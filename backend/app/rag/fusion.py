from app.rag.schemas import RetrievedChunk


def reciprocal_rank_fusion(
    result_sets: list[list[RetrievedChunk]],
    k: int = 60,
) -> list[RetrievedChunk]:
    scores: dict[str, float] = {}
    chunks: dict[str, RetrievedChunk] = {}

    for results in result_sets:
        for index, result in enumerate(results):
            chunk_id = result.chunk.id
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + index + 1)
            chunks[chunk_id] = result

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    return [
        RetrievedChunk(chunk=chunks[chunk_id].chunk, score=score, rank=rank)
        for rank, (chunk_id, score) in enumerate(ranked, start=1)
    ]
