from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github_commit import GitHubCommit
from app.models.github_pull_request import GitHubPullRequest
from app.models.team_member import TeamMember

logger = logging.getLogger(__name__)


def _to_utc_datetime(d: date | datetime | None) -> datetime | None:
    """Convert a date or datetime to a UTC-aware datetime, or return None."""
    if d is None:
        return None
    if isinstance(d, datetime):
        if d.tzinfo is None:
            return d.replace(tzinfo=timezone.utc)
        return d
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


async def get_github_overview(
    db: AsyncSession,
    user_id: int | None = None,
    repo_name: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """Return aggregate GitHub metrics across the filtered scope."""
    dt_from = _to_utc_datetime(date_from)
    dt_to = _to_utc_datetime(date_to)
    # Make date_to inclusive (end of day)
    if dt_to is not None:
        dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)

    # --- Commits aggregate ---
    commit_query = select(
        func.count(GitHubCommit.id).label("total_commits"),
        func.coalesce(func.sum(GitHubCommit.lines_added), 0).label("total_lines_added"),
        func.coalesce(func.sum(GitHubCommit.lines_removed), 0).label("total_lines_removed"),
    )
    if user_id is not None:
        commit_query = commit_query.where(GitHubCommit.team_member_id == user_id)
    if repo_name is not None:
        commit_query = commit_query.where(GitHubCommit.repo_name == repo_name)
    if dt_from is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at >= dt_from)
    if dt_to is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at <= dt_to)

    commit_result = await db.execute(commit_query)
    commit_row = commit_result.one()

    # --- PRs aggregate ---
    pr_query = select(
        func.count(GitHubPullRequest.id).label("total_prs"),
        func.count(
            case((GitHubPullRequest.merged_at.isnot(None), 1))
        ).label("total_prs_merged"),
    )
    if user_id is not None:
        pr_query = pr_query.where(GitHubPullRequest.team_member_id == user_id)
    if repo_name is not None:
        pr_query = pr_query.where(GitHubPullRequest.repo_name == repo_name)
    if dt_from is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at >= dt_from)
    if dt_to is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at <= dt_to)

    pr_result = await db.execute(pr_query)
    pr_row = pr_result.one()

    return {
        "total_commits": commit_row.total_commits or 0,
        "total_prs": pr_row.total_prs or 0,
        "total_prs_merged": pr_row.total_prs_merged or 0,
        "total_lines_added": int(commit_row.total_lines_added or 0),
        "total_lines_removed": int(commit_row.total_lines_removed or 0),
    }


