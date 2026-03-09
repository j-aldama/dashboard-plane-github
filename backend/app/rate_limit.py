"""Simple in-memory rate limiter for sync endpoints.

Uses a per-endpoint cooldown period to prevent abuse.
Not suitable for multi-process deployments — use Redis-based
limiting in that case.
"""
from __future__ import annotations

import time

from fastapi import HTTPException, status

_last_call: dict[str, float] = {}

# Minimum seconds between consecutive calls to the same endpoint.
SYNC_COOLDOWN_SECONDS = 30


def check_rate_limit(endpoint_key: str, cooldown: int = SYNC_COOLDOWN_SECONDS) -> None:
    """Raise 429 if the endpoint was called too recently."""
    now = time.monotonic()
    last = _last_call.get(endpoint_key, 0.0)
    elapsed = now - last

    if elapsed < cooldown:
        remaining = int(cooldown - elapsed)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests. Try again in {remaining} seconds.",
            headers={"Retry-After": str(remaining)},
        )

    _last_call[endpoint_key] = now
