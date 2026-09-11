import logging
from typing import Optional, Dict, Any, Tuple
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger("lexiaudit.exceptions")

# Base domain error definition
class LexiAuditException(Exception):
    def __init__(
        self,
        msg: str,
        status: int = 500,
        code: str = "INTERNAL_SERVER_ERROR",
        info: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ):
        super().__init__(msg)
        self.message = msg
        self.status_code = status
        self.error_code = code
        self.user_message = info or msg
        self.details = data or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": False,
            "error": {
                "code": self.error_code,
                "message": self.user_message,
                "technical_details": self.message,
                "details": self.details
            }
        }

# Domain specific error classes
class LLMServiceException(LexiAuditException):
    def __init__(self, msg: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(msg, 502, "LLM_SERVICE_ERROR", "LLM reasoning service error.", data)

class PageIndexException(LexiAuditException):
    def __init__(self, msg: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(msg, 502, "PAGEINDEX_PARSING_ERROR", "Document parsing error occurred.", data)

class TreeCacheException(LexiAuditException):
    def __init__(self, msg: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(msg, 503, "CACHE_ERROR", "Cache service unavailable.", data)

class DatabaseException(LexiAuditException):
    def __init__(self, msg: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(msg, 500, "DATABASE_ERROR", "Database service error occurred.", data)

class GuardrailViolationException(LexiAuditException):
    def __init__(self, reason: str, kind: str = "prompt_injection"):
        super().__init__(f"Safety violation: {kind}", 400, "SAFETY_VIOLATION", reason, {"violation": kind})

class DocumentAuditException(LexiAuditException):
    def __init__(self, msg: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(msg, 500, "AUDIT_REASONING_ERROR", "Contract audit failed.", data)

class ResourceNotFoundException(LexiAuditException):
    def __init__(self, item: str, item_id: str):
        super().__init__(f"{item} '{item_id}' not found.", 404, "RESOURCE_NOT_FOUND", f"{item} not found.", {"item": item, "id": item_id})

class AuthenticationException(LexiAuditException):
    def __init__(self, msg: str = "Authentication required."):
        super().__init__(msg, 401, "UNAUTHORIZED", "Authentication credentials invalid.")

# Application exception handler orchestrator
class LexiAuditExceptionHandler:
    # Map exceptions to status and payload
    @classmethod
    def handle_exception(cls, exc: Exception) -> Tuple[int, Dict[str, Any]]:
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

        logger.error(f"Unhandled error: {exc}", exc_info=True)
        return 500, {
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error occurred.",
                "technical_details": str(exc)
            }
        }

    @classmethod
    def create_json_response(cls, exc: Exception, req: Optional[Request] = None) -> JSONResponse:
        status, payload = cls.handle_exception(exc)
        return JSONResponse(status_code=status, content=payload)

    # Register handlers with FastAPI app
    @classmethod
    def register_app_handlers(cls, app: FastAPI):
        @app.exception_handler(LexiAuditException)
        async def domain_handler(req: Request, exc: LexiAuditException):
            return cls.create_json_response(exc, req)

        @app.exception_handler(HTTPException)
        async def http_handler(req: Request, exc: HTTPException):
            return cls.create_json_response(exc, req)

        @app.exception_handler(RequestValidationError)
        async def validation_handler(req: Request, exc: RequestValidationError):
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
        async def general_handler(req: Request, exc: Exception):
            return cls.create_json_response(exc, req)