async def get_github_by_user(
    db: AsyncSession,
    repo_name: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Return per-user GitHub metrics, joining with TeamMember for names."""
    dt_from = _to_utc_datetime(date_from)
    dt_to = _to_utc_datetime(date_to)
    if dt_to is not None:
        dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Commits per user
    commit_query = (
        select(
            GitHubCommit.team_member_id,
            func.count(GitHubCommit.id).label("commits"),
            func.coalesce(func.sum(GitHubCommit.lines_added), 0).label("lines_added"),
            func.coalesce(func.sum(GitHubCommit.lines_removed), 0).label("lines_removed"),
        )
        .group_by(GitHubCommit.team_member_id)
    )
    if repo_name is not None:
        commit_query = commit_query.where(GitHubCommit.repo_name == repo_name)
    if dt_from is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at >= dt_from)
    if dt_to is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at <= dt_to)

    commit_result = await db.execute(commit_query)
    commit_rows = commit_result.all()
    commit_map = {
        row.team_member_id: {
            "commits": row.commits,
            "lines_added": int(row.lines_added),
            "lines_removed": int(row.lines_removed),
        }
        for row in commit_rows
    }

    # PRs per user
    pr_query = (
        select(
            GitHubPullRequest.team_member_id,
            func.count(GitHubPullRequest.id).label("prs"),
            func.count(
                case((GitHubPullRequest.merged_at.isnot(None), 1))
            ).label("prs_merged"),
        )
        .group_by(GitHubPullRequest.team_member_id)
    )
    if repo_name is not None:
        pr_query = pr_query.where(GitHubPullRequest.repo_name == repo_name)
    if dt_from is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at >= dt_from)
    if dt_to is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at <= dt_to)

    pr_result = await db.execute(pr_query)
    pr_rows = pr_result.all()
    pr_map = {
        row.team_member_id: {
            "prs": row.prs,
            "prs_merged": row.prs_merged,
        }
        for row in pr_rows
    }

    # Gather all user IDs that appear in either map
    all_user_ids = set(commit_map.keys()) | set(pr_map.keys())
    if not all_user_ids:
        return []

    # Fetch TeamMember details for the relevant IDs
    members_result = await db.execute(
        select(TeamMember).where(TeamMember.id.in_(all_user_ids))
    )
    members = {m.id: m for m in members_result.scalars().all()}

    output = []
    for uid in sorted(all_user_ids):
        member = members.get(uid)
        if member is None:
            logger.warning("metrics_github.get_github_by_user: no TeamMember for id=%d", uid)
            continue
        c = commit_map.get(uid, {"commits": 0, "lines_added": 0, "lines_removed": 0})
        p = pr_map.get(uid, {"prs": 0, "prs_merged": 0})
        output.append(
            {
                "user_id": uid,
                "name": member.name,
                "github_username": member.github_username,
                "commits": c["commits"],
                "prs": p["prs"],
                "prs_merged": p["prs_merged"],
                "lines_added": c["lines_added"],
                "lines_removed": c["lines_removed"],
            }
        )

    return output


async def get_github_by_repo(
    db: AsyncSession,
    user_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Return per-repo GitHub metrics."""
    dt_from = _to_utc_datetime(date_from)
    dt_to = _to_utc_datetime(date_to)
    if dt_to is not None:
        dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Commits per repo
    commit_query = (
        select(
            GitHubCommit.repo_name,
            func.count(GitHubCommit.id).label("commits"),
            func.coalesce(func.sum(GitHubCommit.lines_added), 0).label("lines_added"),
            func.coalesce(func.sum(GitHubCommit.lines_removed), 0).label("lines_removed"),
        )
        .group_by(GitHubCommit.repo_name)
    )
    if user_id is not None:
        commit_query = commit_query.where(GitHubCommit.team_member_id == user_id)
    if dt_from is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at >= dt_from)
    if dt_to is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at <= dt_to)

    commit_result = await db.execute(commit_query)
    commit_rows = commit_result.all()
    commit_map = {
        row.repo_name: {
            "commits": row.commits,
            "lines_added": int(row.lines_added),
            "lines_removed": int(row.lines_removed),
        }
        for row in commit_rows
    }

    # PRs per repo
    pr_query = (
        select(
            GitHubPullRequest.repo_name,
            func.count(GitHubPullRequest.id).label("prs"),
            func.count(
                case((GitHubPullRequest.merged_at.isnot(None), 1))
            ).label("prs_merged"),
        )
        .group_by(GitHubPullRequest.repo_name)
    )
    if user_id is not None:
        pr_query = pr_query.where(GitHubPullRequest.team_member_id == user_id)
    if dt_from is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at >= dt_from)
    if dt_to is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at <= dt_to)

    pr_result = await db.execute(pr_query)
    pr_rows = pr_result.all()
    pr_map = {
        row.repo_name: {
            "prs": row.prs,
            "prs_merged": row.prs_merged,
        }
        for row in pr_rows
    }

    all_repos = set(commit_map.keys()) | set(pr_map.keys())
    if not all_repos:
        return []

    output = []
    for repo in sorted(all_repos):
        c = commit_map.get(repo, {"commits": 0, "lines_added": 0, "lines_removed": 0})
        p = pr_map.get(repo, {"prs": 0, "prs_merged": 0})
        output.append(
            {
                "repo_name": repo,
                "commits": c["commits"],
                "prs": p["prs"],
                "prs_merged": p["prs_merged"],
                "lines_added": c["lines_added"],
                "lines_removed": c["lines_removed"],
            }
        )

    return output


