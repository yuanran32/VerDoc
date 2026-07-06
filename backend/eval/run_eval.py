import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.rag.reranker import rerank
from app.rag.retriever import retrieve
from eval.metrics import has_golden_hit, hit_rate_at_k


class EvalCase(BaseModel):
    id: str
    query: str
    framework: str = "vue"
    version: str = "3.4"
    golden_chunk_ids: list[str] = Field(default_factory=list)
    expect_refusal: bool = False
    tags: list[str] = Field(default_factory=list)


class EvalResult(BaseModel):
    id: str
    query: str
    hit: bool
    expected_refusal: bool
    refused: bool
    retrieved_ids: list[str]
    top_source_url: str | None = None
    tags: list[str] = Field(default_factory=list)


class EvalSummary(BaseModel):
    total: int
    hit_rate_at_5: float
    refusal_accuracy: float
    results: list[EvalResult]


async def evaluate_case(case: EvalCase, top_k: int) -> EvalResult:
    retrieved = await retrieve(
        query=case.query,
        framework=case.framework,
        version=case.version,
        limit=top_k,
    )
    ranked = await rerank(query=case.query, chunks=retrieved)
    top_ranked = ranked[:top_k]
    retrieved_ids = [item.chunk.id for item in top_ranked]
    refused = len(top_ranked) == 0

    return EvalResult(
        id=case.id,
        query=case.query,
        hit=has_golden_hit(retrieved_ids, case.golden_chunk_ids),
        expected_refusal=case.expect_refusal,
        refused=refused,
        retrieved_ids=retrieved_ids,
        top_source_url=top_ranked[0].chunk.source_url if top_ranked else None,
        tags=case.tags,
    )


async def evaluate_dataset(cases: list[EvalCase], top_k: int = 5) -> EvalSummary:
    results = [await evaluate_case(case, top_k=top_k) for case in cases]
    non_refusal_results = [
        result for result in results if not result.expected_refusal
    ]
    refusal_results = [result for result in results if result.expected_refusal]
    refusal_hits = [
        result.refused == result.expected_refusal for result in refusal_results
    ]

    return EvalSummary(
        total=len(results),
        hit_rate_at_5=hit_rate_at_k([result.hit for result in non_refusal_results]),
        refusal_accuracy=hit_rate_at_k(refusal_hits),
        results=results,
    )


def load_cases(path: str | Path) -> list[EvalCase]:
    dataset_path = Path(path).expanduser().resolve()
    with dataset_path.open("r", encoding="utf-8") as file:
        return [
            EvalCase.model_validate(json.loads(line))
            for line in file
            if line.strip()
        ]


def print_summary(summary: EvalSummary) -> None:
    print(f"total={summary.total}")
    print(f"hit_rate_at_5={summary.hit_rate_at_5:.3f}")
    print(f"refusal_accuracy={summary.refusal_accuracy:.3f}")
    for result in summary.results:
        status = "HIT" if result.hit else "MISS"
        if result.expected_refusal:
            status = "REFUSED" if result.refused else "NOT_REFUSED"
        top_id = result.retrieved_ids[0] if result.retrieved_ids else "-"
        print(f"{status}\t{result.id}\t{top_id}")


def summary_to_json(summary: EvalSummary) -> dict[str, Any]:
    return summary.model_dump()


def run_eval(
    dataset_path: str | Path = "eval/dataset.example.jsonl",
    top_k: int = 5,
) -> EvalSummary:
    """Run retrieval evaluation against a JSONL dataset."""
    cases = load_cases(dataset_path)
    return asyncio.run(evaluate_dataset(cases=cases, top_k=top_k))


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate retrieval quality.")
    parser.add_argument("--dataset", default="eval/dataset.example.jsonl")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    summary = run_eval(dataset_path=args.dataset, top_k=args.top_k)
    if args.json:
        print(json.dumps(summary_to_json(summary), ensure_ascii=False, indent=2))
    else:
        print_summary(summary)


if __name__ == "__main__":
    main()
