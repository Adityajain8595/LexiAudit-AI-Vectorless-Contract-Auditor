from app.core.telemetry import get_prompt_template

class PromptRegistry:
    """
    Centralized Prompt Registry & Versioning Engine.
    Manages base prompt templates with remote Langfuse Cloud resolution.
    """
    DEFAULTS = {
        "audit_system_prompt": (
            "You are an expert legal auditor. You analyze hierarchical contract trees strictly based "
            "on the text provided. Output strictly valid JSON conforming to the requested schema. "
            "NEVER fabricate quotes or assume clauses are missing without verifying "
            "the entire node tree. Every extracted_text MUST be a verbatim substring from the document tree."
        ),
        "audit_human_template": """
Perform an objective legal audit on this contract. Output strictly a single valid JSON object.

DOCUMENT TREE:
{document_tree}

Extract risk analysis, missing clauses, and suggested queries in the following JSON schema:
```json
{{
  "risk_analysis": [
    {{
      "clause_name": "Clause Name (e.g., Uncapped Indemnification, Termination)",
      "risk_level": "HIGH",
      "section_title": "Exact node section title",
      "page_number": 1,
      "extracted_text": "Verbatim excerpt from the document tree",
      "analysis": "Detailed legal reasoning for the assigned risk level",
      "remedy_recommendation": "Suggested counter-language or safety measure"
    }}
  ],
  "missing_clauses": [
    {{
      "clause_name": "Standard protective clause omitted (e.g. Data Protection / DPA, Force Majeure)",
      "severity": "MEDIUM",
      "impact_description": "Explanation of legal exposure introduced",
      "suggested_language": "Standard boilerplate clause to insert"
    }}
  ],
  "suggested_queries": [
    "Context-specific question 1 tailored to contract numbers/parties",
    "Context-specific question 2 tailored to liabilities/remedies",
    "Context-specific question 3 tailored to governing law/dispute resolution"
  ]
}}
```
Ensure the JSON output contains all three keys: risk_analysis, missing_clauses, and suggested_queries.
""",
        "query_rewrite_prompt": """
Given the following conversation history between a legal auditor and user, rewrite the latest follow-up question into a standalone, specific search query that incorporates necessary context from the conversation.
If the question is already standalone, return it unchanged. Do not answer the question; only return the rewritten query.

CONVERSATION HISTORY:
{history_text}

LATEST USER QUESTION:
{query}

STANDALONE QUERY:
""",
        "tree_search_prompt": """
Analyze the given query and hierarchical document structure.
Identify the minimal set of node IDs containing the facts to address the query.

SEARCH QUERY: {search_query}

DOCUMENT TREE:
{search_tree}

Output ONLY a valid JSON object matching this schema:
```json
{{
  "node_list": ["node_id_1", "node_id_2"]
}}
```
""",
        "self_correct_prompt": """
A direct search for the legal query failed to locate explicit section matches in the index.
As an autonomous legal reasoning agent, broaden your scope to locate relevant provisions:
1. Look for relevant parent sections, definitions, general terms, or termination/default provisions.
2. Check schedules, exhibits, annexures, or governing law clauses.
3. Return the best candidate node IDs to inspect.

SEARCH QUERY: {query}

DOCUMENT TREE:
{search_tree}

Output ONLY a valid JSON object matching this schema:
```json
{{
  "node_list": ["candidate_node_id_1", "candidate_node_id_2"]
}}
```
""",
        "rag_synthesis_prompt": """
Analyze the verified contract sections below to answer the user query concisely and authoritatively.

Answer Requirements:
- Answer concisely, authoritatively, and directly using ONLY the verified contract sections below.
- Cite the relevant contract provision inline using bracket notation (e.g. '[Section 4.4, Page 1]').
- Do NOT repeatedly cite the exact same section on every single sub-bullet; cite it once per main finding or clause group.
- Do NOT add a redundant summary paragraph that repeats clauses already cited in the bullets above.
- Do NOT append a separate 'Citations:', 'References:', or bibliography section at the end of the text.
- Keep formatting crisp, direct, and professional without verbose restatements.

{history_context}
USER QUERY: {query}

VERIFIED CONTRACT SECTIONS:
{context_string}
""",
        "rag_followup_prompt": """
Based on the contract context and user query below, formulate 3 concise, insightful follow-up legal questions that a counsel or auditor would naturally investigate next.

{history_context}
USER QUERY: {query}

CONTRACT CONTEXT:
{context_string}
""",
        "eval_context_precision_prompt": """
You are an expert legal compliance auditor evaluating Context Precision.

USER QUERY: {query}

RETRIEVED CONTRACT SECTIONS:
{retrieved_summary}

Scoring Rubric:
- Score 1.0: EVERY single retrieved node contains critical, directly actionable contract terms for the query.
- Score 0.7-0.99: Most nodes are relevant, but 1 node contains general boilerplate or tangential context.
- Score 0.4-0.69: Half or more of the retrieved nodes are irrelevant background clutter.
- Score 0.0-0.39: None of the retrieved nodes address the query.

Output strictly as JSON conforming to the requested schema.
""",
        "eval_context_recall_prompt": """
You are an expert legal compliance auditor evaluating Context Recall.

USER QUERY: {query}

RETRIEVED CONTRACT SECTIONS:
{retrieved_summary}

Scoring Rubric:
- Score 1.0: Complete context retrieved. All necessary parent clauses, definitions, and specific provisions are present.
- Score 0.7-0.99: Core clause retrieved, but related definitions, remedy periods, or governing law context are omitted.
- Score 0.3-0.69: Key operational clause missing from retrieval.
- Score 0.0-0.29: Essential contract provisions completely absent.

Output strictly as JSON conforming to the requested schema.
""",
        "eval_faithfulness_prompt": """
You are a strict compliance legal auditor auditing an AI's contract analysis for hallucinations.

VERIFIED CONTRACT CONTEXT:
{context_text}

AI-GENERATED ANSWER:
{generated_answer}

Task:
- Verify if every claim made in the AI-Generated Answer is strictly grounded in the Verified Contract Context.
- Identify any ungrounded assertions, invented dates, fabricated percentages, or fictitious clause numbers.
- Score Faithfulness from 1.0 (perfectly faithful, 0 hallucinations) to 0.0 (completely hallucinated).

Output strictly as JSON conforming to the schema.
""",
        "eval_relevancy_prompt": """
You are an expert legal evaluator assessing answer relevancy.

USER QUERY:
{query}

AI-GENERATED ANSWER:
{generated_answer}

Evaluate how directly, concisely, and completely the answer resolves the legal question.
Score from 1.0 (directly and fully responsive) to 0.0 (evasive or completely unrelated).

Output strictly as JSON conforming to the schema.
"""
    }

    def get_prompt(self, name: str, **kwargs) -> str:
        fallback = self.DEFAULTS.get(name, "")
        template = get_prompt_template(name, fallback)
        if kwargs:
            try:
                return template.format(**kwargs)
            except Exception:
                return template
        return template

_prompt_registry = PromptRegistry()

def get_registered_prompt(name: str, **kwargs) -> str:
    """Functional facade for prompt resolution."""
    return _prompt_registry.get_prompt(name, **kwargs)
