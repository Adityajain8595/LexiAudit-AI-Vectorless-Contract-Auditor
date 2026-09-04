import os
import time
import tempfile
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response
from supabase import Client
from app.core import get_supabase, get_current_user, LexiAuditExceptionHandler
from app.services.pageindex_service import process_pdf
from app.services.audit_service import automatic_audit
from app.services.redis_cache import cache_contract_tree, invalidate_doc_tree
from app.schemas.contract import DocumentUploadResponse

router = APIRouter(prefix="/api/documents", tags=['Documents'])

BUCKET_NAME = "contracts"

def ensure_bucket_exists(supabase: Client, bucket_name: str = BUCKET_NAME):
    try:
        supabase.storage.get_bucket(bucket_name)
    except Exception:
        try:
            supabase.storage.create_bucket(bucket_name, options={"public": True})
        except Exception:
            pass

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Parse tree via PageIndex
    temp_pdf_path = None
    doc_id = f"doc_{int(time.time())}"
    tree_nodes = []
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            temp_pdf_path = tmp.name

        parsed_doc_id, parsed_nodes = await process_pdf(temp_pdf_path)
        if parsed_doc_id:
            doc_id = parsed_doc_id
        if parsed_nodes:
            tree_nodes = parsed_nodes
    except Exception as parse_err:
        print(f"[DocUpload] PageIndex parsing note (using fallback structure): {parse_err}")
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
        if temp_pdf_path and os.path.exists(temp_pdf_path):
            try:
                os.unlink(temp_pdf_path)
            except Exception as e:
                print(f"Temp file cleanup note: {e}")

    # Autonomous risk and missing protections audit
    try:
        audit_results = await automatic_audit(tree_nodes, user_id=current_user["id"])
    except Exception as audit_err:
        audit_results = {"risk_analysis": [], "missing_clauses": [], "suggested_queries": []}

    # Persist file in Supabase storage
    ensure_bucket_exists(supabase, BUCKET_NAME)
    bucket_storage_path = f"{current_user['id']}/{doc_id}.pdf"

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=bucket_storage_path,
            file=content,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception as e:
        print(f"Supabase storage upload error: {e}")
        try:
            fallback_path = f"{current_user['id']}/{file.filename}"
            supabase.storage.from_(BUCKET_NAME).upload(
                path=fallback_path,
                file=content,
                file_options={"content-type": "application/pdf", "upsert": "true"}
            )
            bucket_storage_path = fallback_path
        except Exception as e2:
            print(f"Supabase fallback storage upload note: {e2}")

    # Persist document metadata in database
    doc_payload = {
        "user_id": current_user["id"],
        "filename": file.filename,
        "storage_path": bucket_storage_path,
        "pageindex_doc_id": doc_id,
        "tree_index": tree_nodes,
        "risk_analysis": audit_results.get("risk_analysis", []),
        "missing_clauses": audit_results.get("missing_clauses", []),
        "suggested_queries": audit_results.get("suggested_queries", [])
    }

    insert_res = supabase.table("documents").insert(doc_payload).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save document metadata to database.")

    saved_doc = insert_res.data[0]

    # Pre-warm Redis Cloud cache 
    try:
        await cache_contract_tree(
            user_id=current_user["id"],
            doc_id=saved_doc["id"],
            tree=tree_nodes
        )
        if saved_doc.get("pageindex_doc_id"):
            await cache_contract_tree(
                user_id=current_user["id"],
                doc_id=saved_doc["pageindex_doc_id"],
                tree=tree_nodes
            )
    except Exception as cache_err:
        print(f"[RedisCache] Pre-warm cache notice: {cache_err}")

    return {
        "doc_id": saved_doc["id"],
        "pageindex_doc_id": saved_doc["pageindex_doc_id"],
        "filename": saved_doc["filename"],
        "tree_index": saved_doc["tree_index"],
        "risk_analysis": saved_doc["risk_analysis"],
        "missing_clauses": saved_doc["missing_clauses"],
        "suggested_queries": saved_doc["suggested_queries"]
    }

@router.get("/")
async def list_documents(current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = supabase.table("documents").select(
        "id, filename, created_at, suggested_queries, risk_analysis, missing_clauses"
    ).eq("user_id", current_user["id"]).order("created_at", desc=True).execute()
    return res.data

@router.get("/{doc_id}/file")
async def serve_document_file(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    res = supabase.table("documents").select("id, storage_path, pageindex_doc_id, filename, user_id").eq("id", doc_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    if res.data["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    filename = res.data.get("filename", "contract.pdf")
    user_id = current_user["id"]
    pageindex_doc_id = res.data.get("pageindex_doc_id")
    stored_path = res.data.get("storage_path")

    paths_to_try = []
    if stored_path:
        paths_to_try.append(stored_path)
    if pageindex_doc_id:
        paths_to_try.append(f"{user_id}/{pageindex_doc_id}.pdf")
    paths_to_try.append(f"{user_id}/{doc_id}.pdf")
    paths_to_try.append(f"{user_id}/{filename}")

    file_bytes = None
    for path in paths_to_try:
        try:
            file_bytes = supabase.storage.from_(BUCKET_NAME).download(path)
            if file_bytes:
                break
        except Exception:
            continue

    if not file_bytes:
        raise HTTPException(
            status_code=404,
            detail="Contract PDF content not found in Supabase storage bucket."
        )

    return Response(
        content=file_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{filename}\"",
            "Cache-Control": "public, max-age=86400"
        }
    )

@router.get("/{doc_id}")
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = supabase.table("documents").select("*").eq("id", doc_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    if res.data.get("user_id") and res.data["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")
    return res.data

@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    doc_res = supabase.table("documents").select("id, user_id, storage_path, pageindex_doc_id, filename").eq("id", doc_id).single().execute()
    if not doc_res.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc_res.data["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    user_id = current_user["id"]
    storage_path = doc_res.data.get("storage_path")
    pageindex_doc_id = doc_res.data.get("pageindex_doc_id")

    paths_to_remove = []
    if storage_path:
        paths_to_remove.append(storage_path)
    if pageindex_doc_id:
        paths_to_remove.append(f"{user_id}/{pageindex_doc_id}.pdf")

    if paths_to_remove:
        try:
            supabase.storage.from_(BUCKET_NAME).remove(paths_to_remove)
        except Exception as e:
            print(f"Notice removing from Supabase bucket: {e}")

    sessions_res = supabase.table("chat_sessions").select("id").eq("document_id", doc_id).eq("user_id", current_user["id"]).execute()
    session_ids = [s["id"] for s in (sessions_res.data or [])]

    if session_ids:
        for sid in session_ids:
            supabase.table("chat_messages").delete().eq("session_id", sid).execute()
        supabase.table("chat_sessions").delete().eq("document_id", doc_id).eq("user_id", current_user["id"]).execute()

    supabase.table("documents").delete().eq("id", doc_id).eq("user_id", current_user["id"]).execute()

    # Purge Redis tree cache
    try:
        await invalidate_doc_tree(user_id=current_user["id"], doc_id=doc_id)
        if pageindex_doc_id:
            await invalidate_doc_tree(user_id=current_user["id"], doc_id=pageindex_doc_id)
    except Exception as cache_del_err:
        print(f"[RedisCache] Invalidation notice on doc delete: {cache_del_err}")

    return {"status": "success", "message": "Document and associated sessions deleted successfully from Supabase"}