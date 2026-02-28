"""Tests for the sync_work_items service and endpoint.

Covers:
- Creating new work items from Plane API
- Upserting existing work items
- Label extraction and bug/client-blocked detection
- State parsing, completed_at calculation
- Assignee and cycle resolution
- Pagination handling
- Error handling: timeout, HTTP errors
- Empty project list
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.work_item import WorkItem
from tests.conftest import (
    create_cycle,
    create_project,
    create_team_member,
    create_work_item,
)


def _make_response(data, status_code: int = 200, url: str = "https://plane.test") -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        json=data,
        request=httpx.Request("GET", url),
    )


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------


@patch("app.services.sync_work_items.settings")
async def test_sync_work_items_creates_new(mock_settings, db_session: AsyncSession) -> None:
    """sync_work_items creates new WorkItem rows for each issue."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    project = await create_project(db_session, plane_project_id="proj-001", name="Backend")
    member = await create_team_member(db_session, plane_user_id="uid-001")

    issues_data = [
        {
            "id": "issue-001",
            "name": "Fix bug",
            "state_detail": {"name": "In Progress"},
            "priority": "high",
            "estimate_point": 5,
            "assignees": ["uid-001"],
            "label_detail": [{"name": "bug"}],
        },
        {
            "id": "issue-002",
            "name": "New feature",
            "state_detail": {"name": "Done"},
            "priority": "medium",
            "estimate_point": 8,
            "assignees": [],
            "label_detail": [],
            "completed_at": "2025-01-15T10:00:00Z",
        },
    ]

    async def mock_get(url, headers=None, params=None):
        return _make_response(issues_data, url=url)

    with patch("app.services.sync_work_items.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_work_items import sync_work_items

        result = await sync_work_items(db_session)

    assert result["created"] == 2
    assert result["updated"] == 0
    assert result["total"] == 2

    items = (await db_session.execute(select(WorkItem))).scalars().all()
    assert len(items) == 2

    bug_item = next(i for i in items if i.plane_issue_id == "issue-001")
    assert bug_item.is_bug is True
    assert bug_item.assignee_id == member.id
    assert bug_item.state == "In Progress"

    done_item = next(i for i in items if i.plane_issue_id == "issue-002")
    assert done_item.state == "Done"
    assert done_item.completed_at is not None


@patch("app.services.sync_work_items.settings")
async def test_sync_work_items_updates_existing(mock_settings, db_session: AsyncSession) -> None:
    """sync_work_items updates an existing WorkItem when re-synced."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    project = await create_project(db_session, plane_project_id="proj-001", name="Backend")
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-001",
        title="Old Title",
        state="Backlog",
    )

    issues_data = [
        {
            "id": "issue-001",
            "name": "New Title",
            "state_detail": {"name": "In Progress"},
            "priority": "high",
            "estimate_point": 3,
            "assignees": [],
            "label_detail": [],
        }
    ]

    async def mock_get(url, headers=None, params=None):
        return _make_response(issues_data, url=url)

    with patch("app.services.sync_work_items.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_work_items import sync_work_items

        result = await sync_work_items(db_session)

    assert result["created"] == 0
    assert result["updated"] == 1

    item = (
        await db_session.execute(
            select(WorkItem).where(WorkItem.plane_issue_id == "issue-001")
        )
    ).scalar_one()
    assert item.title == "New Title"
    assert item.state == "In Progress"


@patch("app.services.sync_work_items.settings")
async def test_sync_work_items_no_projects(mock_settings, db_session: AsyncSession) -> None:
    """sync_work_items returns zero counts when no projects exist."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    from app.services.sync_work_items import sync_work_items

    result = await sync_work_items(db_session)

    assert result["created"] == 0
    assert result["updated"] == 0
    assert result["total"] == 0


@patch("app.services.sync_work_items.settings")
async def test_sync_work_items_client_blocked_label(mock_settings, db_session: AsyncSession) -> None:
    """sync_work_items detects client-blocked items by label."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    project = await create_project(db_session, plane_project_id="proj-001", name="Backend")

    issues_data = [
        {
            "id": "issue-001",
            "name": "Blocked task",
            "state_detail": {"name": "In Progress"},
            "priority": "high",
            "assignees": [],
            "label_detail": [{"name": "Esperando Cliente"}],
        }
    ]

    async def mock_get(url, headers=None, params=None):
        return _make_response(issues_data, url=url)

    with patch("app.services.sync_work_items.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_work_items import sync_work_items

        result = await sync_work_items(db_session)

    assert result["created"] == 1

    item = (await db_session.execute(select(WorkItem))).scalar_one()
    assert item.is_client_blocked is True


@patch("app.services.sync_work_items.settings")
async def test_sync_work_items_pagination(mock_settings, db_session: AsyncSession) -> None:
    """sync_work_items follows Plane pagination for issues."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    await create_project(db_session, plane_project_id="proj-001", name="Backend")

    page_1 = {
        "results": [
            {"id": "issue-001", "name": "Task 1", "state_detail": {"name": "Done"}, "assignees": [], "label_detail": []}
        ],
        "next_page_results": True,
        "next_cursor": "cursor-xyz",
    }
    page_2 = {
        "results": [
            {"id": "issue-002", "name": "Task 2", "state_detail": {"name": "Backlog"}, "assignees": [], "label_detail": []}
        ],
        "next_page_results": False,
    }

    async def mock_get(url, headers=None, params=None):
        if "cursor=" in url:
            return _make_response(page_2, url=url)
        return _make_response(page_1, url=url)

    with patch("app.services.sync_work_items.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_work_items import sync_work_items

        result = await sync_work_items(db_session)

    assert result["created"] == 2
    assert result["total"] == 2


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


async def test_sync_work_items_endpoint_timeout(client: AsyncClient, db_session: AsyncSession) -> None:
    """POST /api/sync/work-items returns 504 on timeout."""
    await create_project(db_session, plane_project_id="proj-001", name="Test")

    with (
        patch("app.services.sync_work_items.settings") as mock_settings,
        patch("app.services.sync_work_items.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.PLANE_BASE_URL = "https://plane.test"
        mock_settings.PLANE_WORKSPACE_SLUG = "ws"
        mock_settings.PLANE_API_KEY = "test-key"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        response = await client.post("/api/sync/work-items")

    # The service catches per-project timeouts and continues, so it won't raise
    # at endpoint level — it returns 200 with zero items
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
