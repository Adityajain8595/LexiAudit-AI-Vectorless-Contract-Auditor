import os
import time
import tempfile
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response
from supabase import Client
from app.core import get_supabase, get_current_user
from app.services.pageindex_service import process_pdf
from app.services.audit_service import automatic_audit
from app.services.redis_cache import cache_contract_tree, invalidate_doc_tree
from app.schemas.contract import DocumentUploadResponse

router = APIRouter(prefix="/api/documents", tags=['Documents'])

BUCKET_NAME = "contracts"

def ensure_bucket(supabase: Client, name: str = BUCKET_NAME):
    try:
        supabase.storage.get_bucket(name)
    except Exception:
        try:
            supabase.storage.create_bucket(name, options={"public": True})
        except Exception:
            pass

# Upload and parse contract document
@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Parse tree using PageIndex
    temp_path = None
    doc_id = f"doc_{int(time.time())}"
    tree_nodes = []
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            temp_path = tmp.name

        parsed_id, parsed_nodes = await process_pdf(temp_path)
        if parsed_id:
            doc_id = parsed_id
        if parsed_nodes:
            tree_nodes = parsed_nodes
    except Exception:
        tree_nodes = [
            {
                "node_id": "sec-1",
                "title": file.filename.replace(".pdf", "").replace("_", " ").title(),
                "page_index": 1,
                "summary": "Uploaded legal contract document.",
                "text": "Full document content available for legal auditing."
            }
        ]
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass

    # Run automated contract compliance audit
    try:
        audit_res = await automatic_audit(tree_nodes, doc_id=doc_id, user_id=user["id"])
    except Exception:
        audit_res = {"risk_analysis": [], "missing_clauses": [], "suggested_queries": []}

    # Store PDF in Supabase bucket
    ensure_bucket(supabase, BUCKET_NAME)
    storage_path = f"{user['id']}/{doc_id}.pdf"

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception:
        pass

    doc_payload = {
        "user_id": user["id"],
        "filename": file.filename,
        "storage_path": storage_path,
        "pageindex_doc_id": doc_id,
        "tree_index": tree_nodes,
        "risk_analysis": audit_res.get("risk_analysis", []),
        "missing_clauses": audit_res.get("missing_clauses", []),
        "suggested_queries": audit_res.get("suggested_queries", [])
    }

    insert_res = supabase.table("documents").insert(doc_payload).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save document metadata.")

    saved_doc = insert_res.data[0]

    # Pre-warm Redis tree cache
    try:
        await cache_contract_tree(user_id=user["id"], doc_id=saved_doc["id"], tree=tree_nodes)
        if saved_doc.get("pageindex_doc_id"):
            await cache_contract_tree(user_id=user["id"], doc_id=saved_doc["pageindex_doc_id"], tree=tree_nodes)
    except Exception:
        pass

    return {
        "doc_id": saved_doc["id"],
        "pageindex_doc_id": saved_doc["pageindex_doc_id"],
        "filename": saved_doc["filename"],
        "tree_index": saved_doc["tree_index"],
        "risk_analysis": saved_doc["risk_analysis"],
        "missing_clauses": saved_doc["missing_clauses"],
        "suggested_queries": saved_doc["suggested_queries"]
    }

# List all user documents
@router.get("/")
async def list_documents(user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = supabase.table("documents").select(
        "id, filename, created_at, suggested_queries, risk_analysis, missing_clauses"
    ).eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return res.data

# Serve stored PDF content
@router.get("/{doc_id}/file")
async def serve_document(
    doc_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    res = supabase.table("documents").select("id, storage_path, pageindex_doc_id, filename, user_id").eq("id", doc_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    if res.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    filename = res.data.get("filename", "contract.pdf")
    stored_path = res.data.get("storage_path")
    paths = [stored_path, f"{user['id']}/{doc_id}.pdf", f"{user['id']}/{filename}"]

    file_bytes = None
    for p in paths:
        if not p:
            continue
        try:
            file_bytes = supabase.storage.from_(BUCKET_NAME).download(p)
            if file_bytes:
                break
        except Exception:
            continue

    if not file_bytes:
        raise HTTPException(status_code=404, detail="Contract file not found in storage.")

    return Response(
        content=file_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{filename}\"", "Cache-Control": "public, max-age=86400"}
    )

# Retrieve single document metadata
@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = supabase.table("documents").select("*").eq("id", doc_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    if res.data.get("user_id") and res.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")
    return res.data

# Delete document and sessions
@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    doc_res = supabase.table("documents").select("id, user_id, storage_path, pageindex_doc_id").eq("id", doc_id).single().execute()
    if not doc_res.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc_res.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    storage_path = doc_res.data.get("storage_path")
    if storage_path:
        try:
            supabase.storage.from_(BUCKET_NAME).remove([storage_path])
        except Exception:
            pass

    sess_res = supabase.table("chat_sessions").select("id").eq("document_id", doc_id).eq("user_id", user["id"]).execute()
    for s in (sess_res.data or []):
        supabase.table("chat_messages").delete().eq("session_id", s["id"]).execute()
    supabase.table("chat_sessions").delete().eq("document_id", doc_id).eq("user_id", user["id"]).execute()
    supabase.table("documents").delete().eq("id", doc_id).eq("user_id", user["id"]).execute()

    try:
        await invalidate_doc_tree(user_id=user["id"], doc_id=doc_id)
    except Exception:
        pass

    return {"status": "success", "message": "Document deleted successfully"}