"""Tests for the blocked tasks endpoint.

Covers:
- GET /api/blocked-tasks returns empty list when no blocked tasks exist
- GET /api/blocked-tasks returns tasks with 'bloqueada' label
- Completed/cancelled tasks are excluded even with 'bloqueada' label
- Label matching is case-insensitive
- Response includes project name, identifier, and assignee name
- GET /api/work-items/{id}/comments returns empty for nonexistent item
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_project, create_team_member, create_work_item


# ---------------------------------------------------------------------------
# GET /api/blocked-tasks
# ---------------------------------------------------------------------------


async def test_blocked_tasks_empty_when_no_blocked(client: AsyncClient) -> None:
    """Returns count=0 and empty tasks list when no work items have bloqueada label."""
    resp = await client.get("/api/blocked-tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0
    assert data["tasks"] == []


async def test_blocked_tasks_returns_blocked_items(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Returns work items that have a 'bloqueada' label."""
    project = await create_project(db_session)
    member = await create_team_member(db_session)
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-blocked-1",
        title="Tarea bloqueada",
        state="In Progress",
        label_names=["Bloqueada", "urgente"],
        assignee=member,
    )

    resp = await client.get("/api/blocked-tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    task = data["tasks"][0]
    assert task["title"] == "Tarea bloqueada"
    assert task["project_name"] == "Test Project"
    assert task["assignee_name"] == "Juan Test"
    assert "Bloqueada" in task["labels"]


async def test_blocked_tasks_case_insensitive(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Label matching for 'bloqueada' is case-insensitive."""
    project = await create_project(db_session)
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-lower",
        title="Lowercase label",
        state="In Progress",
        label_names=["bloqueada"],
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-upper",
        title="Uppercase label",
        state="In Progress",
        label_names=["BLOQUEADA"],
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-mixed",
        title="Mixed case label",
        state="Todo",
        label_names=["Bloqueada por cliente"],
    )

    resp = await client.get("/api/blocked-tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3


async def test_blocked_tasks_excludes_completed(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Completed/cancelled tasks are excluded even if they have 'bloqueada' label."""
    project = await create_project(db_session)
    # Active blocked task — should appear
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-active",
        title="Active blocked",
        state="In Progress",
        label_names=["Bloqueada"],
    )
    # Completed blocked task — should NOT appear
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-done",
        title="Done blocked",
        state="Done",
        state_group="completed",
        label_names=["Bloqueada"],
    )
    # Cancelled blocked task — should NOT appear
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-cancelled",
        title="Cancelled blocked",
        state="Cancelled",
        state_group="cancelled",
        label_names=["Bloqueada"],
    )

    resp = await client.get("/api/blocked-tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["tasks"][0]["title"] == "Active blocked"


async def test_blocked_tasks_excludes_non_blocked(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Tasks without 'bloqueada' label are not returned."""
    project = await create_project(db_session)
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-normal",
        title="Normal task",
        state="In Progress",
        label_names=["bug", "urgente"],
    )

    resp = await client.get("/api/blocked-tasks")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


async def test_blocked_tasks_includes_project_and_assignee(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Response includes project identifier and assignee name."""
    project = await create_project(
        db_session,
        plane_project_id="proj-abc",
        name="Mi Proyecto",
        identifier="MP",
    )
    member = await create_team_member(
        db_session,
        name="Ana García",
        plane_user_id="user-ana",
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-detail",
        title="Detalle completo",
        state="In Progress",
        label_names=["Bloqueada"],
        assignee=member,
        priority="urgent",
    )

    resp = await client.get("/api/blocked-tasks")
    data = resp.json()
    task = data["tasks"][0]
    assert task["project_name"] == "Mi Proyecto"
    assert task["project_identifier"] == "MP"
    assert task["assignee_name"] == "Ana García"
    assert task["priority"] == "urgent"


async def test_blocked_tasks_no_assignee(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Tasks without assignee return assignee_name as null."""
    project = await create_project(db_session)
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-no-assignee",
        title="Sin asignar",
        state="In Progress",
        label_names=["Bloqueada"],
    )

    resp = await client.get("/api/blocked-tasks")
    task = resp.json()["tasks"][0]
    assert task["assignee_name"] is None


# ---------------------------------------------------------------------------
# GET /api/work-items/{id}/comments
# ---------------------------------------------------------------------------


async def test_comments_returns_empty_for_nonexistent_item(
    client: AsyncClient,
) -> None:
    """Returns empty comments list for a work item that doesn't exist."""
    resp = await client.get("/api/work-items/99999/comments")
    assert resp.status_code == 200
    assert resp.json()["comments"] == []
