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

# Create new chat session
@router.post("/sessions")
async def create_session(payload: ChatSessionCreate, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    title = payload.title
    if not title or title in ("Contract Audit Session", "auto", ""):
        try:
            doc_res = execute_db_query(supabase.table("documents").select("filename").eq("id", payload.document_id).single())
            if doc_res.data and doc_res.data.get("filename"):
                sess_res = execute_db_query(supabase.table("chat_sessions").select("id").eq("document_id", payload.document_id).eq("user_id", user["id"]))
                count = len(sess_res.data or []) + 1
                from app.services.session_namer import generate_smart_session_title
                title = await generate_smart_session_title(doc_res.data["filename"], session_index=count)
        except Exception:
            title = title or "Contract Audit Session"

    data = {"user_id": user["id"], "document_id": payload.document_id, "title": title}
    res = execute_db_query(supabase.table("chat_sessions").insert(data))
    return res.data[0]

# Suggest AI session title
@router.post("/suggest-title")
async def suggest_title(payload: dict, user: dict = Depends(get_current_user)):
    filename = payload.get("filename", "")
    session_index = payload.get("session_index", 1)
    from app.services.session_namer import generate_smart_session_title
    title = await generate_smart_session_title(filename, session_index=session_index)
    return {"title": title}

# List all user sessions
@router.get("/sessions-all")
async def list_sessions(user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = execute_db_query(supabase.table("chat_sessions").select("*, documents(id, filename)").eq("user_id", user["id"]).order("created_at", desc=True))
    return res.data

# List sessions for document
@router.get("/sessions/{doc_id}")
async def get_sessions(doc_id: str, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    res = execute_db_query(supabase.table("chat_sessions").select("*").eq("document_id", doc_id).eq("user_id", user["id"]).order("created_at", desc=True))
    return res.data

# Update session title
@router.patch("/sessions/{session_id}")
async def update_session(session_id: str, payload: dict, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    new_title = payload.get("title")
    if not new_title:
        raise HTTPException(status_code=400, detail="Title is required")
    res = execute_db_query(supabase.table("chat_sessions").update({"title": new_title}).eq("id", session_id).eq("user_id", user["id"]))
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return res.data[0]

# Delete session and messages
@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    check_res = execute_db_query(supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", user["id"]).single())
    if not check_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    execute_db_query(supabase.table("chat_messages").delete().eq("session_id", session_id))
    execute_db_query(supabase.table("chat_sessions").delete().eq("id", session_id).eq("user_id", user["id"]))

    try:
        await invalidate_session_tree(user_id=user["id"], session_id=session_id)
    except Exception:
        pass

    return {"status": "success", "message": "Session deleted successfully"}

# Retrieve messages for session
@router.get("/messages/{session_id}")
async def get_messages(session_id: str, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    check_res = execute_db_query(supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", user["id"]).single())
    if not check_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    res = execute_db_query(supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=False))
    return res.data

# Contract query execution endpoint
@router.post("/query")
async def query_contract_rag(payload: QueryRequest, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    # Safety guardrails query evaluation
    guard_res = await check_guardrails(payload.query)
    if not guard_res["is_safe"]:
        reason = guard_res.get("reason", "Query blocked by safety policy.")
        return {
            "answer": f"**Safety Notice:** {reason}",
            "cited_nodes": [],
            "suggested_queries": ["What are the core obligations?", "What is governing law?", "What is liability limit?"]
        }

    # Fetch document tree and history
    def fetch_session():
        return execute_db_query(supabase.table("chat_sessions").select("*, documents(id, filename, tree_index)").eq("id", payload.session_id).eq("user_id", user["id"]).single())

    def fetch_history():
        return execute_db_query(supabase.table("chat_messages").select("sender, content").eq("session_id", payload.session_id).order("created_at", desc=True).limit(6))

    sess_res, hist_res = await asyncio.gather(
        asyncio.to_thread(fetch_session),
        asyncio.to_thread(fetch_history)
    )

    if not sess_res.data:
        raise ResourceNotFoundException("ChatSession", payload.session_id)

    doc_data = sess_res.data["documents"]
    doc_id = doc_data.get("id")
    prior_msgs = list(reversed(hist_res.data or []))
    doc_tree = doc_data.get("tree_index") or []

    clean_query, _ = redact_pii(payload.query)

    # Persist user message asynchronously
    def save_user():
        try:
            execute_db_query(supabase.table("chat_messages").insert({
                "session_id": payload.session_id,
                "sender": "user",
                "content": clean_query
            }))
        except Exception:
            pass

    asyncio.create_task(asyncio.to_thread(save_user))

    # Initialize Langfuse telemetry trace
    trace = start_trace(
        name="vectorless_rag_query",
        session_id=payload.session_id,
        user_id=user["id"],
        metadata={"document_id": doc_id, "doc_title": doc_data.get("filename")}
    )

    # Execute vectorless RAG search
    res = await run_rag_direct(query=clean_query, tree=doc_tree, chat_history=prior_msgs, trace=trace)

    trace_id = getattr(trace, "trace_id", getattr(trace, "id", None))
    if trace_id:
        res["trace_id"] = trace_id

    # Persist assistant response asynchronously
    def save_assistant():
        try:
            execute_db_query(supabase.table("chat_messages").insert({
                "session_id": payload.session_id,
                "sender": "assistant",
                "content": res.get("answer", ""),
                "cited_nodes": res.get("cited_nodes", [])
            }))
        except Exception:
            pass

    asyncio.create_task(asyncio.to_thread(save_assistant))

    if hasattr(trace, "end"):
        trace.end(output={"answer": res.get("answer", "")[:500], "nodes": len(res.get("cited_nodes", []))})

    # Background automated LLM evaluation
    async def run_turn_eval():
        try:
            from app.services.eval_service import evaluate_rag_turn
            await evaluate_rag_turn(
                query=clean_query,
                retrieved_nodes=res.get("cited_nodes", []),
                tree=doc_tree,
                generated_answer=res.get("answer", ""),
                trace_id=trace_id,
                session_id=payload.session_id
            )
            flush_telemetry()
        except Exception:
            pass

    asyncio.create_task(run_turn_eval())
    flush_telemetry()

    return res

# Export audit dialogue report
@router.get("/export/{session_id}")
async def export_session_pdf(session_id: str, user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase)):
    sess_res = supabase.table("chat_sessions").select("*, documents(filename, risk_analysis, missing_clauses)").eq("id", session_id).eq("user_id", user["id"]).single().execute()
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    doc_info = sess_res.data.get("documents") or {}
    msg_res = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=False).execute()

    class MessageObj:
        def __init__(self, d):
            self.sender = d["sender"]
            self.content = d["content"]
            self.cited_nodes = d.get("cited_nodes") or []

    msg_objs = [MessageObj(m) for m in (msg_res.data or [])]
    pdf_buf = generate_session_pdf(
        session_title=sess_res.data["title"],
        doc_name=doc_info.get("filename", "Contract Document"),
        messages=msg_objs,
        risk_analysis=doc_info.get("risk_analysis", []),
        missing_clauses=doc_info.get("missing_clauses", [])
    )

    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Audit_Report_{session_id[:8]}.pdf"}
    )