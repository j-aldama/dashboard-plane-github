"""Service layer for comparative (cross-member) metrics queries.

Calculates per-member productivity metrics and assigns rankings
(1 = best performer for each metric).

All functions handle empty result sets and division-by-zero gracefully.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cycle import Cycle
from app.models.github_commit import GitHubCommit
from app.models.github_pull_request import GitHubPullRequest
from app.models.team_member import TeamMember
from app.models.work_item import WorkItem

logger = logging.getLogger(__name__)

# States considered "completed" — must match metrics_plane definition
_COMPLETED_STATES = ("Done", "Cancelled")

# States treated as backlog (not counted in active_workload)
_BACKLOG_STATES = ("Backlog",)


def _to_utc_datetime(d: date | datetime | None) -> datetime | None:
    """Convert a date or datetime to a UTC-aware datetime, or return None."""
    if d is None:
        return None
    if isinstance(d, datetime):
        if d.tzinfo is None:
            return d.replace(tzinfo=timezone.utc)
        return d
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _rank_members(
    members: list[dict],
    metric_key: str,
    higher_is_better: bool = True,
) -> dict[int, int]:
    """Return a mapping of member_id -> rank for the given metric.

    Rank 1 is assigned to the member with the best value.
    Ties receive the same rank.  Higher-is-better metrics rank the largest
    value as 1; lower-is-better metrics (e.g. overdue_tasks) rank the
    smallest value as 1.
    """
    if not members:
        return {}

    values = [(m["id"], m[metric_key]) for m in members]
    values.sort(key=lambda x: x[1], reverse=higher_is_better)

    ranks: dict[int, int] = {}
    current_rank = 1
    for i, (member_id, value) in enumerate(values):
        if i > 0 and value == values[i - 1][1]:
            ranks[member_id] = ranks[values[i - 1][0]]
        else:
            ranks[member_id] = current_rank
        current_rank += 1

    return ranks


async def get_comparative_metrics(
    db: AsyncSession,
    project_id: int | None = None,
    cycle_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Return comparative metrics for all team members.

    Members with no activity are included with all metrics set to zero.
    """
    try:
        # Fetch all team members so that members with zero activity appear too
        members_result = await db.execute(
            select(TeamMember).order_by(TeamMember.name)
        )
        members: list[TeamMember] = list(members_result.scalars().all())

        if not members:
            return []

        today = date.today()
        dt_from = _to_utc_datetime(date_from)
        dt_to = _to_utc_datetime(date_to)
        if dt_to is not None:
            dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)

        member_ids = [m.id for m in members]

        # ------------------------------------------------------------------
        # Work-item queries (tasks_completed, points_completed, active_workload)
        # ------------------------------------------------------------------

        wi_conditions = [WorkItem.assignee_id.in_(member_ids)]
        if project_id is not None:
            wi_conditions.append(WorkItem.project_id == project_id)
        if cycle_id is not None:
            wi_conditions.append(WorkItem.cycle_id == cycle_id)
        if date_from is not None:
            wi_conditions.append(WorkItem.completed_at >= date_from)
        if date_to is not None:
            wi_conditions.append(WorkItem.completed_at <= date_to)

        wi_agg_stmt = (
            select(
                WorkItem.assignee_id,
                func.count(
                    case((WorkItem.state.in_(_COMPLETED_STATES), 1))
                ).label("tasks_completed"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                WorkItem.state.in_(_COMPLETED_STATES),
                                WorkItem.estimate_points,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("points_completed"),
                func.count(
                    case(
                        (
                            and_(
                                WorkItem.state.notin_(_COMPLETED_STATES),
                                WorkItem.state.notin_(_BACKLOG_STATES),
                                WorkItem.state.isnot(None),
                            ),
                            1,
                        )
                    )
                ).label("active_workload"),
            )
            .where(and_(*wi_conditions))
            .group_by(WorkItem.assignee_id)
        )

        wi_rows = (await db.execute(wi_agg_stmt)).all()
        wi_map: dict[int, dict] = {
            row.assignee_id: {
                "tasks_completed": row.tasks_completed or 0,
                "points_completed": int(row.points_completed or 0),
                "active_workload": row.active_workload or 0,
            }
            for row in wi_rows
            if row.assignee_id is not None
        }

        # ------------------------------------------------------------------
        # Overdue tasks: assigned, not completed, cycle already ended
        # ------------------------------------------------------------------

        overdue_conditions = [
            WorkItem.assignee_id.in_(member_ids),
            WorkItem.state.notin_(_COMPLETED_STATES),
            Cycle.end_date < today,
        ]
        if project_id is not None:
            overdue_conditions.append(WorkItem.project_id == project_id)
        if cycle_id is not None:
            overdue_conditions.append(WorkItem.cycle_id == cycle_id)

        overdue_stmt = (
            select(
                WorkItem.assignee_id,
                func.count(WorkItem.id).label("overdue_tasks"),
            )
            .join(Cycle, WorkItem.cycle_id == Cycle.id)
            .where(and_(*overdue_conditions))
            .group_by(WorkItem.assignee_id)
        )

        overdue_rows = (await db.execute(overdue_stmt)).all()
        overdue_map: dict[int, int] = {
            row.assignee_id: row.overdue_tasks or 0
            for row in overdue_rows
            if row.assignee_id is not None
        }

        # ------------------------------------------------------------------
        # GitHub commits
        # ------------------------------------------------------------------

        commit_conditions: list = [GitHubCommit.team_member_id.in_(member_ids)]
        if dt_from is not None:
            commit_conditions.append(GitHubCommit.committed_at >= dt_from)
        if dt_to is not None:
            commit_conditions.append(GitHubCommit.committed_at <= dt_to)

        commit_stmt = (
            select(
                GitHubCommit.team_member_id,
                func.count(GitHubCommit.id).label("commits"),
                func.coalesce(func.sum(GitHubCommit.lines_added), 0).label(
                    "lines_written"
                ),
            )
            .where(and_(*commit_conditions))
            .group_by(GitHubCommit.team_member_id)
        )

        commit_rows = (await db.execute(commit_stmt)).all()
        commit_map: dict[int, dict] = {
            row.team_member_id: {
                "commits": row.commits or 0,
                "lines_written": int(row.lines_written or 0),
            }
            for row in commit_rows
        }

        # ------------------------------------------------------------------
        # GitHub PRs merged
        # ------------------------------------------------------------------

        pr_conditions: list = [GitHubPullRequest.team_member_id.in_(member_ids)]
        if dt_from is not None:
            pr_conditions.append(GitHubPullRequest.created_at >= dt_from)
        if dt_to is not None:
            pr_conditions.append(GitHubPullRequest.created_at <= dt_to)

        pr_stmt = (
            select(
                GitHubPullRequest.team_member_id,
                func.count(
                    case((GitHubPullRequest.merged_at.isnot(None), 1))
                ).label("prs_merged"),
            )
            .where(and_(*pr_conditions))
            .group_by(GitHubPullRequest.team_member_id)
        )

        pr_rows = (await db.execute(pr_stmt)).all()
        pr_map: dict[int, int] = {
            row.team_member_id: row.prs_merged or 0
            for row in pr_rows
        }

        # ------------------------------------------------------------------
        # Assemble per-member records
        # ------------------------------------------------------------------

        records: list[dict] = []
        for member in members:
            wi = wi_map.get(member.id, {"tasks_completed": 0, "points_completed": 0, "active_workload": 0})
            tasks_completed: int = wi["tasks_completed"]
            points_completed: int = wi["points_completed"]

            avg_complexity: float = (
                round(points_completed / tasks_completed, 2)
                if tasks_completed > 0
                else 0.0
            )

            records.append(
                {
                    "id": member.id,
                    "name": member.name,
                    "avatar_url": member.avatar_url,
                    "github_username": member.github_username,
                    "tasks_completed": tasks_completed,
                    "points_completed": points_completed,
                    "avg_complexity": avg_complexity,
                    "active_workload": wi["active_workload"],
                    "overdue_tasks": overdue_map.get(member.id, 0),
                    "commits": commit_map.get(member.id, {}).get("commits", 0),
                    "prs_merged": pr_map.get(member.id, 0),
                    "lines_written": commit_map.get(member.id, {}).get("lines_written", 0),
                }
            )

        # ------------------------------------------------------------------
        # Compute rankings (1 = best for each metric)
        # ------------------------------------------------------------------

        higher_better_metrics = [
            "tasks_completed",
            "points_completed",
            "avg_complexity",
            "active_workload",
            "commits",
            "prs_merged",
            "lines_written",
        ]
        lower_better_metrics = ["overdue_tasks"]

        ranking_maps: dict[str, dict[int, int]] = {}
        for metric in higher_better_metrics:
            ranking_maps[metric] = _rank_members(records, metric, higher_is_better=True)
        for metric in lower_better_metrics:
            ranking_maps[metric] = _rank_members(records, metric, higher_is_better=False)

        for record in records:
            mid = record["id"]
            record["rankings"] = {
                metric: ranking_maps[metric].get(mid, len(records))
                for metric in (*higher_better_metrics, *lower_better_metrics)
            }

        return records

    except Exception:
        logger.error("get_comparative_metrics failed", exc_info=True)
        return []
