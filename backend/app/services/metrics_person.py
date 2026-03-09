"""Service layer for per-person metrics queries.

Returns individual metrics for a single team member, including
Plane work items and GitHub activity.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cycle import Cycle
from app.models.github_commit import GitHubCommit
from app.models.github_pull_request import GitHubPullRequest
from app.models.github_repository import GitHubRepository
from app.models.project import Project
from app.models.team_member import TeamMember
from app.models.work_item import WorkItem

logger = logging.getLogger(__name__)

_COMPLETED_GROUPS = ("completed",)
_BACKLOG_GROUPS = ("backlog",)
_CANCELLED_GROUPS = ("cancelled",)
_INACTIVE_GROUPS = ("completed", "cancelled", "backlog")


def _to_utc_datetime(d: date | datetime | None) -> datetime | None:
    if d is None:
        return None
    if isinstance(d, datetime):
        if d.tzinfo is None:
            return d.replace(tzinfo=timezone.utc)
        return d
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


async def get_person_metrics(
    db: AsyncSession,
    user_id: int,
    project_id: int | None = None,
    cycle_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict | None:
    """Return Plane metrics for a single team member."""
    try:
        member_result = await db.execute(
            select(TeamMember).where(TeamMember.id == user_id)
        )
        member: TeamMember | None = member_result.scalar_one_or_none()
        if member is None:
            return None

        today = date.today()

        # --- Aggregate work-item stats ---
        wi_conditions = [WorkItem.assignee_id == user_id]
        if project_id is not None:
            wi_conditions.append(WorkItem.project_id == project_id)
        if cycle_id is not None:
            wi_conditions.append(WorkItem.cycle_id == cycle_id)
        if date_from is not None:
            wi_conditions.append(WorkItem.completed_at >= date_from)
        if date_to is not None:
            wi_conditions.append(WorkItem.completed_at <= date_to)

        agg_stmt = select(
            func.count(
                case((WorkItem.state_group.in_(_COMPLETED_GROUPS), 1))
            ).label("completed_tasks"),
            func.coalesce(
                func.sum(
                    case(
                        (WorkItem.state_group.in_(_COMPLETED_GROUPS), WorkItem.estimate_points),
                        else_=0,
                    )
                ),
                0,
            ).label("completed_points"),
            func.count(
                case(
                    (
                        and_(
                            WorkItem.state_group.notin_(_INACTIVE_GROUPS),
                            WorkItem.state_group.isnot(None),
                        ),
                        1,
                    )
                )
            ).label("active_tasks"),
            func.count(
                case((WorkItem.is_bug.is_(True), 1))
            ).label("bug_tasks"),
        ).where(and_(*wi_conditions))

        agg_row = (await db.execute(agg_stmt)).one()

        # --- Overdue tasks ---
        overdue_conditions = [
            WorkItem.assignee_id == user_id,
            WorkItem.state_group.notin_(_INACTIVE_GROUPS),
            WorkItem.state_group.isnot(None),
            Cycle.end_date < today,
        ]
        if project_id is not None:
            overdue_conditions.append(WorkItem.project_id == project_id)
        if cycle_id is not None:
            overdue_conditions.append(WorkItem.cycle_id == cycle_id)

        overdue_stmt = (
            select(func.count(WorkItem.id).label("overdue"))
            .join(Cycle, WorkItem.cycle_id == Cycle.id)
            .where(and_(*overdue_conditions))
        )
        overdue_count = (await db.execute(overdue_stmt)).scalar() or 0

        # --- Assigned tasks list ---
        tasks_conditions = [WorkItem.assignee_id == user_id]
        if project_id is not None:
            tasks_conditions.append(WorkItem.project_id == project_id)
        if cycle_id is not None:
            tasks_conditions.append(WorkItem.cycle_id == cycle_id)
        if date_from is not None:
            tasks_conditions.append(
                or_(
                    WorkItem.completed_at >= date_from,
                    WorkItem.created_at >= date_from,
                )
            )
        if date_to is not None:
            tasks_conditions.append(
                or_(
                    WorkItem.completed_at <= date_to,
                    WorkItem.created_at <= date_to,
                )
            )

        tasks_stmt = (
            select(
                WorkItem.id,
                WorkItem.title,
                Project.name.label("project_name"),
                WorkItem.state,
                WorkItem.state_group,
                WorkItem.estimate_points,
                Cycle.name.label("cycle_name"),
                WorkItem.is_bug,
            )
            .join(Project, WorkItem.project_id == Project.id)
            .outerjoin(Cycle, WorkItem.cycle_id == Cycle.id)
            .where(and_(*tasks_conditions))
            .order_by(WorkItem.id.desc())
        )
        task_rows = (await db.execute(tasks_stmt)).all()

        assigned_tasks = [
            {
                "id": r.id,
                "title": r.title,
                "project": r.project_name,
                "state": r.state or "Unknown",
                "state_group": r.state_group or "unknown",
                "points": int(r.estimate_points) if r.estimate_points is not None else None,
                "cycle": r.cycle_name,
                "is_bug": r.is_bug,
            }
            for r in task_rows
        ]

        return {
            "user_id": str(user_id),
            "display_name": member.name,
            "email": member.email,
            "github_username": member.github_username,
            "avatar_url": member.avatar_url,
            "completed_tasks": agg_row.completed_tasks or 0,
            "completed_points": int(agg_row.completed_points or 0),
            "active_tasks": agg_row.active_tasks or 0,
            "overdue_tasks": overdue_count,
            "bug_tasks": agg_row.bug_tasks or 0,
            "assigned_tasks": assigned_tasks,
        }
    except Exception:
        logger.error("get_person_metrics failed for user_id=%s", user_id, exc_info=True)
        return None


async def get_person_github(
    db: AsyncSession,
    user_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict | None:
    """Return GitHub metrics for a single team member."""
    try:
        member_result = await db.execute(
            select(TeamMember).where(TeamMember.id == user_id)
        )
        member: TeamMember | None = member_result.scalar_one_or_none()
        if member is None:
            return None

        dt_from = _to_utc_datetime(date_from)
        dt_to = _to_utc_datetime(date_to)
        if dt_to is not None:
            dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)

        # --- Exclude inactive repos ---
        excl_result = await db.execute(
            select(GitHubRepository.repo_name).where(
                GitHubRepository.is_active.is_(False)
            )
        )
        excluded_repos = {row[0] for row in excl_result.all()}

        # --- Commit aggregates ---
        commit_conditions: list = [GitHubCommit.team_member_id == user_id]
        if excluded_repos:
            commit_conditions.append(GitHubCommit.repo_name.notin_(excluded_repos))
        if dt_from is not None:
            commit_conditions.append(GitHubCommit.committed_at >= dt_from)
        if dt_to is not None:
            commit_conditions.append(GitHubCommit.committed_at <= dt_to)

        commit_stmt = select(
            func.count(GitHubCommit.id).label("commits"),
            func.coalesce(func.sum(GitHubCommit.lines_added), 0).label("lines_added"),
            func.coalesce(func.sum(GitHubCommit.lines_removed), 0).label("lines_removed"),
        ).where(and_(*commit_conditions))

        commit_row = (await db.execute(commit_stmt)).one()

        # --- PR aggregates ---
        pr_conditions: list = [GitHubPullRequest.team_member_id == user_id]
        if excluded_repos:
            pr_conditions.append(GitHubPullRequest.repo_name.notin_(excluded_repos))
        if dt_from is not None:
            pr_conditions.append(GitHubPullRequest.created_at >= dt_from)
        if dt_to is not None:
            pr_conditions.append(GitHubPullRequest.created_at <= dt_to)

        pr_agg_stmt = select(
            func.count(GitHubPullRequest.id).label("pull_requests"),
            func.count(
                case((GitHubPullRequest.merged_at.isnot(None), 1))
            ).label("prs_merged"),
        ).where(and_(*pr_conditions))

        pr_row = (await db.execute(pr_agg_stmt)).one()

        # --- Weekly commits (last 3 months) ---
        three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
        week_trunc = func.date_trunc("week", GitHubCommit.committed_at).label("week")
        weekly_conditions = [
            GitHubCommit.team_member_id == user_id,
            GitHubCommit.committed_at >= three_months_ago,
        ]
        if excluded_repos:
            weekly_conditions.append(GitHubCommit.repo_name.notin_(excluded_repos))
        weekly_stmt = (
            select(
                week_trunc,
                func.count(GitHubCommit.id).label("commits"),
            )
            .where(and_(*weekly_conditions))
            .group_by(week_trunc)
            .order_by(week_trunc)
        )
        weekly_rows = (await db.execute(weekly_stmt)).all()
        weekly_commits = [
            {
                "week": r.week.strftime("%d/%m") if isinstance(r.week, (date, datetime)) else str(r.week),
                "commits": r.commits,
            }
            for r in weekly_rows
        ]

        # --- Recent PRs (10 most recent) ---
        recent_pr_conditions = [GitHubPullRequest.team_member_id == user_id]
        if excluded_repos:
            recent_pr_conditions.append(GitHubPullRequest.repo_name.notin_(excluded_repos))
        recent_pr_stmt = (
            select(
                GitHubPullRequest.id,
                GitHubPullRequest.title,
                GitHubPullRequest.repo_name,
                GitHubPullRequest.state,
                GitHubPullRequest.merged_at,
                GitHubPullRequest.created_at,
                GitHubPullRequest.pr_number,
            )
            .where(and_(*recent_pr_conditions))
            .order_by(GitHubPullRequest.created_at.desc())
            .limit(10)
        )
        pr_rows_list = (await db.execute(recent_pr_stmt)).all()

        recent_prs = [
            {
                "id": r.id,
                "title": r.title,
                "repo": r.repo_name,
                "state": "merged" if r.merged_at else r.state,
                "merged_at": r.merged_at.isoformat() if r.merged_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else "",
                "url": None,
            }
            for r in pr_rows_list
        ]

        return {
            "user_id": str(user_id),
            "github_username": member.github_username,
            "commits": commit_row.commits or 0,
            "pull_requests": pr_row.pull_requests or 0,
            "prs_merged": pr_row.prs_merged or 0,
            "lines_added": int(commit_row.lines_added or 0),
            "lines_deleted": int(commit_row.lines_removed or 0),
            "weekly_commits": weekly_commits,
            "recent_prs": recent_prs,
        }
    except Exception:
        logger.error("get_person_github failed for user_id=%s", user_id, exc_info=True)
        return None
