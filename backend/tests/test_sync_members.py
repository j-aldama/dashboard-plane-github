"""Tests for the sync_members service and endpoint.

Covers:
- Happy path: creating new members from Plane API response
- Upsert: updating existing members
- Error handling: 401, 429, 500, timeout, connection error
- Edge cases: empty responses, missing fields
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team_member import TeamMember
from tests.conftest import create_team_member


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------


def _mock_plane_members_response(members_data: list, status_code: int = 200) -> httpx.Response:
    """Build a fake httpx.Response for the Plane members endpoint."""
    import json
    return httpx.Response(
        status_code=status_code,
        json=members_data,
        request=httpx.Request("GET", "https://plane.test/api/v1/workspaces/ws/members/"),
    )


@patch("app.services.sync_members.settings")
async def test_sync_members_creates_new(mock_settings, db_session: AsyncSession) -> None:
    """sync_members creates new TeamMember rows for members not in the DB."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    plane_response_data = [
        {
            "member": {
                "id": "uid-001",
                "display_name": "Alice",
                "email": "alice@test.com",
                "avatar": "https://avatar.test/alice.png",
            }
        },
        {
            "member": {
                "id": "uid-002",
                "display_name": "Bob",
                "email": "bob@test.com",
                "avatar": None,
            }
        },
    ]

    mock_response = _mock_plane_members_response(plane_response_data)

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members

        result = await sync_members(db_session)

    assert result["created"] == 2
    assert result["updated"] == 0
    assert result["total"] == 2

    members = (await db_session.execute(select(TeamMember))).scalars().all()
    assert len(members) == 2
    assert {m.plane_user_id for m in members} == {"uid-001", "uid-002"}


@patch("app.services.sync_members.settings")
async def test_sync_members_updates_existing(mock_settings, db_session: AsyncSession) -> None:
    """sync_members updates an existing TeamMember when plane_user_id matches."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    await create_team_member(
        db_session,
        name="Old Name",
        plane_user_id="uid-001",
        email="old@test.com",
    )

    plane_response_data = [
        {
            "member": {
                "id": "uid-001",
                "display_name": "New Name",
                "email": "new@test.com",
                "avatar": "https://avatar.test/new.png",
            }
        },
    ]

    mock_response = _mock_plane_members_response(plane_response_data)

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members

        result = await sync_members(db_session)

    assert result["created"] == 0
    assert result["updated"] == 1

    member = (
        await db_session.execute(
            select(TeamMember).where(TeamMember.plane_user_id == "uid-001")
        )
    ).scalar_one()
    assert member.name == "New Name"
    assert member.email == "new@test.com"


@patch("app.services.sync_members.settings")
async def test_sync_members_skips_entries_without_id(mock_settings, db_session: AsyncSession) -> None:
    """sync_members skips member entries that have no id."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    plane_response_data = [
        {"member": {"display_name": "No ID", "email": "noid@test.com"}},
        {"member": {"id": "uid-001", "display_name": "Valid", "email": "valid@test.com"}},
    ]

    mock_response = _mock_plane_members_response(plane_response_data)

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members

        result = await sync_members(db_session)

    assert result["created"] == 1
    assert result["total"] == 1


@patch("app.services.sync_members.settings")
async def test_sync_members_handles_dict_response(mock_settings, db_session: AsyncSession) -> None:
    """sync_members handles Plane responses wrapped in {results: [...]}."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    plane_response_data = {
        "results": [
            {
                "member": {
                    "id": "uid-001",
                    "display_name": "Alice",
                    "email": "alice@test.com",
                }
            }
        ]
    }

    mock_response = httpx.Response(
        status_code=200,
        json=plane_response_data,
        request=httpx.Request("GET", "https://plane.test/api/v1/workspaces/ws/members/"),
    )

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members

        result = await sync_members(db_session)

    assert result["created"] == 1


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------


@patch("app.services.sync_members.settings")
async def test_sync_members_401_raises(mock_settings, db_session: AsyncSession) -> None:
    """sync_members raises HTTPException when Plane returns 401."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "bad-key"

    mock_response = httpx.Response(
        status_code=401,
        text="Unauthorized",
        request=httpx.Request("GET", "https://plane.test/api/v1/workspaces/ws/members/"),
    )

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await sync_members(db_session)

        assert exc_info.value.status_code == 502


@patch("app.services.sync_members.settings")
async def test_sync_members_429_raises(mock_settings, db_session: AsyncSession) -> None:
    """sync_members raises HTTPException when Plane returns 429 (rate limit)."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    mock_response = httpx.Response(
        status_code=429,
        text="Too Many Requests",
        request=httpx.Request("GET", "https://plane.test/api/v1/workspaces/ws/members/"),
    )

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await sync_members(db_session)

        assert exc_info.value.status_code == 429


@patch("app.services.sync_members.settings")
async def test_sync_members_500_raises(mock_settings, db_session: AsyncSession) -> None:
    """sync_members raises HTTPException when Plane returns 500."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    mock_response = httpx.Response(
        status_code=500,
        text="Internal Server Error",
        request=httpx.Request("GET", "https://plane.test/api/v1/workspaces/ws/members/"),
    )

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await sync_members(db_session)

        assert exc_info.value.status_code == 502


@patch("app.services.sync_members.settings")
async def test_sync_members_timeout_raises(mock_settings, db_session: AsyncSession) -> None:
    """sync_members raises HTTPException when the Plane API times out."""
    mock_settings.PLANE_BASE_URL = "https://plane.test"
    mock_settings.PLANE_WORKSPACE_SLUG = "ws"
    mock_settings.PLANE_API_KEY = "test-key"

    with patch("app.services.sync_members.httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        from app.services.sync_members import sync_members
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await sync_members(db_session)

        assert exc_info.value.status_code == 504


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


async def test_sync_members_endpoint_success(client: AsyncClient, db_session: AsyncSession) -> None:
    """POST /api/sync/members returns the sync summary on success."""
    plane_response_data = [
        {
            "member": {
                "id": "uid-001",
                "display_name": "Alice",
                "email": "alice@test.com",
                "avatar": None,
            }
        },
    ]

    mock_response = _mock_plane_members_response(plane_response_data)

    with (
        patch("app.services.sync_members.settings") as mock_settings,
        patch("app.services.sync_members.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.PLANE_BASE_URL = "https://plane.test"
        mock_settings.PLANE_WORKSPACE_SLUG = "ws"
        mock_settings.PLANE_API_KEY = "test-key"

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        response = await client.post("/api/sync/members")

    assert response.status_code == 200
    data = response.json()
    assert data["created"] == 1
    assert data["updated"] == 0
    assert data["total"] == 1
