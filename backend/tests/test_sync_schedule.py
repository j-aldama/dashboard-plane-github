"""Tests for the sync schedule configuration endpoints.

Covers:
- GET /api/sync/schedule creates default schedule if none exists
- GET /api/sync/schedule returns existing schedule
- PUT /api/sync/schedule updates schedule configuration
- PUT /api/sync/schedule validation (invalid time format, invalid timezone)
- Enabling/disabling the schedule and job management
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_sync_schedule


# ---------------------------------------------------------------------------
# GET /api/sync/schedule
# ---------------------------------------------------------------------------


@patch("app.routers.sync_schedule.get_next_run_time", return_value=None)
async def test_get_schedule_creates_default(
    mock_next_run, client: AsyncClient
) -> None:
    """GET /api/sync/schedule creates a default disabled schedule if none exists."""
    response = await client.get("/api/sync/schedule")
    assert response.status_code == 200

    data = response.json()
    assert data["enabled"] is False
    assert data["scheduled_time"] == "08:00"
    assert data["timezone"] == "America/Mexico_City"
    assert data["next_run_at"] is None


@patch("app.routers.sync_schedule.get_next_run_time", return_value=None)
async def test_get_schedule_returns_existing(
    mock_next_run, client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/sync/schedule returns the existing schedule configuration."""
    await create_sync_schedule(
        db_session,
        enabled=True,
        scheduled_time="09:30",
        tz="America/Bogota",
    )

    response = await client.get("/api/sync/schedule")
    assert response.status_code == 200

    data = response.json()
    assert data["enabled"] is True
    assert data["scheduled_time"] == "09:30"
    assert data["timezone"] == "America/Bogota"


# ---------------------------------------------------------------------------
# PUT /api/sync/schedule
# ---------------------------------------------------------------------------


@patch("app.routers.sync_schedule.schedule_job")
@patch("app.routers.sync_schedule.get_next_run_time", return_value=None)
async def test_update_schedule_enable(
    mock_next_run, mock_schedule_job, client: AsyncClient, db_session: AsyncSession
) -> None:
    """PUT /api/sync/schedule enables the schedule and calls schedule_job."""
    await create_sync_schedule(db_session, enabled=False)

    response = await client.put(
        "/api/sync/schedule",
        json={
            "enabled": True,
            "scheduled_time": "14:00",
            "timezone": "America/Mexico_City",
        },
    )
    assert response.status_code == 200

    data = response.json()
    assert data["enabled"] is True
    assert data["scheduled_time"] == "14:00"

    mock_schedule_job.assert_called_once_with("14:00", "America/Mexico_City")


@patch("app.routers.sync_schedule.remove_job")
@patch("app.routers.sync_schedule.get_next_run_time", return_value=None)
async def test_update_schedule_disable(
    mock_next_run, mock_remove_job, client: AsyncClient, db_session: AsyncSession
) -> None:
    """PUT /api/sync/schedule disables the schedule and calls remove_job."""
    await create_sync_schedule(db_session, enabled=True, scheduled_time="09:00")

    response = await client.put(
        "/api/sync/schedule",
        json={
            "enabled": False,
            "scheduled_time": "09:00",
            "timezone": "America/Mexico_City",
        },
    )
    assert response.status_code == 200

    data = response.json()
    assert data["enabled"] is False

    mock_remove_job.assert_called_once()


async def test_update_schedule_invalid_time_format(client: AsyncClient, db_session: AsyncSession) -> None:
    """PUT /api/sync/schedule rejects invalid time format."""
    await create_sync_schedule(db_session)

    response = await client.put(
        "/api/sync/schedule",
        json={
            "enabled": True,
            "scheduled_time": "25:00",
            "timezone": "America/Mexico_City",
        },
    )
    assert response.status_code == 422


async def test_update_schedule_invalid_timezone(client: AsyncClient, db_session: AsyncSession) -> None:
    """PUT /api/sync/schedule rejects invalid timezone."""
    await create_sync_schedule(db_session)

    response = await client.put(
        "/api/sync/schedule",
        json={
            "enabled": True,
            "scheduled_time": "09:00",
            "timezone": "Invalid/Timezone",
        },
    )
    assert response.status_code == 422


async def test_update_schedule_missing_fields(client: AsyncClient) -> None:
    """PUT /api/sync/schedule rejects request with missing fields."""
    response = await client.put(
        "/api/sync/schedule",
        json={"enabled": True},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------


def test_sync_schedule_time_validation() -> None:
    """SyncScheduleUpdate validates time format HH:MM."""
    from app.schemas.sync_schedule import SyncScheduleUpdate

    valid = SyncScheduleUpdate(
        enabled=True,
        scheduled_time="08:30",
        timezone="America/Mexico_City",
    )
    assert valid.scheduled_time == "08:30"

    with pytest.raises(Exception):
        SyncScheduleUpdate(
            enabled=True,
            scheduled_time="8:30",
            timezone="America/Mexico_City",
        )

    with pytest.raises(Exception):
        SyncScheduleUpdate(
            enabled=True,
            scheduled_time="24:00",
            timezone="America/Mexico_City",
        )


def test_sync_schedule_timezone_validation() -> None:
    """SyncScheduleUpdate validates timezone against IANA database."""
    from app.schemas.sync_schedule import SyncScheduleUpdate

    valid = SyncScheduleUpdate(
        enabled=True,
        scheduled_time="08:00",
        timezone="UTC",
    )
    assert valid.timezone == "UTC"

    with pytest.raises(Exception):
        SyncScheduleUpdate(
            enabled=True,
            scheduled_time="08:00",
            timezone="Not/A/Timezone",
        )
