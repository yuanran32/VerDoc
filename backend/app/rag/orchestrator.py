from collections.abc import AsyncGenerator
from typing import Any

from app.rag.corpus import DEFAULT_FRAMEWORK, DEFAULT_VERSION, SUPPORTED_VERSIONS
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

    requested_version = version or DEFAULT_VERSION
    if requested_version not in SUPPORTED_VERSIONS:
        yield {
            "event": "error",
            "data": {
                "message": (
                    "当前演示版只内置 Vue "
                    f"{' / '.join(SUPPORTED_VERSIONS)} 文档，暂不支持其他版本。"
                )
            },
        }
        return

    retrieved = await retrieve(query=query, framework=framework, version=requested_version)
    ranked = await rerank(query=query, chunks=retrieved)

    if not ranked:
        conflict_ranked = await _find_newer_version_evidence(
            query=query,
            framework=framework,
            requested_version=requested_version,
        )
        if conflict_ranked:
            async for event in _stream_version_conflict_answer(
                requested_version=requested_version,
                chunks=conflict_ranked,
            ):
                yield event
            return

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


async def _find_newer_version_evidence(
    query: str,
    framework: str,
    requested_version: str,
) -> list:
    if requested_version == DEFAULT_VERSION:
        return []

    retrieved = await retrieve(query=query, framework=framework, version=DEFAULT_VERSION)
    return await rerank(query=query, chunks=retrieved)


async def _stream_version_conflict_answer(
    requested_version: str,
    chunks: list,
) -> AsyncGenerator[dict[str, Any], None]:
    primary = chunks[0]
    available_version = primary.chunk.version or DEFAULT_VERSION
    answer = "\n".join(
        [
            f"当前选择的是 Vue {requested_version}，检索不到该 API 在此版本可用的官方证据。",
            "",
            (
                f"在 Vue {available_version} 文档中可以找到相关说明："
                f"{primary.chunk.text} [1]"
            ),
            "",
            f"版本提示：如果要使用这个能力，请切换到 Vue {available_version} 或更高版本；"
            f"如果项目仍停留在 Vue {requested_version}，应继续使用该版本文档中支持的写法。",
            "",
            f"适用版本：Vue {available_version}。当前选择版本 Vue {requested_version} 不适用。",
        ]
    )

    for token in _split_for_streaming(answer):
        yield {"event": "token", "data": {"text": token}}

    citations = [
        Citation(
            id=str(index),
            title=" / ".join(item.chunk.heading_path) or item.chunk.id,
            source_url=item.chunk.source_url,
            excerpt=item.chunk.text,
        ).model_dump()
        for index, item in enumerate(chunks, start=1)
    ]
    yield {"event": "citations", "data": {"items": citations}}
    yield {"event": "done", "data": {"ok": True, "version_conflict": True}}


def _split_for_streaming(text: str, chunk_size: int = 36) -> list[str]:
    return [text[index : index + chunk_size] for index in range(0, len(text), chunk_size)]
