"""Tests for the team member management endpoints.

Covers:
- GET /api/team-members — list all members sorted by name
- PATCH /api/team-members/{id} — update github_username
- PATCH /api/team-members/{id} — toggle is_active
- 404 on missing member
- Clearing github_username with empty string
- GET /api/github-org-members — returns empty list when GITHUB_TOKEN/GITHUB_ORG not set
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_team_member


# ---------------------------------------------------------------------------
# GET /api/team-members
# ---------------------------------------------------------------------------


async def test_list_team_members_empty(client: AsyncClient) -> None:
    """GET /api/team-members returns empty list when no members exist."""
    response = await client.get("/api/team-members")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_team_members_sorted_by_name(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/team-members returns members sorted alphabetically by name."""
    await create_team_member(
        db_session,
        name="Zara Smith",
        plane_user_id="uid-001",
        email="zara@test.com",
    )
    await create_team_member(
        db_session,
        name="Alice Johnson",
        plane_user_id="uid-002",
        email="alice@test.com",
    )
    await create_team_member(
        db_session,
        name="Marco Polo",
        plane_user_id="uid-003",
        email="marco@test.com",
    )

    response = await client.get("/api/team-members")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 3
    assert data[0]["name"] == "Alice Johnson"
    assert data[1]["name"] == "Marco Polo"
    assert data[2]["name"] == "Zara Smith"


async def test_list_team_members_response_shape(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/team-members each item has the expected fields."""
    await create_team_member(
        db_session,
        name="Juan Test",
        plane_user_id="uid-001",
        email="juan@test.com",
        github_username="juantest",
        avatar_url="https://avatar.test/juan.png",
    )

    response = await client.get("/api/team-members")
    assert response.status_code == 200

    item = response.json()[0]
    assert "id" in item
    assert item["name"] == "Juan Test"
    assert item["email"] == "juan@test.com"
    assert item["plane_user_id"] == "uid-001"
    assert item["github_username"] == "juantest"
    assert item["avatar_url"] == "https://avatar.test/juan.png"
    assert "is_active" in item


# ---------------------------------------------------------------------------
# PATCH /api/team-members/{id}
# ---------------------------------------------------------------------------


async def test_update_team_member_github_username(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH updates github_username for a team member."""
    member = await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username=None,
    )

    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"github_username": "newuser"},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["github_username"] == "newuser"
    assert data["id"] == member.id


async def test_update_team_member_github_username_overwrite(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH overwrites an existing github_username."""
    member = await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="olduser",
    )

    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"github_username": "updateduser"},
    )
    assert response.status_code == 200
    assert response.json()["github_username"] == "updateduser"


async def test_update_team_member_clear_github_username_with_empty_string(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH with github_username='' clears the GitHub link (sets to None)."""
    member = await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="someuser",
    )

    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"github_username": ""},
    )
    assert response.status_code == 200
    assert response.json()["github_username"] is None


async def test_update_team_member_clear_github_username_with_null(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH with github_username=null leaves existing value unchanged."""
    member = await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="existinguser",
    )

    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"github_username": None},
    )
    assert response.status_code == 200
    # None in payload means "no update", so it should remain unchanged
    assert response.json()["github_username"] == "existinguser"


async def test_update_team_member_toggle_active_false(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH sets is_active to False to deactivate a member."""
    member = await create_team_member(db_session, plane_user_id="uid-001")

    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"is_active": False},
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False


async def test_update_team_member_toggle_active_true(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH sets is_active to True to re-activate a member."""
    member = await create_team_member(db_session, plane_user_id="uid-001")

    # First deactivate
    await client.patch(
        f"/api/team-members/{member.id}",
        json={"is_active": False},
    )

    # Then reactivate
    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"is_active": True},
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is True


async def test_update_team_member_both_fields_at_once(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH can update github_username and is_active in a single request."""
    member = await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username=None,
    )

    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"github_username": "combined", "is_active": False},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["github_username"] == "combined"
    assert data["is_active"] is False


async def test_update_team_member_not_found(client: AsyncClient) -> None:
    """PATCH on a non-existent member returns 404."""
    response = await client.patch(
        "/api/team-members/999",
        json={"github_username": "ghost"},
    )
    assert response.status_code == 404


async def test_update_team_member_github_username_too_long(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH rejects github_username longer than 39 characters."""
    member = await create_team_member(db_session, plane_user_id="uid-001")

    response = await client.patch(
        f"/api/team-members/{member.id}",
        json={"github_username": "a" * 40},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/github-org-members
# ---------------------------------------------------------------------------


async def test_github_org_members_returns_empty_when_no_token(
    client: AsyncClient,
) -> None:
    """GET /api/github-org-members returns empty list when GITHUB_TOKEN is not set."""
    # conftest sets GITHUB_TOKEN="" and GITHUB_ORG="" so no real call is made
    response = await client.get("/api/github-org-members")
    assert response.status_code == 200
    assert response.json() == []
