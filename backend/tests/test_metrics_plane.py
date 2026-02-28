"""Tests for the Plane metrics endpoints.

Covers:
- Overview metrics with and without filters
- Projects list metrics
- Project detail with state/label breakdowns
- Cycles list metrics
- Cycle detail with task list
- Empty data scenarios
- Filter combinations (project_id, user_id, date_from, date_to)
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import (
    create_cycle,
    create_project,
    create_team_member,
    create_work_item,
)


# ---------------------------------------------------------------------------
# Overview endpoint
# ---------------------------------------------------------------------------


async def test_overview_empty_db(client: AsyncClient) -> None:
    """GET /api/metrics/overview returns zeroed metrics for an empty database."""
    response = await client.get("/api/metrics/overview")
    assert response.status_code == 200

    data = response.json()
    assert data["total_tasks"] == 0
    assert data["completed_tasks"] == 0
    assert data["pending_tasks"] == 0
    assert data["total_points"] == 0
    assert data["completed_points"] == 0
    assert data["total_cycles"] == 0
    assert data["active_cycles"] == 0
    assert data["total_bugs"] == 0


async def test_overview_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/overview returns correct aggregates."""
    project = await create_project(db_session)
    member = await create_team_member(db_session)

    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-001",
        state="In Progress",
        estimate_points=5,
        assignee=member,
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-002",
        state="Done",
        estimate_points=3,
        completed_at=datetime.now(timezone.utc),
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-003",
        state="In Progress",
        is_bug=True,
        estimate_points=2,
    )

    today = date.today()
    await create_cycle(
        db_session,
        project,
        plane_cycle_id="cycle-001",
        is_active=True,
        start_date=today - timedelta(days=7),
        end_date=today + timedelta(days=7),
    )

    response = await client.get("/api/metrics/overview")
    assert response.status_code == 200

    data = response.json()
    assert data["total_tasks"] == 3
    assert data["completed_tasks"] == 1
    assert data["pending_tasks"] == 2
    assert data["total_points"] == 10
    assert data["completed_points"] == 3
    assert data["total_cycles"] == 1
    assert data["active_cycles"] == 1
    assert data["total_bugs"] == 1


