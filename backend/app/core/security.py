import re
from typing import Tuple, Dict, Any, List
from .config import settings
try:
    from presidio_analyzer import AnalyzerEngine
    from presidio_anonymizer import AnonymizerEngine
except ImportError:
    AnalyzerEngine = None  # type: ignore
    AnonymizerEngine = None  # type: ignore

class PIISanitizer:
    """
    Sanitizes personal identifiable numbers, financial records, and confidential credentials
    while preserving contract party names, organizations, and legal jurisdictions.
    """
    PATTERNS = [
        # Email Addresses
        (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'), "<EMAIL>"),
        # Credit / Debit Cards (13 to 19 digits)
        (re.compile(r'\b(?:\d{4}[-\s]?){3}\d{1,7}\b'), "<CREDIT_CARD>"),
        # International Bank Account Numbers (IBAN)
        (re.compile(r'\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b'), "<IBAN>"),
        # SSN & National IDs
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
    ]

    PRESIDIO_ENTITIES = [
        "EMAIL_ADDRESS",
        "PHONE_NUMBER",
        "CREDIT_CARD",
        "CRYPTO",
        "IBAN_CODE",
        "US_SSN",
        "US_PASSPORT",
        "US_DRIVER_LICENSE",
        "UK_NHS",
        "SG_NRIC_FIN",
        "AU_TFN",
        "AU_MEDICARE",
        "IP_ADDRESS"
    ]

    def __init__(self):
        self._analyzer = None
        self._anonymizer = None
        self._presidio_attempted = False
        self._presidio_loaded = False

    def _ensure_presidio(self):
        if self._presidio_attempted:
            return
        self._presidio_attempted = True
        if AnalyzerEngine is not None and AnonymizerEngine is not None:
            try:
                self._analyzer = AnalyzerEngine()
                self._anonymizer = AnonymizerEngine()
                self._presidio_loaded = True
            except Exception:
                self._presidio_loaded = False

    def sanitize(self, text: str) -> Tuple[str, Dict[str, Any]]:
        if not settings.ENABLE_PII_REDACTION or not text or not text.strip():
            return text, {"redacted": False, "count": 0, "entities": []}

        entities_detected: List[str] = []
        sanitized_text = text
        total_count = 0
        engines_used = []

        # Presidio Named Entity Recognition & Anonymization
        self._ensure_presidio()
        if self._presidio_loaded and self._analyzer and self._anonymizer:
            try:
                results = self._analyzer.analyze(
                    text=sanitized_text,
                    language="en",
                    entities=self.PRESIDIO_ENTITIES
                )
                if results:
                    total_count += len(results)
                    entities_detected.extend([r.entity_type for r in results])
                    anonymized_result = self._anonymizer.anonymize(text=sanitized_text, analyzer_results=results)
                    sanitized_text = anonymized_result.text
                    engines_used.append("presidio")
            except Exception:
                pass

        # Deterministic regex pattern pass
        regex_matches = 0
        for pattern, replacement in self.PATTERNS:
            matches = pattern.findall(sanitized_text)
            if matches:
                regex_matches += len(matches)
                entities_detected.append(replacement.strip("<>"))
                sanitized_text = pattern.sub(replacement, sanitized_text)

        if regex_matches > 0:
            total_count += regex_matches
            engines_used.append("pattern_matching")

        is_redacted = total_count > 0
        engine_str = "+".join(engines_used) if engines_used else ("pattern_matching" if is_redacted else "none")

        return sanitized_text, {
            "redacted": is_redacted,
            "engine": engine_str,
            "count": total_count,
            "entities": list(set(entities_detected))
        }

_sanitizer_instance = PIISanitizer()

def redact_pii(text: str) -> Tuple[str, Dict[str, Any]]:
    return _sanitizer_instance.sanitize(text)
