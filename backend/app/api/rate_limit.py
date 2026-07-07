import math
import os
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import HTTPException, Request


DEFAULT_CHAT_LIMIT_PER_HOUR = 20
DEFAULT_WINDOW_SECONDS = 3600


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


class FixedWindowRateLimiter:
    def __init__(
        self,
        limit: int,
        window_seconds: int,
        now: Callable[[], float] = time.monotonic,
    ) -> None:
        if limit <= 0:
            raise ValueError("Rate limit must be greater than 0.")
        if window_seconds <= 0:
            raise ValueError("Rate limit window must be greater than 0.")

        self.limit = limit
        self.window_seconds = window_seconds
        self._now = now
        self._buckets: dict[str, tuple[float, int]] = {}

    def check(self, key: str) -> RateLimitResult:
        now = self._now()
        window_start, count = self._buckets.get(key, (now, 0))

        if now - window_start >= self.window_seconds:
            window_start = now
            count = 0

        if count >= self.limit:
            retry_after = math.ceil(self.window_seconds - (now - window_start))
            return RateLimitResult(
                allowed=False,
                limit=self.limit,
                remaining=0,
                retry_after_seconds=max(retry_after, 1),
            )

        count += 1
        self._buckets[key] = (window_start, count)
        return RateLimitResult(
            allowed=True,
            limit=self.limit,
            remaining=max(self.limit - count, 0),
            retry_after_seconds=0,
        )

    def reset(self) -> None:
        self._buckets.clear()


def request_client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_client = forwarded_for.split(",", maxsplit=1)[0].strip()
        if first_client:
            return first_client

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def check_chat_rate_limit(request: Request) -> RateLimitResult:
    result = chat_rate_limiter.check(request_client_key(request))
    if result.allowed:
        return result

    raise HTTPException(
        status_code=429,
        detail={
            "message": "请求过于频繁，请稍后再试。",
            "retry_after_seconds": result.retry_after_seconds,
        },
        headers={"Retry-After": str(result.retry_after_seconds)},
    )


def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        return default

    return value if value > 0 else default


chat_rate_limiter = FixedWindowRateLimiter(
    limit=_env_int("VERDOC_CHAT_RATE_LIMIT_PER_HOUR", DEFAULT_CHAT_LIMIT_PER_HOUR),
    window_seconds=_env_int(
        "VERDOC_CHAT_RATE_LIMIT_WINDOW_SECONDS",
        DEFAULT_WINDOW_SECONDS,
    ),
)
