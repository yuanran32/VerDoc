from collections.abc import AsyncGenerator
from typing import Any

from app.rag.corpus import DEFAULT_FRAMEWORK, DEFAULT_VERSION
from app.rag.llm import stream_answer
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

    if framework != DEFAULT_FRAMEWORK:
        yield {
            "event": "error",
            "data": {
                "message": "当前演示版只支持 Vue 3.4 文档问答，暂不覆盖其他框架。"
            },
        }
        return

    if version is not None and version != DEFAULT_VERSION:
        yield {
            "event": "error",
            "data": {
                "message": "当前演示版只内置 Vue 3.4 单版本文档，暂不支持其他版本。"
            },
        }
        return

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

    async for token in stream_answer(query=query, chunks=ranked):
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
