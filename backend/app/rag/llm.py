from collections.abc import AsyncGenerator

from app.rag.corpus import DEFAULT_VERSION
from app.rag.schemas import RetrievedChunk


async def stream_answer(
    query: str,
    chunks: list[RetrievedChunk],
) -> AsyncGenerator[str, None]:
    """Stream a deterministic V0 answer grounded in retrieved chunks.

    This module keeps the same boundary that a real LLM client will use later,
    but V0 stays offline and reproducible.
    """
    answer = build_extractive_answer(query=query, chunks=chunks)
    for token in _split_for_streaming(answer):
        yield token


def build_extractive_answer(query: str, chunks: list[RetrievedChunk]) -> str:
    del query

    if not chunks:
        return "当前知识库没有检索到足够证据，无法回答这个问题。"

    primary = chunks[0]
    supporting = chunks[1:3]

    lines = [
        f"基于 Vue {primary.chunk.version or DEFAULT_VERSION} 官方文档，结论如下：",
        "",
        f"{primary.chunk.text} [1]",
    ]

    for index, item in enumerate(supporting, start=2):
        lines.extend(["", f"补充依据：{item.chunk.text} [{index}]"])

    lines.extend(
        [
            "",
            f"适用版本：Vue {primary.chunk.version or DEFAULT_VERSION}。",
            "以上内容只来自当前检索到的文档片段；如果问题超出这些片段，V0 不会继续扩展推断。",
        ]
    )
    return "\n".join(lines)


def _split_for_streaming(text: str, chunk_size: int = 36) -> list[str]:
    return [text[index : index + chunk_size] for index in range(0, len(text), chunk_size)]
