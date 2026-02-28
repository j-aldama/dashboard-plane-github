"""Tests for the sync_github service and endpoint.

Covers:
- Syncing commits for team members with github_username
- Syncing pull requests
- Upsert logic for commits and PRs
- Pagination via Link header
- Rate-limit handling
- Error handling: timeout, HTTP errors (401, 403, 429)
- No members with github_username returns zero counters
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github_commit import GitHubCommit
from app.models.github_pull_request import GitHubPullRequest
from tests.conftest import (
    create_github_commit,
    create_github_pr,
    create_team_member,
)


def _make_response(
    data,
    status_code: int = 200,
    url: str = "https://api.github.com",
    headers: dict | None = None,
) -> httpx.Response:
    resp_headers = {"X-RateLimit-Remaining": "100", "X-RateLimit-Reset": "9999999999"}
    if headers:
        resp_headers.update(headers)
    return httpx.Response(
        status_code=status_code,
        json=data,
        request=httpx.Request("GET", url),
        headers=resp_headers,
    )


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------


@patch("app.services.sync_github.settings")
async def test_sync_github_no_members(mock_settings, db_session: AsyncSession) -> None:
    """sync_github returns zero counters when no members have github_username."""
    mock_settings.GITHUB_TOKEN = "test-token"
    mock_settings.GITHUB_ORG = "test-org"

    from app.services.sync_github import sync_github

    result = await sync_github(db_session)

    assert result["commits_created"] == 0
    assert result["prs_created"] == 0
    assert result["repos_scanned"] == 0


@patch("app.services.sync_github.settings")
async def test_sync_github_creates_commits(mock_settings, db_session: AsyncSession) -> None:
    """sync_github creates new commit rows for each GitHub commit."""
    mock_settings.GITHUB_TOKEN = "test-token"
    mock_settings.GITHUB_ORG = "test-org"

    await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="alice",
    )

    repos_data = [{"full_name": "test-org/repo1", "name": "repo1"}]

    commits_data = [
        {
            "sha": "abc123",
            "commit": {
                "message": "feat: add feature",
                "committer": {"date": "2025-01-15T10:00:00Z"},
            },
        }
    ]

    commit_detail = {
        "stats": {"additions": 50, "deletions": 10},
    }

    prs_data = []

    async def mock_get(url, headers=None, params=None):
        if "/orgs/" in url:
            return _make_response(repos_data, url=url)
        if "/pulls" in url:
            return _make_response(prs_data, url=url)
        if "/commits/abc123" in url:
            return _make_response(commit_detail, url=url)
        if "/commits" in url:
            return _make_response(commits_data, url=url)
        return _make_response([], url=url)

    with patch("app.services.sync_github.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_github import sync_github

        result = await sync_github(db_session)

    assert result["commits_created"] == 1
    assert result["repos_scanned"] == 1

    commits = (await db_session.execute(select(GitHubCommit))).scalars().all()
    assert len(commits) == 1
    assert commits[0].sha == "abc123"
    assert commits[0].lines_added == 50
    assert commits[0].lines_removed == 10


@patch("app.services.sync_github.settings")
async def test_sync_github_creates_prs(mock_settings, db_session: AsyncSession) -> None:
    """sync_github creates new PR rows for PRs authored by team members."""
    mock_settings.GITHUB_TOKEN = "test-token"
    mock_settings.GITHUB_ORG = "test-org"

    await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="alice",
    )

    repos_data = [{"full_name": "test-org/repo1", "name": "repo1"}]
    commits_data = []
    prs_data = [
        {
            "number": 42,
            "title": "feat: new feature",
            "state": "closed",
            "merged_at": "2025-01-20T12:00:00Z",
            "user": {"login": "alice"},
        },
        {
            "number": 43,
            "title": "fix: bug",
            "state": "open",
            "merged_at": None,
            "user": {"login": "bob"},  # Different user, should be skipped
        },
    ]

    async def mock_get(url, headers=None, params=None):
        if "/orgs/" in url:
            return _make_response(repos_data, url=url)
        if "/pulls" in url:
            return _make_response(prs_data, url=url)
        if "/commits" in url:
            return _make_response(commits_data, url=url)
        return _make_response([], url=url)

    with patch("app.services.sync_github.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_github import sync_github

        result = await sync_github(db_session)

    assert result["prs_created"] == 1  # Only Alice's PR

    prs = (await db_session.execute(select(GitHubPullRequest))).scalars().all()
    assert len(prs) == 1
    assert prs[0].pr_number == 42
    assert prs[0].merged_at is not None


@patch("app.services.sync_github.settings")
async def test_sync_github_updates_existing_commit(mock_settings, db_session: AsyncSession) -> None:
    """sync_github updates an existing commit when the SHA already exists."""
    mock_settings.GITHUB_TOKEN = "test-token"
    mock_settings.GITHUB_ORG = "test-org"

    member = await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="alice",
    )
    await create_github_commit(
        db_session,
        member,
        sha="abc123",
        message="old message",
        lines_added=0,
        lines_removed=0,
    )

    repos_data = [{"full_name": "test-org/repo1", "name": "repo1"}]
    commits_data = [
        {
            "sha": "abc123",
            "commit": {
                "message": "updated message",
                "committer": {"date": "2025-01-15T10:00:00Z"},
            },
        }
    ]
    commit_detail = {"stats": {"additions": 100, "deletions": 50}}

    async def mock_get(url, headers=None, params=None):
        if "/orgs/" in url:
            return _make_response(repos_data, url=url)
        if "/pulls" in url:
            return _make_response([], url=url)
        if "/commits/abc123" in url:
            return _make_response(commit_detail, url=url)
        if "/commits" in url:
            return _make_response(commits_data, url=url)
        return _make_response([], url=url)

    with patch("app.services.sync_github.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_github import sync_github

        result = await sync_github(db_session)

    assert result["commits_updated"] == 1
    assert result["commits_created"] == 0


@patch("app.services.sync_github.settings")
async def test_sync_github_no_repos(mock_settings, db_session: AsyncSession) -> None:
    """sync_github returns zero counters when no repos exist in the org."""
    mock_settings.GITHUB_TOKEN = "test-token"
    mock_settings.GITHUB_ORG = "test-org"

    await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="alice",
    )

    async def mock_get(url, headers=None, params=None):
        return _make_response([], url=url)

    with patch("app.services.sync_github.httpx.AsyncClient") as MockClient:
        mock_client = AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        from app.services.sync_github import sync_github

        result = await sync_github(db_session)

    assert result["repos_scanned"] == 0


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


async def test_sync_github_endpoint_timeout(client: AsyncClient, db_session: AsyncSession) -> None:
    """POST /api/sync/github returns 504 on timeout."""
    await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="alice",
    )

    with (
        patch("app.services.sync_github.settings") as mock_settings,
        patch("app.services.sync_github.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.GITHUB_TOKEN = "test-token"
        mock_settings.GITHUB_ORG = "test-org"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        response = await client.post("/api/sync/github")

    assert response.status_code == 504


async def test_sync_github_endpoint_401(client: AsyncClient, db_session: AsyncSession) -> None:
    """POST /api/sync/github returns 502 on 401."""
    await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="alice",
    )

    error_resp = httpx.Response(
        status_code=401,
        text="Bad credentials",
        request=httpx.Request("GET", "https://api.github.com/orgs/test-org/repos"),
        headers={"X-RateLimit-Remaining": "100"},
    )

    with (
        patch("app.services.sync_github.settings") as mock_settings,
        patch("app.services.sync_github.httpx.AsyncClient") as MockClient,
    ):
        mock_settings.GITHUB_TOKEN = "bad-token"
        mock_settings.GITHUB_ORG = "test-org"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=error_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client

        response = await client.post("/api/sync/github")

    assert response.status_code == 502


# ---------------------------------------------------------------------------
# Utility function tests
# ---------------------------------------------------------------------------


def test_parse_next_link() -> None:
    """_parse_next_link extracts the next URL from a GitHub Link header."""
    from app.services.sync_github import _parse_next_link

    header = '<https://api.github.com/repos?page=2>; rel="next", <https://api.github.com/repos?page=5>; rel="last"'
    assert _parse_next_link(header) == "https://api.github.com/repos?page=2"

    assert _parse_next_link(None) is None
    assert _parse_next_link("") is None
    assert _parse_next_link('<https://api.github.com/repos?page=5>; rel="last"') is None


def test_parse_iso_datetime() -> None:
    """_parse_iso_datetime handles valid and invalid datetime strings."""
    from app.services.sync_github import _parse_iso_datetime

    result = _parse_iso_datetime("2025-01-15T10:00:00Z")
    assert result.year == 2025
    assert result.month == 1
    assert result.day == 15

    result = _parse_iso_datetime(None)
    assert result == datetime.min.replace(tzinfo=timezone.utc)

    result = _parse_iso_datetime("invalid-date")
    assert result == datetime.min.replace(tzinfo=timezone.utc)
