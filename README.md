# VerDoc

VerDoc is a version-aware documentation assistant for frontend developers. It is planned as a RAG system over official Vue ecosystem documentation, with source citations and version-aware retrieval.

## Repository Layout

```text
VerDoc/
├─ frontend/                 # Next.js 15 App Router UI
├─ backend/                  # FastAPI service, RAG modules, pipeline, eval
├─ docs/                     # Project notes and generated docs
├─ .github/workflows/        # CI
├─ 暑假项目-产品文档.md
└─ 暑假项目-技术方案.md
```

## Frontend

```bash
pnpm install
pnpm dev:frontend
```

The frontend starts on `http://localhost:3000`.

## Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The backend exposes:

- `GET /health`
- `GET /api/meta`
- `POST /api/chat` with SSE response

## Current Status

- Next.js page shell with version picker, message list, and citation panel
- FastAPI app with `/api/chat`, `/api/meta`, and `/health`
- V0 backend RAG path over built-in Vue 3.4 documentation chunks
- Local lexical retrieval with framework/version filtering
- Deterministic extractive answer streaming with citations
- Explicit refusal for unsupported frameworks, unsupported versions, and low-evidence queries
- V1 frontend demo with SSE streaming, Markdown rendering, clickable citation badges, source panel highlighting, and refusal display
- RAG module boundaries for retriever, fusion, reranker, prompt, and LLM streaming
- Offline pipeline placeholders for fetch, parse, chunk, and embed
- Evaluation placeholders and sample JSONL dataset

## Verification

```bash
cd backend
uv run --extra dev pytest
uv run --extra dev ruff check .

cd ../frontend
pnpm typecheck
pnpm build
```

## Next Milestones

1. Replace the built-in V0 corpus with fetched Vue documentation snapshots.
2. Add embedding and Chroma index creation.
3. Add BM25, RRF, and reranker for V2.
4. Build a small evaluation set before tuning retrieval.
5. Add multi-version data and pre-filtering for V3.
