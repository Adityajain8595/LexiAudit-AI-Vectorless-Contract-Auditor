import pytest
from app.services.rag_service import VectorlessRAGPipeline, run_rag_direct

def test_history_formatting():
    pipeline = VectorlessRAGPipeline()
    history = [
        {"sender": "user", "content": "What is the termination period?"},
        {"sender": "assistant", "content": "The termination period is 30 days notice."}
    ]
    formatted = pipeline.format_history(history)
    assert "User: What is the termination period?" in formatted
    assert "Auditor: The termination period is 30 days notice." in formatted

def test_find_nodes():
    pipeline = VectorlessRAGPipeline()
    tree = [
        {
            "node_id": "sec-1",
            "title": "Section 1",
            "nodes": [
                {"node_id": "sec-1.1", "title": "Subsection 1.1"}
            ]
        },
        {"node_id": "sec-2", "title": "Section 2"}
    ]
    matched = pipeline.find_nodes(tree, ["sec-1.1"])
    assert len(matched) == 1
    assert matched[0]["title"] == "Subsection 1.1"

@pytest.mark.asyncio
async def test_rag_pipeline():
    sample_tree = [
        {
            "node_id": "clause-indemnity",
            "title": "Indemnification & Hold Harmless",
            "page_index": 4,
            "summary": "Both parties agree to indemnify for third party IP claims.",
            "text": "Section 4.1 Indemnification: Each party shall defend and hold harmless the other party."
        }
    ]
    result = await run_rag_direct(
        query="What are the indemnification requirements?",
        tree=sample_tree,
        chat_history=[]
    )
    assert "answer" in result
    assert "cited_nodes" in result
    assert "suggested_queries" in result
    assert len(result["cited_nodes"]) >= 1
