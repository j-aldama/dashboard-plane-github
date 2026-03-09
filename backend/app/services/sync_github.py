"""Service to sync GitHub commits and pull requests for all team members.

Iterates over all repos in the configured GitHub org and, for each team
member that has a ``github_username``, fetches commits (with line stats)
and pull requests.  Data is upserted into the local database.

Rate-limiting is handled automatically by inspecting the
``X-RateLimit-Remaining`` / ``X-RateLimit-Reset`` response headers and
sleeping when the budget is low.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.github_commit import GitHubCommit
from app.models.github_pull_request import GitHubPullRequest
from app.models.github_repository import GitHubRepository
from app.models.team_member import TeamMember

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 30.0
_PER_PAGE = 100
_RATE_LIMIT_THRESHOLD = 10
_RATE_LIMIT_MAX_WAIT = 60

_GITHUB_API = "https://api.github.com"


def _github_headers() -> dict[str, str]:
    """Build common request headers for the GitHub API."""
    return {
        "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }


# ------------------------------------------------------------------
# Rate-limit helpers
# ------------------------------------------------------------------

async def _check_rate_limit(response: httpx.Response) -> None:
    """Sleep if the GitHub rate-limit budget is running low.

    Inspects ``X-RateLimit-Remaining`` and ``X-RateLimit-Reset`` headers.
    If remaining requests drop below the threshold, sleeps until the reset
    timestamp (capped at 60 s).
    """
    remaining_raw = response.headers.get("X-RateLimit-Remaining")
    if remaining_raw is None:
        return

    remaining = int(remaining_raw)
    if remaining < _RATE_LIMIT_THRESHOLD:
        reset_epoch = int(response.headers.get("X-RateLimit-Reset", 0))
        wait_seconds = max(reset_epoch - int(time.time()), 1)
        wait_seconds = min(wait_seconds, _RATE_LIMIT_MAX_WAIT)
        logger.warning(
            "GitHub rate limit low (%d remaining), waiting %ds",
            remaining,
            wait_seconds,
        )
        await asyncio.sleep(wait_seconds)


# ------------------------------------------------------------------
# Paginated fetch helpers
# ------------------------------------------------------------------

async def _fetch_paginated(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
    params: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Fetch all pages from a GitHub endpoint using Link-header pagination.

    Returns the aggregated list of JSON objects across all pages.
    Returns an empty list for 404 or 409 responses (private repo / empty repo).
    """
    results: list[dict[str, Any]] = []
    request_params = dict(params or {})
    request_params.setdefault("per_page", str(_PER_PAGE))

    current_url: str | None = url

    while current_url:
        response = await client.get(
            current_url,
            headers=headers,
            params=request_params if current_url == url else None,
        )

        await _check_rate_limit(response)

        # 404 = no access / not found, 409 = empty repo
        if response.status_code in (404, 409):
            return []

        response.raise_for_status()

        page_data = response.json()
        if isinstance(page_data, list):
            results.extend(page_data)
        else:
            # Some endpoints return an object; ignore non-list payloads
            break

        # Follow Link: <url>; rel="next" header
        current_url = _parse_next_link(response.headers.get("Link"))
        # After the first request params are baked into the Link URL
        request_params = {}

    return results


def _parse_next_link(link_header: str | None) -> str | None:
    """Extract the ``next`` URL from a GitHub ``Link`` response header."""
    if not link_header:
        return None
    for part in link_header.split(","):
        segment = part.strip()
        if 'rel="next"' in segment:
            url_start = segment.index("<") + 1
            url_end = segment.index(">")
            return segment[url_start:url_end]
    return None


# ------------------------------------------------------------------
# Org repos
# ------------------------------------------------------------------

