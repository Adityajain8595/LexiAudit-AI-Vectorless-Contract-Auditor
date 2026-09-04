# LexiAudit AI — Vectorless Legal Contract Auditor

LexiAudit AI is an enterprise legal contract auditing platform. It features vectorless tree-based RAG via PageIndex, Groq-powered high-speed LLM inference (`openai/gpt-oss-120b` and `openai/gpt-oss-20b`), deterministic PII sanitization, Llama-Guard security guardrails, AES-256-GCM encrypted Redis caching, and Langfuse LLMOps telemetry.

---

## Key Features

- **Vectorless Hierarchical RAG**: Navigates hierarchical contract section trees generated via PageIndex without vector embedding loss or chunk boundary issues.
- **Autonomous Legal Audit**: Automatically scans uploaded contract PDFs for indemnification caps, liability exposure, termination clauses, missing protective boilerplate, and risks.
- **Langfuse Telemetry & Evaluation**: Full LLMOps tracing with root trace user and session tracking, separated context precision & context recall evaluation, faithfulness hallucination detection, and answer relevancy scoring.
- **Security & Guardrails**: Deterministic Regex PII Sanitizer (masking SSNs, credit cards, emails, phone numbers, API keys) and Groq Llama-Guard safety checks.
- **Encrypted Redis Tree Caching**: Upstash Redis caching protected by AES-256-GCM encryption for ultra-fast section retrieval.
- **PDF Report Generation**: Instant export of legal audit summaries and chat session transcripts into formatted PDF reports.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │    React + Vite Frontend  │
                          │   (Tailwind, Framer Motion)│
                          └─────────────┬─────────────┘
                                        │ API Requests (Port 8080 -> 8000)
                                        ▼
                          ┌───────────────────────────┐
                          │     FastAPI Backend       │
                          └──────┬─────────────┬──────┘
                                 │             │
              ┌──────────────────┴─┐         ┌─┴──────────────────┐
              │ PageIndex PDF Tree │         │   Groq LLM Engine  │
              └────────────────────┘         │ (gpt-oss-120b/20b) │
                                             └────────────────────┘
              ┌────────────────────┐         ┌────────────────────┐
              │  Upstash Redis     │         │ Langfuse Telemetry │
              │ (AES-256-GCM Cache)│         │ (User & Session)   │
              └────────────────────┘         └────────────────────┘
```

---

## Project Structure

```
Legal-Contract-Auditor/
├── backend/
│   ├── app/
│   │   ├── core/         # Telemetry, Security, Guardrails, Prompts, Config
│   │   ├── routers/      # FastAPI endpoints (chat, doc, eval, auth)
│   │   ├── schemas/      # Pydantic data schemas
│   │   ├── services/     # RAG, Audit, LLM, PageIndex, Evaluation, Redis
│   │   └── main.py       # FastAPI application entry point
│   ├── scripts/          # Diagnostics, env verification & evaluation scripts
│   ├── tests/            # Pytest suite (unit, integration, security, eval)
│   └── requirements.txt  # Python backend dependencies
├── frontend/
│   ├── src/              # React TypeScript workspace UI, components, pages
│   ├── package.json      # Node dependencies and scripts
│   └── vite.config.ts    # Vite server configuration & API proxy
└── README.md
```

---

## Environment Setup

### Backend (.env)

Create a `backend/.env` file (refer to `backend/.env.example`):

```env
GROQ_API_KEY=your_groq_api_key
PRIMARY_GROQ_MODEL=openai/gpt-oss-120b
FAST_GROQ_MODEL=openai/gpt-oss-20b
SUPABASE_URL=https://your-supabase.supabase.co
SUPABASE_KEY=your_supabase_key
REDIS_URL=rediss://default:your_password@your-endpoint.upstash.io:6379
REDIS_AES_SECRET_KEY=your_32_byte_aes_key
LANGFUSE_PUBLIC_KEY=pk-lf-your_public_key
LANGFUSE_SECRET_KEY=sk-lf-your_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com
PAGEINDEX_API_KEY=your_pageindex_key
```

### Frontend (.env)

Create a `frontend/.env` file (refer to `frontend/.env.example`):

```env
VITE_APP_TITLE=LexiAudit AI
VITE_SUPABASE_URL=https://your-supabase.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Getting Started

### 1. Backend Server

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Development Server

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:8080` with API requests proxied to the backend at `http://localhost:8000`.

---

## Testing & Verification

Run the automated backend test suite:

```bash
cd backend
pytest tests/ -v
```

Run environmental subsystem diagnostics:

```bash
cd backend
python scripts/setup_env.py
```

---

## GitHub Deployment Checklist

- [x] All `.env` files and sensitive API keys excluded via `.gitignore`.
- [x] `.env.example` templates created for backend and frontend.
- [x] Langfuse telemetry updated with user and session tracking.
- [x] Prompt registry enhanced with separate precision and recall prompts.
- [x] Codebase cleaned of AI-ish comments and redundant files.
"# LexiAudit-AI-Vectorless-Contract-Auditor" 
