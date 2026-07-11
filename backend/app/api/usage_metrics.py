import json
import math
import os
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter

router = APIRouter(tags=["metrics"])

DEFAULT_CHAT_METRICS_PATH = (
    Path(__file__).resolve().parents[3]
    / ".verdoc-data"
    / "metrics"
    / "chat_metrics.jsonl"
)


@dataclass(frozen=True)
class ChatMetricRecord:
    latency_ms: float
    output_chars: int
    citation_count: int
    status: str


@dataclass(frozen=True)
class PersistedChatMetricRecord(ChatMetricRecord):
    timestamp: str
    estimated_cost_cny: float = 0.0


class ChatMetricsCollector:
    def __init__(self, metrics_path: str | Path | None = None) -> None:
        self.metrics_path = resolve_metrics_path(metrics_path)
        self.reset()
        self._load_persisted_records()

    def record(self, record: ChatMetricRecord) -> None:
        persisted_record = PersistedChatMetricRecord(
            timestamp=datetime.now(UTC).isoformat(),
            latency_ms=record.latency_ms,
            output_chars=record.output_chars,
            citation_count=record.citation_count,
            status=record.status,
            estimated_cost_cny=0.0,
        )
        self._record_persisted(persisted_record)
        self._append_record(persisted_record)

    def snapshot(self) -> dict[str, object]:
        return {
            "total_requests": self.total_requests,
            "status_counts": dict(sorted(self.status_counts.items())),
            "latency_ms": {
                "avg": round(self._average_latency(), 2),
                "p95": round(percentile(self.latencies_ms, 95), 2),
                "max": round(self.max_latency_ms, 2),
            },
            "output_chars": {
                "total": self.total_output_chars,
                "avg": round(self._average(self.total_output_chars), 2),
            },
            "citations": {
                "total": self.total_citations,
                "avg": round(self._average(self.total_citations), 2),
            },
            "estimated_cost_cny": round(self.estimated_cost_cny(), 6),
        }

    def estimated_cost_cny(self) -> float:
        # Current demo generation is extractive/local, so direct LLM spend is zero.
        # Keep this field stable so an API-backed model can plug in real costs later.
        return self.total_estimated_cost_cny

    def reset(self) -> None:
        self.total_requests = 0
        self.total_output_chars = 0
        self.total_citations = 0
        self.total_latency_ms = 0.0
        self.max_latency_ms = 0.0
        self.total_estimated_cost_cny = 0.0
        self.latencies_ms: list[float] = []
        self.status_counts: dict[str, int] = {}

    def _record_persisted(self, record: PersistedChatMetricRecord) -> None:
        self.total_requests += 1
        self.total_output_chars += record.output_chars
        self.total_citations += record.citation_count
        self.total_latency_ms += record.latency_ms
        self.max_latency_ms = max(self.max_latency_ms, record.latency_ms)
        self.total_estimated_cost_cny += record.estimated_cost_cny
        self.latencies_ms.append(record.latency_ms)
        self.status_counts[record.status] = (
            self.status_counts.get(record.status, 0) + 1
        )

    def _load_persisted_records(self) -> None:
        if not self.metrics_path.exists():
            return

        for payload in load_metric_payloads(self.metrics_path):
            record = persisted_record_from_payload(payload)
            if record is not None:
                self._record_persisted(record)

    def _append_record(self, record: PersistedChatMetricRecord) -> None:
        try:
            self.metrics_path.parent.mkdir(parents=True, exist_ok=True)
            with self.metrics_path.open("a", encoding="utf-8") as file:
                file.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")
        except OSError:
            # Metrics are observational; a filesystem issue must not break chat.
            return

    def _average_latency(self) -> float:
        return self._average(self.total_latency_ms)

    def _average(self, total: float | int) -> float:
        if self.total_requests == 0:
            return 0.0
        return float(total) / self.total_requests


def resolve_metrics_path(path: str | Path | None = None) -> Path:
    if path is not None:
        return Path(path).expanduser().resolve()

    env_path = os.getenv("VERDOC_CHAT_METRICS_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()

    return DEFAULT_CHAT_METRICS_PATH


def load_metric_payloads(path: str | Path) -> list[dict[str, Any]]:
    metrics_path = Path(path).expanduser().resolve()
    payloads: list[dict[str, Any]] = []
    if not metrics_path.exists():
        return payloads

    with metrics_path.open("r", encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict):
                payloads.append(payload)
    return payloads


def persisted_record_from_payload(
    payload: dict[str, Any],
) -> PersistedChatMetricRecord | None:
    try:
        return PersistedChatMetricRecord(
            timestamp=str(payload.get("timestamp") or ""),
            latency_ms=float(payload["latency_ms"]),
            output_chars=int(payload["output_chars"]),
            citation_count=int(payload["citation_count"]),
            status=str(payload["status"]),
            estimated_cost_cny=float(payload.get("estimated_cost_cny") or 0.0),
        )
    except (KeyError, TypeError, ValueError):
        return None


def percentile(values: list[float], percentile_rank: float) -> float:
    if not values:
        return 0.0

    sorted_values = sorted(values)
    index = math.ceil((percentile_rank / 100) * len(sorted_values)) - 1
    index = min(max(index, 0), len(sorted_values) - 1)
    return sorted_values[index]


chat_metrics = ChatMetricsCollector()


def now_ms() -> float:
    return time.perf_counter() * 1000


@router.get("/metrics")
async def metrics() -> dict[str, object]:
    return chat_metrics.snapshot()
