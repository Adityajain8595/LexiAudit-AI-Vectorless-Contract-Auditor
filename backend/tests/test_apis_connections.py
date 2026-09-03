from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.core.exceptions import (
    ResourceNotFoundException,
    GuardrailViolationException,
    LexiAuditExceptionHandler
)

app = FastAPI()
LexiAuditExceptionHandler.register_app_handlers(app)

@app.get("/test-not-found")
def route_not_found():
    raise ResourceNotFoundException("ContractDocument", "doc_999")

@app.get("/test-guardrail")
def route_guardrail():
    raise GuardrailViolationException("Prompt injection detected")

client = TestClient(app)

def test_not_found_error():
    res = client.get("/test-not-found")
    assert res.status_code == 404
    data = res.json()
    assert data["error"]["code"] == "RESOURCE_NOT_FOUND"

def test_guardrail_error():
    res = client.get("/test-guardrail")
    assert res.status_code == 400
    data = res.json()
    assert data["error"]["code"] == "SAFETY_VIOLATION"
