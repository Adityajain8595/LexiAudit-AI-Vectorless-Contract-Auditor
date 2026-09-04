from pydantic import BaseModel, Field, model_validator
from typing import List, Any, Dict, Union

class RiskClause(BaseModel):
    clause_name: str = Field(default="Clause", description="Descriptive legal risk title (e.g., Uncapped Liability for Restriction Breach, Unilateral Price Hike Right)")
    risk_level: str = Field(default="MEDIUM", description="Assigned risk severity level: HIGH, MEDIUM, or LOW")
    section_title: str = Field(default="Section", description="Specific section or sub-clause reference from document (e.g. Section 7.2: Warranty Disclaimer)")
    page_number: Any = Field(default=1, description="Page index or number where sub-clause appears")
    extracted_text: str = Field(default="", description="Complete verbatim paragraph excerpt of the specific sub-clause analyzed")
    analysis: str = Field(default="", description="In-depth multi-sentence legal risk assessment detailing legal exposure, statutory liability, and contractual imbalance")
    remedy_recommendation: str = Field(default="", description="Specific redline proposal or counter-language to negotiate safer terms")

    @model_validator(mode='before')
    @classmethod
    def validate_risk_clause(cls, data: Any) -> Any:
        if isinstance(data, dict):
            c_name = data.get("clause_name")
            sec = data.get("section_title")
            if (not c_name or c_name == "Clause") and sec and sec != "Section":
                data["clause_name"] = sec
        return data

class MissingClause(BaseModel):
    clause_name: str = Field(default="Clause", description="Specific missing safeguard title (e.g. Data Protection Addendum, Cyber Incident Liability)")
    severity: str = Field(default="MEDIUM", description="Severity impact of omission: HIGH, MEDIUM, or LOW")
    impact_description: str = Field(default="", description="Detailed multi-sentence explanation of legal or operational exposure caused by missing protection")
    suggested_language: str = Field(default="", description="Complete multi-line standard enterprise boilerplate clause ready for insertion")

    @model_validator(mode='before')
    @classmethod
    def pre_process_missing(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "clause_name": data,
                "severity": "MEDIUM",
                "impact_description": f"Omitting this standard {data} provision creates legal and regulatory ambiguity between the parties.",
                "suggested_language": ""
            }
        return data

class AutomaticAuditOutput(BaseModel):
    risk_analysis: List[RiskClause] = Field(default=[], description="List of detected high/medium/standard risk clauses")
    missing_clauses: List[Union[MissingClause, str]] = Field(default=[], description="List of standard protective clauses missing")
    suggested_queries: List[str] = Field(default=[], description="Strictly 3 context-specific queries tailored to the contract")

    @model_validator(mode='before')
    @classmethod
    def validate_audit_output(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_missing = data.get("missing_clauses")
            if isinstance(raw_missing, list):
                coerced = []
                for item in raw_missing:
                    if isinstance(item, str):
                        coerced.append({
                            "clause_name": item,
                            "severity": "MEDIUM",
                            "impact_description": f"Omitting this standard {item} provision creates legal and regulatory ambiguity between the parties.",
                            "suggested_language": ""
                        })
                    elif isinstance(item, dict):
                        coerced.append(item)
                    else:
                        coerced.append(item)
                data["missing_clauses"] = coerced
        return data

class DocumentUploadResponse(BaseModel):
    doc_id: str
    pageindex_doc_id: str
    filename: str
    tree_index: List[Dict[str, Any]]
    risk_analysis: List[RiskClause] = []
    missing_clauses: List[MissingClause] = []
    suggested_queries: List[str] = []
