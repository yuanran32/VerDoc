from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.eval_summary import router as eval_router
from app.api.feedback import router as feedback_router
from app.api.meta import router as meta_router
from app.api.usage_metrics import router as metrics_router

app = FastAPI(title="VerDoc API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(eval_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
app.include_router(meta_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
