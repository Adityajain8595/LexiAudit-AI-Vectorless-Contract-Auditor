from pydantic import BaseModel, Field
from typing import List, Any, Dict

class RiskClause(BaseModel):
    clause_name: str = Field(default="Clause", description="Name of the clause analyzed (e.g., Indemnification, Default)")
    risk_level: str = Field(default="MEDIUM", description="Assigned risk severity level: HIGH, MEDIUM, or LOW")
    section_title: str = Field(default="Section", description="Exact section title from document")
    page_number: Any = Field(default=1, description="Page index or number where clause appears")
    extracted_text: str = Field(default="", description="Verbatim excerpt from contract text")
    analysis: str = Field(default="", description="Detailed reason for the assigned risk level")
    remedy_recommendation: str = Field(default="", description="Suggested counter-language or safety measure")

class MissingClause(BaseModel):
    clause_name: str = Field(default="Clause", description="Standard protective clause name omitted from contract")
    severity: str = Field(default="MEDIUM", description="Severity impact of the omission: HIGH, MEDIUM, LOW")
    impact_description: str = Field(default="", description="Explanation of legal risk introduced by missing clause")
    suggested_language: str = Field(default="", description="Standard boilerplate language to insert")

class AutomaticAuditOutput(BaseModel):
    risk_analysis: List[RiskClause] = Field(default=[], description="List of detected high/medium/standard risk clauses")
    missing_clauses: List[MissingClause] = Field(default=[], description="List of standard protective clauses missing")
    suggested_queries: List[str] = Field(default=[], description="Strictly 3 context-specific queries tailored to the contract")

class DocumentUploadResponse(BaseModel):
    doc_id: str
    pageindex_doc_id: str
    filename: str
    tree_index: List[Dict[str, Any]]
    risk_analysis: List[RiskClause] = []
    missing_clauses: List[MissingClause] = []
    suggested_queries: List[str] = []
