from app.rag.schemas import RetrievedChunk


def build_answer_prompt(query: str, chunks: list[RetrievedChunk]) -> str:
    context = "\n\n".join(
        f"[{index}] {item.chunk.text}" for index, item in enumerate(chunks, start=1)
    )
    return (
        "You are VerDoc, a version-aware documentation assistant. "
        "Answer only from the provided context and cite sources with [n].\n\n"
        f"Question: {query}\n\n"
        f"Context:\n{context}"
    )
