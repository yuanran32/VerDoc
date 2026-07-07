import json
import math
import os
import re
from collections import Counter
from collections.abc import Iterable
from functools import lru_cache
from pathlib import Path

from app.rag.corpus import (
    DEFAULT_FRAMEWORK,
    DEFAULT_VERSION,
    SUPPORTED_VERSIONS,
    load_chunks,
)
from app.rag.fusion import reciprocal_rank_fusion
from app.rag.schemas import DocumentChunk, RetrievedChunk

TOKEN_PATTERN = re.compile(r"[a-zA-Z][a-zA-Z0-9_-]*|\d+(?:\.\d+)?|[\u4e00-\u9fff]+")
CJK_PATTERN = re.compile(r"^[\u4e00-\u9fff]+$")
STOP_TOKENS = {
    "vue",
    "the",
    "and",
    "for",
    "with",
    "的",
    "了",
    "吗",
    "怎么",
    "什么",
    "如何",
    "区别",
    "使用",
    "用法",
    "一个",
    "这个",
    "那个",
    "可以",
    "需要",
    "时候",
}
RETRIEVAL_POOL_SIZE = 12
VECTOR_SIMILARITY_THRESHOLD = 0.05
DEFAULT_VECTOR_INDEX_PATH = (
    Path(__file__).resolve().parents[3] / ".verdoc-data" / "vectors" / "vue-index.jsonl"
)
UNSUPPORTED_API_PATTERNS = {
    "usememo",
    "usestate",
    "useeffect",
    "usereducer",
    "usecallback",
    "usecontext",
}
SEMANTIC_EXPANSIONS = {
    "状态同步": ["双向绑定", "v-model", "modelvalue", "update"],
    "保持同步": ["双向绑定", "v-model", "modelvalue", "update"],
    "数据同步": ["双向绑定", "v-model", "modelvalue", "update"],
    "输入框": ["表单", "文本输入", "v-model"],
    "父子组件同步": ["组件", "v-model", "modelvalue", "update"],
    "文本格式化": ["filters", "computed", "methods", "迁移"],
}


async def retrieve(
    query: str,
    framework: str,
    version: str | None,
    limit: int = 5,
) -> list[RetrievedChunk]:
    """Retrieve Vue docs with BM25 + keyword + local vector recall + RRF fusion."""
    if framework != DEFAULT_FRAMEWORK:
        return []

    if is_unsupported_api_query(query):
        return []

    requested_version = version or DEFAULT_VERSION
    if requested_version not in SUPPORTED_VERSIONS:
        return []

    query_terms = tokenize(query)
    if not query_terms:
        return []

    index = get_index()
    pool_size = max(limit * 3, RETRIEVAL_POOL_SIZE)
    candidate_chunks = index.filter_chunks(
        framework=framework,
        version=requested_version,
    )
    if not candidate_chunks:
        return []

    bm25_results = bm25_retrieve(
        query_terms=query_terms,
        chunks=candidate_chunks,
        index=index,
        limit=pool_size,
    )
    keyword_results = keyword_retrieve(
        query=query,
        query_terms=query_terms,
        chunks=candidate_chunks,
        index=index,
        limit=pool_size,
    )
    vector_results = vector_retrieve(
        query=query,
        chunks=candidate_chunks,
        index=index,
        limit=pool_size,
    )

    fused = reciprocal_rank_fusion([bm25_results, keyword_results, vector_results])
    ranked = fused[:limit]
    return [
        RetrievedChunk(chunk=item.chunk, score=item.score, rank=rank)
        for rank, item in enumerate(ranked, start=1)
    ]


class LocalIndex:
    def __init__(self, chunks: list[DocumentChunk]) -> None:
        self.chunks = chunks
        persisted_vectors = load_vector_index(chunks)
        self.document_terms = {
            chunk.id: tokenize(chunk_search_text(chunk)) for chunk in chunks
        }
        self.document_vectors = {
            chunk.id: persisted_vectors.get(chunk.id, vectorize_text(chunk_search_text(chunk)))
            for chunk in chunks
        }
        self.document_frequency = document_frequency(self.document_terms.values())
        self.document_count = len(chunks)
        self.document_lengths = {
            chunk_id: sum(terms.values())
            for chunk_id, terms in self.document_terms.items()
        }
        total_length = sum(self.document_lengths.values())
        self.average_document_length = total_length / max(self.document_count, 1)

    def filter_chunks(self, framework: str, version: str) -> list[DocumentChunk]:
        return [
            chunk
            for chunk in self.chunks
            if chunk.framework == framework and chunk.version == version
        ]


@lru_cache(maxsize=1)
def get_index() -> LocalIndex:
    return LocalIndex(load_chunks())


