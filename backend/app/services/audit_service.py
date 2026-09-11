import json
from typing import Optional, Dict, Any, List
from app.schemas.contract import AutomaticAuditOutput
from app.services.llm_service import llm_structured
from app.core import (
    start_trace,
    start_span,
    get_registered_prompt,
    settings,
)

# Automated contract audit engine
class ContractAuditor:
    # Flatten hierarchical tree nodes
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

    # Execute full contract compliance audit
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
        nodes = self.flatten_nodes(tree)

        compact = [
            {
                "node_id": n["node_id"],
                "title": n["title"],
                "page_index": n["page_index"],
                "text": n.get("text") or n.get("summary", "")
            }
            for n in nodes
        ]

        # Audit prompt generation
        sys_prompt = get_registered_prompt("audit_system_prompt")
        user_prompt = get_registered_prompt("audit_human_template", document_tree=json.dumps(compact, indent=1))
        msgs = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            validated: AutomaticAuditOutput = await llm_structured(
                messages=msgs,
                pydantic_cls=AutomaticAuditOutput,
                model=settings.PRIMARY_GROQ_MODEL,
                temperature=0.0,
                max_tokens=8000
            )
            out = validated.model_dump()
            levels = {"RED": "HIGH", "YELLOW": "MEDIUM", "GREEN": "LOW", "HIGH": "HIGH", "MEDIUM": "MEDIUM", "LOW": "LOW"}

            # Align risks with tree nodes
            for item in out.get("risk_analysis", []):
                raw_level = str(item.get("risk_level", "MEDIUM")).strip().upper()
                item["risk_level"] = levels.get(raw_level, "MEDIUM")

                sec_title = str(item.get("section_title", "")).strip()
                item_text = str(item.get("extracted_text", "")).strip()

                matched = None
                for n in nodes:
                    node_title = str(n.get("title", "")).strip().lower()
                    node_text = str(n.get("text", "")).strip()
                    if item_text and len(item_text) > 15 and (item_text.lower() in node_text.lower() or node_text.lower() in item_text.lower()):
                        matched = n
                        break
                    if sec_title and (sec_title.lower() in node_title or node_title in sec_title.lower()):
                        matched = n
                        break

                if matched:
                    item["page_number"] = matched.get("page_index") or matched.get("page_number") or item.get("page_number") or 1
                    if matched.get("node_id"):
                        item["node_id"] = matched["node_id"]

            for missing in out.get("missing_clauses", []):
                raw_sev = str(missing.get("severity", "MEDIUM")).strip().upper()
                missing["severity"] = levels.get(raw_sev, "MEDIUM")

            if len(out.get("suggested_queries", [])) > 3:
                out["suggested_queries"] = out["suggested_queries"][:3]

            span.end(output={"risks": len(out.get("risk_analysis", [])), "missing": len(out.get("missing_clauses", []))})
            if hasattr(trace, "end"):
                trace.end(output={"risks": len(out.get("risk_analysis", [])), "missing": len(out.get("missing_clauses", []))})
            return out

        except Exception as err:
            span.end(output={"error": str(err)})
            if hasattr(trace, "end"):
                trace.end(output={"error": str(err)})
            return {"risk_analysis": [], "missing_clauses": [], "suggested_queries": []}

_auditor = ContractAuditor()

def flatten_tree(nodes: list) -> list:
    return ContractAuditor.flatten_nodes(nodes)

async def automatic_audit(tree: list, doc_id: Optional[str] = None, user_id: Optional[str] = None) -> dict:
    return await _auditor.audit_contract(tree, doc_id, user_id)
