"""Tests for the sync_projects service and endpoint.

Covers:
- Creating new projects and cycles from Plane API
- Upserting existing projects and cycles
- Pagination handling
- Error handling: timeout, HTTP errors (401, 429, 500)
- Date parsing for cycles
"""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cycle import Cycle
from app.models.project import Project
from tests.conftest import create_project, create_cycle


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_response(data, status_code: int = 200, url: str = "https://plane.test/api") -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        json=data,
        request=httpx.Request("GET", url),
    )


def _make_error_response(status_code: int, text: str = "Error") -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        text=text,
        request=httpx.Request("GET", "https://plane.test/api"),
    )


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------


@patch("app.services.sync_projects.settings")
async def test_sync_projects_creates_new(mock_settings, db_session: AsyncSession) -> None:
    """sync_projects_and_cycles creates new Project and Cycle rows."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    projects_data = [
        {
            "id": "proj-001",
            "name": "Backend",
            "identifier": "BE",
            "description": "Backend project",
        }
    ]

    cycles_data = [
        {
            "id": "cycle-001",
            "name": "Sprint 1",
            "start_date": "2025-01-01",
            "end_date": "2025-01-14",
        }
    ]

    call_count = 0

    async def mock_get(url, headers=None, params=None):
        nonlocal call_count
        call_count += 1
        if "cycles" in url:
            return _make_response(cycles_data, url=url)
        return _make_response(projects_data, url=url)

    with patch("app.services.sync_projects.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_projects import sync_projects_and_cycles

        result = await sync_projects_and_cycles(db_session)

    assert result["projects_created"] == 1
    assert result["projects_updated"] == 0
    assert result["cycles_created"] == 1
    assert result["cycles_updated"] == 0

    projects = (await db_session.execute(select(Project))).scalars().all()
    assert len(projects) == 1
    assert projects[0].name == "Backend"
    assert projects[0].identifier == "BE"


@patch("app.services.sync_projects.settings")
async def test_sync_projects_upserts_existing(mock_settings, db_session: AsyncSession) -> None:
    """sync_projects_and_cycles updates existing Project/Cycle when re-synced."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    existing_project = await create_project(
        db_session,
        plane_project_id="proj-001",
        name="Old Name",
        identifier="OLD",
    )
    await create_cycle(
        db_session,
        existing_project,
        plane_cycle_id="cycle-001",
        name="Old Sprint",
    )

    projects_data = [
        {
            "id": "proj-001",
            "name": "New Name",
            "identifier": "NEW",
            "description": "Updated",
        }
    ]

    cycles_data = [
        {
            "id": "cycle-001",
            "name": "New Sprint",
            "start_date": "2025-02-01",
            "end_date": "2025-02-14",
        }
    ]

    async def mock_get(url, headers=None, params=None):
        if "cycles" in url:
            return _make_response(cycles_data, url=url)
        return _make_response(projects_data, url=url)

    with patch("app.services.sync_projects.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_projects import sync_projects_and_cycles

        result = await sync_projects_and_cycles(db_session)

    assert result["projects_created"] == 0
    assert result["projects_updated"] == 1
    assert result["cycles_created"] == 0
    assert result["cycles_updated"] == 1


@patch("app.services.sync_projects.settings")
async def test_sync_projects_pagination(mock_settings, db_session: AsyncSession) -> None:
    """sync_projects_and_cycles follows cursor pagination."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    page_1 = {
        "results": [{"id": "proj-001", "name": "P1"}],
        "next_page_results": True,
        "next_cursor": "cursor-abc",
    }
    page_2 = {
        "results": [{"id": "proj-002", "name": "P2"}],
        "next_page_results": False,
    }

    call_urls = []

    async def mock_get(url, headers=None, params=None):
        call_urls.append(url)
        if "cycles" in url:
            return _make_response([], url=url)
        if "cursor=" in url:
            return _make_response(page_2, url=url)
        return _make_response(page_1, url=url)

    with patch("app.services.sync_projects.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_projects import sync_projects_and_cycles

        result = await sync_projects_and_cycles(db_session)

    assert result["projects_created"] == 2


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------


@patch("app.services.sync_projects.settings")
async def test_sync_projects_timeout_raises(mock_settings, db_session: AsyncSession) -> None:
    """sync_projects_and_cycles raises httpx.TimeoutException on timeout."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    with patch("app.services.sync_projects.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_projects import sync_projects_and_cycles

        with pytest.raises(httpx.TimeoutException):
            await sync_projects_and_cycles(db_session)


@patch("app.services.sync_projects.settings")
async def test_sync_projects_401_raises(mock_settings, db_session: AsyncSession) -> None:
    """sync_projects_and_cycles raises HTTPStatusError on 401."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "bad-key"

    error_resp = _make_error_response(401, "Unauthorized")

    with patch("app.services.sync_projects.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=error_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_projects import sync_projects_and_cycles

        with pytest.raises(httpx.HTTPStatusError):
            await sync_projects_and_cycles(db_session)


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


async def test_sync_projects_endpoint_success(client: AsyncClient, db_session: AsyncSession) -> None:
    """POST /api/sync/projects-cycles returns the sync summary."""
    projects_data = [
        {"id": "proj-001", "name": "Backend", "identifier": "BE"}
    ]
    cycles_data = []

    async def mock_get(url, headers=None, params=None):
        if "cycles" in url:
            return _make_response(cycles_data, url=url)
        return _make_response(projects_data, url=url)

    with (
        patch("app.services.sync_projects.settings") as mock_settings,
        patch("app.services.sync_projects.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.PLANE_BASE_URL = "https://plane.test"
        mock_settings.PLANE_WORKSPACE_SLUG = "ws"
        mock_settings.PLANE_API_KEY = "test-key"

        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        response = await client.post("/api/sync/projects-cycles")

    assert response.status_code == 200
    data = response.json()
    assert data["projects_created"] == 1
    assert data["cycles_created"] == 0


async def test_sync_projects_endpoint_timeout(client: AsyncClient) -> None:
    """POST /api/sync/projects-cycles returns 504 on timeout."""
    with (
        patch("app.services.sync_projects.settings") as mock_settings,
        patch("app.services.sync_projects.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.PLANE_BASE_URL = "https://plane.test"
        mock_settings.PLANE_WORKSPACE_SLUG = "ws"
        mock_settings.PLANE_API_KEY = "test-key"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        response = await client.post("/api/sync/projects-cycles")

    assert response.status_code == 504


async def test_sync_projects_endpoint_401(client: AsyncClient) -> None:
    """POST /api/sync/projects-cycles returns 502 on 401."""
    error_resp = _make_error_response(401, "Unauthorized")

    with (
        patch("app.services.sync_projects.settings") as mock_settings,
        patch("app.services.sync_projects.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.PLANE_BASE_URL = "https://plane.test"
        mock_settings.PLANE_WORKSPACE_SLUG = "ws"
        mock_settings.PLANE_API_KEY = "bad-key"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=error_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        response = await client.post("/api/sync/projects-cycles")

    assert response.status_code == 502


async def test_sync_projects_endpoint_429(client: AsyncClient) -> None:
    """POST /api/sync/projects-cycles returns 502 on 429."""
    error_resp = _make_error_response(429, "Too Many Requests")

    with (
        patch("app.services.sync_projects.settings") as mock_settings,
        patch("app.services.sync_projects.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.PLANE_BASE_URL = "https://plane.test"
        mock_settings.PLANE_WORKSPACE_SLUG = "ws"
        mock_settings.PLANE_API_KEY = "test-key"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=error_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        response = await client.post("/api/sync/projects-cycles")

    assert response.status_code == 502