def load_vector_index(chunks: list[DocumentChunk]) -> dict[str, Counter[str]]:
    index_path = resolve_vector_index_path()
    if not index_path or not index_path.exists():
        return {}

    valid_chunk_ids = {chunk.id for chunk in chunks}
    vectors: dict[str, Counter[str]] = {}

    with index_path.open("r", encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue

            record = json.loads(line)
            chunk_id = record.get("id")
            raw_vector = record.get("vector")
            if chunk_id not in valid_chunk_ids or not isinstance(raw_vector, dict):
                continue

            vectors[chunk_id] = Counter(
                {
                    str(term): float(weight)
                    for term, weight in raw_vector.items()
                    if isinstance(weight, int | float) and weight > 0
                }
            )

    return vectors


def resolve_vector_index_path() -> Path | None:
    env_path = os.getenv("VERDOC_VECTOR_INDEX_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()

    return DEFAULT_VECTOR_INDEX_PATH


def bm25_retrieve(
    query_terms: Counter[str],
    chunks: list[DocumentChunk],
    index: LocalIndex,
    limit: int,
) -> list[RetrievedChunk]:
    scored: list[RetrievedChunk] = []

    for chunk in chunks:
        if not has_sufficient_evidence(query_terms=query_terms, chunk=chunk, index=index):
            continue

        score = bm25_score(query_terms=query_terms, chunk=chunk, index=index)
        if score > 0:
            scored.append(RetrievedChunk(chunk=chunk, score=score, rank=0))

    return rerank_by_score(scored, limit=limit)


def keyword_retrieve(
    query: str,
    query_terms: Counter[str],
    chunks: list[DocumentChunk],
    index: LocalIndex,
    limit: int,
) -> list[RetrievedChunk]:
    scored: list[RetrievedChunk] = []

    for chunk in chunks:
        if not has_sufficient_evidence(query_terms=query_terms, chunk=chunk, index=index):
            continue

        score = keyword_score(query=query, query_terms=query_terms, chunk=chunk, index=index)
        if score > 0:
            scored.append(RetrievedChunk(chunk=chunk, score=score, rank=0))

    return rerank_by_score(scored, limit=limit)


def vector_retrieve(
    query: str,
    chunks: list[DocumentChunk],
    index: LocalIndex,
    limit: int,
) -> list[RetrievedChunk]:
    query_vector = vectorize_text(query)
    if not query_vector:
        return []

    query_terms = tokenize(query)
    filters_migration_intent = _has_filters_migration_intent(query, query_terms)
    scored: list[RetrievedChunk] = []
    for chunk in chunks:
        if filters_migration_intent and "filters" not in chunk_search_text(chunk).lower():
            continue

        score = cosine_similarity(
            query_vector,
            index.document_vectors[chunk.id],
        ) + vector_intent_score(query, query_terms, chunk)
        if score >= VECTOR_SIMILARITY_THRESHOLD:
            scored.append(RetrievedChunk(chunk=chunk, score=score, rank=0))

    return rerank_by_score(scored, limit=limit)


def bm25_score(
    query_terms: Counter[str],
    chunk: DocumentChunk,
    index: LocalIndex,
    k1: float = 1.5,
    b: float = 0.75,
) -> float:
    chunk_terms = index.document_terms[chunk.id]
    document_length = index.document_lengths[chunk.id]
    score = 0.0

    for term, query_frequency in query_terms.items():
        term_frequency = chunk_terms.get(term, 0)
        if term_frequency == 0:
            continue

        idf = bm25_idf(term, index)
        denominator = term_frequency + k1 * (
            1 - b + b * document_length / max(index.average_document_length, 1)
        )
        score += idf * (term_frequency * (k1 + 1) / denominator) * min(
            query_frequency,
            3,
        )

    return score


def keyword_score(
    query: str,
    query_terms: Counter[str],
    chunk: DocumentChunk,
    index: LocalIndex,
) -> float:
    chunk_terms = index.document_terms[chunk.id]
    matched_terms = set(query_terms).intersection(chunk_terms)
    if not matched_terms:
        return 0.0

    search_text = chunk_search_text(chunk).lower()
    heading_text = " ".join(chunk.heading_path).lower()
    normalized_query = query.lower().strip()
    api_terms = {term for term in query_terms if is_api_like(term)}

    score = 2.0 * len(matched_terms) / max(len(query_terms), 1)

    if normalized_query and normalized_query in search_text:
        score += 6.0

    for term in matched_terms:
        if is_api_like(term):
            score += 4.0
            if term in heading_text or term in chunk.id.lower():
                score += 2.0

        if is_specific_cjk_term(term):
            score += 0.75
            if term in heading_text:
                score += 1.25

    if api_terms and api_terms.issubset(matched_terms):
        score += 3.0

    if _is_migration_query(query_terms) and _is_migration_chunk(chunk):
        score += 4.0

    if "区别" in query and len(api_terms.intersection(matched_terms)) >= 2:
        score += 2.0

    return score


def has_sufficient_evidence(
    query_terms: Counter[str],
    chunk: DocumentChunk,
    index: LocalIndex,
) -> bool:
    chunk_terms = index.document_terms[chunk.id]
    matched_terms = set(query_terms).intersection(chunk_terms)
    api_terms = {term for term in query_terms if is_api_like(term)}

    if api_terms and not api_terms.intersection(matched_terms):
        return False

    specific_matches = [
        term
        for term in matched_terms
        if is_api_like(term) or is_specific_cjk_term(term)
    ]
    return len(specific_matches) >= 1


def rerank_by_score(chunks: list[RetrievedChunk], limit: int) -> list[RetrievedChunk]:
    ranked = sorted(chunks, key=lambda item: item.score, reverse=True)[:limit]
    return [
        RetrievedChunk(chunk=item.chunk, score=item.score, rank=rank)
        for rank, item in enumerate(ranked, start=1)
    ]


def tokenize(text: str) -> Counter[str]:
    terms: list[str] = []

    for raw_token in TOKEN_PATTERN.findall(text.lower()):
        if CJK_PATTERN.match(raw_token):
            terms.extend(split_cjk_token(raw_token))
        else:
            terms.append(raw_token)

    filtered = [term for term in terms if term and term not in STOP_TOKENS]
    return Counter(filtered)


def vectorize_text(text: str) -> Counter[str]:
    vector = Counter[str]()
    vector.update(tokenize(text))

    normalized = text.lower()
    for phrase, expansions in SEMANTIC_EXPANSIONS.items():
        if phrase.lower() in normalized:
            for expansion in expansions:
                vector[expansion.lower()] += 3

    return vector


def cosine_similarity(left: Counter[str], right: Counter[str]) -> float:
    if not left or not right:
        return 0.0

    shared_terms = set(left).intersection(right)
    dot_product = sum(left[term] * right[term] for term in shared_terms)
    if dot_product == 0:
        return 0.0

    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    return dot_product / max(left_norm * right_norm, 1.0)


def vector_intent_score(
    query: str,
    query_terms: Counter[str],
    chunk: DocumentChunk,
) -> float:
    chunk_id = chunk.id.lower()
    source_path = (chunk.source_path or "").lower()
    score = 0.0

    for term in query_terms:
        if is_api_like(term):
            if f"#{term}" in chunk_id:
                score += 0.12
            elif term in chunk_id:
                score += 0.04

    if any(phrase in query for phrase in ("输入框", "表单", "文本输入")):
        if "forms" in source_path:
            score += 0.3

    if _has_filters_migration_intent(query, query_terms):
        if "filters" in chunk_id:
            score += 0.14
        elif _is_migration_chunk(chunk):
            score += 0.06

    if chunk.chunk_type == "code":
        score -= 0.1

    return score


def _has_filters_migration_intent(query: str, query_terms: Counter[str]) -> bool:
    has_filter_term = "filters" in query_terms or "filter" in query_terms or "过滤器" in query
    return has_filter_term and _is_migration_query(query_terms)


def is_unsupported_api_query(query: str) -> bool:
    terms = tokenize(query)
    has_react = "react" in terms
    has_unsupported_api = bool(UNSUPPORTED_API_PATTERNS.intersection(terms))
    return has_react and has_unsupported_api


def split_cjk_token(token: str) -> list[str]:
    if len(token) <= 1:
        return [token]

    terms = [token]
    terms.extend(token[index : index + 2] for index in range(len(token) - 1))

    if len(token) >= 3:
        terms.extend(token[index : index + 3] for index in range(len(token) - 2))

    return terms


def document_frequency(term_sets: Iterable[Counter[str]]) -> Counter[str]:
    frequency: Counter[str] = Counter()
    for terms in term_sets:
        frequency.update(set(terms))
    return frequency


def bm25_idf(term: str, index: LocalIndex) -> float:
    appearances = index.document_frequency.get(term, 0)
    return math.log(1 + (index.document_count - appearances + 0.5) / (appearances + 0.5))


def chunk_search_text(chunk: DocumentChunk) -> str:
    return " ".join(
        [
            chunk.id,
            chunk.text,
            chunk.source_path or "",
            chunk.source_url or "",
            " ".join(chunk.heading_path),
            chunk.chunk_type,
        ]
    )


def is_api_like(term: str) -> bool:
    return any(character.isascii() and character.isalpha() for character in term) and (
        len(term) >= 4 or "-" in term
    )


def is_specific_cjk_term(term: str) -> bool:
    return len(term) >= 2 and CJK_PATTERN.match(term) is not None


def _is_migration_query(query_terms: Counter[str]) -> bool:
    return bool({"迁移", "升级", "升到", "改写", "移除", "breaking"}.intersection(query_terms))


def _is_migration_chunk(chunk: DocumentChunk) -> bool:
    text = chunk_search_text(chunk)
    return "迁移" in text or "migration" in text.lower()
