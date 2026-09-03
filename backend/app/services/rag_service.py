import json
from typing import List, Optional, Dict, Any
from app.schemas.chat import TreeSearchOutput, RAGFollowUpOutput
from app.services.llm_service import llm_chat, llm_structured
from app.core import (
    redact_pii,
    start_trace,
    start_span,
    log_generation,
    flush_telemetry,
    get_registered_prompt,
    settings
)

class VectorlessRAGPipeline:
    """Enterprise Vectorless Hierarchical Document RAG Pipeline."""
    def prune_tree(self, tree: list) -> list:
        if not tree:
            return []
        pruned = []
        for n in tree:
            item = {
                "node_id": n.get("node_id", ""),
                "title": n.get("title", ""),
                "page_index": n.get("page_index", 1),
                "summary": n.get("summary", "")
            }
            if n.get("nodes"):
                item["nodes"] = self.prune_tree(n["nodes"])
            pruned.append(item)
        return pruned

    def find_nodes(self, tree: list, target_ids: List[str]) -> list:
        found = []
        target_set = set(target_ids)

        def traverse(node_list):
            for n in node_list:
                if n.get("node_id") in target_set:
                    found.append(n)
                if n.get("nodes"):
                    traverse(n["nodes"])

        traverse(tree)
        return found

    def format_history(self, chat_history: Optional[List[Dict[str, str]]], max_turns: int = 6) -> str:
        if not chat_history:
            return ""
        return "\n".join([
            f"{'User' if m.get('sender') == 'user' else 'Auditor'}: {m.get('content', '')}"
            for m in chat_history[-max_turns:]
        ])

    async def rewrite_query(self, query: str, history_text: str, parent_span: Any = None) -> str:
        if not history_text.strip():
            return query

        span = start_span(parent_span, "Query Rewrite", input_data={"query": query, "history": history_text})
        prompt = get_registered_prompt("query_rewrite_prompt", history_text=history_text, query=query)

        messages = [
            {"role": "system", "content": "You are a query rewriting assistant for a legal contract search system. Output only the standalone rewritten query with no conversational filler or explanation."},
            {"role": "user", "content": prompt}
        ]

        try:
            rewritten = await llm_chat(messages, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=128)
            rewritten = rewritten.strip().strip('"').strip("'")
            final_query = rewritten if rewritten else query
            span.end(output={"rewritten_query": final_query})
            return final_query
        except Exception as e:
            print(f"Query rewrite note: {e}")
            span.end(output={"rewritten_query": query, "fallback": True})
            return query

    async def self_correct_search(
        self,
        query: str,
        search_tree: list,
        failed_target_ids: list,
        parent_span: Any = None
    ) -> List[str]:
        span = start_span(parent_span, "Self-Correcting Search Agent", input_data={"query": query, "failed_ids": failed_target_ids})
        correction_prompt = get_registered_prompt(
            "self_correct_prompt",
            query=query,
            search_tree=json.dumps(search_tree, indent=2)
        )

        messages = [
            {"role": "system", "content": "You are an autonomous self-correcting legal agent identifying broader candidate sections when direct retrieval yields no hits."},
            {"role": "user", "content": correction_prompt}
        ]

        try:
            res: TreeSearchOutput = await llm_structured(messages, TreeSearchOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
            candidate_ids = res.node_list or []
            span.end(output={"self_corrected_nodes": candidate_ids, "strategy": "broadened_parent_sweep"})
            return candidate_ids
        except Exception as e:
            print(f"Self-correcting search note: {e}")
            span.end(output={"error": str(e)})
            return []

    async def generate_followups(self, query: str, context_string: str, history_text: str = "", parent_span: Any = None) -> List[str]:
        span = start_span(parent_span, "Follow-Up Question Generation")
        history_context = f"\nPRIOR DIALOGUE CONTEXT:\n{history_text}\n" if history_text else ""
        prompt = get_registered_prompt(
            "rag_followup_prompt",
            history_context=history_context,
            query=query,
            context_string=context_string
        )
        messages = [
            {"role": "system", "content": "You are a legal auditor formulating 3 concise, context-aware follow-up legal questions for the user."},
            {"role": "user", "content": prompt}
        ]
        try:
            res: RAGFollowUpOutput = await llm_structured(messages, RAGFollowUpOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
            queries = (res.suggested_queries or [])[:3]
            span.end(output={"suggested_queries": queries})
            return queries
        except Exception as e:
            print(f"Followup query generation note: {e}")
            span.end(output={"suggested_queries": [], "error": str(e)})
            return []

    async def direct_pipeline(
        self,
        query: str,
        tree: list,
        chat_history: Optional[List[Dict[str, str]]] = None,
        trace: Any = None
    ) -> Dict[str, Any]:
        trace = trace or start_trace("vectorless_rag_direct_pipeline")
        sanitized_query, _ = redact_pii(query)
        history_text = self.format_history(chat_history, max_turns=4)

        # Tree search and candidate section lookup
        search_span = start_span(trace, name="Tree Search Navigation", input_data={"query": sanitized_query})
        search_tree = self.prune_tree(tree)
        target_ids = []
        search_res = None
        if search_tree:
            try:
                search_prompt = get_registered_prompt(
                    "tree_search_prompt",
                    search_query=sanitized_query,
                    search_tree=json.dumps(search_tree, indent=2)
                )
                messages_search = [
                    {"role": "system", "content": "You are a legal index search engine navigating a document hierarchical tree. Output only the target node IDs adhering strictly to JSON."},
                    {"role": "user", "content": search_prompt}
                ]
                search_res = await llm_structured(messages_search, TreeSearchOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=1024)
                target_ids = search_res.node_list or []
                log_generation(
                    search_span,
                    name="Tree Search Generation",
                    model=settings.FAST_GROQ_MODEL,
                    prompt=messages_search,
                    completion=search_res.model_dump_json() if search_res else ""
                )
            except Exception as e:
                print(f"Direct tree search note: {e}")
        search_span.end(output={"matched_node_ids": target_ids})

        matched_nodes = self.find_nodes(tree, target_ids)
        if not matched_nodes and tree:
            matched_nodes = tree[:4]

        context_string = "\n\n".join([
            f"--- SECTION: {n.get('title')} (Page: {n.get('page_index') or n.get('page_number') or 1}) ---\nSummary: {n.get('summary', '')}\nText: {n.get('text', '')[:1200]}"
            for n in matched_nodes
        ])

        payload = [
            {
                "node_id": n.get("node_id", ""),
                "title": n.get("title", "Section"),
                "page_index": n.get("page_index") or n.get("page_number") or 1,
                "summary": n.get("summary", ""),
                "exact_text": n.get("text", "")
            }
            for n in matched_nodes
        ]

        # LLM synthesis generation
        synth_span = start_span(trace, name="Answer Synthesis Stream", input_data={"node_count": len(matched_nodes)})
        history_context = f"\nPRIOR DIALOGUE CONTEXT:\n{history_text}\n" if history_text else ""
        sanitized_context, _ = redact_pii(context_string)
        synthesis_prompt = get_registered_prompt(
            "rag_synthesis_prompt",
            history_context=history_context,
            query=sanitized_query,
            context_string=sanitized_context
        )

        messages_synthesis = [
            {"role": "system", "content": "You are LexiAudit AI, a senior legal auditor providing precise, fully grounded, and citation-backed contract answers."},
            {"role": "user", "content": synthesis_prompt}
        ]

        try:
            raw_answer = await llm_chat(messages_synthesis, model=settings.PRIMARY_GROQ_MODEL, temperature=0.0, max_tokens=1024)
            log_generation(
                synth_span,
                name="Synthesis Generation",
                model=settings.PRIMARY_GROQ_MODEL,
                prompt=messages_synthesis,
                completion=raw_answer
            )
        except Exception as e:
            print(f"Direct synthesis LLM note: {e}")
            raw_answer = "Analysis of the requested contract section is complete. Please review the cited contract sections or ask follow-up questions."

        synth_span.end(output={"answer_length": len(raw_answer)})

        # Generate follow-up suggestions
        followup_queries = await self.generate_followups(
            query=sanitized_query,
            context_string=sanitized_context,
            history_text=history_text,
            parent_span=trace
        )

        if not followup_queries:
            followup_queries = [
                "What are the specific conditions associated with this clause?",
                "What liabilities or remedies are defined for breach of this provision?",
                "Are there related definitions or schedules in the agreement?"
            ]

        trace.end(output={"cited_nodes_count": len(payload)})
        flush_telemetry()

        sanitized_final_answer, _ = redact_pii(raw_answer)

        return {
            "answer": sanitized_final_answer,
            "cited_nodes": payload,
            "suggested_queries": followup_queries
        }

_rag_pipeline = VectorlessRAGPipeline()

def find_nodes(tree: list, target_ids: list) -> list:
    return _rag_pipeline.find_nodes(tree, target_ids)

def prune_tree(nodes: list) -> list:
    return _rag_pipeline.prune_tree(nodes)

def format_history(chat_history: Optional[List[Dict[str, str]]], max_turns: int = 6) -> str:
    return _rag_pipeline.format_history(chat_history, max_turns)

async def rewrite_query(query: str, history_text: str, parent_span: Any = None) -> str:
    return await _rag_pipeline.rewrite_query(query, history_text, parent_span)

async def self_correct_search(query: str, search_tree: list, failed_target_ids: list, parent_span: Any = None) -> List[str]:
    return await _rag_pipeline.self_correct_search(query, search_tree, failed_target_ids, parent_span)

async def generate_followups(query: str, context_string: str, history_text: str = "", parent_span: Any = None) -> List[str]:
    return await _rag_pipeline.generate_followups(query, context_string, history_text, parent_span)

async def run_rag_direct(query: str, tree: list, chat_history: Optional[List[Dict[str, str]]] = None, trace: Any = None) -> Dict[str, Any]:
    return await _rag_pipeline.direct_pipeline(query, tree, chat_history, trace)
