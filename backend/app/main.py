from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import doc_router, chat_router, auth_router, eval_router
from app.core import LexiAuditExceptionHandler
from app.services.redis_cache import _cache_service

app = FastAPI(
    title="LexiAudit AI — Intelligent Legal Contract Auditor",
    version="1.0.0",
    description="Enterprise Vectorless RAG engine with deterministic PII sanitization, guardrails, and Langfuse telemetry."
)

LexiAuditExceptionHandler.register_app_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lexiaudit-ai.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*",
)

app.include_router(auth_router.router)
app.include_router(doc_router.router)
app.include_router(chat_router.router)
app.include_router(eval_router.router)

@app.get("/health")
async def health_check():
    redis_status = "unreachable"
    try:
        client = await _cache_service._get_redis()
        if client:
            ping_ok = await client.ping()
            if ping_ok:
                redis_status = "connected"
    except Exception:
        redis_status = "offline"

    return {
        "status": "healthy",
        "redis_cache": redis_status,
        "engine": "PageIndex-Vectorless",
        "stack": "Groq + Supabase + PageIndex + Redis"
    }