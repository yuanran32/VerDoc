import asyncio

from app.api.usage_metrics import (
    ChatMetricRecord,
    ChatMetricsCollector,
    chat_metrics,
    metrics,
)


def test_chat_metrics_collector_aggregates_records() -> None:
    collector = ChatMetricsCollector()
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
    assert snapshot["latency_ms"] == {"avg": 90.25, "max": 120.5}
    assert snapshot["output_chars"] == {"total": 100, "avg": 50.0}
    assert snapshot["citations"] == {"total": 2, "avg": 1.0}
    assert snapshot["estimated_cost_cny"] == 0.0


def test_metrics_endpoint_returns_snapshot() -> None:
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
