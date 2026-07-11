import asyncio
import json

from app.api.usage_metrics import (
    ChatMetricRecord,
    ChatMetricsCollector,
    chat_metrics,
    metrics,
    percentile,
)


def test_chat_metrics_collector_aggregates_records(tmp_path) -> None:
    collector = ChatMetricsCollector(metrics_path=tmp_path / "chat_metrics.jsonl")
    collector.record(
        ChatMetricRecord(
            latency_ms=120.5,
            output_chars=80,
            citation_count=2,
            status="done",
        )
    )
    collector.record(
        ChatMetricRecord(
            latency_ms=60,
            output_chars=20,
            citation_count=0,
            status="error",
        )
    )

    snapshot = collector.snapshot()

    assert snapshot["total_requests"] == 2
    assert snapshot["status_counts"] == {"done": 1, "error": 1}
    assert snapshot["latency_ms"] == {"avg": 90.25, "p95": 120.5, "max": 120.5}
    assert snapshot["output_chars"] == {"total": 100, "avg": 50.0}
    assert snapshot["citations"] == {"total": 2, "avg": 1.0}
    assert snapshot["estimated_cost_cny"] == 0.0


def test_chat_metrics_collector_persists_jsonl_records(tmp_path) -> None:
    metrics_path = tmp_path / "chat_metrics.jsonl"
    collector = ChatMetricsCollector(metrics_path=metrics_path)

    collector.record(
        ChatMetricRecord(
            latency_ms=25,
            output_chars=10,
            citation_count=1,
            status="done",
        )
    )

    payloads = [
        json.loads(line)
        for line in metrics_path.read_text(encoding="utf-8").splitlines()
    ]

    assert len(payloads) == 1
    assert payloads[0]["latency_ms"] == 25
    assert payloads[0]["output_chars"] == 10
    assert payloads[0]["citation_count"] == 1
    assert payloads[0]["status"] == "done"
    assert payloads[0]["estimated_cost_cny"] == 0.0
    assert payloads[0]["timestamp"]


def test_chat_metrics_collector_restores_persisted_records(tmp_path) -> None:
    metrics_path = tmp_path / "chat_metrics.jsonl"
    first_collector = ChatMetricsCollector(metrics_path=metrics_path)
    first_collector.record(
        ChatMetricRecord(
            latency_ms=50,
            output_chars=30,
            citation_count=1,
            status="done",
        )
    )

    second_collector = ChatMetricsCollector(metrics_path=metrics_path)
    snapshot = second_collector.snapshot()

    assert snapshot["total_requests"] == 1
    assert snapshot["status_counts"] == {"done": 1}
    assert snapshot["latency_ms"] == {"avg": 50.0, "p95": 50.0, "max": 50.0}
    assert snapshot["output_chars"] == {"total": 30, "avg": 30.0}
    assert snapshot["citations"] == {"total": 1, "avg": 1.0}


def test_percentile_handles_empty_and_nearest_rank() -> None:
    assert percentile([], 95) == 0.0
    assert percentile([10, 20, 30, 40], 95) == 40
    assert percentile([10, 20, 30, 40], 50) == 20


def test_metrics_endpoint_returns_snapshot(tmp_path) -> None:
    chat_metrics.metrics_path = tmp_path / "global_chat_metrics.jsonl"
    chat_metrics.reset()
    chat_metrics.record(
        ChatMetricRecord(
            latency_ms=25,
            output_chars=10,
            citation_count=1,
            status="done",
        )
    )
    payload = asyncio.run(metrics())

    assert payload["total_requests"] == 1
    assert payload["status_counts"] == {"done": 1}
    assert payload["latency_ms"] == {"avg": 25.0, "p95": 25, "max": 25}
