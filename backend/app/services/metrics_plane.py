"""Service layer for Plane metrics queries.

All functions use async SQLAlchemy queries and handle empty results gracefully
by returning zeroed aggregates or empty lists.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cycle import Cycle
from app.models.project import Project
from app.models.team_member import TeamMember
from app.models.work_item import WorkItem

logger = logging.getLogger(__name__)

# State groups considered "completed" (matches Plane's group field)
_COMPLETED_GROUPS = ("completed",)

# State groups excluded from active/pending counts
_INACTIVE_GROUPS = ("completed", "cancelled", "backlog")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _apply_work_item_filters(
    stmt: Any,
    project_ids: list[int] | None = None,
    user_ids: list[int] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    cycle_id: int | None = None,
) -> Any:
    """Apply optional filters to a statement already selecting from WorkItem."""
    conditions = []
    if project_ids:
        conditions.append(WorkItem.project_id.in_(project_ids))
    if user_ids:
        conditions.append(WorkItem.assignee_id.in_(user_ids))
    if cycle_id is not None:
        conditions.append(WorkItem.cycle_id == cycle_id)
    if date_from is not None:
        conditions.append(
            or_(
                WorkItem.completed_at >= date_from,
                WorkItem.created_at >= date_from,
            )
        )
    if date_to is not None:
        conditions.append(
            or_(
                WorkItem.completed_at <= date_to,
                WorkItem.created_at <= date_to,
            )
        )
    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


async def get_overview_metrics(
    db: AsyncSession,
    project_ids: list[int] | None = None,
    user_ids: list[int] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    cycle_id: int | None = None,
) -> dict:
    """Return aggregated overview metrics across all (or filtered) work items."""
    try:
        # Work-item aggregates
        stmt = select(
            func.count(WorkItem.id).label("total_tasks"),
            func.sum(
                case((WorkItem.state_group.in_(_COMPLETED_GROUPS), 1), else_=0)
            ).label("completed_tasks"),
            func.coalesce(func.sum(WorkItem.estimate_points), 0).label("total_points"),
            func.coalesce(
                func.sum(
                    case(
                        (WorkItem.state_group.in_(_COMPLETED_GROUPS), WorkItem.estimate_points),
                        else_=0,
                    )
                ),
                0,
            ).label("completed_points"),
            func.sum(case((WorkItem.is_bug.is_(True), 1), else_=0)).label(
                "total_bugs"
            ),
            func.sum(
                case(
                    (
                        and_(
                            WorkItem.state_group.notin_(_INACTIVE_GROUPS),
                            WorkItem.state_group.isnot(None),
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("active_tasks"),
        )
        stmt = _apply_work_item_filters(
            stmt, project_ids=project_ids, user_ids=user_ids,
            date_from=date_from, date_to=date_to, cycle_id=cycle_id,
        )
        row = (await db.execute(stmt)).one()

        total_tasks: int = row.total_tasks or 0
        completed_tasks: int = row.completed_tasks or 0
        pending_tasks: int = row.active_tasks or 0
        total_points: int = int(row.total_points or 0)
        completed_points: int = int(row.completed_points or 0)
        total_bugs: int = row.total_bugs or 0

        # Cycle aggregates
        cycle_stmt = select(
            func.count(Cycle.id).label("total_cycles"),
            func.sum(case((Cycle.is_active.is_(True), 1), else_=0)).label(
                "active_cycles"
            ),
        )
        if project_ids:
            cycle_stmt = cycle_stmt.where(Cycle.project_id.in_(project_ids))
        cycle_row = (await db.execute(cycle_stmt)).one()

        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "total_points": total_points,
            "completed_points": completed_points,
            "total_cycles": cycle_row.total_cycles or 0,
            "active_cycles": cycle_row.active_cycles or 0,
            "total_bugs": total_bugs,
        }
    except Exception:
        logger.error("get_overview_metrics failed", exc_info=True)
        return {
            "total_tasks": 0,
            "completed_tasks": 0,
            "pending_tasks": 0,
            "total_points": 0,
            "completed_points": 0,
            "total_cycles": 0,
            "active_cycles": 0,
            "total_bugs": 0,
        }


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


async def get_projects_metrics(
    db: AsyncSession,
    user_ids: list[int] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Return per-project metric summaries."""
    try:
        projects_result = await db.execute(
            select(Project)
            .where(Project.is_archived.is_(False))
            .order_by(Project.name)
        )
        projects = projects_result.scalars().all()

        if not projects:
            return []

        result = []
        for project in projects:
            metrics = await _compute_project_metrics(
                db, project, user_ids=user_ids, date_from=date_from, date_to=date_to
            )
            result.append(metrics)

        return result
    except Exception:
        logger.error("get_projects_metrics failed", exc_info=True)
        return []


