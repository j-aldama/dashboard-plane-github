"""Tests for the health check endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient



async def test_health_check_returns_healthy(client: AsyncClient) -> None:
    """GET /api/health returns 200 with status=healthy when the database is reachable."""
    response = await client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


async def test_health_check_response_schema(client: AsyncClient) -> None:
    """The health response contains exactly the expected keys."""
    response = await client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert set(data.keys()) == {"status", "database"}
