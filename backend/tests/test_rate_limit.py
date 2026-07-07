from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import rate_limit
from app.api.rate_limit import FixedWindowRateLimiter, request_client_key


def test_fixed_window_rate_limiter_blocks_until_window_resets() -> None:
    current_time = 100.0

    def now() -> float:
        return current_time

    limiter = FixedWindowRateLimiter(limit=2, window_seconds=60, now=now)

    first = limiter.check("client-a")
    second = limiter.check("client-a")
    blocked = limiter.check("client-a")

    assert first.allowed
    assert first.remaining == 1
    assert second.allowed
    assert second.remaining == 0
    assert not blocked.allowed
    assert blocked.retry_after_seconds == 60

    current_time = 161.0
    reset = limiter.check("client-a")

    assert reset.allowed
    assert reset.remaining == 1


def test_request_client_key_prefers_first_forwarded_for_address() -> None:
    request = SimpleNamespace(
        headers={"x-forwarded-for": "203.0.113.10, 10.0.0.1"},
        client=SimpleNamespace(host="127.0.0.1"),
    )

    assert request_client_key(request) == "203.0.113.10"


def test_check_chat_rate_limit_raises_429_after_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    limiter = FixedWindowRateLimiter(limit=1, window_seconds=60, now=lambda: 10.0)
    monkeypatch.setattr(rate_limit, "chat_rate_limiter", limiter)
    request = SimpleNamespace(
        headers={},
        client=SimpleNamespace(host="127.0.0.1"),
    )

    allowed = rate_limit.check_chat_rate_limit(request)
    assert allowed.remaining == 0

    with pytest.raises(HTTPException) as exc_info:
        rate_limit.check_chat_rate_limit(request)

    error = exc_info.value
    assert error.status_code == 429
    assert error.headers == {"Retry-After": "60"}
    assert error.detail["retry_after_seconds"] == 60
