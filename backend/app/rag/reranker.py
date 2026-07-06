from collections import Counter

from app.rag.retriever import (
    chunk_search_text,
    is_api_like,
    is_specific_cjk_term,
    tokenize,
)
from app.rag.schemas import DocumentChunk, RetrievedChunk


async def rerank(query: str, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """Lightweight V2 reranker for the local demo corpus.

    It preserves the external async boundary so a model/API reranker can replace
    this implementation later.
    """
    if not chunks:
        return []

    query_terms = tokenize(query)
    scored = [
        RetrievedChunk(
            chunk=item.chunk,
            score=item.score + rerank_score(query, query_terms, item.chunk),
            rank=0,
        )
        for item in chunks
    ]
    ranked = sorted(scored, key=lambda item: item.score, reverse=True)
    return [
        RetrievedChunk(chunk=item.chunk, score=item.score, rank=rank)
        for rank, item in enumerate(ranked, start=1)
    ]


def rerank_score(
    query: str,
    query_terms: Counter[str],
    chunk: DocumentChunk,
) -> float:
    chunk_terms = tokenize(chunk_search_text(chunk))
    matched_terms = set(query_terms).intersection(chunk_terms)
    api_terms = {term for term in query_terms if is_api_like(term)}
    heading_text = " ".join(chunk.heading_path).lower()
    search_text = chunk_search_text(chunk).lower()

    score = 0.0
    score += 3.0 * len(matched_terms) / max(len(query_terms), 1)

    for term in matched_terms:
        if is_api_like(term):
            score += 4.0
            if term in heading_text or term in chunk.id.lower():
                score += 3.0

        if is_specific_cjk_term(term) and term in heading_text:
            score += 1.5

    if api_terms and api_terms.issubset(matched_terms):
        score += 4.0

    normalized_query = query.lower().strip()
    if normalized_query and normalized_query in search_text:
        score += 5.0

    if _has_migration_intent(query_terms) and _is_migration_chunk(chunk):
        score += 4.0

    if _asks_for_difference(query) and len(api_terms.intersection(matched_terms)) >= 2:
        score += 2.0

    if chunk.chunk_type == "api-ref" and api_terms.intersection(matched_terms):
        score += 1.5

    return score


def _has_migration_intent(query_terms: Counter[str]) -> bool:
    return bool({"迁移", "升级", "升到", "改写", "移除", "breaking"}.intersection(query_terms))


def _is_migration_chunk(chunk: DocumentChunk) -> bool:
    search_text = chunk_search_text(chunk)
    return "迁移" in search_text or "migration" in search_text.lower()


def _asks_for_difference(query: str) -> bool:
    return "区别" in query or "不同" in query or "差异" in query
