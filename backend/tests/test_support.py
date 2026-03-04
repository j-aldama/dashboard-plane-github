"""Tests for the support management endpoints.

Covers:
- Activating support on a finished project
- Deactivating support
- Validation: cannot activate on a project without project_end_date
- Project not found returns 404
- Support metrics listing
- Empty support metrics
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_project, create_work_item


# ---------------------------------------------------------------------------
# PATCH /api/projects/{id}/support
# ---------------------------------------------------------------------------


async def test_toggle_support_activate(client: AsyncClient, db_session: AsyncSession) -> None:
    """PATCH activates support on a project that has a project_end_date."""
    today = date.today()
    p = await create_project(
        db_session,
        name="Finished Project",
        project_start_date=today - timedelta(days=90),
        project_end_date=today - timedelta(days=5),
    )

    response = await client.patch(
        f"/api/projects/{p.id}/support",
        json={"activate": True},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["is_support"] is True
    assert data["support_start_date"] is not None
    assert data["support_end_date"] is not None


async def test_toggle_support_deactivate(client: AsyncClient, db_session: AsyncSession) -> None:
    """PATCH deactivates support and clears support dates."""
    today = date.today()
    p = await create_project(
        db_session,
        name="Support Project",
        is_support=True,
        project_type="support",
        project_end_date=today - timedelta(days=5),
        support_start_date=today - timedelta(days=3),
        support_end_date=today + timedelta(days=18),
    )

    response = await client.patch(
        f"/api/projects/{p.id}/support",
        json={"activate": False},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["is_support"] is False
    assert data["support_start_date"] is None
    assert data["support_end_date"] is None


async def test_toggle_support_requires_end_date(client: AsyncClient, db_session: AsyncSession) -> None:
    """PATCH returns 422 when trying to activate on a project without project_end_date."""
    p = await create_project(
        db_session,
        name="Active Project",
        project_end_date=None,
    )

    response = await client.patch(
        f"/api/projects/{p.id}/support",
        json={"activate": True},
    )
    assert response.status_code == 422


async def test_toggle_support_not_found(client: AsyncClient) -> None:
    """PATCH on a non-existent project returns 404."""
    response = await client.patch(
        "/api/projects/999/support",
        json={"activate": True},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/metrics/support
# ---------------------------------------------------------------------------


async def test_support_metrics_empty(client: AsyncClient) -> None:
    """GET /api/metrics/support returns empty list when no projects in support."""
    response = await client.get("/api/metrics/support")
    assert response.status_code == 200
    assert response.json()["projects"] == []


async def test_support_metrics_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/support returns metrics for projects in support mode."""
    today = date.today()
    p = await create_project(
        db_session,
        name="Support Project",
        is_support=True,
        project_type="support",
        project_end_date=today - timedelta(days=5),
        support_start_date=today - timedelta(days=3),
        support_end_date=today + timedelta(days=18),
    )
    await create_work_item(
        db_session,
        p,
        plane_issue_id="issue-001",
        state="In Progress",
    )
    await create_work_item(
        db_session,
        p,
        plane_issue_id="issue-002",
        state="Done",
    )

    response = await client.get("/api/metrics/support")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projects"]) == 1
    proj = data["projects"][0]
    assert proj["name"] == "Support Project"
    assert proj["is_active"] is True
    assert proj["days_remaining"] > 0


async def test_support_metrics_non_support_excluded(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/support does not include non-support projects."""
    await create_project(
        db_session,
        name="Normal Project",
        is_support=False,
    )

    response = await client.get("/api/metrics/support")
    assert response.status_code == 200
    assert response.json()["projects"] == []
