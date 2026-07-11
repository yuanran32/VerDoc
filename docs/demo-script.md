# VerDoc Demo Script

This script is the fixed presentation flow for showing VerDoc as a version-aware, citation-grounded Vue documentation assistant.

## Setup

Start the backend:

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Start the frontend:

```bash
pnpm dev:frontend
```

Open `http://localhost:3000`.

## Demo 1: Citation-grounded documentation answer

Selection:

- Framework: Vue
- Version: 3.4

Question:

```text
watch 和 watchEffect 有什么区别？
```

Expected behavior:

- The answer compares `watch` and `watchEffect` directly.
- The answer streams into the chat UI.
- Citation badges appear in the answer.
- The source panel shows the official-documentation excerpt and link.

Presentation points:

- VerDoc does not answer from memory only; it grounds the answer in retrieved documentation chunks.
- The user can click the citation to verify the source.

## Demo 2: Version-aware answer

Selection:

- Framework: Vue
- Version: 3.3

Question:

```text
defineModel 怎么用？
```

Expected behavior:

- The system should not pretend that `defineModel` is supported in Vue 3.3.
- It should surface the version conflict or guide the user to Vue 3.4+ evidence.
- The behavior demonstrates version metadata filtering and conflict handling.

Presentation points:

- This is the project’s main differentiator: the same API question can produce different behavior depending on the selected version.
- Version filtering reduces outdated or unsupported API answers.

## Demo 3: Vue 2 to Vue 3 migration

Selection:

- Framework: Vue
- Version: 3.4

Question:

```text
Vue2 的 filters 升到 Vue3 怎么改？
```

Expected behavior:

- The answer identifies this as a migration-style question.
- It explains that filters were removed in Vue 3.
- It recommends methods, computed properties, plain functions, or composables as replacements.
- It cites the migration-guide source.

Presentation points:

- Migration questions are handled by retrieval over migration documentation, not generic advice.
- Citation makes the breaking-change explanation auditable.

## Demo 4: Refusal boundary

Selection:

- Framework: Vue
- Version: 3.4

Question:

```text
React 的 useMemo 怎么用？
```

Expected behavior:

- The system refuses or redirects instead of generating a React answer.
- It explains that the current knowledge base covers Vue ecosystem documentation.

Presentation points:

- A useful RAG assistant should know when not to answer.
- Refusal behavior protects the product from unsupported-framework hallucinations.

## Optional: Show evaluation and metrics

After running the chat demos, open the inspector panel or API endpoints:

```text
GET http://localhost:8000/api/metrics
GET http://localhost:8000/api/eval/summary
```

Point out:

- request count and latency metrics
- p95 latency
- estimated demo cost
- evaluation `hit@5` and refusal accuracy
