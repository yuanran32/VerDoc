from pathlib import Path
from typing import Any

from fastapi import APIRouter

from eval.run_eval import evaluate_dataset, load_cases, summary_to_json

router = APIRouter(tags=["eval"])

DEFAULT_EVAL_DATASET = Path(__file__).resolve().parents[2] / "eval" / "dataset.example.jsonl"


@router.get("/eval/summary")
async def eval_summary(top_k: int = 5) -> dict[str, Any]:
    cases = load_cases(DEFAULT_EVAL_DATASET)
    summary = await evaluate_dataset(cases=cases, top_k=top_k)
    return summary_to_json(summary)
