"""GitHub API integration service.

Fetches pull requests, commits, and code-line metrics per team member from
the GitHub REST API v3.  Implements Redis caching with PostgreSQL snapshot
fallback, identical to the pattern established by PlaneService.
"""

import logging
from datetime import date, datetime, timezone

import httpx
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.github_snapshot import GithubMetricsSnapshot
from app.models.team_member import TeamMember
from app.redis_client import cache_get, cache_set
from app.schemas.github import (
    GitHubMemberMetrics,
    MemberDetailResponse,
    Rankings,
    RankingEntry,
    RateLimitResponse,
    TeamGitHubMetricsResponse,
)

logger = logging.getLogger(__name__)

# Cache keys
CACHE_KEY_TEAM_METRICS = "github:team_metrics:{period_start}:{period_end}"
CACHE_KEY_MEMBER_DETAIL = "github:member:{username}:{period_start}:{period_end}"
CACHE_KEY_RATE_LIMIT = "github:rate_limit"

# GitHub API constants
_GITHUB_API_BASE = "https://api.github.com"
_PER_PAGE = 100
_REQUEST_TIMEOUT = 30.0
_CACHE_TTL = 600  # 10 minutes


class GitHubAPIError(Exception):
    """Raised when the GitHub API returns an unexpected response."""