async def _compute_project_metrics(
    db: AsyncSession,
    project: Project,
    user_ids: list[int] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """Compute metric aggregates for a single project."""
    stmt = select(
        func.count(WorkItem.id).label("total_tasks"),
        func.sum(
            case((WorkItem.state_group.in_(_COMPLETED_GROUPS), 1), else_=0)
        ).label("completed_tasks"),
        func.coalesce(func.sum(WorkItem.estimate_points), 0).label("total_points"),
        func.coalesce(
            func.sum(
                case(
                    (WorkItem.state_group.in_(_COMPLETED_GROUPS), WorkItem.estimate_points),
                    else_=0,
                )
            ),
            0,
        ).label("completed_points"),
        func.sum(case((WorkItem.is_bug.is_(True), 1), else_=0)).label("total_bugs"),
        func.sum(
            case(
                (
                    and_(
                        WorkItem.state_group.notin_(_INACTIVE_GROUPS),
                        WorkItem.state_group.isnot(None),
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("active_tasks"),
    ).where(WorkItem.project_id == project.id)

    stmt = _apply_work_item_filters(
        stmt, user_ids=user_ids, date_from=date_from, date_to=date_to
    )
    row = (await db.execute(stmt)).one()

    total_tasks = row.total_tasks or 0
    completed_tasks = row.completed_tasks or 0

    # Active cycle name
    active_cycle_result = await db.execute(
        select(Cycle.name)
        .where(Cycle.project_id == project.id, Cycle.is_active.is_(True))
        .limit(1)
    )
    active_cycle_row = active_cycle_result.first()
    active_cycle = active_cycle_row[0] if active_cycle_row else None

    return {
        "id": project.id,
        "name": project.name,
        "identifier": project.identifier,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": row.active_tasks or 0,
        "total_points": int(row.total_points or 0),
        "completed_points": int(row.completed_points or 0),
        "total_bugs": row.total_bugs or 0,
        "active_cycle": active_cycle,
        "is_support": project.is_support,
        "project_type": project.project_type,
        "is_archived": project.is_archived,
        "project_start_date": project.project_start_date,
        "project_end_date": project.project_end_date,
    }


# ---------------------------------------------------------------------------
# Project detail
# ---------------------------------------------------------------------------


async def get_project_detail(
    db: AsyncSession,
    project_id: int,
    user_ids: list[int] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict | None:
    """Return detailed metrics for a single project, including breakdowns."""
    try:
        project_result = await db.execute(
            select(Project).where(Project.id == project_id)
        )
        project: Project | None = project_result.scalar_one_or_none()
        if project is None:
            return None

        # Base metrics
        base = await _compute_project_metrics(
            db, project, user_ids=user_ids, date_from=date_from, date_to=date_to
        )

        # State breakdown
        state_stmt = (
            select(WorkItem.state, func.count(WorkItem.id).label("count"))
            .where(WorkItem.project_id == project_id)
            .group_by(WorkItem.state)
            .order_by(func.count(WorkItem.id).desc())
        )
        state_stmt = _apply_work_item_filters(
            state_stmt, user_ids=user_ids, date_from=date_from, date_to=date_to
        )
        state_rows = (await db.execute(state_stmt)).all()
        state_breakdown = [
            {"state": row.state or "Unknown", "count": row.count}
            for row in state_rows
        ]

        # Work items for label breakdown
        wi_stmt = select(WorkItem.label_names).where(
            WorkItem.project_id == project_id, WorkItem.label_names.isnot(None)
        )
        wi_stmt = _apply_work_item_filters(
            wi_stmt, user_ids=user_ids, date_from=date_from, date_to=date_to
        )
        label_rows = (await db.execute(wi_stmt)).scalars().all()
        label_counts: dict[str, int] = {}
        for label_list in label_rows:
            if isinstance(label_list, list):
                for lbl in label_list:
                    if isinstance(lbl, str):
                        label_counts[lbl] = label_counts.get(lbl, 0) + 1
        label_breakdown = [
            {"label": lbl, "count": cnt}
            for lbl, cnt in sorted(label_counts.items(), key=lambda x: -x[1])
        ]

        # Bugs
        bugs = await _fetch_work_items_summary(
            db, project_id, user_ids=user_ids, date_from=date_from, date_to=date_to,
            is_bug=True
        )

        # Client-blocked
        client_blocked = await _fetch_work_items_summary(
            db, project_id, user_ids=user_ids, date_from=date_from, date_to=date_to,
            is_client_blocked=True
        )

        # Pending items (not completed/cancelled)
        pending_items = await _fetch_work_items_summary(
            db, project_id, user_ids=user_ids, date_from=date_from, date_to=date_to,
            exclude_completed=True
        )

        return {
            **base,
            "state_breakdown": state_breakdown,
            "label_breakdown": label_breakdown,
            "bugs": bugs,
            "client_blocked": client_blocked,
            "pending_items": pending_items,
        }
    except Exception:
        logger.error("get_project_detail failed for project_id=%s", project_id, exc_info=True)
        return None


async def _fetch_work_items_summary(
    db: AsyncSession,
    project_id: int,
    user_ids: list[int] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    is_bug: bool = False,
    is_client_blocked: bool = False,
    exclude_completed: bool = False,
) -> list[dict]:
    """Return a list of work-item summary dicts with optional assignee name."""
    stmt = (
        select(
            WorkItem.id,
            WorkItem.plane_issue_id,
            WorkItem.title,
            WorkItem.state,
            WorkItem.priority,
            TeamMember.name.label("assignee_name"),
        )
        .outerjoin(TeamMember, WorkItem.assignee_id == TeamMember.id)
        .where(WorkItem.project_id == project_id)
    )
    if is_bug:
        stmt = stmt.where(WorkItem.is_bug.is_(True))
    if is_client_blocked:
        stmt = stmt.where(WorkItem.is_client_blocked.is_(True))
    if exclude_completed:
        stmt = stmt.where(
            WorkItem.state_group.notin_(_INACTIVE_GROUPS),
            WorkItem.state_group.isnot(None),
        )
    stmt = _apply_work_item_filters(
        stmt, user_ids=user_ids, date_from=date_from, date_to=date_to
    )
    stmt = stmt.order_by(WorkItem.id)

    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": r.id,
            "plane_issue_id": r.plane_issue_id,
            "title": r.title,
            "state": r.state,
            "priority": r.priority,
            "assignee_name": r.assignee_name,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Cycles
# ---------------------------------------------------------------------------


async def get_cycles_metrics(
    db: AsyncSession,
    project_ids: list[int] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Return per-cycle metric summaries."""
    try:
        cycle_stmt = (
            select(Cycle, Project.name.label("project_name"))
            .join(Project, Cycle.project_id == Project.id)
            .order_by(Cycle.is_active.desc(), Cycle.start_date.desc())
        )
        if project_ids:
            cycle_stmt = cycle_stmt.where(Cycle.project_id.in_(project_ids))
        if date_from is not None:
            cycle_stmt = cycle_stmt.where(
                or_(Cycle.end_date >= date_from, Cycle.start_date >= date_from)
            )
        if date_to is not None:
            cycle_stmt = cycle_stmt.where(
                or_(Cycle.start_date <= date_to, Cycle.end_date <= date_to)
            )

        cycle_rows = (await db.execute(cycle_stmt)).all()

        if not cycle_rows:
            return []

        result = []
        for row in cycle_rows:
            cycle: Cycle = row[0]
            project_name: str = row.project_name
            metrics = await _compute_cycle_metrics(db, cycle, project_name)
            result.append(metrics)

        return result
    except Exception:
        logger.error("get_cycles_metrics failed", exc_info=True)
        return []


async def _compute_cycle_metrics(
    db: AsyncSession, cycle: Cycle, project_name: str
) -> dict:
    """Compute metric aggregates for a single cycle."""
    stmt = select(
        func.count(WorkItem.id).label("total_tasks"),
        func.sum(
            case((WorkItem.state_group.in_(_COMPLETED_GROUPS), 1), else_=0)
        ).label("completed_tasks"),
        func.coalesce(func.sum(WorkItem.estimate_points), 0).label("total_points"),
        func.coalesce(
            func.sum(
                case(
                    (WorkItem.state_group.in_(_COMPLETED_GROUPS), WorkItem.estimate_points),
                    else_=0,
                )
            ),
            0,
        ).label("completed_points"),
        func.sum(
            case(
                (
                    and_(
                        WorkItem.state_group.notin_(_INACTIVE_GROUPS),
                        WorkItem.state_group.isnot(None),
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("active_tasks"),
    ).where(WorkItem.cycle_id == cycle.id)
    row = (await db.execute(stmt)).one()

    total_tasks = row.total_tasks or 0
    completed_tasks = row.completed_tasks or 0

    return {
        "id": cycle.id,
        "name": cycle.name,
        "project_name": project_name,
        "project_id": cycle.project_id,
        "start_date": cycle.start_date,
        "end_date": cycle.end_date,
        "is_active": cycle.is_active,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": row.active_tasks or 0,
        "total_points": int(row.total_points or 0),
        "completed_points": int(row.completed_points or 0),
    }


# ---------------------------------------------------------------------------
# Cycle detail
# ---------------------------------------------------------------------------


async def get_cycle_detail(db: AsyncSession, cycle_id: int) -> dict | None:
    """Return detailed metrics for a single cycle, including task list."""
    try:
        result = await db.execute(
            select(Cycle, Project.name.label("project_name"))
            .join(Project, Cycle.project_id == Project.id)
            .where(Cycle.id == cycle_id)
        )
        row = result.first()
        if row is None:
            return None

        cycle: Cycle = row[0]
        project_name: str = row.project_name

        base = await _compute_cycle_metrics(db, cycle, project_name)

        # Task list
        tasks_stmt = (
            select(
                WorkItem.id,
                WorkItem.plane_issue_id,
                WorkItem.title,
                WorkItem.state,
                WorkItem.priority,
                TeamMember.name.label("assignee_name"),
            )
            .outerjoin(TeamMember, WorkItem.assignee_id == TeamMember.id)
            .where(WorkItem.cycle_id == cycle_id)
            .order_by(WorkItem.id)
        )
        task_rows = (await db.execute(tasks_stmt)).all()
        tasks = [
            {
                "id": r.id,
                "plane_issue_id": r.plane_issue_id,
                "title": r.title,
                "state": r.state,
                "priority": r.priority,
                "assignee_name": r.assignee_name,
            }
            for r in task_rows
        ]

        return {**base, "tasks": tasks}
    except Exception:
        logger.error("get_cycle_detail failed for cycle_id=%s", cycle_id, exc_info=True)
        return None
