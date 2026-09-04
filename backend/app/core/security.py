import re
from typing import Tuple, Dict, Any, List
from .config import settings

class PIISanitizer:
    """
    High-performance, zero-memory deterministic PII sanitizer.
    Redacts sensitive personal numbers, financial records, API keys, and credentials
    while preserving contract party names, terms, and legal clauses.
    """
    PATTERNS = [
        # Email Addresses
        (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b'), "<EMAIL>"),
        # Credit / Debit Cards (13 to 19 digits)
        (re.compile(r'\b(?:\d{4}[-\s]?){3}\d{1,7}\b'), "<CREDIT_CARD>"),
        # International Bank Account Numbers (IBAN)
        (re.compile(r'\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b'), "<IBAN>"),
        # US SSN & National IDs
        (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), "<NATIONAL_ID>"),
        (re.compile(r'\b[A-CEGHJ-PR-TW-Z]{2}\s?[0-9]{6}\s?[A-D]{1}\b', re.IGNORECASE), "<NATIONAL_ID>"),
        (re.compile(r'\b[2-9]{1}[0-9]{3}[-\s][0-9]{4}[-\s][0-9]{4}\b'), "<NATIONAL_ID>"),
        # Tax IDs
        (re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b'), "<TAX_ID>"),
        (re.compile(r'\b\d{2}-\d{7}\b'), "<TAX_ID>"),
        # Phone Numbers (International & Local formats)
        (re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b'), "<PHONE>"),
        # IP Addresses
        (re.compile(r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b'), "<IP_ADDRESS>"),
        # API Keys & Secrets (AWS, JWT, Generic Secret Tokens)
        (re.compile(r'\b(?:AKIA|ASIA)[0-9A-Z]{16}\b'), "<API_KEY>"),
        (re.compile(r'\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b'), "<JWT_TOKEN>"),
    ]

    def sanitize(self, text: str) -> Tuple[str, Dict[str, Any]]:
        if not settings.ENABLE_PII_REDACTION or not text or not text.strip():
            return text, {"redacted": False, "count": 0, "entities": []}

        entities_detected: List[str] = []
        sanitized_text = text
        total_count = 0

        for pattern, replacement in self.PATTERNS:
            matches = pattern.findall(sanitized_text)
            if matches:
                total_count += len(matches)
                entities_detected.append(replacement.strip("<>"))
                sanitized_text = pattern.sub(replacement, sanitized_text)

        is_redacted = total_count > 0

        return sanitized_text, {
            "redacted": is_redacted,
            "engine": "deterministic_regex",
            "count": total_count,
            "entities": list(set(entities_detected))
        }

_sanitizer_instance = PIISanitizer()

def redact_pii(text: str) -> Tuple[str, Dict[str, Any]]:
    return _sanitizer_instance.sanitize(text)
