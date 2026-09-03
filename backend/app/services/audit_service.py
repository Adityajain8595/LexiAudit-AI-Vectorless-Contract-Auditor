import json
import re
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
                "summary": n.get("summary") or (n.get("text", ""))
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
                max_tokens=4000
            )
            out = validated.model_dump()

            if not out.get("risk_analysis") and not out.get("missing_clauses"):
                fb = LexiAuditExceptionHandler.get_audit_fallback()
                out["risk_analysis"] = fb["risk_analysis"]
                out["missing_clauses"] = fb["missing_clauses"]
                if not out.get("suggested_queries"):
                    out["suggested_queries"] = fb["suggested_queries"]

            for item in out.get("risk_analysis", []):
                item_sec = str(item.get("section_title", "")).strip().lower()
                item_clause = str(item.get("clause_name", "")).strip().lower()
                item_text = str(item.get("extracted_text", "")).strip()

                matched_node = None
                for n in all_nodes:
                    n_title = str(n.get("title", "")).strip().lower()
                    n_text = str(n.get("text", "")).strip()
                    if item_text and len(item_text) > 15 and item_text.lower() in n_text.lower():
                        matched_node = n
                        break
                    if item_clause and (item_clause in n_title or n_title in item_clause):
                        matched_node = n
                        break
                    if item_sec and (item_sec in n_title or n_title in item_sec):
                        matched_node = n
                        break

                sub_num = None
                text_match = re.search(r'^\s*(\d+\.\d+)\b', item_text)
                if text_match:
                    sub_num = text_match.group(1)
                elif matched_node:
                    node_sub_match = re.search(r'\b(\d+\.\d+)\b', matched_node.get("title", ""))
                    if node_sub_match:
                        sub_num = node_sub_match.group(1)

                if sub_num:
                    item["section_title"] = f"Section {sub_num}"
                elif matched_node:
                    item["section_title"] = matched_node.get("title") or item.get("section_title")

                if matched_node:
                    item["page_number"] = matched_node.get("page_index") or matched_node.get("page_number") or item.get("page_number") or 1
                    if matched_node.get("node_id"):
                        item["node_id"] = matched_node["node_id"]
                    if not item.get("extracted_text") or len(item["extracted_text"]) < 5:
                        item["extracted_text"] = matched_node.get("text") or matched_node.get("summary") or ""

            if len(out.get("suggested_queries", [])) > 3:
                out["suggested_queries"] = out["suggested_queries"][:3]

            span.end(output={
                "risk_clauses_count": len(out.get("risk_analysis", [])),
                "missing_clauses_count": len(out.get("missing_clauses", []))
            })
            return out

        except Exception as e:
            span.end(output={"error": str(e)})
            return LexiAuditExceptionHandler.get_audit_fallback()

_auditor_instance = ContractAuditor()

def flatten_tree(nodes: list) -> list:
    return ContractAuditor.flatten_nodes(nodes)

async def automatic_audit(tree: list, doc_id: Optional[str] = None, user_id: Optional[str] = None) -> dict:
    return await _auditor_instance.audit_contract(tree, doc_id, user_id)
