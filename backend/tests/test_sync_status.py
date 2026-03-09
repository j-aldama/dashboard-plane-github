"""Tests for GET /api/sync/status with Redis-backed progress.

Covers:
- Returns is_running=False and progress=100 when no sync is running
- Returns is_running=True when a SyncLog with status='running' exists
- Returns progress and steps from Redis when sync is running
- Returns progress=0 and empty steps when Redis has no data
- Returns last_sync info from the most recent completed sync
- Returns current_step from Redis state
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync_log import SyncLog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_sync_log(
    db: AsyncSession,
    status: str = "running",
    completed_at: datetime | None = None,
    error_message: str | None = None,
) -> SyncLog:
    log = SyncLog(
        sync_type="manual",
        status=status,
        completed_at=completed_at,
        error_message=error_message,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_sync_status_no_running_sync(client: AsyncClient) -> None:
    """Returns is_running=False when no sync is active."""
    resp = await client.get("/api/sync/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_running"] is False
    assert data["progress"] == 100
    assert data["current_step"] is None
    assert data["steps"] == []


async def test_sync_status_running_with_redis_progress(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Returns progress and steps from Redis when sync is running."""
    await _create_sync_log(db_session, status="running")

    redis_state = {
        "sync_log_id": 1,
        "status": "running",
        "progress": 50,
        "current_step": "work_items",
        "steps": [
            {"id": "members", "label": "Sincronizando miembros", "status": "completed", "records_synced": 5},
            {"id": "projects", "label": "Sincronizando proyectos", "status": "completed", "records_synced": 3},
            {"id": "work_items", "label": "Sincronizando tareas", "status": "running"},
            {"id": "github", "label": "Sincronizando GitHub", "status": "pending"},
        ],
    }

    with patch("app.routers.sync_all.cache_get", new_callable=AsyncMock, return_value=redis_state):
        resp = await client.get("/api/sync/status")

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_running"] is True
    assert data["progress"] == 50
    assert data["current_step"] == "work_items"
    assert len(data["steps"]) == 4

    # Verify step details
    members_step = next(s for s in data["steps"] if s["id"] == "members")
    assert members_step["status"] == "completed"
    assert members_step["records_synced"] == 5

    running_step = next(s for s in data["steps"] if s["id"] == "work_items")
    assert running_step["status"] == "running"


async def test_sync_status_running_no_redis_data(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Returns progress=0 and empty steps when Redis has no progress data."""
    await _create_sync_log(db_session, status="running")

    with patch("app.routers.sync_all.cache_get", new_callable=AsyncMock, return_value=None):
        resp = await client.get("/api/sync/status")

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_running"] is True
    assert data["progress"] == 0
    assert data["current_step"] is None
    assert data["steps"] == []


async def test_sync_status_includes_last_sync(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Returns last_sync info from the most recent completed sync."""
    completed_at = datetime(2026, 3, 9, 12, 0, 0, tzinfo=timezone.utc)
    await _create_sync_log(
        db_session,
        status="completed",
        completed_at=completed_at,
    )

    resp = await client.get("/api/sync/status")
    data = resp.json()
    assert data["last_sync"] is not None
    assert data["last_sync"]["status"] == "completed"
    assert data["last_sync"]["error_count"] == 0


async def test_sync_status_last_sync_with_errors(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Returns error_count from last failed sync."""
    import json

    errors = [{"step": "github", "error": "Timeout"}]
    completed_at = datetime(2026, 3, 9, 12, 0, 0, tzinfo=timezone.utc)
    await _create_sync_log(
        db_session,
        status="failed",
        completed_at=completed_at,
        error_message=json.dumps(errors),
    )

    resp = await client.get("/api/sync/status")
    data = resp.json()
    assert data["last_sync"] is not None
    assert data["last_sync"]["status"] == "failed"
    assert data["last_sync"]["error_count"] == 1


async def test_sync_status_redis_step_with_error(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Steps with error status include the error message."""
    await _create_sync_log(db_session, status="running")

    redis_state = {
        "progress": 25,
        "current_step": "projects",
        "steps": [
            {"id": "members", "label": "Sincronizando miembros", "status": "error", "error": "Timeout after 120s"},
            {"id": "projects", "label": "Sincronizando proyectos", "status": "running"},
        ],
    }

    with patch("app.routers.sync_all.cache_get", new_callable=AsyncMock, return_value=redis_state):
        resp = await client.get("/api/sync/status")

    data = resp.json()
    error_step = next(s for s in data["steps"] if s["id"] == "members")
    assert error_step["status"] == "error"
    assert error_step["error"] == "Timeout after 120s"
