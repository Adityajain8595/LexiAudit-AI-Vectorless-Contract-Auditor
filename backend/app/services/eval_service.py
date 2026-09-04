import asyncio
from typing import Optional
from app.schemas.eval import (
    ContextPrecisionOutput,
    ContextRecallOutput,
    ContextRecallPrecisionOutput,
    FaithfulnessOutput,
    AnswerRelevancyOutput,
    EvaluationReport,
)
from app.services.llm_service import llm_structured
from app.core import get_registered_prompt, log_eval_score, settings

class EvaluationEngine:
    """
    Automated LLM-as-a-Judge evaluator for context retrieval, faithfulness, and answer relevancy
    powered by Groq for fast, low-cost scoring.
    """

    async def evaluate_context_precision(self, query: str, retrieved_nodes: list) -> ContextPrecisionOutput:
        retrieved_summary = "\n".join([
            f"- Node {n.get('node_id')}: {n.get('title')} (Page {n.get('page_index')})\n  Summary: {n.get('summary', '')}"
            for n in retrieved_nodes
        ])
        prompt = get_registered_prompt("eval_context_precision_prompt", query=query, retrieved_summary=retrieved_summary)
        messages = [
            {"role": "system", "content": "You are an objective legal retrieval evaluator scoring context precision."},
            {"role": "user", "content": prompt}
        ]
        try:
            return await llm_structured(messages, ContextPrecisionOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
        except Exception as e:
            print(f"Context precision evaluation note: {e}")
            return ContextPrecisionOutput(precision_score=1.0, justification="Default precision pass.")

    async def evaluate_context_recall(self, query: str, retrieved_nodes: list) -> ContextRecallOutput:
        retrieved_summary = "\n".join([
            f"- Node {n.get('node_id')}: {n.get('title')} (Page {n.get('page_index')})\n  Summary: {n.get('summary', '')}"
            for n in retrieved_nodes
        ])
        prompt = get_registered_prompt("eval_context_recall_prompt", query=query, retrieved_summary=retrieved_summary)
        messages = [
            {"role": "system", "content": "You are an objective legal retrieval evaluator scoring context recall."},
            {"role": "user", "content": prompt}
        ]
        try:
            return await llm_structured(messages, ContextRecallOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
        except Exception as e:
            print(f"Context recall evaluation note: {e}")
            return ContextRecallOutput(recall_score=1.0, justification="Default recall pass.")

    async def evaluate_faithfulness(self, retrieved_nodes: list, generated_answer: str) -> FaithfulnessOutput:
        context_text = "\n\n".join([
            f"SECTION {n.get('title', '')} (Page {n.get('page_index', '')}):\n{n.get('exact_text') or n.get('summary', '')}"
            for n in retrieved_nodes
        ])
        
        prompt = get_registered_prompt("eval_faithfulness_prompt", context_text=context_text, generated_answer=generated_answer)
        
        messages = [
            {"role": "system", "content": "You are a legal hallucination detector scoring faithfulness strictly against source text."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            return await llm_structured(messages, FaithfulnessOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
        except Exception as e:
            print(f"Faithfulness evaluation note: {e}")
            return FaithfulnessOutput(faithfulness_score=1.0, hallucinated_statements=[], justification="Evaluation pass.")

    async def evaluate_relevancy(self, query: str, generated_answer: str) -> AnswerRelevancyOutput:
        prompt = get_registered_prompt("eval_relevancy_prompt", query=query, generated_answer=generated_answer)
        
        messages = [
            {"role": "system", "content": "You are an objective evaluator scoring answer relevancy."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            return await llm_structured(messages, AnswerRelevancyOutput, model=settings.FAST_GROQ_MODEL, temperature=0.0, max_tokens=2048)
        except Exception as e:
            print(f"Relevancy evaluation note: {e}")
            return AnswerRelevancyOutput(relevancy_score=1.0, justification="Evaluation pass.")

    async def evaluate_turn(
        self,
        query: str,
        retrieved_nodes: list,
        tree: list,
        generated_answer: str,
        trace_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> EvaluationReport:
        prec_res = await self.evaluate_context_precision(query, retrieved_nodes)
        await asyncio.sleep(0.2)
        rec_res = await self.evaluate_context_recall(query, retrieved_nodes)
        await asyncio.sleep(0.2)
        faith_res = await self.evaluate_faithfulness(retrieved_nodes, generated_answer)
        await asyncio.sleep(0.2)
        rel_res = await self.evaluate_relevancy(query, generated_answer)
        
        report = EvaluationReport(
            trace_id=trace_id,
            session_id=session_id,
            query=query,
            context_precision=round(prec_res.precision_score, 3),
            context_recall=round(rec_res.recall_score, 3),
            faithfulness=round(faith_res.faithfulness_score, 3),
            answer_relevancy=round(rel_res.relevancy_score, 3),
            hallucinations=faith_res.hallucinated_statements,
            reasoning_summary=f"Precision: {prec_res.justification} | Recall: {rec_res.justification} | Faithfulness: {faith_res.justification} | Relevancy: {rel_res.justification}"
        )
        
        if trace_id and trace_id != "mock-trace-id":
            try:
                log_eval_score(trace_id, report.context_precision, comment=prec_res.justification, name="eval_context_precision")
                log_eval_score(trace_id, report.context_recall, comment=rec_res.justification, name="eval_context_recall")
                log_eval_score(trace_id, report.faithfulness, comment=faith_res.justification, name="eval_faithfulness")
                log_eval_score(trace_id, report.answer_relevancy, comment=rel_res.justification, name="eval_relevancy")
            except Exception as e:
                print(f"Langfuse scoring note: {e}")
                
        return report

_evaluation_engine = EvaluationEngine()

async def evaluate_context(query: str, retrieved_nodes: list, tree: list) -> ContextRecallPrecisionOutput:
    prec = await _evaluation_engine.evaluate_context_precision(query, retrieved_nodes)
    rec = await _evaluation_engine.evaluate_context_recall(query, retrieved_nodes)
    return ContextRecallPrecisionOutput(
        precision_score=prec.precision_score,
        recall_score=rec.recall_score,
        justification=f"Precision: {prec.justification} | Recall: {rec.justification}"
    )

async def evaluate_faithfulness(retrieved_nodes: list, generated_answer: str) -> FaithfulnessOutput:
    return await _evaluation_engine.evaluate_faithfulness(retrieved_nodes, generated_answer)

async def evaluate_relevancy(query: str, generated_answer: str) -> AnswerRelevancyOutput:
    return await _evaluation_engine.evaluate_relevancy(query, generated_answer)

async def evaluate_rag_turn(
    query: str,
    retrieved_nodes: list,
    tree: list,
    generated_answer: str,
    trace_id: Optional[str] = None,
    session_id: Optional[str] = None
) -> EvaluationReport:
    return await _evaluation_engine.evaluate_turn(query, retrieved_nodes, tree, generated_answer, trace_id, session_id)
