from app.core.prompts import get_registered_prompt
from app.schemas.eval import EvaluationReport

def test_eval_prompts():
    prec_prompt = get_registered_prompt("eval_context_precision_prompt", query="test", retrieved_summary="summary")
    assert "Context Precision" in prec_prompt
    assert "Scoring Rubric" in prec_prompt

    rec_prompt = get_registered_prompt("eval_context_recall_prompt", query="test", retrieved_summary="summary")
    assert "Context Recall" in rec_prompt
    assert "Scoring Rubric" in rec_prompt

def test_eval_schema():
    report = EvaluationReport(
        trace_id="trace-abc-123",
        session_id="session-xyz-789",
        query="Is liability capped?",
        context_precision=0.85,
        context_recall=0.90,
        faithfulness=1.0,
        answer_relevancy=0.95,
        hallucinations=[],
        reasoning_summary="Precision: 0.85 | Recall: 0.90 | Faithfulness: 1.0 | Relevancy: 0.95"
    )
    assert report.context_precision == 0.85
    assert report.context_recall == 0.90
    assert report.faithfulness == 1.0
    assert report.answer_relevancy == 0.95
