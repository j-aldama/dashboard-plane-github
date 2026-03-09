"""Tests for the GitHub repository management endpoints.

Covers:
- GET /api/github-repos — list all repositories sorted by name
- PATCH /api/github-repos/{id} — toggle is_active
- 404 on missing repository
- Empty list scenario
- Response shape validation
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github_repository import GitHubRepository


# ---------------------------------------------------------------------------
# Factory helper (not in conftest — local to this module)
# ---------------------------------------------------------------------------


async def create_github_repo(
    db: AsyncSession,
    *,
    repo_name: str = "test-repo",
    is_active: bool = True,
) -> GitHubRepository:
    """Seed a GitHubRepository row for testing."""
    repo = GitHubRepository(repo_name=repo_name, is_active=is_active)
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return repo


# ---------------------------------------------------------------------------
# GET /api/github-repos
# ---------------------------------------------------------------------------


async def test_list_github_repos_empty(client: AsyncClient) -> None:
    """GET /api/github-repos returns empty list when no repositories exist."""
    response = await client.get("/api/github-repos")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_github_repos_sorted_by_name(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/github-repos returns repos sorted alphabetically by repo_name."""
    await create_github_repo(db_session, repo_name="zeta-service")
    await create_github_repo(db_session, repo_name="alpha-api")
    await create_github_repo(db_session, repo_name="middleware-lib")

    response = await client.get("/api/github-repos")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 3
    assert data[0]["repo_name"] == "alpha-api"
    assert data[1]["repo_name"] == "middleware-lib"
    assert data[2]["repo_name"] == "zeta-service"


async def test_list_github_repos_response_shape(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/github-repos each item has the required fields."""
    await create_github_repo(db_session, repo_name="my-repo", is_active=True)

    response = await client.get("/api/github-repos")
    assert response.status_code == 200

    item = response.json()[0]
    assert "id" in item
    assert item["repo_name"] == "my-repo"
    assert "is_active" in item


async def test_list_github_repos_includes_inactive(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/github-repos returns both active and inactive repositories."""
    await create_github_repo(db_session, repo_name="active-repo", is_active=True)
    await create_github_repo(db_session, repo_name="inactive-repo", is_active=False)

    response = await client.get("/api/github-repos")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    names = {r["repo_name"] for r in data}
    assert "active-repo" in names
    assert "inactive-repo" in names


# ---------------------------------------------------------------------------
# PATCH /api/github-repos/{id}
# ---------------------------------------------------------------------------


async def test_toggle_repo_deactivate(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH sets is_active to False for an active repository."""
    repo = await create_github_repo(db_session, repo_name="active-repo", is_active=True)

    response = await client.patch(
        f"/api/github-repos/{repo.id}",
        json={"is_active": False},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["is_active"] is False
    assert data["id"] == repo.id
    assert data["repo_name"] == "active-repo"


async def test_toggle_repo_activate(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH sets is_active to True for an inactive repository."""
    repo = await create_github_repo(
        db_session, repo_name="inactive-repo", is_active=False
    )

    response = await client.patch(
        f"/api/github-repos/{repo.id}",
        json={"is_active": True},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["is_active"] is True


async def test_toggle_repo_persists_in_db(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH change is reflected when listing repositories afterwards."""
    repo = await create_github_repo(db_session, repo_name="my-repo", is_active=True)

    await client.patch(
        f"/api/github-repos/{repo.id}",
        json={"is_active": False},
    )

    # Verify the change persists by re-reading from the list endpoint
    list_response = await client.get("/api/github-repos")
    assert list_response.status_code == 200

    repos = list_response.json()
    matching = [r for r in repos if r["id"] == repo.id]
    assert len(matching) == 1
    assert matching[0]["is_active"] is False


async def test_toggle_repo_not_found(client: AsyncClient) -> None:
    """PATCH on a non-existent repository returns 404."""
    response = await client.patch(
        "/api/github-repos/999",
        json={"is_active": False},
    )
    assert response.status_code == 404


async def test_toggle_repo_missing_body(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH without body returns 422."""
    repo = await create_github_repo(db_session, repo_name="my-repo")

    response = await client.patch(f"/api/github-repos/{repo.id}", json={})
    assert response.status_code == 422


async def test_toggle_repo_wrong_type_for_is_active(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH with is_active as an arbitrary non-boolean object returns 422."""
    repo = await create_github_repo(db_session, repo_name="my-repo")

    # Pydantic coerces strings like "yes"/"no" to bool, but an object/dict
    # that cannot be interpreted as a boolean should return 422.
    response = await client.patch(
        f"/api/github-repos/{repo.id}",
        json={"is_active": {"nested": "object"}},
    )
    assert response.status_code == 422