async def _fetch_org_repos(
    client: httpx.AsyncClient,
    headers: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch all repositories for the configured GitHub org."""
    url = f"{_GITHUB_API}/orgs/{settings.GITHUB_ORG}/repos"
    repos = await _fetch_paginated(client, url, headers, {"type": "all"})
    logger.info("Fetched %d repo(s) from org '%s'", len(repos), settings.GITHUB_ORG)
    return repos


async def _ensure_repos_in_config(
    db: AsyncSession,
    repos: list[dict[str, Any]],
) -> None:
    """Ensure all fetched repos exist in the github_repositories config table.

    New repos are inserted with is_active=True. Existing repos keep their
    current is_active value untouched.
    """
    if not repos:
        return

    result = await db.execute(select(GitHubRepository.repo_name))
    existing_names = {row[0] for row in result.all()}

    new_count = 0
    for repo_data in repos:
        name = repo_data.get("name", "")
        if not name or name in existing_names:
            continue
        db.add(GitHubRepository(repo_name=name, is_active=True))
        existing_names.add(name)
        new_count += 1

    if new_count > 0:
        await db.flush()
        logger.info("Registered %d new repo(s) in github_repositories config", new_count)


# ------------------------------------------------------------------
# Incremental sync date helpers
# ------------------------------------------------------------------

async def _last_commit_date(
    db: AsyncSession,
    team_member_id: int,
    repo_name: str,
) -> str | None:
    """Return the ISO-8601 timestamp of the latest synced commit for a
    member + repo pair, or None if there are no prior commits."""
    result = await db.execute(
        select(func.max(GitHubCommit.committed_at)).where(
            GitHubCommit.team_member_id == team_member_id,
            GitHubCommit.repo_name == repo_name,
        )
    )
    latest: datetime | None = result.scalar_one_or_none()
    if latest is None:
        return None
    # Add 1 second to avoid re-fetching the latest commit
    return latest.isoformat()


# ------------------------------------------------------------------
# Commit sync
# ------------------------------------------------------------------

async def _sync_commits_for_member_repo(
    client: httpx.AsyncClient,
    db: AsyncSession,
    headers: dict[str, str],
    member: TeamMember,
    repo_full_name: str,
    repo_short_name: str,
    counters: dict[str, int],
) -> None:
    """Fetch and upsert commits authored by *member* in *repo*."""
    since = await _last_commit_date(db, member.id, repo_short_name)

    params: dict[str, str] = {"author": member.github_username or ""}
    if since:
        params["since"] = since

    commits_url = f"{_GITHUB_API}/repos/{repo_full_name}/commits"
    commits = await _fetch_paginated(client, commits_url, headers, params)

    if not commits:
        return

    for commit_data in commits:
        sha: str = commit_data.get("sha", "")
        if not sha:
            continue

        # Check if already exists
        existing_result = await db.execute(
            select(GitHubCommit).where(GitHubCommit.sha == sha)
        )
        existing = existing_result.scalar_one_or_none()

        # Fetch detailed commit for line stats
        detail_resp = await client.get(
            f"{_GITHUB_API}/repos/{repo_full_name}/commits/{sha}",
            headers=headers,
        )
        await _check_rate_limit(detail_resp)

        lines_added = 0
        lines_removed = 0
        if detail_resp.status_code == 200:
            detail = detail_resp.json()
            stats = detail.get("stats", {})
            lines_added = stats.get("additions", 0)
            lines_removed = stats.get("deletions", 0)

        commit_info = commit_data.get("commit", {})
        message = commit_info.get("message", "")
        committed_at_str = (
            commit_info.get("committer", {}).get("date")
            or commit_info.get("author", {}).get("date")
        )
        committed_at = _parse_iso_datetime(committed_at_str)

        if existing is not None:
            existing.team_member_id = member.id
            existing.message = message
            existing.lines_added = lines_added
            existing.lines_removed = lines_removed
            existing.committed_at = committed_at
            counters["commits_updated"] += 1
        else:
            new_commit = GitHubCommit(
                team_member_id=member.id,
                repo_name=repo_short_name,
                sha=sha,
                message=message,
                lines_added=lines_added,
                lines_removed=lines_removed,
                committed_at=committed_at,
            )
            db.add(new_commit)
            counters["commits_created"] += 1


# ------------------------------------------------------------------
# PR sync
# ------------------------------------------------------------------

async def _sync_prs_for_member_repo(
    client: httpx.AsyncClient,
    db: AsyncSession,
    headers: dict[str, str],
    member: TeamMember,
    repo_full_name: str,
    repo_short_name: str,
    counters: dict[str, int],
) -> None:
    """Fetch and upsert pull requests created by *member* in *repo*.

    The GitHub search for PRs by creator uses the ``/pulls`` endpoint
    which does not support a ``creator`` query parameter directly.
    We filter client-side by comparing the PR user login with the
    team member's GitHub username.
    """
    prs_url = f"{_GITHUB_API}/repos/{repo_full_name}/pulls"
    prs = await _fetch_paginated(
        client,
        prs_url,
        headers,
        {"state": "all", "sort": "updated", "direction": "desc"},
    )

    if not prs:
        return

    username_lower = (member.github_username or "").lower()

    for pr_data in prs:
        pr_user = pr_data.get("user", {})
        pr_login = (pr_user.get("login") or "").lower()
        if pr_login != username_lower:
            continue

        pr_number: int = pr_data.get("number", 0)
        if pr_number == 0:
            continue

        existing_result = await db.execute(
            select(GitHubPullRequest).where(
                GitHubPullRequest.repo_name == repo_short_name,
                GitHubPullRequest.pr_number == pr_number,
            )
        )
        existing = existing_result.scalar_one_or_none()

        title = pr_data.get("title", "")
        state = pr_data.get("state", "open")
        merged_at = _parse_iso_datetime(pr_data.get("merged_at"))

        if existing is not None:
            existing.team_member_id = member.id
            existing.title = title
            existing.state = state
            existing.merged_at = merged_at
            counters["prs_updated"] += 1
        else:
            new_pr = GitHubPullRequest(
                team_member_id=member.id,
                repo_name=repo_short_name,
                pr_number=pr_number,
                title=title,
                state=state,
                merged_at=merged_at,
            )
            db.add(new_pr)
            counters["prs_created"] += 1


# ------------------------------------------------------------------
# Datetime parsing
# ------------------------------------------------------------------

def _parse_iso_datetime(value: str | None) -> datetime:
    """Parse an ISO-8601 datetime string.

    Returns ``datetime.min`` (UTC) when the value is None or
    unparseable, so the column is never NULL.
    """
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        # GitHub uses 'YYYY-MM-DDTHH:MM:SSZ' or with timezone offset
        cleaned = value.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)
    except (ValueError, TypeError):
        logger.warning("Could not parse datetime value: %r", value)
        return datetime.min.replace(tzinfo=timezone.utc)


# ------------------------------------------------------------------
# Main entry point
# ------------------------------------------------------------------

async def sync_github(db: AsyncSession) -> dict[str, int]:
    """Sync GitHub commits and pull requests for all team members.

    Steps:
    1. Load team members with a ``github_username`` from the database.
    2. Fetch all repos in the configured GitHub org.
    3. For each repo / member combination, fetch commits (with line
       stats) and pull requests, upserting into the local DB.

    Returns a summary dict::

        {
            "commits_created": int,
            "commits_updated": int,
            "prs_created": int,
            "prs_updated": int,
            "repos_scanned": int,
        }
    """
    headers = _github_headers()
    counters: dict[str, int] = {
        "commits_created": 0,
        "commits_updated": 0,
        "prs_created": 0,
        "prs_updated": 0,
        "repos_scanned": 0,
    }

    # 1. Get team members with GitHub usernames
    result = await db.execute(
        select(TeamMember).where(TeamMember.github_username.isnot(None))
    )
    members = list(result.scalars().all())

    if not members:
        logger.info("No team members with github_username — nothing to sync")
        return counters

    logger.info(
        "Syncing GitHub data for %d team member(s): %s",
        len(members),
        ", ".join(m.github_username or "" for m in members),
    )

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        # 2. Get all repos from org
        repos = await _fetch_org_repos(client, headers)

        if not repos:
            logger.info("No repos found in org '%s'", settings.GITHUB_ORG)
            return counters

        # 2b. Register repos in config table (new repos default to active)
        await _ensure_repos_in_config(db, repos)

        # 3. Iterate repos x members
        for repo_data in repos:
            repo_full_name: str = repo_data.get("full_name", "")
            repo_short_name: str = repo_data.get("name", "")

            if not repo_full_name:
                continue

            counters["repos_scanned"] += 1
            logger.info("Scanning repo: %s", repo_full_name)

            for member in members:
                if not member.github_username:
                    continue

                try:
                    await _sync_commits_for_member_repo(
                        client,
                        db,
                        headers,
                        member,
                        repo_full_name,
                        repo_short_name,
                        counters,
                    )
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code in (404, 403):
                        logger.debug(
                            "Skipping commits for %s in %s (HTTP %d)",
                            member.github_username,
                            repo_short_name,
                            exc.response.status_code,
                        )
                    else:
                        logger.error(
                            "Error fetching commits for %s in %s: HTTP %d",
                            member.github_username,
                            repo_short_name,
                            exc.response.status_code,
                        )
                except httpx.TimeoutException:
                    logger.warning(
                        "Timeout fetching commits for %s in %s — skipping",
                        member.github_username,
                        repo_short_name,
                    )

                try:
                    await _sync_prs_for_member_repo(
                        client,
                        db,
                        headers,
                        member,
                        repo_full_name,
                        repo_short_name,
                        counters,
                    )
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code in (404, 403):
                        logger.debug(
                            "Skipping PRs for %s in %s (HTTP %d)",
                            member.github_username,
                            repo_short_name,
                            exc.response.status_code,
                        )
                    else:
                        logger.error(
                            "Error fetching PRs for %s in %s: HTTP %d",
                            member.github_username,
                            repo_short_name,
                            exc.response.status_code,
                        )
                except httpx.TimeoutException:
                    logger.warning(
                        "Timeout fetching PRs for %s in %s — skipping",
                        member.github_username,
                        repo_short_name,
                    )

        await db.commit()

    logger.info("GitHub sync complete: %s", counters)
    return counters
