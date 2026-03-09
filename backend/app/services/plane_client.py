"""Shared HTTP client helpers for Plane API calls with rate-limit handling.

Plane API v1 allows 60 requests per minute per API key.  It returns
``X-RateLimit-Remaining`` and ``X-RateLimit-Reset`` (UTC epoch seconds)
headers on every response.

This module provides a ``plane_get`` helper that:
- Reads the rate-limit headers and pauses when remaining requests are low.
- On 429, reads ``X-RateLimit-Reset`` to know exactly when to retry.
- Falls back to exponential backoff when the header is missing.
"""
from __future__ import annotations

import asyncio
import logging
import time

import httpx

logger = logging.getLogger(__name__)

# Fixed delay between requests to spread load (~1 req/sec = 60/min)
REQUEST_DELAY = 1.1  # seconds

# Extra pause when remaining requests are critically low
LOW_REMAINING_THRESHOLD = 5
LOW_REMAINING_PAUSE = 10.0  # seconds

# Retry config for 429 responses
MAX_RETRIES = 5
RETRY_FALLBACK_DELAY = 60.0  # when X-RateLimit-Reset header is missing


def _seconds_until_reset(response: httpx.Response) -> float | None:
    """Parse X-RateLimit-Reset header and return seconds to wait."""
    raw = response.headers.get("X-RateLimit-Reset")
    if not raw:
        return None
    try:
        reset_epoch = float(raw)
        wait = reset_epoch - time.time()
        return max(wait, 1.0)
    except (ValueError, TypeError):
        return None


def _remaining_requests(response: httpx.Response) -> int | None:
    """Parse X-RateLimit-Remaining header."""
    raw = response.headers.get("X-RateLimit-Remaining")
    if raw is None:
        return None
    try:
        return int(raw)
    except (ValueError, TypeError):
        return None


async def plane_get(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
) -> httpx.Response:
    """GET with automatic rate-limit awareness and retry on 429.

    - Pauses REQUEST_DELAY between requests (~1 req/sec).
    - If X-RateLimit-Remaining is low, pauses until reset.
    - On 429, waits for X-RateLimit-Reset before retrying.

    Raises httpx.HTTPStatusError for non-429 errors after retries.
    Raises httpx.TimeoutException on timeout.
    """
    await asyncio.sleep(REQUEST_DELAY)

    short_url = (
        url.split("/projects/")[-1][:50]
        if "/projects/" in url
        else url.split("/workspaces/")[-1][:50]
    )

    for attempt in range(MAX_RETRIES + 1):
        resp = await client.get(url, headers=headers)

        if resp.status_code != 429:
            resp.raise_for_status()

            # Proactive throttle: if remaining is low, pause before next call
            remaining = _remaining_requests(resp)
            if remaining is not None and remaining <= LOW_REMAINING_THRESHOLD:
                reset_wait = _seconds_until_reset(resp)
                pause = reset_wait if reset_wait else LOW_REMAINING_PAUSE
                logger.info(
                    "Rate limit low (%d remaining) — pausing %.0fs before next request",
                    remaining,
                    pause,
                )
                await asyncio.sleep(pause)

            return resp

        # 429 — rate limited
        if attempt >= MAX_RETRIES:
            break

        reset_wait = _seconds_until_reset(resp)
        if reset_wait:
            wait = reset_wait + 1.0  # small buffer
        else:
            wait = RETRY_FALLBACK_DELAY

        logger.warning(
            "Rate limited (429) on %s — retry %d/%d in %.0fs",
            short_url,
            attempt + 1,
            MAX_RETRIES,
            wait,
        )
        await asyncio.sleep(wait)

    # Exhausted retries — raise the 429 as an error
    resp.raise_for_status()
    return resp  # unreachable but satisfies type checker
