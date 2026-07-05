import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

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
async def chat(payload: ChatRequest) -> EventSourceResponse:
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

    return EventSourceResponse(event_stream())
