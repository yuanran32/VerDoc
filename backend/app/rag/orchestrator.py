from collections.abc import AsyncGenerator
from typing import Any

from app.rag.llm import stream_answer
from app.rag.prompt import build_answer_prompt
from app.rag.reranker import rerank
from app.rag.retriever import retrieve
from app.rag.schemas import Citation


async def answer_question(
    query: str,
    framework: str,
    version: str | None,
    history: list[dict[str, str]],
) -> AsyncGenerator[dict[str, Any], None]:
    del history
    retrieved = await retrieve(query=query, framework=framework, version=version)
    ranked = await rerank(query=query, chunks=retrieved)

    if not ranked:
        yield {
            "event": "error",
            "data": {
                "message": "当前知识库没有检索到足够证据，无法回答这个问题。"
            },
        }
        return

    prompt = build_answer_prompt(query=query, chunks=ranked)
    async for token in stream_answer(prompt):
        yield {"event": "token", "data": {"text": token}}

    citations = [
        Citation(
            id=str(index),
            title=" / ".join(item.chunk.heading_path) or item.chunk.id,
            source_url=item.chunk.source_url,
            excerpt=item.chunk.text,
        ).model_dump()
        for index, item in enumerate(ranked, start=1)
    ]
    yield {"event": "citations", "data": {"items": citations}}
    yield {"event": "done", "data": {"ok": True}}
