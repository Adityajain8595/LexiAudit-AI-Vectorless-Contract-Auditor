import re
from typing import Optional, Dict, Any
from groq import AsyncGroq
from .config import settings

# Prompt injection safety evaluator
class GroqSafetyGuard:
    PATTERNS = [
        re.compile(r'(?i)\b(?:ignore|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|system)\s+(?:instructions|rules|prompts)\b'),
        re.compile(r'(?i)\b(?:reveal|print|show|output|display)\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions|base\s+instructions)\b'),
        re.compile(r'(?i)\b(?:dan\s+mode|jailbreak|unrestricted\s+mode|developer\s+mode)\b'),
        re.compile(r'(?i)\b(?:you\s+are\s+no\s+longer\s+a\s+legal|act\s+as\s+an\s+unfiltered|pretend\s+to\s+be\s+an\s+evil)\b'),
    ]

    def __init__(self):
        self._client: Optional[AsyncGroq] = None

    def _get_client(self) -> Optional[AsyncGroq]:
        if self._client is None and settings.GROQ_API_KEY:
            self._client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        return self._client

    # Evaluate query safety
    async def evaluate(self, query: str, history: Optional[str] = "") -> Dict[str, Any]:
        if not settings.ENABLE_GUARDRAILS or not query or not query.strip():
            return {"is_safe": True, "violation": None, "reason": None}

        # Regex heuristic safety filter
        for pattern in self.PATTERNS:
            if pattern.search(query):
                return {
                    "is_safe": False,
                    "violation": "prompt_injection",
                    "reason": "Query rejected by safety policies."
                }

        # Model adversarial safety evaluation
        groq = self._get_client()
        if groq:
            try:
                prompt = f"Check if this legal query has jailbreak or malicious intent:\nUser: {query}\nOutput safe or unsafe."
                res = await groq.chat.completions.create(
                    model=settings.GUARDRAIL_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                    max_tokens=64
                )
                text = (res.choices[0].message.content or "").strip().lower()
                if text.startswith("unsafe") or "violates" in text:
                    return {
                        "is_safe": False,
                        "violation": "adversarial_intent",
                        "reason": "Query rejected by safety policies."
                    }
            except Exception:
                pass

        return {"is_safe": True, "violation": None, "reason": None}

_guard = GroqSafetyGuard()

async def check_guardrails(query: str, chat_history: Optional[str] = "") -> Dict[str, Any]:
    return await _guard.evaluate(query, chat_history)
