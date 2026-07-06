import asyncio

from eval.run_eval import EvalCase, evaluate_dataset


def test_evaluate_dataset_reports_hits_and_refusals() -> None:
    summary = asyncio.run(
        evaluate_dataset(
            cases=[
                EvalCase(
                    id="definemodel",
                    query="defineModel 怎么用?",
                    golden_chunk_ids=[
                        "vue@3.4:api/sfc-script-setup#definemodel",
                    ],
                ),
                EvalCase(
                    id="react-usememo",
                    query="React 的 useMemo 怎么用?",
                    expect_refusal=True,
                ),
            ]
        )
    )

    assert summary.total == 2
    assert summary.hit_rate_at_5 == 1.0
    assert summary.refusal_accuracy == 1.0
    assert summary.results[0].retrieved_ids
    assert summary.results[1].refused
