from pydantic import BaseModel, Field
from typing import List, Any, Dict

class RiskClause(BaseModel):
    clause_name: str = Field(default="Clause", description="Descriptive legal risk title (e.g., Uncapped Liability for Restriction Breach, Unilateral Price Hike Right)")
    risk_level: str = Field(default="MEDIUM", description="Assigned risk severity level: HIGH, MEDIUM, or LOW")
    section_title: str = Field(default="Section", description="Specific section or sub-clause reference from document (e.g. Section 7.2: Warranty Disclaimer)")
    page_number: Any = Field(default=1, description="Page index or number where sub-clause appears")
    extracted_text: str = Field(default="", description="Complete verbatim paragraph excerpt of the specific sub-clause analyzed")
    analysis: str = Field(default="", description="In-depth multi-sentence legal risk assessment detailing legal exposure and contractual imbalance")
    remedy_recommendation: str = Field(default="", description="Specific redline proposal or counter-language to negotiate safer terms")

class MissingClause(BaseModel):
    clause_name: str = Field(default="Clause", description="Specific missing safeguard title (e.g. Data Protection Addendum, Cyber Incident Liability)")
    severity: str = Field(default="MEDIUM", description="Severity impact of omission: HIGH, MEDIUM, or LOW")
    impact_description: str = Field(default="", description="Detailed multi-sentence explanation of legal or operational exposure caused by missing protection")
    suggested_language: str = Field(default="", description="Complete multi-line standard enterprise boilerplate clause ready for insertion")

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
