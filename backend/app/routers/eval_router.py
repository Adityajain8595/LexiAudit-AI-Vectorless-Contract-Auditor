from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.core import get_supabase, get_current_user, get_langfuse, settings
from app.services.eval_service import evaluate_rag_turn

router = APIRouter(prefix="/api/eval", tags=["Evaluation & LLMOps"])

# Observability health endpoint
@router.get("/status")
async def get_eval_status(user: dict = Depends(get_current_user)):
    connected = get_langfuse() is not None
    return {
        "status": "operational",
        "pii_redaction_enabled": settings.ENABLE_PII_REDACTION,
        "guardrails_enabled": settings.ENABLE_GUARDRAILS,
        "guardrail_model": settings.GUARDRAIL_MODEL,
        "langfuse_observability": "connected" if connected else "offline_fallback",
        "primary_model": settings.PRIMARY_GROQ_MODEL,
        "fast_model": settings.FAST_GROQ_MODEL,
    }

# Session conversation evaluation
@router.post("/session/{session_id}")
async def evaluate_session(
    session_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    session_res = supabase.table("chat_sessions").select("*, documents(tree_index)").eq("id", session_id).eq("user_id", user["id"]).single().execute()
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    doc_tree = session_res.data["documents"]["tree_index"]
    msg_res = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=False).execute()
    messages = msg_res.data or []

    # Score each question-answer dialogue pair
    reports = []
    for i in range(len(messages) - 1):
        curr = messages[i]
        nxt = messages[i + 1]
        if curr.get("sender") == "user" and nxt.get("sender") == "assistant":
            report = await evaluate_rag_turn(
                query=curr.get("content", ""),
                retrieved_nodes=nxt.get("cited_nodes", []),
                tree=doc_tree,
                generated_answer=nxt.get("content", ""),
                session_id=session_id
            )
            reports.append(report.model_dump())

    return {
        "session_id": session_id,
        "evaluated_turns": len(reports),
        "reports": reports
    }
