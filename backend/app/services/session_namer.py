import re
from typing import Optional
from app.core import settings

AMBIGUOUS_PATTERNS = [
    re.compile(r"^(?:doc|document|scan|file|contract|agreement|test|sample|temp|upload|untitled|page|pdf|draft|new)[\d_\-\s.]*$", re.I),
    re.compile(r"^[0-9a-f]{8,}(?:-[0-9a-f]{4,})*$", re.I),
    re.compile(r"^\d{4,}[\d_\-\s]*$"),
    re.compile(r"^[a-z0-9]{1,3}$", re.I),
]

def is_ambiguous_or_unruly(stem: str) -> bool:
    clean = stem.strip()
    if len(clean) < 4:
        return True
    return any(p.match(clean) for p in AMBIGUOUS_PATTERNS)

def heuristic_session_title(filename: str, session_index: int = 1) -> str:
    if not filename:
        return f"Audit {session_index} – Contract" if session_index > 1 else "Contract Audit Session"

    stem = re.sub(r"\.[^/.]+$", "", filename).strip()

    if is_ambiguous_or_unruly(stem):
        clean_stem = re.sub(r"[_\-]+", " ", stem).strip() or "Contract"
        return f"Audit {session_index} – {clean_stem}" if session_index > 1 else f"Audit – {clean_stem}"

    # Clean noise tokens
    working = re.sub(r"\b(?:v\d+|version\s*\d+|final|draft|signed|executed|docusign|copy|scanned|revised|amended)\b", " ", stem, flags=re.I)
    working = re.sub(r"\b(?:20\d{2}|19\d{2})\b", " ", working)

    segments = [s.strip() for s in re.split(r"[_\-]+", working) if s.strip()]
    if not segments:
        return f"Audit {session_index} – {stem}" if session_index > 1 else f"Audit – {stem}"

    title = " ".join([s[0].upper() + s[1:] if len(s) > 1 else s.upper() for s in segments])
    if session_index > 1:
        return f"{title} (Audit {session_index})"
    return title

async def generate_smart_session_title(filename: str, session_index: int = 1) -> str:
    """
    AI Plugin for automatically and uniquely naming audit chat sessions based on filename.
    """
    stem = re.sub(r"\.[^/.]+$", "", filename or "").strip()
    if is_ambiguous_or_unruly(stem):
        return heuristic_session_title(filename, session_index)

    # Attempt fast LLM inference with fallback
    try:
        if settings.GROQ_API_KEY:
            from app.services.llm_service import GroqLLMService
            llm_service = GroqLLMService()
            llm = llm_service.get_llm(model=settings.FAST_GROQ_MODEL, temperature=0.1, max_tokens=35)
            prompt = (
                "You are an AI assistant that creates concise, professional audit titles for legal contracts. "
                "Given this file name, output a natural legal title (such as 'HarborPeak & Northstar Logistics Agreement' or 'Commercial Office Lease'). "
                "Do NOT include file extensions, version tags, or phrases like 'Audit -'. Return ONLY the title.\n"
                f"Filename: {filename}\nTitle:"
            )
            response = await llm.ainvoke(prompt)
            content = response.content.strip().strip('"').strip("'")
            if content and len(content) > 3 and "\n" not in content and len(content) < 60:
                if session_index > 1:
                    return f"{content} (Audit {session_index})"
                return content
    except Exception:
        pass

    return heuristic_session_title(filename, session_index)