class GitHubService:
    """Handles all interaction with the GitHub REST API v3."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._org = settings.github_org
        self._headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if settings.github_token:
            self._headers["Authorization"] = f"Bearer {settings.github_token}"

        # Optional repo filter: if GITHUB_REPOS is set, only query those repos
        self._repo_filter: list[str] = []
        if settings.github_repos:
            self._repo_filter = [
                r.strip() for r in settings.github_repos.split(",") if r.strip()
            ]

    # ------------------------------------------------------------------
    # Low-level HTTP helpers
    # ------------------------------------------------------------------

    async def _get_paginated(self, url: str, params: dict | None = None) -> list[dict]:
        """Perform paginated GET requests using GitHub's Link header pagination.

        Automatically follows ``rel="next"`` links until all pages are consumed.
        """
        all_results: list[dict] = []
        request_params = dict(params or {})
        request_params.setdefault("per_page", _PER_PAGE)

        async with httpx.AsyncClient(
            headers=self._headers, timeout=_REQUEST_TIMEOUT
        ) as client:
            next_url: str | None = url
            while next_url is not None:
                response = await client.get(next_url, params=request_params)

                if response.status_code == 403:
                    # Likely rate-limited
                    raise GitHubAPIError(
                        f"GitHub API returned 403 — possible rate limit exceeded"
                    )
                if response.status_code == 404:
                    logger.warning("GitHub 404 for %s — skipping", next_url)
                    return all_results
                if response.status_code != 200:
                    raise GitHubAPIError(
                        f"GitHub API returned {response.status_code} for {next_url}"
                    )

                data = response.json()
                if isinstance(data, list):
                    all_results.extend(data)
                elif isinstance(data, dict) and "items" in data:
                    # Search API wraps results in {"items": [...]}
                    all_results.extend(data["items"])
                else:
                    all_results.append(data)

                # Parse Link header for next page
                next_url = self._parse_next_link(response.headers.get("link", ""))
                # After the first request, params are embedded in next_url
                request_params = {}

        return all_results

    async def _get_single(self, url: str) -> dict:
        """Perform a single (non-paginated) GET request."""
        async with httpx.AsyncClient(
            headers=self._headers, timeout=_REQUEST_TIMEOUT
        ) as client:
            response = await client.get(url)
            if response.status_code != 200:
                raise GitHubAPIError(
                    f"GitHub API returned {response.status_code} for {url}"
                )
            return response.json()

    @staticmethod
    def _parse_next_link(link_header: str) -> str | None:
        """Extract the URL for ``rel="next"`` from the GitHub Link header."""
        if not link_header:
            return None
        for part in link_header.split(","):
            part = part.strip()
            if 'rel="next"' in part:
                # Format: <https://api.github.com/...?page=2>; rel="next"
                url_part = part.split(";")[0].strip()
                if url_part.startswith("<") and url_part.endswith(">"):
                    return url_part[1:-1]
        return None

    # ------------------------------------------------------------------
    # Org repo listing
    # ------------------------------------------------------------------

    async def _get_org_repos(self) -> list[str]:
        """Return the list of repository full names (org/repo) to query.

        If ``GITHUB_REPOS`` is configured, use that filter.  Otherwise fetch
        all non-archived repositories in the organisation.
        """
        if self._repo_filter:
            return [
                f"{self._org}/{r}" if "/" not in r else r
                for r in self._repo_filter
            ]

        url = f"{_GITHUB_API_BASE}/orgs/{self._org}/repos"
        repos_raw = await self._get_paginated(url, {"type": "all"})
        return [
            r["full_name"]
            for r in repos_raw
            if not r.get("archived", False)
        ]

    # ------------------------------------------------------------------
    # Team member mapping
    # ------------------------------------------------------------------

    async def _get_github_team_map(self) -> dict[str, TeamMember]:
        """Return a map of github_username -> TeamMember from the database."""
        stmt = select(TeamMember).where(TeamMember.github_username.isnot(None))
        result = await self._db.execute(stmt)
        members = result.scalars().all()
        return {m.github_username.lower(): m for m in members if m.github_username}

    # ------------------------------------------------------------------
    # Public API — team metrics
    # ------------------------------------------------------------------

    async def get_team_metrics(
        self, period_start: date | None = None, period_end: date | None = None
    ) -> TeamGitHubMetricsResponse:
        """Fetch aggregated per-member GitHub metrics.

        Strategy:
        1. Check Redis cache.
        2. On miss, fetch from GitHub API, compute metrics, cache, snapshot.
        3. On API error, fall back to the latest PostgreSQL snapshot.
        """
        start_str = period_start.isoformat() if period_start else "none"
        end_str = period_end.isoformat() if period_end else "none"
        cache_key = CACHE_KEY_TEAM_METRICS.format(
            period_start=start_str, period_end=end_str
        )

        cached = await cache_get(cache_key)
        if cached is not None:
            return TeamGitHubMetricsResponse(**cached, is_cached=True)

        try:
            return await self._fetch_team_metrics_from_api(
                period_start, period_end, cache_key
            )
        except Exception as exc:
            logger.warning("GitHub API error fetching team metrics: %s", exc)
            return await self._team_metrics_from_snapshot(period_start, period_end)

    # ------------------------------------------------------------------
    # Public API — member detail
    # ------------------------------------------------------------------

    async def get_member_detail(
        self, username: str, period_start: date | None = None, period_end: date | None = None
    ) -> MemberDetailResponse:
        """Fetch detailed metrics + history for a single GitHub user."""
        start_str = period_start.isoformat() if period_start else "none"
        end_str = period_end.isoformat() if period_end else "none"
        cache_key = CACHE_KEY_MEMBER_DETAIL.format(
            username=username, period_start=start_str, period_end=end_str
        )

        cached = await cache_get(cache_key)
        if cached is not None:
            return MemberDetailResponse(**cached, is_cached=True)

        try:
            return await self._fetch_member_detail_from_api(
                username, period_start, period_end, cache_key
            )
        except Exception as exc:
            logger.warning(
                "GitHub API error fetching member detail for %s: %s", username, exc
            )
            return await self._member_detail_from_snapshot(username)

    # ------------------------------------------------------------------
    # Public API — rate limit
    # ------------------------------------------------------------------

    async def get_rate_limit(self) -> RateLimitResponse:
        """Return the current GitHub API rate-limit status."""
        cached = await cache_get(CACHE_KEY_RATE_LIMIT)
        if cached is not None:
            return RateLimitResponse(**cached)

        try:
            data = await self._get_single(f"{_GITHUB_API_BASE}/rate_limit")
            core = data.get("rate", data.get("resources", {}).get("core", {}))
            reset_ts = core.get("reset")
            reset_at = (
                datetime.fromtimestamp(reset_ts, tz=timezone.utc)
                if reset_ts
                else None
            )
            result = RateLimitResponse(
                limit=core.get("limit", 0),
                remaining=core.get("remaining", 0),
                used=core.get("used", 0),
                reset_at=reset_at,
            )
            # Cache for 60 seconds — lightweight, but avoids hammering the endpoint
            await cache_set(
                CACHE_KEY_RATE_LIMIT,
                result.model_dump(mode="json"),
                60,
            )
            return result
        except Exception as exc:
            logger.warning("GitHub rate-limit fetch failed: %s", exc)
            return RateLimitResponse()

    # ------------------------------------------------------------------
    # API fetch helpers
    # ------------------------------------------------------------------

    async def _fetch_team_metrics_from_api(
        self,
        period_start: date | None,
        period_end: date | None,
        cache_key: str,
    ) -> TeamGitHubMetricsResponse:
        """Fetch PRs, commits, and line stats from the GitHub API."""
        repos = await self._get_org_repos()
        team_map = await self._get_github_team_map()

        # Accumulators keyed by lowercase GitHub username
        member_data: dict[str, dict] = {}

        for repo_full_name in repos:
            await self._collect_pr_metrics(
                repo_full_name, member_data, period_start, period_end
            )
            await self._collect_commit_metrics(
                repo_full_name, member_data, period_start, period_end
            )

        # Build schema objects and attach team mapping
        members_out: list[GitHubMemberMetrics] = []
        for username_lower, data in member_data.items():
            tm = team_map.get(username_lower)
            members_out.append(
                GitHubMemberMetrics(
                    username=data["username"],
                    name=data.get("name"),
                    avatar_url=data.get("avatar_url"),
                    prs_open=data.get("prs_open", 0),
                    prs_merged=data.get("prs_merged", 0),
                    prs_rejected=data.get("prs_rejected", 0),
                    commits_total=data.get("commits_total", 0),
                    lines_added=data.get("lines_added", 0),
                    lines_removed=data.get("lines_removed", 0),
                    lines_net=data.get("lines_added", 0) - data.get("lines_removed", 0),
                    team_member_id=tm.id if tm else None,
                    plane_member_id=tm.plane_member_id if tm else None,
                )
            )

        rankings = self._compute_rankings(members_out)
        now = _utcnow()

        result = TeamGitHubMetricsResponse(
            members=members_out,
            rankings=rankings,
            period_start=period_start.isoformat() if period_start else None,
            period_end=period_end.isoformat() if period_end else None,
            last_updated=now,
            is_cached=False,
        )

        # Cache with 10 min TTL
        await cache_set(cache_key, result.model_dump(mode="json"), _CACHE_TTL)

        # Persist snapshot to PostgreSQL
        await self._save_team_metrics_snapshot(
            members_out, period_start, period_end
        )

        return result

    async def _fetch_member_detail_from_api(
        self,
        username: str,
        period_start: date | None,
        period_end: date | None,
        cache_key: str,
    ) -> MemberDetailResponse:
        """Fetch detailed metrics for a single member from the API."""
        # Re-use team metrics and filter
        team_response = await self.get_team_metrics(period_start, period_end)
        member: GitHubMemberMetrics | None = None
        for m in team_response.members:
            if m.username.lower() == username.lower():
                member = m
                break

        # Load snapshot history
        history = await self._load_member_history(username)

        now = _utcnow()
        result = MemberDetailResponse(
            username=username,
            name=member.name if member else None,
            avatar_url=member.avatar_url if member else None,
            prs_open=member.prs_open if member else 0,
            prs_merged=member.prs_merged if member else 0,
            prs_rejected=member.prs_rejected if member else 0,
            commits_total=member.commits_total if member else 0,
            lines_added=member.lines_added if member else 0,
            lines_removed=member.lines_removed if member else 0,
            lines_net=member.lines_net if member else 0,
            history=history,
            team_member_id=member.team_member_id if member else None,
            plane_member_id=member.plane_member_id if member else None,
            last_updated=now,
            is_cached=False,
        )

        await cache_set(cache_key, result.model_dump(mode="json"), _CACHE_TTL)
        return result

    # ------------------------------------------------------------------
    # PR metrics collection
    # ------------------------------------------------------------------

    async def _collect_pr_metrics(
        self,
        repo_full_name: str,
        member_data: dict[str, dict],
        period_start: date | None,
        period_end: date | None,
    ) -> None:
        """Fetch all pull requests for a repo and aggregate by author."""
        url = f"{_GITHUB_API_BASE}/repos/{repo_full_name}/pulls"
        params: dict = {"state": "all", "sort": "updated", "direction": "desc"}

        prs = await self._get_paginated(url, params)

        for pr in prs:
            created_at = _parse_iso_date(pr.get("created_at"))
            if created_at is None:
                continue

            # Apply date filters
            if period_start and created_at < period_start:
                continue
            if period_end and created_at > period_end:
                continue

            user = pr.get("user") or {}
            login = user.get("login", "")
            if not login:
                continue

            entry = self._ensure_member_entry(member_data, login, user)

            state = pr.get("state", "")
            merged_at = pr.get("merged_at")

            if merged_at:
                entry["prs_merged"] += 1
                # Fetch line stats from the PR detail (additions/deletions)
                await self._collect_pr_lines(
                    repo_full_name, pr.get("number"), entry
                )
            elif state == "closed":
                # Closed but not merged = rejected
                entry["prs_rejected"] += 1
            elif state == "open":
                entry["prs_open"] += 1

    async def _collect_pr_lines(
        self, repo_full_name: str, pr_number: int | None, entry: dict
    ) -> None:
        """Fetch additions/deletions from the PR detail endpoint."""
        if pr_number is None:
            return
        try:
            url = f"{_GITHUB_API_BASE}/repos/{repo_full_name}/pulls/{pr_number}"
            data = await self._get_single(url)
            entry["lines_added"] += data.get("additions", 0)
            entry["lines_removed"] += data.get("deletions", 0)
        except Exception as exc:
            logger.debug(
                "Could not fetch PR #%s line stats for %s: %s",
                pr_number,
                repo_full_name,
                exc,
            )

    # ------------------------------------------------------------------
    # Commit metrics collection
    # ------------------------------------------------------------------

    async def _collect_commit_metrics(
        self,
        repo_full_name: str,
        member_data: dict[str, dict],
        period_start: date | None,
        period_end: date | None,
    ) -> None:
        """Fetch commits for a repo and count per author."""
        url = f"{_GITHUB_API_BASE}/repos/{repo_full_name}/commits"
        params: dict = {}
        if period_start:
            params["since"] = datetime.combine(
                period_start, datetime.min.time(), tzinfo=timezone.utc
            ).isoformat()
        if period_end:
            params["until"] = datetime.combine(
                period_end, datetime.max.time(), tzinfo=timezone.utc
            ).isoformat()

        commits = await self._get_paginated(url, params)

        for commit in commits:
            author = commit.get("author") or {}
            login = author.get("login", "")
            if not login:
                continue

            entry = self._ensure_member_entry(member_data, login, author)
            entry["commits_total"] += 1

    # ------------------------------------------------------------------
    # Rankings
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_rankings(members: list[GitHubMemberMetrics]) -> Rankings:
        """Build sorted rankings for PRs merged, commits, and net lines."""
        if not members:
            return Rankings()

        by_prs = sorted(members, key=lambda m: m.prs_merged, reverse=True)
        by_commits = sorted(members, key=lambda m: m.commits_total, reverse=True)
        by_lines = sorted(members, key=lambda m: m.lines_net, reverse=True)

        return Rankings(
            by_prs_merged=[
                RankingEntry(username=m.username, value=m.prs_merged) for m in by_prs
            ],
            by_commits=[
                RankingEntry(username=m.username, value=m.commits_total) for m in by_commits
            ],
            by_lines_net=[
                RankingEntry(username=m.username, value=m.lines_net) for m in by_lines
            ],
        )

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def _ensure_member_entry(
        member_data: dict[str, dict], login: str, user_obj: dict
    ) -> dict:
        """Get or create a metrics accumulator for a GitHub user."""
        key = login.lower()
        if key not in member_data:
            member_data[key] = {
                "username": login,
                "name": user_obj.get("name") or login,
                "avatar_url": user_obj.get("avatar_url"),
                "prs_open": 0,
                "prs_merged": 0,
                "prs_rejected": 0,
                "commits_total": 0,
                "lines_added": 0,
                "lines_removed": 0,
            }
        return member_data[key]

    # ------------------------------------------------------------------
    # PostgreSQL snapshot persistence
    # ------------------------------------------------------------------

    async def _save_team_metrics_snapshot(
        self,
        members: list[GitHubMemberMetrics],
        period_start: date | None,
        period_end: date | None,
    ) -> None:
        """Save metric snapshots to PostgreSQL, upserting TeamMember rows."""
        try:
            today = date.today()
            for m in members:
                # Find or create TeamMember via github_username
                stmt = select(TeamMember).where(
                    TeamMember.github_username == m.username
                )
                result = await self._db.execute(stmt)
                tm = result.scalar_one_or_none()

                if tm is None:
                    tm = TeamMember(
                        name=m.name or m.username,
                        github_username=m.username,
                        avatar_url=m.avatar_url,
                    )
                    self._db.add(tm)
                    await self._db.flush()
                else:
                    if m.avatar_url:
                        tm.avatar_url = m.avatar_url

                snapshot = GithubMetricsSnapshot(
                    team_member_id=tm.id,
                    prs_opened=m.prs_open,
                    prs_merged=m.prs_merged,
                    prs_rejected=m.prs_rejected,
                    commits_count=m.commits_total,
                    lines_added=m.lines_added,
                    lines_deleted=m.lines_removed,
                    period_start=period_start,
                    period_end=period_end,
                    snapshot_date=today,
                )
                self._db.add(snapshot)

            await self._db.commit()
        except Exception as exc:
            logger.warning("Failed to save GitHub metrics snapshot: %s", exc)
            await self._db.rollback()

    # ------------------------------------------------------------------
    # PostgreSQL fallback readers
    # ------------------------------------------------------------------

    async def _team_metrics_from_snapshot(
        self, period_start: date | None, period_end: date | None
    ) -> TeamGitHubMetricsResponse:
        """Load latest team metrics from PostgreSQL snapshots."""
        stmt = (
            select(GithubMetricsSnapshot)
            .order_by(desc(GithubMetricsSnapshot.snapshot_date))
            .limit(200)
        )
        result = await self._db.execute(stmt)
        rows = result.scalars().all()

        if not rows:
            return TeamGitHubMetricsResponse(
                members=[],
                rankings=Rankings(),
                last_updated=_utcnow(),
                is_cached=False,
            )

        # Keep latest snapshot per team_member_id
        latest: dict[int, GithubMetricsSnapshot] = {}
        for row in rows:
            if row.team_member_id not in latest:
                latest[row.team_member_id] = row

        # Resolve member names
        tm_ids = list(latest.keys())
        tm_stmt = select(TeamMember).where(TeamMember.id.in_(tm_ids))
        tm_result = await self._db.execute(tm_stmt)
        tm_map = {tm.id: tm for tm in tm_result.scalars().all()}

        members_out: list[GitHubMemberMetrics] = []
        for tm_id, snap in latest.items():
            tm = tm_map.get(tm_id)
            lines_added = snap.lines_added or 0
            lines_removed = snap.lines_deleted or 0
            members_out.append(
                GitHubMemberMetrics(
                    username=tm.github_username if tm and tm.github_username else str(tm_id),
                    name=tm.name if tm else None,
                    avatar_url=tm.avatar_url if tm else None,
                    prs_open=snap.prs_opened or 0,
                    prs_merged=snap.prs_merged or 0,
                    prs_rejected=snap.prs_rejected or 0,
                    commits_total=snap.commits_count or 0,
                    lines_added=lines_added,
                    lines_removed=lines_removed,
                    lines_net=lines_added - lines_removed,
                    team_member_id=tm.id if tm else None,
                    plane_member_id=tm.plane_member_id if tm else None,
                )
            )

        rankings = self._compute_rankings(members_out)
        last_date = max(r.snapshot_date for r in rows)

        return TeamGitHubMetricsResponse(
            members=members_out,
            rankings=rankings,
            period_start=period_start.isoformat() if period_start else None,
            period_end=period_end.isoformat() if period_end else None,
            last_updated=datetime.combine(
                last_date, datetime.min.time(), tzinfo=timezone.utc
            ),
            is_cached=False,
        )

    async def _member_detail_from_snapshot(
        self, username: str
    ) -> MemberDetailResponse:
        """Load member detail from the latest snapshot as a fallback."""
        tm_stmt = select(TeamMember).where(TeamMember.github_username == username)
        tm_result = await self._db.execute(tm_stmt)
        tm = tm_result.scalar_one_or_none()

        if tm is None:
            return MemberDetailResponse(
                username=username,
                last_updated=_utcnow(),
                is_cached=False,
            )

        snap_stmt = (
            select(GithubMetricsSnapshot)
            .where(GithubMetricsSnapshot.team_member_id == tm.id)
            .order_by(desc(GithubMetricsSnapshot.snapshot_date))
            .limit(1)
        )
        snap_result = await self._db.execute(snap_stmt)
        snap = snap_result.scalar_one_or_none()

        history = await self._load_member_history(username)

        if snap is None:
            return MemberDetailResponse(
                username=username,
                name=tm.name,
                avatar_url=tm.avatar_url,
                team_member_id=tm.id,
                plane_member_id=tm.plane_member_id,
                history=history,
                last_updated=_utcnow(),
                is_cached=False,
            )

        lines_added = snap.lines_added or 0
        lines_removed = snap.lines_deleted or 0

        return MemberDetailResponse(
            username=username,
            name=tm.name,
            avatar_url=tm.avatar_url,
            prs_open=snap.prs_opened or 0,
            prs_merged=snap.prs_merged or 0,
            prs_rejected=snap.prs_rejected or 0,
            commits_total=snap.commits_count or 0,
            lines_added=lines_added,
            lines_removed=lines_removed,
            lines_net=lines_added - lines_removed,
            history=history,
            team_member_id=tm.id,
            plane_member_id=tm.plane_member_id,
            last_updated=datetime.combine(
                snap.snapshot_date, datetime.min.time(), tzinfo=timezone.utc
            ),
            is_cached=False,
        )

    async def _load_member_history(self, username: str) -> list[dict]:
        """Load snapshot history for a member, most recent first."""
        tm_stmt = select(TeamMember).where(TeamMember.github_username == username)
        tm_result = await self._db.execute(tm_stmt)
        tm = tm_result.scalar_one_or_none()
        if tm is None:
            return []

        stmt = (
            select(GithubMetricsSnapshot)
            .where(GithubMetricsSnapshot.team_member_id == tm.id)
            .order_by(desc(GithubMetricsSnapshot.snapshot_date))
            .limit(30)
        )
        result = await self._db.execute(stmt)
        rows = result.scalars().all()

        return [
            {
                "snapshot_date": row.snapshot_date.isoformat(),
                "prs_opened": row.prs_opened or 0,
                "prs_merged": row.prs_merged or 0,
                "prs_rejected": row.prs_rejected or 0,
                "commits_count": row.commits_count or 0,
                "lines_added": row.lines_added or 0,
                "lines_removed": row.lines_deleted or 0,
                "lines_net": (row.lines_added or 0) - (row.lines_deleted or 0),
                "period_start": row.period_start.isoformat() if row.period_start else None,
                "period_end": row.period_end.isoformat() if row.period_end else None,
            }
            for row in rows
        ]


# ----------------------------------------------------------------------
# Module-level utility functions
# ----------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_date(value: str | None) -> date | None:
    """Parse an ISO-8601 datetime string to a date object."""
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except (ValueError, TypeError):
        return None
