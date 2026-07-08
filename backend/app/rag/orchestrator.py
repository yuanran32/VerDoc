from collections.abc import AsyncGenerator
import re
from typing import Any

from app.rag.corpus import DEFAULT_FRAMEWORK, DEFAULT_VERSION, SUPPORTED_VERSIONS
from app.rag.llm import stream_answer
from app.rag.reranker import rerank
from app.rag.retriever import retrieve
from app.rag.schemas import Citation

VERSION_PATTERN = re.compile(r"(?:vue\s*)?(3\.[34])", re.IGNORECASE)
FOLLOW_UP_MARKERS = {
    "那",
    "这个",
    "上面",
    "它",
    "再",
    "继续",
    "例子",
    "示例",
    "建议",
    "区别",
    "3.3",
    "3.4",
}


async def answer_question(
    query: str,
    framework: str,
    version: str | None,
    history: list[dict[str, str]],
) -> AsyncGenerator[dict[str, Any], None]:
    if framework != DEFAULT_FRAMEWORK:
        yield {
            "event": "error",
            "data": {
                "message": "当前演示版只支持 Vue 3.4 文档问答，暂不覆盖其他框架。"
            },
        }
        return

    requested_version = resolve_requested_version(query=query, selected_version=version)
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

    search_query = build_contextual_query(query=query, history=history)
    retrieved = await retrieve(
        query=search_query,
        framework=framework,
        version=requested_version,
    )
    ranked = await rerank(query=search_query, chunks=retrieved)

    if not ranked:
        conflict_ranked = await _find_newer_version_evidence(
            query=search_query,
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


def resolve_requested_version(query: str, selected_version: str | None) -> str:
    match = VERSION_PATTERN.search(query)
    if match and match.group(1) in SUPPORTED_VERSIONS:
        return match.group(1)
    return selected_version or DEFAULT_VERSION


def build_contextual_query(query: str, history: list[dict[str, str]]) -> str:
    normalized_query = query.strip()
    previous_user_query = last_user_query(history)
    if not previous_user_query:
        return normalized_query

    if is_follow_up_query(normalized_query):
        return f"{previous_user_query} {normalized_query}"

    return normalized_query


def last_user_query(history: list[dict[str, str]]) -> str | None:
    for message in reversed(history):
        if message.get("role") == "user":
            content = message.get("content", "").strip()
            if content:
                return content
    return None


def is_follow_up_query(query: str) -> bool:
    normalized = query.strip().lower()
    if len(normalized) <= 12:
        return True

    return any(marker in normalized for marker in FOLLOW_UP_MARKERS)


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
