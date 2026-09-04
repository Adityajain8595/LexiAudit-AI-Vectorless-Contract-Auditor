import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from supabase import Client
from app.core import (
    get_supabase,
    execute_db_query,
    get_current_user,
    check_guardrails,
    redact_pii,
    start_trace,
    flush_telemetry,
    ResourceNotFoundException,
)
from app.schemas.chat import QueryRequest, ChatSessionCreate
from app.services.rag_service import run_rag_direct
from app.services.export_service import generate_session_pdf
from app.services.redis_cache import invalidate_session_tree

router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("/sessions")
async def create_session(payload: ChatSessionCreate, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    session_data = {"user_id": current_user["id"], 'document_id': payload.document_id, "title": payload.title or "Contract Audit Session"}
    res = execute_db_query(supabase.table("chat_sessions").insert(session_data))
    return res.data[0]

@router.get("/sessions-all")
async def list_all_sessions(current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = execute_db_query(supabase.table("chat_sessions").select("*, documents(id, filename)").eq("user_id", current_user["id"]).order("created_at", desc=True))
    return res.data

@router.get("/sessions/{doc_id}")
async def get_doc_sessions(doc_id: str,  current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = execute_db_query(supabase.table("chat_sessions").select("*").eq('document_id', doc_id).eq("user_id", current_user["id"]).order("created_at", desc=True))
    return res.data

@router.patch("/sessions/{session_id}")
async def update_session_title(session_id: str, payload: dict, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    new_title = payload.get("title")
    if not new_title:
        raise HTTPException(status_code=400, detail="Title is required")
    res = execute_db_query(supabase.table("chat_sessions").update({"title": new_title}).eq("id", session_id).eq("user_id", current_user["id"]))
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return res.data[0]

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    sess_res = execute_db_query(supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).single())
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    execute_db_query(supabase.table("chat_messages").delete().eq("session_id", session_id))
    execute_db_query(supabase.table("chat_sessions").delete().eq("id", session_id).eq("user_id", current_user["id"]))

    # Invalidate session-scoped cache in Redis Cloud
    try:
        await invalidate_session_tree(user_id=current_user["id"], session_id=session_id)
    except Exception as e:
        print(f"[RedisCache] Session cache cleanup notice: {e}")

    return {"status": "success", "message": "Session deleted successfully"}

@router.get("/messages/{session_id}")
async def get_session_messages(session_id: str, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    sess_res = execute_db_query(supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).single())
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    res = execute_db_query(supabase.table("chat_messages").select("*").eq('session_id', session_id).order("created_at", desc=False))
    return res.data

@router.post("/query")
async def query_contract_rag(payload: QueryRequest, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    # Safety check
    guard_result = await check_guardrails(payload.query)
    if not guard_result["is_safe"]:
        reason = guard_result.get("reason", "Query blocked by safety policy.")
        return {
            "answer": f"**Safety Notice:** {reason}",
            "cited_nodes": [],
            "suggested_queries": ["What are the core obligations of each party?", "What is the governing law of this agreement?", "What is the liability limitation?"]
        }

    # Fetch document tree & history
    def fetch_session():
        return execute_db_query(supabase.table("chat_sessions").select("*, documents(id, filename, tree_index)").eq("id", payload.session_id).eq("user_id", current_user["id"]).single())

    def fetch_history():
        return execute_db_query(supabase.table("chat_messages").select("sender, content").eq("session_id", payload.session_id).order("created_at", desc=True).limit(6))

    session_res, prior_messages_res = await asyncio.gather(
        asyncio.to_thread(fetch_session),
        asyncio.to_thread(fetch_history)
    )

    if not session_res.data:
        raise ResourceNotFoundException("ChatSession", payload.session_id)

    doc_data = session_res.data["documents"]
    doc_id = doc_data.get("id")
    prior_messages = list(reversed(prior_messages_res.data or []))
    doc_tree = doc_data.get("tree_index") or []

    # Sanitize user query
    sanitized_query, _ = redact_pii(payload.query)

    # Persist user question asynchronously in background
    def save_user_msg():
        try:
            execute_db_query(supabase.table("chat_messages").insert({
                "session_id": payload.session_id,
                "sender": "user",
                "content": sanitized_query
            }))
        except Exception as e:
            print(f"Error saving user message: {e}")

    asyncio.create_task(asyncio.to_thread(save_user_msg))

    # Initialize Langfuse root trace 
    trace = start_trace(
        name="vectorless_rag_query",
        session_id=payload.session_id,
        user_id=current_user["id"],
        metadata={"document_id": doc_id, "doc_title": doc_data.get("filename")}
    )

    # Run single-pass RAG pipeline with trace observation
    result = await run_rag_direct(query=sanitized_query, tree=doc_tree, chat_history=prior_messages, trace=trace)

    trace_id = getattr(trace, "id", None)
    if trace_id:
        result["trace_id"] = trace_id

    # Persist assistant message asynchronously
    def save_assistant_msg():
        try:
            execute_db_query(supabase.table("chat_messages").insert({
                "session_id": payload.session_id,
                "sender": "assistant",
                "content": result.get("answer", ""),
                "cited_nodes": result.get("cited_nodes", [])
            }))
        except Exception as db_err:
            print(f"Error persisting assistant message: {db_err}")

    asyncio.create_task(asyncio.to_thread(save_assistant_msg))
    
    # Flush telemetry events to Langfuse
    flush_telemetry()

    return result

@router.get("/export/{session_id}")
async def export_session_pdf(session_id: str, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    session_res = supabase.table("chat_sessions").select("*, documents(filename, risk_analysis, missing_clauses)").eq("id", session_id).eq("user_id", current_user["id"]).single().execute()
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    doc_info = session_res.data.get("documents") or {}
    messages_res = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=False).execute()
    
    class MessageObj:
        def __init__(self, d):
            self.sender = d["sender"]
            self.content = d["content"]
            self.cited_nodes = d.get("cited_nodes") or []

    msg_objects = [MessageObj(m) for m in (messages_res.data or [])]
    pdf_buffer = generate_session_pdf(
        session_title=session_res.data["title"],
        doc_name=doc_info.get("filename", "Contract Document"),
        messages=msg_objects,
        risk_analysis=doc_info.get("risk_analysis", []),
        missing_clauses=doc_info.get("missing_clauses", [])
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Audit_Report_{session_id[:8]}.pdf"}
    )