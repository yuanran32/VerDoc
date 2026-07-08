import asyncio
from pathlib import Path

from app.api import feedback
from app.api.feedback import (
    FeedbackRecord,
    FeedbackRequest,
    append_feedback,
    feedback_summary,
    load_feedback,
    submit_feedback,
)


def test_append_and_load_feedback(tmp_path: Path) -> None:
    feedback_file = tmp_path / "feedback.jsonl"
    record = FeedbackRecord(
        question="defineModel 怎么用?",
        answer="defineModel 是 Vue 3.4 的宏。",
        rating="up",
        framework="vue",
        version="3.4",
        created_at="2026-07-07T00:00:00+00:00",
    )

    append_feedback(record, feedback_file)

    loaded = load_feedback(feedback_file)
    assert len(loaded) == 1
    assert loaded[0].question == record.question
    assert loaded[0].rating == "up"


def test_submit_feedback_and_summary(
    tmp_path: Path,
    monkeypatch,
) -> None:
    feedback_file = tmp_path / "feedback.jsonl"
    monkeypatch.setattr(feedback, "resolve_feedback_path", lambda: feedback_file)

    asyncio.run(
        submit_feedback(
            FeedbackRequest(
                question="watch 和 watchEffect 有什么区别?",
                answer="watch 监听明确来源。",
                rating="up",
                framework="vue",
                version="3.4",
            )
        )
    )
    asyncio.run(
        submit_feedback(
            FeedbackRequest(
                question="React 的 useMemo 怎么用?",
                answer="当前知识库没有检索到足够证据。",
                rating="down",
                framework="vue",
                version="3.4",
                note="拒答文案还可以更清楚",
            )
        )
    )

    summary = asyncio.run(feedback_summary())

    assert summary["total"] == 2
    assert summary["up"] == 1
    assert summary["down"] == 1
    assert summary["recent_bad_cases"][0]["question"] == "React 的 useMemo 怎么用?"
