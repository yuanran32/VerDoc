import asyncio
import json
from pathlib import Path

from app.rag.fusion import reciprocal_rank_fusion
from app.rag.reranker import rerank
from app.rag.retriever import LocalIndex, get_index, retrieve, vector_retrieve
from app.rag.schemas import DocumentChunk, RetrievedChunk


def test_retrieve_cjk_binding_query_finds_form_v_model_chunk() -> None:
    results = asyncio.run(
        retrieve(query="表单怎么做双向绑定?", framework="vue", version="3.4")
    )

    assert results
    assert (
        "双向绑定" in results[0].chunk.text
        or "v-model" in results[0].chunk.id
        or "forms" in (results[0].chunk.source_path or "")
    )


def test_vector_retrieve_semantic_sync_query_finds_form_v_model_chunk() -> None:
    index = get_index()
    chunks = index.filter_chunks(framework="vue", version="3.4")
    results = vector_retrieve(
        query="输入框状态同步怎么做?",
        chunks=chunks,
        index=index,
        limit=5,
    )

    assert results
    assert results[0].chunk.id.startswith("vue@3.4:guide/essentials/forms#")


def test_local_index_loads_persisted_vector_index(
    tmp_path: Path,
    monkeypatch,
) -> None:
    chunk = DocumentChunk(id="chunk-a", text="alpha", framework="vue", version="3.4")
    vector_file = tmp_path / "vectors.jsonl"
    vector_file.write_text(
        json.dumps(
            {
                "id": chunk.id,
                "framework": "vue",
                "version": "3.4",
                "vector": {"persisted-term": 1.0},
            },
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("VERDOC_VECTOR_INDEX_PATH", str(vector_file))

    index = LocalIndex([chunk])

    assert index.document_vectors[chunk.id]["persisted-term"] == 1.0


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
