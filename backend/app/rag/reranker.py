from app.rag.schemas import RetrievedChunk


async def rerank(query: str, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """Placeholder reranker. Keeps the retrieval order for V0."""
    return chunks
