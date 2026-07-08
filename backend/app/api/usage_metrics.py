import time
from dataclasses import dataclass

from fastapi import APIRouter

router = APIRouter(tags=["metrics"])


@dataclass(frozen=True)
class ChatMetricRecord:
    latency_ms: float
    output_chars: int
    citation_count: int
    status: str


class ChatMetricsCollector:
    def __init__(self) -> None:
        self.reset()

    def record(self, record: ChatMetricRecord) -> None:
        self.total_requests += 1
        self.total_output_chars += record.output_chars
        self.total_citations += record.citation_count
        self.total_latency_ms += record.latency_ms
        self.max_latency_ms = max(self.max_latency_ms, record.latency_ms)
        self.status_counts[record.status] = self.status_counts.get(record.status, 0) + 1

    def snapshot(self) -> dict[str, object]:
        return {
            "total_requests": self.total_requests,
            "status_counts": dict(sorted(self.status_counts.items())),
            "latency_ms": {
                "avg": round(self._average_latency(), 2),
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
        return 0.0

    def reset(self) -> None:
        self.total_requests = 0
        self.total_output_chars = 0
        self.total_citations = 0
        self.total_latency_ms = 0.0
        self.max_latency_ms = 0.0
        self.status_counts: dict[str, int] = {}

    def _average_latency(self) -> float:
        return self._average(self.total_latency_ms)

    def _average(self, total: float | int) -> float:
        if self.total_requests == 0:
            return 0.0
        return float(total) / self.total_requests


chat_metrics = ChatMetricsCollector()


def now_ms() -> float:
    return time.perf_counter() * 1000


@router.get("/metrics")
async def metrics() -> dict[str, object]:
    return chat_metrics.snapshot()
