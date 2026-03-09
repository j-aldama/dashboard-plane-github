"""API key authentication dependency.

When API_KEY is configured (non-empty), all protected endpoints require
the ``X-API-Key`` header to match. When API_KEY is empty (development),
authentication is bypassed.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(
    api_key: str | None = Security(_api_key_header),
) -> str | None:
    """Validate the API key from the X-API-Key header.

    - If API_KEY is not configured (empty), skip validation (dev mode).
    - If API_KEY is configured, require a matching header value.
    """
    if not settings.API_KEY:
        return None

    if not api_key or api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
    return api_key
