import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.api.rate_limit import check_chat_rate_limit
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
        async for event in answer_question(
            query=payload.query,
            framework=payload.framework,
            version=payload.version,
            history=[message.model_dump() for message in payload.history],
        ):
            yield {
                "event": event["event"],
                "data": json.dumps(event["data"], ensure_ascii=False),
            }

    return EventSourceResponse(
        event_stream(),
        headers={
            "X-RateLimit-Limit": str(rate_limit.limit),
            "X-RateLimit-Remaining": str(rate_limit.remaining),
        },
    )
