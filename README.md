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
- Local BM25, keyword, and persisted lightweight semantic vector retrieval with framework/version filtering
- Deterministic extractive answer streaming with citations
- Explicit refusal for unsupported frameworks, unsupported versions, and low-evidence queries
- V1 frontend demo with SSE streaming, Markdown rendering, clickable citation badges, source panel highlighting, and refusal display
- V2 retrieval path with RRF fusion and lightweight reranking
- Multi-version Vue 3.4 / 3.3 filtering with version conflict hints
- Configurable per-client `/api/chat` rate limiting for demo protection
- Offline fetch, parse, chunk, and local vector index pipeline
- Evaluation CLI with sample JSONL dataset, hit@5, and refusal accuracy

Build the local vector index:

```bash
cd backend
uv run python -m pipeline.embed
```

The default index is written to `.verdoc-data/vectors/vue-index.jsonl`. Set
`VERDOC_VECTOR_INDEX_PATH` to point the API at another index file.

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

1. Replace the remaining built-in fallback corpus with versioned documentation snapshots.
2. Add model-backed embedding generation and Chroma index creation.
3. Expand the evaluation set before tuning retrieval further.
4. Add deployment configuration and cost/latency metrics.
5. Add multi-turn follow-up support and feedback collection.
