import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["feedback"])

DEFAULT_FEEDBACK_PATH = (
    Path(__file__).resolve().parents[3] / ".verdoc-data" / "feedback.jsonl"
)
MAX_RECENT_BAD_CASES = 5


class FeedbackCitation(BaseModel):
    id: str
    title: str
    source_url: str | None = None


class FeedbackRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=12000)
    rating: Literal["up", "down"]
    framework: str = "vue"
    version: str | None = None
    citations: list[FeedbackCitation] = Field(default_factory=list)
    note: str | None = Field(default=None, max_length=1000)


class FeedbackRecord(FeedbackRequest):
    created_at: str


@router.post("/feedback")
async def submit_feedback(payload: FeedbackRequest) -> dict[str, object]:
    record = FeedbackRecord(
        **payload.model_dump(),
        created_at=datetime.now(UTC).isoformat(),
    )
    append_feedback(record, resolve_feedback_path())
    return {"ok": True}


@router.get("/feedback/summary")
async def feedback_summary() -> dict[str, object]:
    records = load_feedback(resolve_feedback_path())
    up_count = sum(1 for record in records if record.rating == "up")
    down_count = sum(1 for record in records if record.rating == "down")
    recent_bad_cases = [
        record
        for record in reversed(records)
        if record.rating == "down"
    ][:MAX_RECENT_BAD_CASES]

    return {
        "total": len(records),
        "up": up_count,
        "down": down_count,
        "recent_bad_cases": [
            {
                "question": record.question,
                "note": record.note,
                "framework": record.framework,
                "version": record.version,
                "created_at": record.created_at,
            }
            for record in recent_bad_cases
        ],
    }


def append_feedback(record: FeedbackRecord, path: str | Path) -> None:
    feedback_path = Path(path).expanduser().resolve()
    feedback_path.parent.mkdir(parents=True, exist_ok=True)
    with feedback_path.open("a", encoding="utf-8") as file:
        file.write(record.model_dump_json() + "\n")


def load_feedback(path: str | Path) -> list[FeedbackRecord]:
    feedback_path = Path(path).expanduser().resolve()
    if not feedback_path.exists():
        return []

    records: list[FeedbackRecord] = []
    with feedback_path.open("r", encoding="utf-8") as file:
        for line in file:
            if line.strip():
                records.append(FeedbackRecord.model_validate(json.loads(line)))
    return records


def resolve_feedback_path() -> Path:
    env_path = os.getenv("VERDOC_FEEDBACK_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()
    return DEFAULT_FEEDBACK_PATH
