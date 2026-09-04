# LexiAudit AI — Backend Engine

FastAPI backend engine for **LexiAudit AI**, providing Vectorless RAG via PageIndex, Groq LLMs (openai/gpt-oss-120b & openai/gpt-oss-20b), deterministic PII sanitization, Groq/Llama-Guard security guardrails, and Langfuse LLMOps telemetry.

---

## Directory Layout

```
backend/
├── app/
│   ├── core/         # Config, Database, Guardrails, Prompts, Security, Telemetry
│   ├── routers/      # FastAPI API route handlers (auth, doc, chat, eval)
│   ├── schemas/      # Pydantic data schemas
│   ├── services/     # Core business logic (RAG, audit, LLM, pageindex, export)
│   ├── __init__.py
│   └── main.py       # FastAPI application entry point
├── scripts/
│   └── setup_env.py      # Diagnostic & subsystem connectivity tests
├── tests/            # Pytest test suite (security, guardrails, RAG, eval)
├── pytest.ini        # Pytest configuration
├── requirements.txt  # Python package dependencies
└── README.md
```

---

## Setup & Running Locally

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Configuration
Ensure your `.env` file exists with required credentials in the project root or inside `backend/`:
```env
GROQ_API_KEY=...
PAGEINDEX_API_KEY=...
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```

### 3. Run FastAPI Server
From the `backend/` directory:
```bash
uvicorn app.main:app --reload --port 8000
```
Or from the project root:
```bash
uvicorn backend.app.main:app --reload --port 8000
```

### 4. Run Diagnostics
```bash
python scripts/setup_env.py
```

### 5. Run Unit & Security Tests
```bash
pytest
```
