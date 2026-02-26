import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


def get_redis_client() -> aioredis.Redis:
    """Return the shared async Redis client (lazy singleton)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def ping_redis() -> bool:
    """Check if Redis is reachable."""
    try:
        client = get_redis_client()
        return await client.ping()
    except Exception:
        return False


async def cache_get(key: str) -> Any | None:
    """Retrieve a JSON-encoded value from the cache."""
    try:
        client = get_redis_client()
        raw = await client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Cache GET failed for key=%s: %s", key, exc)
        return None


async def cache_set(key: str, value: Any, ttl: int | None = None) -> bool:
    """Store a JSON-encoded value in the cache with an optional TTL (seconds)."""
    try:
        client = get_redis_client()
        serialized = json.dumps(value)
        if ttl is not None:
            await client.setex(key, ttl, serialized)
        else:
            await client.set(key, serialized)
        return True
    except Exception as exc:
        logger.warning("Cache SET failed for key=%s: %s", key, exc)
        return False


async def cache_delete(key: str) -> bool:
    """Remove a key from the cache."""
    try:
        client = get_redis_client()
        await client.delete(key)
        return True
    except Exception as exc:
        logger.warning("Cache DELETE failed for key=%s: %s", key, exc)
        return False


async def close_redis() -> None:
    """Close the Redis connection pool on shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
