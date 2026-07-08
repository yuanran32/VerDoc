import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.api.rate_limit import check_chat_rate_limit
from app.api.usage_metrics import ChatMetricRecord, chat_metrics, now_ms
from app.rag.orchestrator import answer_question

router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    framework: str = "vue"
    version: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)


@router.post("/chat")
async def chat(payload: ChatRequest, request: Request) -> EventSourceResponse:
    rate_limit = check_chat_rate_limit(request)

    async def event_stream() -> AsyncGenerator[dict[str, str], None]:
        start_ms = now_ms()
        output_chars = 0
        citation_count = 0
        status = "stream_closed"

        try:
            async for event in answer_question(
                query=payload.query,
                framework=payload.framework,
                version=payload.version,
                history=[message.model_dump() for message in payload.history],
            ):
                event_name = event["event"]
                data = event["data"]

                if event_name == "token":
                    output_chars += len(str(data.get("text", "")))
                elif event_name == "citations":
                    items = data.get("items", [])
                    citation_count = len(items) if isinstance(items, list) else 0
                elif event_name == "error":
                    status = "error"
                elif event_name == "done" and status != "error":
                    status = "done"

                yield {
                    "event": event_name,
                    "data": json.dumps(data, ensure_ascii=False),
                }
        finally:
            chat_metrics.record(
                ChatMetricRecord(
                    latency_ms=now_ms() - start_ms,
                    output_chars=output_chars,
                    citation_count=citation_count,
                    status=status,
                )
            )

    return EventSourceResponse(
        event_stream(),
        headers={
            "X-RateLimit-Limit": str(rate_limit.limit),
            "X-RateLimit-Remaining": str(rate_limit.remaining),
        },
    )
