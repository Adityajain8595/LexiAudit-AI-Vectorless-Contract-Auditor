import json
from typing import Optional, Dict, Any, List

from app.schemas.contract import AutomaticAuditOutput
from app.services.llm_service import llm_structured
from app.core import (
    start_trace,
    start_span,
    get_registered_prompt,
    LexiAuditExceptionHandler,
    settings,
)

class ContractAuditor:
    """
    Autonomous Legal Risk and Compliance Audit Engine.
    Processes tree-structured contract provisions against legal rubrics using Groq LLM engine.
    """
    @staticmethod
    def flatten_nodes(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        flat_list = []
        for node in nodes:
            flat_list.append({
                "node_id": node.get("node_id", "N/A"),
                "title": node.get("title", "Untitled Section"),
                "page_index": node.get("page_index", 1),
                "summary": node.get("summary", ""),
                "text": node.get("text", "")
            })
            if node.get("nodes"):
                flat_list.extend(ContractAuditor.flatten_nodes(node["nodes"]))
        return flat_list

    async def audit_contract(
        self,
        tree: List[Dict[str, Any]],
        doc_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        trace = start_trace(
            name="automatic_audit",
            session_id=doc_id,
            user_id=user_id,
            metadata={"doc_id": doc_id}
        )
        span = start_span(trace, "Contract Audit Reasoning", input_data={"node_count": len(tree)})
        
        all_nodes = self.flatten_nodes(tree)
        
        compact_nodes = [
            {
                "node_id": n["node_id"],
                "title": n["title"],
                "page_index": n["page_index"],
                "text": n.get("text") or n.get("summary", "")
            }
            for n in all_nodes
        ]

        system_prompt = get_registered_prompt("audit_system_prompt")
        human_prompt = get_registered_prompt(
            "audit_human_template",
            document_tree=json.dumps(compact_nodes, indent=1)
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": human_prompt}
        ]

        try:
            validated: AutomaticAuditOutput = await llm_structured(
                messages=messages,
                pydantic_cls=AutomaticAuditOutput,
                model=settings.PRIMARY_GROQ_MODEL,
                temperature=0.0,
                max_tokens=8000
            )
            out = validated.model_dump()

            risk_map = {"RED": "HIGH", "YELLOW": "MEDIUM", "GREEN": "LOW", "HIGH": "HIGH", "MEDIUM": "MEDIUM", "LOW": "LOW"}

            for item in out.get("risk_analysis", []):
                raw_level = str(item.get("risk_level", "MEDIUM")).strip().upper()
                item["risk_level"] = risk_map.get(raw_level, "MEDIUM")

                item_sec = str(item.get("section_title", "")).strip()
                item_clause = str(item.get("clause_name", "")).strip()
                item_text = str(item.get("extracted_text", "")).strip()

                # Find matching tree node by text or title
                matched_node = None
                for n in all_nodes:
                    n_title = str(n.get("title", "")).strip().lower()
                    n_text = str(n.get("text", "")).strip()
                    if item_text and len(item_text) > 15 and (item_text.lower() in n_text.lower() or n_text.lower() in item_text.lower()):
                        matched_node = n
                        break
                    if item_sec and (item_sec.lower() in n_title or n_title in item_sec.lower()):
                        matched_node = n
                        break
                    if item_clause and (item_clause.lower() in n_title or n_title in item_clause.lower()):
                        matched_node = n
                        break

                if matched_node:
                    item["page_number"] = matched_node.get("page_index") or matched_node.get("page_number") or item.get("page_number") or 1
                    if matched_node.get("node_id"):
                        item["node_id"] = matched_node["node_id"]

            for missing in out.get("missing_clauses", []):
                raw_sev = str(missing.get("severity", "MEDIUM")).strip().upper()
                missing["severity"] = risk_map.get(raw_sev, "MEDIUM")

            if len(out.get("suggested_queries", [])) > 3:
                out["suggested_queries"] = out["suggested_queries"][:3]

            span.end(output={
                "risk_clauses_count": len(out.get("risk_analysis", [])),
                "missing_clauses_count": len(out.get("missing_clauses", []))
            })
            return out

        except Exception as e:
            span.end(output={"error": str(e)})
            return {"risk_analysis": [], "missing_clauses": [], "suggested_queries": []}

_auditor_instance = ContractAuditor()

def flatten_tree(nodes: list) -> list:
    return ContractAuditor.flatten_nodes(nodes)

async def automatic_audit(tree: list, doc_id: Optional[str] = None, user_id: Optional[str] = None) -> dict:
    return await _auditor_instance.audit_contract(tree, doc_id, user_id)
