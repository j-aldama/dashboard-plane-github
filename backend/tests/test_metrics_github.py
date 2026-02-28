"""Tests for the GitHub metrics endpoints.

Covers:
- Overview aggregate metrics
- By-user breakdown
- By-repo breakdown
- Activity timeline (daily)
- Filter combinations (user_id, repo_name, date_from, date_to)
- Empty data scenarios
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import (
    create_github_commit,
    create_github_pr,
    create_team_member,
)


# ---------------------------------------------------------------------------
# Overview endpoint
# ---------------------------------------------------------------------------


async def test_github_overview_empty(client: AsyncClient) -> None:
    """GET /api/metrics/github/overview returns zeroed metrics when no data exists."""
    response = await client.get("/api/metrics/github/overview")
    assert response.status_code == 200

    data = response.json()
    assert data["total_commits"] == 0
    assert data["total_prs"] == 0
    assert data["total_prs_merged"] == 0
    assert data["total_lines_added"] == 0
    assert data["total_lines_removed"] == 0


async def test_github_overview_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/github/overview returns correct aggregates."""
    member = await create_team_member(db_session, github_username="alice")
    now = datetime.now(timezone.utc)

    await create_github_commit(
        db_session,
        member,
        sha="aaa111",
        lines_added=100,
        lines_removed=20,
        committed_at=now,
    )
    await create_github_commit(
        db_session,
        member,
        sha="bbb222",
        lines_added=50,
        lines_removed=10,
        committed_at=now,
    )
    await create_github_pr(
        db_session,
        member,
        pr_number=1,
        state="closed",
        merged_at=now,
    )
    await create_github_pr(
        db_session,
        member,
        pr_number=2,
        state="open",
        merged_at=None,
    )

    response = await client.get("/api/metrics/github/overview")
    assert response.status_code == 200

    data = response.json()
    assert data["total_commits"] == 2
    assert data["total_prs"] == 2
    assert data["total_prs_merged"] == 1
    assert data["total_lines_added"] == 150
    assert data["total_lines_removed"] == 30


async def test_github_overview_filter_by_user(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/github/overview?user_id=X filters by user."""
    m1 = await create_team_member(db_session, plane_user_id="uid-001", name="Alice", github_username="alice")
    m2 = await create_team_member(db_session, plane_user_id="uid-002", name="Bob", github_username="bob")
    now = datetime.now(timezone.utc)

    await create_github_commit(db_session, m1, sha="aaa", lines_added=100, committed_at=now)
    await create_github_commit(db_session, m2, sha="bbb", lines_added=50, committed_at=now)

    response = await client.get(f"/api/metrics/github/overview?user_id={m1.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_commits"] == 1
    assert data["total_lines_added"] == 100


async def test_github_overview_filter_by_repo(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/github/overview?repo_name=X filters by repo."""
    member = await create_team_member(db_session)
    now = datetime.now(timezone.utc)

    await create_github_commit(db_session, member, sha="aaa", repo_name="repo-a", committed_at=now)
    await create_github_commit(db_session, member, sha="bbb", repo_name="repo-b", committed_at=now)

    response = await client.get("/api/metrics/github/overview?repo_name=repo-a")
    assert response.status_code == 200
    data = response.json()
    assert data["total_commits"] == 1


async def test_github_overview_filter_by_date(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/github/overview with date filters returns correct data."""
    member = await create_team_member(db_session)

    await create_github_commit(
        db_session,
        member,
        sha="aaa",
        committed_at=datetime(2025, 1, 15, tzinfo=timezone.utc),
    )
    await create_github_commit(
        db_session,
        member,
        sha="bbb",
        committed_at=datetime(2025, 2, 15, tzinfo=timezone.utc),
    )

    response = await client.get(
        "/api/metrics/github/overview?date_from=2025-02-01&date_to=2025-02-28"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_commits"] == 1


# ---------------------------------------------------------------------------
# By-user endpoint
# ---------------------------------------------------------------------------


async def test_github_by_user_empty(client: AsyncClient) -> None:
    """GET /api/metrics/github/by-user returns empty list when no data exists."""
    response = await client.get("/api/metrics/github/by-user")
    assert response.status_code == 200
    assert response.json()["users"] == []


async def test_github_by_user_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/github/by-user returns per-user metrics."""
    m1 = await create_team_member(db_session, plane_user_id="uid-001", name="Alice", github_username="alice")
    m2 = await create_team_member(db_session, plane_user_id="uid-002", name="Bob", github_username="bob")
    now = datetime.now(timezone.utc)

    await create_github_commit(db_session, m1, sha="aaa", lines_added=100, committed_at=now)
    await create_github_commit(db_session, m2, sha="bbb", lines_added=50, committed_at=now)
    await create_github_pr(db_session, m1, pr_number=1, merged_at=now)

    response = await client.get("/api/metrics/github/by-user")
    assert response.status_code == 200

    data = response.json()
    assert len(data["users"]) == 2

    alice = next(u for u in data["users"] if u["name"] == "Alice")
    assert alice["commits"] == 1
    assert alice["lines_added"] == 100
    assert alice["prs_merged"] == 1


# ---------------------------------------------------------------------------
# By-repo endpoint
# ---------------------------------------------------------------------------


async def test_github_by_repo_empty(client: AsyncClient) -> None:
    """GET /api/metrics/github/by-repo returns empty list when no data exists."""
    response = await client.get("/api/metrics/github/by-repo")
    assert response.status_code == 200
    assert response.json()["repos"] == []


async def test_github_by_repo_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/github/by-repo returns per-repo metrics."""
    member = await create_team_member(db_session)
    now = datetime.now(timezone.utc)

    await create_github_commit(db_session, member, sha="aaa", repo_name="repo-a", committed_at=now)
    await create_github_commit(db_session, member, sha="bbb", repo_name="repo-b", committed_at=now)
    await create_github_pr(db_session, member, pr_number=1, repo_name="repo-a", merged_at=now)

    response = await client.get("/api/metrics/github/by-repo")
    assert response.status_code == 200

    data = response.json()
    assert len(data["repos"]) == 2

    repo_a = next(r for r in data["repos"] if r["repo_name"] == "repo-a")
    assert repo_a["commits"] == 1
    assert repo_a["prs_merged"] == 1


# ---------------------------------------------------------------------------
# Activity endpoint
# ---------------------------------------------------------------------------


async def test_github_activity_empty(client: AsyncClient) -> None:
    """GET /api/metrics/github/activity returns empty list when no data and no date range."""
    response = await client.get("/api/metrics/github/activity")
    assert response.status_code == 200
    assert response.json()["activity"] == []


async def test_github_activity_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/github/activity returns activity timeline."""
    member = await create_team_member(db_session)

    await create_github_commit(
        db_session,
        member,
        sha="aaa",
        committed_at=datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
        lines_added=100,
    )
    await create_github_commit(
        db_session,
        member,
        sha="bbb",
        committed_at=datetime(2025, 1, 15, 14, 0, 0, tzinfo=timezone.utc),
        lines_added=50,
    )

    response = await client.get("/api/metrics/github/activity")
    assert response.status_code == 200

    data = response.json()
    assert len(data["activity"]) >= 1
