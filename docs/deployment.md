# Deployment Notes

VerDoc is split into a Next.js frontend and a FastAPI backend. The current deployment target is a small public demo, not a high-availability production system.

## Local production check

Backend:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
pnpm install
pnpm build:frontend
pnpm --dir frontend start
```

## Frontend deployment

Recommended provider: Vercel.

Set this environment variable in the frontend deployment:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
```

Build command:

```bash
pnpm build:frontend
```

Output is managed by Next.js/Vercel.

## Backend deployment

Recommended demo providers: Render, Railway, Fly.io, or a small VPS.

Suggested start command:

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Health check:

```text
GET /health
```

Main API endpoints:

```text
GET /api/meta
POST /api/chat
GET /api/metrics
GET /api/eval/summary
POST /api/feedback
GET /api/feedback/summary
```

## Environment variables

Frontend:

| Name | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Public URL of the backend API. |

Backend data paths:

| Name | Description |
|---|---|
| `VERDOC_CHUNKS_PATH` | Optional JSONL document chunk path. Falls back to built-in/demo chunks if unavailable. |
| `VERDOC_VECTOR_INDEX_PATH` | Optional local vector index path. |
| `VERDOC_FEEDBACK_PATH` | Optional local JSONL feedback path. |
| `VERDOC_CHAT_METRICS_PATH` | Optional local JSONL metrics path. |

Demo protection:

| Name | Description |
|---|---|
| `VERDOC_CHAT_RATE_LIMIT_PER_HOUR` | Per-client chat request limit. Default demo value is 20. |
| `VERDOC_CHAT_RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window in seconds. Default demo value is 3600. |

Optional model placeholders:

| Name | Description |
|---|---|
| `LLM_BASE_URL` | Reserved for model-backed generation. |
| `LLM_API_KEY` | Reserved for model-backed generation. |
| `LLM_MODEL` | Reserved for model-backed generation. |
| `EMBEDDING_MODEL` | Reserved for model-backed embedding generation. |
| `RERANKER_MODEL` | Reserved for model-backed reranking. |

## Data persistence caveat

The current demo uses local JSONL files for feedback and usage metrics:

```text
.verdoc-data/metrics/chat_metrics.jsonl
```

Depending on hosting provider, the filesystem may be ephemeral. For a free demo this is acceptable, but long-term retention should use one of:

- provider volume
- object storage
- managed database

The current project intentionally avoids adding a database to keep the demo small and easy to run.

## Verification before publishing

Run backend checks:

```bash
cd backend
uv run python -m eval.run_eval --dataset eval/dataset.example.jsonl
uv run --extra dev pytest
uv run --extra dev ruff check .
```

Run frontend checks:

```bash
cd frontend
pnpm typecheck
pnpm build
```

Then run the demo flow in `docs/demo-script.md` against the deployed URLs.
