"""Small, dependency-free HTTP security controls.

The limiter is intentionally process-local so development and a single API
instance remain protected without introducing a Redis dependency. Deployments
with multiple web workers should replace this store with Redis or an API-gateway
rate limiter to enforce limits across every instance.
"""

from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse


@dataclass(frozen=True)
class Limit:
    requests: int
    window_seconds: int


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, limit: Limit) -> int | None:
        """Return retry seconds when exhausted; otherwise allow the request."""
        now = monotonic()
        with self._lock:
            events = self._events[key]
            cutoff = now - limit.window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit.requests:
                return max(1, int(limit.window_seconds - (now - events[0])) + 1)
            events.append(now)
        return None


rate_limiter = SlidingWindowRateLimiter()


def request_client_ip(request: Request) -> str:
    """Use the socket peer by default; a proxy header only when configured."""
    from config import settings

    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_response(retry_after: int) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please try again later.",
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )
