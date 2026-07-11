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
- `GET /api/eval/summary`
- `GET /api/feedback/summary`
- `GET /api/meta`
- `GET /api/metrics`
- `POST /api/feedback`
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
- Persisted JSONL `/api/metrics` snapshot for request counts, avg/P95/max latency, output size, citations, and current demo cost estimate
- macOS-style inspector metrics panel in the frontend
- Eval summary API and inspector dashboard for hit@5, refusal accuracy, and failed cases
- Feedback collection with per-answer up/down controls and recent bad case summary
- Multi-turn follow-up support using recent chat history for retrieval query completion
- Offline fetch, parse, chunk, and local vector index pipeline
- Evaluation CLI with sample JSONL dataset, hit@5, and refusal accuracy

Build the local vector index:

```bash
cd backend
uv run python -m pipeline.embed
```

The default index is written to `.verdoc-data/vectors/vue-index.jsonl`. Set
`VERDOC_VECTOR_INDEX_PATH` to point the API at another index file.

## Evaluation

Retrieval quality is tracked with `backend/eval/dataset.example.jsonl`, a 35-case JSONL set covering Vue facts, API usage, version differences, Vue 2 → Vue 3 migration, and off-topic refusal cases.

```bash
cd backend
uv run python -m eval.run_eval --dataset eval/dataset.example.jsonl
```

| Dataset | Cases | hit@5 | Refusal Accuracy | Notes |
|---|---:|---:|---:|---|
| `eval/dataset.example.jsonl` | 35 | 93.5% | 100.0% | BM25 + keyword + local vector + RRF + lightweight rerank + off-topic guardrail |

Metrics:

- `hit@5`: whether at least one golden chunk appears in the top 5 retrieved chunks for non-refusal cases.
- `refusal_accuracy`: whether expected refusal cases return no retrieved evidence.
- Current evaluation is retrieval/refusal focused; answer faithfulness and citation accuracy are documented as future judge-based metrics.

## Demo Script

Use `docs/demo-script.md` for the fixed presentation flow:

1. citation-grounded Vue answer
2. Vue 3.3 / 3.4 version-aware behavior
3. Vue 2 → Vue 3 filters migration
4. unsupported-framework refusal

## Deployment

Deployment notes are in `docs/deployment.md`.

Key environment variables are listed in `.env.example`, including:

- `NEXT_PUBLIC_API_BASE_URL`
- `VERDOC_CHUNKS_PATH`
- `VERDOC_VECTOR_INDEX_PATH`
- `VERDOC_FEEDBACK_PATH`
- `VERDOC_CHAT_METRICS_PATH`
- `VERDOC_CHAT_RATE_LIMIT_PER_HOUR`
- `VERDOC_CHAT_RATE_LIMIT_WINDOW_SECONDS`

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

1. Run and record the expanded evaluation baseline numbers in the README table.
2. Replace the remaining built-in fallback corpus with versioned documentation snapshots.
3. Add model-backed embedding generation and Chroma index creation.
4. Deploy the frontend/backend demo and capture screenshots.
5. Expand framework coverage beyond Vue.
