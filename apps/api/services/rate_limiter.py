from __future__ import annotations

import os
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from threading import Lock
from time import monotonic


def _bool_from_env(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int_from_env(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int | None


@dataclass
class RateLimiter:
    enabled: bool = True
    window_seconds: int = 60
    max_requests: int = 120
    exempt_paths: set[str] = field(default_factory=lambda: {"/health"})
    _clock: Callable[[], float] = monotonic
    _requests_by_client: dict[str, deque[float]] = field(
        default_factory=dict, init=False, repr=False
    )
    _lock: Lock = field(default_factory=Lock, init=False, repr=False)

    @classmethod
    def from_env(cls) -> RateLimiter:
        enabled = _bool_from_env(os.getenv("AIIC_RATE_LIMIT_ENABLED"), default=True)
        window_seconds = _int_from_env(os.getenv("AIIC_RATE_LIMIT_WINDOW_SECONDS"), default=60)
        max_requests = _int_from_env(os.getenv("AIIC_RATE_LIMIT_MAX_REQUESTS"), default=120)
        exempt_raw = os.getenv("AIIC_RATE_LIMIT_EXEMPT_PATHS", "/health")
        exempt_paths = {item.strip() for item in exempt_raw.split(",") if item.strip()}
        if not exempt_paths:
            exempt_paths = {"/health"}
        return cls(
            enabled=enabled,
            window_seconds=window_seconds,
            max_requests=max_requests,
            exempt_paths=exempt_paths,
        )

    def is_exempt(self, path: str) -> bool:
        return any(path == exempt or path.startswith(f"{exempt}/") for exempt in self.exempt_paths)

    def reset(self) -> None:
        with self._lock:
            self._requests_by_client.clear()

    def evaluate(self, client_id: str, path: str) -> RateLimitDecision:
        if not self.enabled or self.is_exempt(path):
            return RateLimitDecision(
                allowed=True,
                limit=self.max_requests,
                remaining=self.max_requests,
                retry_after_seconds=None,
            )

        now = self._clock()
        cutoff = now - self.window_seconds

        with self._lock:
            bucket = self._requests_by_client.setdefault(client_id, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                retry_after = max(1, int(bucket[0] + self.window_seconds - now))
                return RateLimitDecision(
                    allowed=False,
                    limit=self.max_requests,
                    remaining=0,
                    retry_after_seconds=retry_after,
                )

            bucket.append(now)
            remaining = max(self.max_requests - len(bucket), 0)

        return RateLimitDecision(
            allowed=True,
            limit=self.max_requests,
            remaining=remaining,
            retry_after_seconds=None,
        )
