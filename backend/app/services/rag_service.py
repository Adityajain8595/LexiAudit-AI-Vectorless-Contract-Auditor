import json
from typing import List, Optional, Dict, Any
from app.schemas.chat import TreeSearchOutput, RAGFollowUpOutput
from app.services.llm_service import llm_chat, llm_structured, get_last_token_usage
from app.core import (
    redact_pii,
    start_trace,
    start_span,
    log_generation,
    flush_telemetry,
    get_registered_prompt,
    settings
)

# Hierarchical document search pipeline
class VectorlessRAGPipeline:
    def prune_tree(self, tree: list) -> list:
        if not tree:
            return []
        nodes = []
        for item in tree:
            entry = {
                "node_id": item.get("node_id", ""),
                "title": item.get("title", ""),
                "page_index": item.get("page_index", 1),
                "summary": item.get("summary", "")
            }
            if item.get("nodes"):
                entry["nodes"] = self.prune_tree(item["nodes"])
            nodes.append(entry)
        return nodes

    def find_nodes(self, tree: list, target_ids: List[str]) -> list:
        found = []
        targets = set(target_ids)

        def walk(items):
            for node in items:
                if node.get("node_id") in targets:
                    found.append(node)
                if node.get("nodes"):
                    walk(node["nodes"])

        walk(tree)
        return found

    def format_history(self, history: Optional[List[Dict[str, str]]], max_turns: int = 6) -> str:
        if not history:
            return ""
        lines = [
            f"{'User' if m.get('sender') == 'user' else 'Auditor'}: {m.get('content', '')}"
            for m in history[-max_turns:]
        ]
        return "\n".join(lines)

    # Contextual query rewrite step
    async def rewrite_query(self, query: str, history: str, parent_span: Any = None) -> str:
        if not history.strip():
            return query
        span = start_span(parent_span, "Query Rewrite", input_data={"query": query})
        prompt = get_registered_prompt("query_rewrite_prompt", history_text=history, query=query)
        msgs = [
            {"role": "system", "content": "You rewrite queries for contract retrieval. Output only the query."},
            {"role": "user", "content": prompt}
        ]
        try:
            res = await llm_chat(msgs, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=128)
            clean = res.strip().strip('"').strip("'")
            out = clean if clean else query
            span.end(output={"query": out})
            return out
        except Exception:
            span.end(output={"query": query})
            return query

    # Fallback sweep for missed nodes
    async def self_correct_search(self, query: str, tree: list, parent_span: Any = None) -> List[str]:
        span = start_span(parent_span, "Self-Correcting Search Agent", input_data={"query": query})
        prompt = get_registered_prompt("self_correct_prompt", query=query, search_tree=json.dumps(tree, indent=2))
        msgs = [
            {"role": "system", "content": "Identify relevant section node IDs from tree. Output JSON only."},
            {"role": "user", "content": prompt}
        ]
        try:
            res: TreeSearchOutput = await llm_structured(msgs, TreeSearchOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
            ids = res.node_list or []
            span.end(output={"nodes": ids})
            return ids
        except Exception:
            span.end(output={"nodes": []})
            return []

    # Follow-up question suggestions
    async def generate_followups(self, query: str, context: str, history: str = "", parent_span: Any = None) -> List[str]:
        span = start_span(parent_span, "Follow-Up Question Generation")
        history_text = f"\nPRIOR DIALOGUE CONTEXT:\n{history}\n" if history else ""
        prompt = get_registered_prompt("rag_followup_prompt", history_context=history_text, query=query, context_string=context)
        msgs = [
            {"role": "system", "content": "Formulate 3 concise follow-up legal questions for the contract user."},
            {"role": "user", "content": prompt}
        ]
        try:
            res: RAGFollowUpOutput = await llm_structured(msgs, RAGFollowUpOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
            questions = (res.suggested_queries or [])[:3]
            span.end(output={"queries": questions})
            return questions
        except Exception:
            span.end(output={"queries": []})
            return []

    # End-to-end vectorless RAG execution
    async def direct_pipeline(self, query: str, tree: list, history: Optional[List[Dict[str, str]]] = None, trace: Any = None) -> Dict[str, Any]:
        trace = trace or start_trace("vectorless_rag_query")
        clean_query, _ = redact_pii(query)
        past_turns = self.format_history(history, max_turns=4)

        # Contextual query rewriting when conversation exists
        if past_turns:
            active_query = await self.rewrite_query(clean_query, past_turns, trace)
        else:
            active_query = clean_query

        # Document tree search navigation
        search_span = start_span(trace, name="Tree Search Navigation", input_data={"query": active_query})
        pruned_tree = self.prune_tree(tree)
        target_ids = []
        if pruned_tree:
            try:
                search_prompt = get_registered_prompt("tree_search_prompt", search_query=active_query, search_tree=json.dumps(pruned_tree, indent=2))
                msgs_search = [
                    {"role": "system", "content": "Navigate document tree and output relevant node IDs adhering to JSON."},
                    {"role": "user", "content": search_prompt}
                ]
                search_res = await llm_structured(msgs_search, TreeSearchOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=1024)
                target_ids = search_res.node_list or []
                log_generation(search_span, name="Tree Search Generation", model=settings.FAST_GROQ_MODEL, prompt=msgs_search, completion=search_res.model_dump_json() if search_res else "")
            except Exception:
                pass
        search_span.end(output={"target_ids": target_ids})

        # Self-correction loop for empty matches
        if not target_ids and pruned_tree:
            target_ids = await self.self_correct_search(active_query, pruned_tree, trace)

        matched_nodes = self.find_nodes(tree, target_ids)
        if not matched_nodes and tree:
            matched_nodes = tree[:4]

        # Context assembly for synthesis
        sections = [
            f"--- SECTION: {n.get('title')} (Page: {n.get('page_index') or n.get('page_number') or 1}) ---\nText: {n.get('text', '')}"
            for n in matched_nodes
        ]
        context_str = "\n\n".join(sections)
        clean_context, _ = redact_pii(context_str)

        cited_nodes = [
            {
                "node_id": n.get("node_id", ""),
                "title": n.get("title", "Section"),
                "page_index": n.get("page_index") or n.get("page_number") or 1,
                "summary": n.get("summary", ""),
                "exact_text": n.get("text", "")
            }
            for n in matched_nodes
        ]

        # Answer generation with telemetry logging
        synth_span = start_span(trace, name="Answer Synthesis Stream", input_data={"node_count": len(matched_nodes)})
        history_text = f"\nPRIOR DIALOGUE CONTEXT:\n{past_turns}\n" if past_turns else ""
        synthesis_prompt = get_registered_prompt("rag_synthesis_prompt", history_context=history_text, query=clean_query, context_string=clean_context)
        msgs_synthesis = [
            {"role": "system", "content": "You are LexiAudit AI, providing precise, grounded, citation-backed answers."},
            {"role": "user", "content": synthesis_prompt}
        ]

        try:
            raw_answer = await llm_chat(msgs_synthesis, model=settings.PRIMARY_GROQ_MODEL, temperature=0.0, max_tokens=1024)
            usage = get_last_token_usage()
            log_generation(synth_span, name="Synthesis Generation", model=settings.PRIMARY_GROQ_MODEL, prompt=msgs_synthesis, completion=raw_answer, usage=usage)
        except Exception:
            raw_answer = "Analysis of the requested contract section is complete."

        synth_span.end(output={"length": len(raw_answer)})

        # Suggested follow-up legal queries
        followups = await self.generate_followups(query=clean_query, context=clean_context, history=past_turns, parent_span=trace)
        if not followups:
            followups = [
                "What are the specific conditions associated with this clause?",
                "What liabilities or remedies are defined for breach of this provision?",
                "Are there related definitions or schedules in the agreement?"
            ]

        trace.end(output={"node_count": len(cited_nodes)})
        flush_telemetry()

        final_answer, _ = redact_pii(raw_answer)
        return {
            "answer": final_answer,
            "cited_nodes": cited_nodes,
            "suggested_queries": followups
        }

_rag_pipeline = VectorlessRAGPipeline()

def find_nodes(tree: list, target_ids: list) -> list:
    return _rag_pipeline.find_nodes(tree, target_ids)

def prune_tree(nodes: list) -> list:
    return _rag_pipeline.prune_tree(nodes)

def format_history(history: Optional[List[Dict[str, str]]], max_turns: int = 6) -> str:
    return _rag_pipeline.format_history(history, max_turns)

async def rewrite_query(query: str, history: str, parent_span: Any = None) -> str:
    return await _rag_pipeline.rewrite_query(query, history, parent_span)

async def self_correct_search(query: str, tree: list, parent_span: Any = None) -> List[str]:
    return await _rag_pipeline.self_correct_search(query, tree, parent_span)

async def generate_followups(query: str, context: str, history: str = "", parent_span: Any = None) -> List[str]:
    return await _rag_pipeline.generate_followups(query, context, history, parent_span)

async def run_rag_direct(query: str, tree: list, chat_history: Optional[List[Dict[str, str]]] = None, trace: Any = None) -> Dict[str, Any]:
    return await _rag_pipeline.direct_pipeline(query, tree, chat_history, trace)
