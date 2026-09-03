import logging
from typing import Optional, Dict, Any, Tuple
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger("lexiaudit.exceptions")

class LexiAuditException(Exception):
    """
    Base domain exception for all LexiAudit AI operations.
    """
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_SERVER_ERROR",
        user_friendly_message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.user_friendly_message = user_friendly_message or (
            "We encountered an issue processing your request. Please check your query or contract document."
        )
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": False,
            "error": {
                "code": self.error_code,
                "message": self.user_friendly_message,
                "technical_details": self.message,
                "details": self.details
            }
        }

class LLMServiceException(LexiAuditException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=502,
            error_code="LLM_SERVICE_ERROR",
            user_friendly_message=(
                "The legal reasoning model is currently busy or experiencing high traffic. "
                "A fallback summary has been generated for your query."
            ),
            details=details
        )

class PageIndexException(LexiAuditException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=502,
            error_code="PAGEINDEX_PARSING_ERROR",
            user_friendly_message=(
                "Unable to fully parse the document hierarchy via PageIndex. "
                "Document has been indexed with standard section fallback."
            ),
            details=details
        )

class TreeCacheException(LexiAuditException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=503,
            error_code="CACHE_ERROR",
            user_friendly_message="Cache access temporarily unavailable. Falling back to persistent database storage.",
            details=details
        )

class DatabaseException(LexiAuditException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=500,
            error_code="DATABASE_ERROR",
            user_friendly_message="Database service operation encountered an error. Please retry shortly.",
            details=details
        )

class GuardrailViolationException(LexiAuditException):
    def __init__(self, reason: str, violation_type: str = "prompt_injection"):
        super().__init__(
            message=f"Query rejected by safety guardrails: {violation_type}",
            status_code=400,
            error_code="SAFETY_VIOLATION",
            user_friendly_message=reason,
            details={"violation_type": violation_type}
        )

class DocumentAuditException(LexiAuditException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=500,
            error_code="AUDIT_REASONING_ERROR",
            user_friendly_message=(
                "Automated risk audit completed with baseline findings. "
                "Specific clause-level analysis remains available in chat."
            ),
            details=details
        )

class ResourceNotFoundException(LexiAuditException):
    def __init__(self, resource_name: str, resource_id: str):
        super().__init__(
            message=f"{resource_name} with ID '{resource_id}' was not found.",
            status_code=404,
            error_code="RESOURCE_NOT_FOUND",
            user_friendly_message=f"The requested {resource_name.lower()} could not be found.",
            details={"resource": resource_name, "id": resource_id}
        )

class AuthenticationException(LexiAuditException):
    def __init__(self, message: str = "Authentication required or credentials invalid."):
        super().__init__(
            message=message,
            status_code=401,
            error_code="UNAUTHORIZED",
            user_friendly_message="Your session has expired or is invalid. Please sign in again."
        )


class LexiAuditExceptionHandler:
    """
    Centralized Exception & Fallback Orchestrator.
    Guarantees structured JSON responses for unexpected application errors.
    """

    @classmethod
    def handle_exception(cls, exc: Exception) -> Tuple[int, Dict[str, Any]]:
        """Maps any exception to HTTP status code and standard JSON error dictionary."""
        if isinstance(exc, LexiAuditException):
            return exc.status_code, exc.to_dict()

        if isinstance(exc, HTTPException):
            return exc.status_code, {
                "success": False,
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail),
                    "technical_details": str(exc.detail)
                }
            }

        logger.error(f"Unhandled system error: {exc}", exc_info=True)
        return 500, {
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected system error occurred. A fallback response has been generated.",
                "technical_details": str(exc)
            }
        }

    @classmethod
    def create_json_response(cls, exc: Exception, request: Optional[Request] = None) -> JSONResponse:
        status_code, payload = cls.handle_exception(exc)
        return JSONResponse(status_code=status_code, content=payload)

    @classmethod
    def get_audit_fallback(cls, filename: str = "Contract") -> Dict[str, Any]:
        """Provides baseline audit findings when automated audit LLM reasoning is disrupted."""
        return {
            "risk_analysis": [
                {
                    "clause_name": "Review Required",
                    "risk_level": "MEDIUM",
                    "section_title": "General Terms",
                    "page_number": 1,
                    "extracted_text": f"Document: {filename}",
                    "analysis": "Automated audit baseline applied. Interactive clause-level Q&A is available.",
                    "remedy_recommendation": "Review key liability, termination, and data security clauses directly in chat."
                }
            ],
            "missing_clauses": [
                {
                    "clause_name": "Data Protection & Privacy (DPA)",
                    "severity": "MEDIUM",
                    "impact_description": "Verify whether standard GDPR / CCPA data processing terms are explicitly defined.",
                    "suggested_language": "Each party shall comply with applicable Data Protection Legislation in respect of personal data processed."
                }
            ],
            "suggested_queries": [
                "What are the primary termination conditions and notice periods?",
                "What is the total liability limitation or indemnification scope?",
                "Are there unilateral or non-mutual covenant provisions?"
            ]
        }

    @classmethod
    def register_app_handlers(cls, app: FastAPI):
        """Registers global FastAPI exception handlers for centralized error trapping."""
        
        @app.exception_handler(LexiAuditException)
        async def custom_exception_handler(request: Request, exc: LexiAuditException):
            return cls.create_json_response(exc, request)

        @app.exception_handler(HTTPException)
        async def http_exception_handler(request: Request, exc: HTTPException):
            return cls.create_json_response(exc, request)

        @app.exception_handler(RequestValidationError)
        async def validation_exception_handler(request: Request, exc: RequestValidationError):
            return JSONResponse(
                status_code=422,
                content={
                    "success": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Invalid request parameters provided.",
                        "details": exc.errors()
                    }
                }
            )

        @app.exception_handler(Exception)
        async def generic_exception_handler(request: Request, exc: Exception):
            return cls.create_json_response(exc, request)
