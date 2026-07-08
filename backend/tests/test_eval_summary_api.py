import asyncio

from app.api.eval_summary import eval_summary


def test_eval_summary_endpoint_returns_dataset_metrics() -> None:
    payload = asyncio.run(eval_summary())

    assert payload["total"] >= 1
    assert 0 <= payload["hit_rate_at_5"] <= 1
    assert 0 <= payload["refusal_accuracy"] <= 1
    assert payload["results"]
    assert {"id", "query", "hit", "retrieved_ids"}.issubset(payload["results"][0])