async def test_overview_filter_by_project(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/overview?project_id=X filters by project."""
    p1 = await create_project(db_session, plane_project_id="proj-001", name="P1")
    p2 = await create_project(db_session, plane_project_id="proj-002", name="P2")

    await create_work_item(db_session, p1, plane_issue_id="issue-001", state="Done", estimate_points=5)
    await create_work_item(db_session, p2, plane_issue_id="issue-002", state="Done", estimate_points=3)

    response = await client.get(f"/api/metrics/overview?project_id={p1.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_tasks"] == 1
    assert data["completed_points"] == 5


async def test_overview_filter_by_user(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/overview?user_id=X filters by team member."""
    project = await create_project(db_session)
    m1 = await create_team_member(db_session, plane_user_id="uid-001", name="Alice")
    m2 = await create_team_member(db_session, plane_user_id="uid-002", name="Bob")

    await create_work_item(db_session, project, plane_issue_id="issue-001", assignee=m1, estimate_points=5)
    await create_work_item(db_session, project, plane_issue_id="issue-002", assignee=m2, estimate_points=3)

    response = await client.get(f"/api/metrics/overview?user_id={m1.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_tasks"] == 1
    assert data["total_points"] == 5


# ---------------------------------------------------------------------------
# Projects list endpoint
# ---------------------------------------------------------------------------


async def test_projects_list_empty(client: AsyncClient) -> None:
    """GET /api/metrics/projects returns empty list when no projects exist."""
    response = await client.get("/api/metrics/projects")
    assert response.status_code == 200
    assert response.json()["projects"] == []


async def test_projects_list_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/projects returns per-project summaries."""
    p = await create_project(db_session, name="Backend", identifier="BE")
    await create_work_item(db_session, p, plane_issue_id="issue-001", state="Done", estimate_points=5)
    await create_work_item(db_session, p, plane_issue_id="issue-002", state="In Progress", estimate_points=3)

    response = await client.get("/api/metrics/projects")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projects"]) == 1
    proj = data["projects"][0]
    assert proj["name"] == "Backend"
    assert proj["total_tasks"] == 2
    assert proj["completed_tasks"] == 1
    assert proj["pending_tasks"] == 1


# ---------------------------------------------------------------------------
# Project detail endpoint
# ---------------------------------------------------------------------------


async def test_project_detail_not_found(client: AsyncClient) -> None:
    """GET /api/metrics/projects/999 returns 404."""
    response = await client.get("/api/metrics/projects/999")
    assert response.status_code == 404


async def test_project_detail_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/projects/{id} returns detailed project metrics."""
    p = await create_project(db_session, name="Backend", identifier="BE")
    await create_work_item(
        db_session,
        p,
        plane_issue_id="issue-001",
        state="In Progress",
        is_bug=True,
        label_names=["bug"],
    )
    await create_work_item(
        db_session,
        p,
        plane_issue_id="issue-002",
        state="Done",
        estimate_points=5,
        label_names=["feature"],
    )
    await create_work_item(
        db_session,
        p,
        plane_issue_id="issue-003",
        state="In Progress",
        is_client_blocked=True,
    )

    response = await client.get(f"/api/metrics/projects/{p.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "Backend"
    assert data["total_tasks"] == 3
    assert data["completed_tasks"] == 1
    assert data["total_bugs"] == 1
    assert len(data["bugs"]) == 1
    assert len(data["client_blocked"]) == 1
    assert len(data["state_breakdown"]) > 0
    assert len(data["label_breakdown"]) > 0


# ---------------------------------------------------------------------------
# Cycles list endpoint
# ---------------------------------------------------------------------------


async def test_cycles_list_empty(client: AsyncClient) -> None:
    """GET /api/metrics/cycles returns empty list when no cycles exist."""
    response = await client.get("/api/metrics/cycles")
    assert response.status_code == 200
    assert response.json()["cycles"] == []


async def test_cycles_list_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/cycles returns per-cycle summaries."""
    p = await create_project(db_session)
    today = date.today()
    c = await create_cycle(
        db_session,
        p,
        name="Sprint 1",
        start_date=today - timedelta(days=7),
        end_date=today + timedelta(days=7),
        is_active=True,
    )
    await create_work_item(
        db_session,
        p,
        plane_issue_id="issue-001",
        state="Done",
        cycle=c,
        estimate_points=3,
    )

    response = await client.get("/api/metrics/cycles")
    assert response.status_code == 200

    data = response.json()
    assert len(data["cycles"]) == 1
    cycle_data = data["cycles"][0]
    assert cycle_data["name"] == "Sprint 1"
    assert cycle_data["total_tasks"] == 1
    assert cycle_data["completed_tasks"] == 1
    assert cycle_data["is_active"] is True


async def test_cycles_list_filter_by_project(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/cycles?project_id=X filters by project."""
    p1 = await create_project(db_session, plane_project_id="proj-001", name="P1")
    p2 = await create_project(db_session, plane_project_id="proj-002", name="P2")

    await create_cycle(db_session, p1, plane_cycle_id="c1", name="Sprint A")
    await create_cycle(db_session, p2, plane_cycle_id="c2", name="Sprint B")

    response = await client.get(f"/api/metrics/cycles?project_id={p1.id}")
    assert response.status_code == 200

    data = response.json()
    assert len(data["cycles"]) == 1
    assert data["cycles"][0]["name"] == "Sprint A"


# ---------------------------------------------------------------------------
# Cycle detail endpoint
# ---------------------------------------------------------------------------


async def test_cycle_detail_not_found(client: AsyncClient) -> None:
    """GET /api/metrics/cycles/999 returns 404."""
    response = await client.get("/api/metrics/cycles/999")
    assert response.status_code == 404


async def test_cycle_detail_with_tasks(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/cycles/{id} returns cycle detail with tasks."""
    p = await create_project(db_session)
    member = await create_team_member(db_session)
    c = await create_cycle(db_session, p, name="Sprint 1")
    await create_work_item(
        db_session,
        p,
        plane_issue_id="issue-001",
        title="Task 1",
        state="Done",
        cycle=c,
        assignee=member,
        estimate_points=5,
    )

    response = await client.get(f"/api/metrics/cycles/{c.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "Sprint 1"
    assert data["total_tasks"] == 1
    assert len(data["tasks"]) == 1
    assert data["tasks"][0]["title"] == "Task 1"
    assert data["tasks"][0]["assignee_name"] == member.name
