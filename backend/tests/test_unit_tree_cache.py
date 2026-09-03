import pytest
from app.services.redis_cache import (
    _cache_service,
    cache_contract_tree,
    get_cached_tree,
    invalidate_doc_tree
)
from app.services.rag_service import VectorlessRAGPipeline

def test_aes_gcm():
    secret_text = "Standard Indemnification Clause - Max Cap $1,000,000"
    encrypted = _cache_service._encrypt_payload(secret_text)
    assert encrypted != secret_text
    decrypted = _cache_service._decrypt_payload(encrypted)
    assert decrypted == secret_text

def test_tree_pruning():
    pipeline = VectorlessRAGPipeline()
    raw_tree = [
        {
            "node_id": "sec-1",
            "title": "Definitions",
            "page_index": 1,
            "summary": "Key contractual definitions.",
            "text": "Full definitions text...",
            "internal_metadata": "do_not_include"
        }
    ]
    pruned = pipeline.prune_tree(raw_tree)
    assert len(pruned) == 1
    assert "text" not in pruned[0]
    assert "internal_metadata" not in pruned[0]
    assert pruned[0]["title"] == "Definitions"

@pytest.mark.asyncio
async def test_tree_cache():
    test_user = "unit_test_user_123"
    test_doc = "unit_test_doc_456"
    test_tree = [
        {
            "node_id": "clause-1",
            "title": "Limitation of Liability",
            "page_index": 2,
            "summary": "Contact legal@company.com with SSN 000-12-3456.",
            "text": "Liability is capped."
        }
    ]

    cached = await cache_contract_tree(user_id=test_user, doc_id=test_doc, tree=test_tree)
    assert cached is True

    retrieved = await get_cached_tree(user_id=test_user, doc_id=test_doc)
    assert retrieved is not None
    assert len(retrieved) == 1
    assert "legal@company.com" not in retrieved[0]["summary"]

    deleted_count = await invalidate_doc_tree(user_id=test_user, doc_id=test_doc)
    assert deleted_count >= 1

    purged = await get_cached_tree(user_id=test_user, doc_id=test_doc)
    assert purged is None
