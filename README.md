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

## Current Scaffold

- Next.js page shell with version picker, message list, and citation panel
- FastAPI app with `/api/chat`, `/api/meta`, and `/health`
- RAG module boundaries for retriever, fusion, reranker, prompt, and LLM streaming
- Offline pipeline placeholders for fetch, parse, chunk, and embed
- Evaluation placeholders and sample JSONL dataset

## Next Milestones

1. Wire frontend form submission to `/api/chat`.
2. Replace placeholder retrieval with real Vue documentation chunks.
3. Add embedding and Chroma index creation.
4. Add BM25, RRF, and reranker.
5. Build a small evaluation set before tuning retrieval.
