import asyncio

from app.rag.fusion import reciprocal_rank_fusion
from app.rag.reranker import rerank
from app.rag.retriever import retrieve
from app.rag.schemas import DocumentChunk, RetrievedChunk


def test_retrieve_cjk_binding_query_finds_form_v_model_chunk() -> None:
    results = asyncio.run(
        retrieve(query="表单怎么做双向绑定?", framework="vue", version="3.4")
    )

    assert results
    assert "双向绑定" in results[0].chunk.text or "v-model" in results[0].chunk.id


def test_retrieve_migration_query_prefers_filters_chunk() -> None:
    results = asyncio.run(
        retrieve(query="Vue2 的 filters 升到 Vue3 怎么改?", framework="vue", version="3.4")
    )

    assert results == [] or "filters" in results[0].chunk.id


def test_rerank_prefers_api_reference_for_definemodel() -> None:
    retrieved = asyncio.run(
        retrieve(query="defineModel 怎么用?", framework="vue", version="3.4")
    )
    ranked = asyncio.run(rerank(query="defineModel 怎么用?", chunks=retrieved))

    assert ranked[0].chunk.id.startswith("vue@3.4:api/sfc-script-setup#definemodel")
    assert ranked[0].score > retrieved[0].score


def test_retrieve_computed_cache_question_prefers_computed_chunk() -> None:
    results = asyncio.run(
        retrieve(query="computed 和 methods 缓存区别", framework="vue", version="3.4")
    )

    assert results
    assert results[0].chunk.id.startswith("vue@3.4:guide/essentials/computed#")


def test_reciprocal_rank_fusion_promotes_consistent_hits() -> None:
    chunk_a = DocumentChunk(id="a", text="alpha", framework="vue")
    chunk_b = DocumentChunk(id="b", text="beta", framework="vue")

    fused = reciprocal_rank_fusion(
        [
            [RetrievedChunk(chunk=chunk_a, score=3, rank=1)],
            [
                RetrievedChunk(chunk=chunk_b, score=4, rank=1),
                RetrievedChunk(chunk=chunk_a, score=2, rank=2),
            ],
        ]
    )

    assert fused[0].chunk.id == "a"
    assert fused[0].score > fused[1].score
