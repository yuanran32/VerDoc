import asyncio

from app.rag.llm import build_extractive_answer
from app.rag.orchestrator import answer_question
from app.rag.retriever import retrieve


def test_retrieve_definemodel_returns_vue_34_api_chunk() -> None:
    results = asyncio.run(
        retrieve(query="defineModel 怎么用?", framework="vue", version="3.4")
    )

    assert results
    assert results[0].chunk.id.startswith("vue@3.4:api/sfc-script-setup#definemodel")
    assert results[0].chunk.source_url
    assert results[0].chunk.source_url.endswith("#definemodel")
    assert results[0].chunk.version == "3.4"


def test_retrieve_returns_empty_for_unsupported_framework() -> None:
    results = asyncio.run(
        retrieve(query="useMemo 怎么用?", framework="react", version=None)
    )

    assert results == []


def test_retrieve_filters_by_requested_version() -> None:
    results = asyncio.run(
        retrieve(query="表单怎么做双向绑定?", framework="vue", version="3.3")
    )

    assert results
    assert results[0].chunk.version == "3.3"


def test_retrieve_returns_empty_for_low_evidence_query() -> None:
    results = asyncio.run(
        retrieve(query="React 的 useMemo 怎么用?", framework="vue", version="3.4")
    )

    assert results == []


def test_extractive_answer_cites_retrieved_chunks() -> None:
    chunks = asyncio.run(
        retrieve(query="watch 和 watchEffect 有什么区别?", framework="vue", version="3.4")
    )
    answer = build_extractive_answer(query="watch 和 watchEffect 有什么区别?", chunks=chunks)

    assert "watchEffect" in answer
    assert "[1]" in answer
    assert "适用版本：Vue 3.4" in answer


def test_answer_question_streams_tokens_citations_and_done() -> None:
    events = asyncio.run(
        _collect_events(
            answer_question(
                query="defineModel 怎么用?",
                framework="vue",
                version="3.4",
                history=[],
            )
        )
    )

    event_names = [event["event"] for event in events]
    assert "token" in event_names
    assert "citations" in event_names
    assert event_names[-1] == "done"

    citation_event = next(event for event in events if event["event"] == "citations")
    assert citation_event["data"]["items"][0]["source_url"].endswith("#definemodel")


def test_answer_question_reports_version_conflict_with_citation() -> None:
    events = asyncio.run(
        _collect_events(
            answer_question(
                query="defineModel 怎么用?",
                framework="vue",
                version="3.3",
                history=[],
            )
        )
    )

    token_text = "".join(
        event["data"]["text"] for event in events if event["event"] == "token"
    )
    assert "Vue 3.4" in token_text
    assert "Vue 3.3" in token_text
    assert "不适用" in token_text

    citation_event = next(event for event in events if event["event"] == "citations")
    assert citation_event["data"]["items"][0]["source_url"].endswith("#definemodel")
    assert events[-1]["event"] == "done"


def test_answer_question_rejects_unsupported_version() -> None:
    events = asyncio.run(
        _collect_events(
            answer_question(
                query="defineModel 怎么用?",
                framework="vue",
                version="3.2",
                history=[],
            )
        )
    )

    assert events == [
        {
            "event": "error",
            "data": {
                "message": "当前演示版只内置 Vue 3.4 / 3.3 文档，暂不支持其他版本。"
            },
        }
    ]


async def _collect_events(generator: object) -> list[dict[str, object]]:
    return [event async for event in generator]