def _generate_date_range(
    date_from: date | None,
    date_to: date | None,
    group_by: str,
) -> list[date]:
    """Generate a list of period-start dates covering the given range.

    When group_by='weekly', dates are ISO week-start Mondays.
    """
    if date_from is None or date_to is None:
        return []

    dates: list[date] = []
    if group_by == "weekly":
        # Snap date_from back to the Monday of its ISO week
        current = date_from - timedelta(days=date_from.weekday())
        while current <= date_to:
            dates.append(current)
            current += timedelta(weeks=1)
    else:
        current = date_from
        while current <= date_to:
            dates.append(current)
            current += timedelta(days=1)

    return dates


async def get_github_activity(
    db: AsyncSession,
    user_id: int | None = None,
    repo_name: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    group_by: str = "daily",
) -> list[dict]:
    """Return time-bucketed GitHub activity, including zero-activity periods."""
    dt_from = _to_utc_datetime(date_from)
    dt_to = _to_utc_datetime(date_to)
    if dt_to is not None:
        dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)

    trunc_unit = "week" if group_by == "weekly" else "day"

    # --- Commits grouped by period ---
    commit_period = func.date_trunc(trunc_unit, GitHubCommit.committed_at).label("period")
    commit_query = (
        select(
            commit_period,
            func.count(GitHubCommit.id).label("commits"),
            func.coalesce(func.sum(GitHubCommit.lines_added), 0).label("lines_added"),
            func.coalesce(func.sum(GitHubCommit.lines_removed), 0).label("lines_removed"),
        )
        .group_by(commit_period)
        .order_by(commit_period)
    )
    if user_id is not None:
        commit_query = commit_query.where(GitHubCommit.team_member_id == user_id)
    if repo_name is not None:
        commit_query = commit_query.where(GitHubCommit.repo_name == repo_name)
    if dt_from is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at >= dt_from)
    if dt_to is not None:
        commit_query = commit_query.where(GitHubCommit.committed_at <= dt_to)

    commit_result = await db.execute(commit_query)
    commit_rows = commit_result.all()

    # --- PRs grouped by period ---
    pr_period = func.date_trunc(trunc_unit, GitHubPullRequest.created_at).label("period")
    pr_query = (
        select(
            pr_period,
            func.count(GitHubPullRequest.id).label("prs"),
        )
        .group_by(pr_period)
        .order_by(pr_period)
    )
    if user_id is not None:
        pr_query = pr_query.where(GitHubPullRequest.team_member_id == user_id)
    if repo_name is not None:
        pr_query = pr_query.where(GitHubPullRequest.repo_name == repo_name)
    if dt_from is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at >= dt_from)
    if dt_to is not None:
        pr_query = pr_query.where(GitHubPullRequest.created_at <= dt_to)

    pr_result = await db.execute(pr_query)
    pr_rows = pr_result.all()

    # Build lookup maps keyed by date (the date portion of the truncated period)
    def _to_date(value: datetime | date) -> date:
        if isinstance(value, datetime):
            return value.date()
        return value

    commit_map: dict[date, dict] = {
        _to_date(row.period): {
            "commits": row.commits,
            "lines_added": int(row.lines_added),
            "lines_removed": int(row.lines_removed),
        }
        for row in commit_rows
        if row.period is not None
    }
    pr_map: dict[date, int] = {
        _to_date(row.period): row.prs
        for row in pr_rows
        if row.period is not None
    }

    # If no date range was provided, return only the dates that have data
    if date_from is None or date_to is None:
        all_dates = sorted(set(commit_map.keys()) | set(pr_map.keys()))
        return [
            {
                "date": d,
                "commits": commit_map.get(d, {}).get("commits", 0),
                "prs": pr_map.get(d, 0),
                "lines_added": commit_map.get(d, {}).get("lines_added", 0),
                "lines_removed": commit_map.get(d, {}).get("lines_removed", 0),
            }
            for d in all_dates
        ]

    # Fill in every period in the range (including zero-activity days/weeks)
    all_dates = _generate_date_range(date_from, date_to, group_by)
    return [
        {
            "date": d,
            "commits": commit_map.get(d, {}).get("commits", 0),
            "prs": pr_map.get(d, 0),
            "lines_added": commit_map.get(d, {}).get("lines_added", 0),
            "lines_removed": commit_map.get(d, {}).get("lines_removed", 0),
        }
        for d in all_dates
    ]
