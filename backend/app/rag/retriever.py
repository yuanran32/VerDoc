from app.rag.schemas import DocumentChunk, RetrievedChunk


async def retrieve(
    query: str,
    framework: str,
    version: str | None,
    limit: int = 5,
) -> list[RetrievedChunk]:
    """Placeholder retriever until Chroma, BM25, and rerank are wired in."""
    sample_chunk = DocumentChunk(
        id="vue@3.4:guide/essentials/watchers#watcheffect:0001",
        text="watchEffect automatically tracks reactive dependencies accessed during its synchronous execution.",
        framework=framework,
        version=version or "3.4",
        source_path="src/guide/essentials/watchers.md",
        source_url="https://cn.vuejs.org/guide/essentials/watchers.html",
        heading_path=["Guide", "Essentials", "Watchers", "watchEffect"],
    )
    return [RetrievedChunk(chunk=sample_chunk, score=1.0, rank=1)][:limit]
