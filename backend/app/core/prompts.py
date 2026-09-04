from app.core.telemetry import get_prompt_template

class PromptRegistry:
    """
    Centralized Prompt Registry & Versioning Engine.
    Manages base prompt templates with remote Langfuse Cloud resolution.
    """
    DEFAULTS = {
        "audit_system_prompt": (
            "You are a Senior Enterprise Legal Compliance Auditor. You analyze hierarchical contract trees strictly "
            "based on the text provided. Output strictly a single valid JSON object conforming to the requested schema. "
            "Every clause_name MUST be a specific, descriptive legal concept (e.g., 'Uncapped Liability for Restriction Breach', 'Unilateral Termination for Convenience', 'Warranty Disclaimer & As-Is Provision'). "
            "NEVER use generic placeholder names like 'Clause' or 'Section'. "
            "Every section_title MUST specify the exact sub-clause or section heading from the document (e.g., 'Section 7.2: Warranty Disclaimer' or 'SECTION 7: WARRANTIES & DISCLAIMERS (Section 7.2)'). "
            "Every extracted_text MUST be the COMPLETE verbatim paragraph excerpt of the specific sub-clause analyzed, starting from its sub-number/title (e.g. '7.2 WARRANTY DISCLAIMER...') through to the end of that paragraph. NEVER return partial fragments or middle-of-sentence substrings. "
            "Every analysis MUST be an in-depth, multi-sentence legal risk assessment detailing legal exposure, statutory liability, and contractual imbalance. "
            "Every remedy_recommendation MUST be a specific strategic counter-language or redline proposal to negotiate better terms. "
            "Every missing_clause MUST contain a descriptive clause_name, detailed multi-sentence impact_description of statutory or financial exposure, and a complete multi-line standard enterprise boilerplate clause."
        ),
        "audit_human_template": """
Perform a comprehensive enterprise legal compliance audit on this contract. Output strictly a single valid JSON object.

DOCUMENT TREE:
{document_tree}

Extract strictly the Top 3 to 5 highest-risk clauses and critical missing safeguards.

Every risk_analysis item MUST include non-empty values for:
1. "clause_name": Descriptive title
2. "risk_level": "HIGH", "MEDIUM", or "LOW"
3. "section_title": Section name and number
4. "page_number": Integer page number
5. "extracted_text": Verbatim sentence from document
6. "analysis": Multi-sentence assessment explaining financial, operational, and legal liability. NEVER write brief generic phrases like "Potential legal exposure".
7. "remedy_recommendation": Concrete redline or counter-language recommendation to balance the terms.

Every missing_clauses item MUST include:
1. "clause_name": Name of standard omitted clause (e.g., Data Protection Addendum / DPA)
2. "severity": "HIGH", "MEDIUM", or "LOW"
3. "impact_description": Multi-sentence explanation of legal risk caused by its absence.
4. "suggested_language": Complete standard boilerplate legal clause (3+ lines) to insert.

Ensure "suggested_queries" contains exactly 3 context-specific legal questions.
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
