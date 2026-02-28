"""Service layer for support project management.

Handles activation/deactivation of support mode on projects and retrieval
of support metrics including task aggregates filtered by the support period.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.work_item import WorkItem

logger = logging.getLogger(__name__)

_SUPPORT_PERIOD_DAYS = 21
_COMPLETED_STATES = ("Done", "Cancelled")


# ---------------------------------------------------------------------------
# Support toggle
# ---------------------------------------------------------------------------


async def toggle_project_support(
    db: AsyncSession,
    project_id: int,
    activate: bool,
) -> dict | None:
    """Activate or deactivate support mode for a project.

    Returns a dict with updated project info, or None if project not found.
    Raises ValueError if activation rules are violated.
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project: Project | None = result.scalar_one_or_none()
    if project is None:
        return None

    if activate:
        if project.project_end_date is None:
            raise ValueError(
                "Cannot activate support: project does not have a project_end_date. "
                "Only finished projects can be placed in support."
            )
        today = date.today()
        project.is_support = True
        project.support_start_date = today
        project.support_end_date = today + timedelta(days=_SUPPORT_PERIOD_DAYS)
    else:
        project.is_support = False
        project.support_start_date = None
        project.support_end_date = None

    await db.commit()
    await db.refresh(project)

    return _project_to_toggle_dict(project)


def _project_to_toggle_dict(project: Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "identifier": project.identifier,
        "is_support": project.is_support,
        "project_start_date": project.project_start_date,
        "project_end_date": project.project_end_date,
        "support_start_date": project.support_start_date,
        "support_end_date": project.support_end_date,
    }


# ---------------------------------------------------------------------------
# Support metrics
# ---------------------------------------------------------------------------


async def get_support_metrics(db: AsyncSession) -> list[dict]:
    """Return metrics for all projects currently in support mode."""
    try:
        projects_result = await db.execute(
            select(Project)
            .where(Project.is_support.is_(True))
            .order_by(Project.support_end_date.asc())
        )
        projects = projects_result.scalars().all()

        if not projects:
            return []

        today = date.today()
        result = []
        for project in projects:
            metrics = await _compute_support_project_metrics(db, project, today)
            result.append(metrics)

        return result
    except Exception:
        logger.error("get_support_metrics failed", exc_info=True)
        return []


async def _compute_support_project_metrics(
    db: AsyncSession,
    project: Project,
    today: date,
) -> dict:
    """Compute task aggregates for a single project in support mode.

    Tasks are filtered to those created or completed within the support period.
    """
    stmt = select(
        func.count(WorkItem.id).label("total_tasks"),
        func.sum(
            case((WorkItem.state.in_(_COMPLETED_STATES), 1), else_=0)
        ).label("completed_tasks"),
    ).where(WorkItem.project_id == project.id)

    # Filter work items to the support period when dates are available
    if project.support_start_date is not None and project.support_end_date is not None:
        stmt = stmt.where(
            and_(
                WorkItem.created_at >= project.support_start_date,
                WorkItem.created_at <= project.support_end_date,
            )
        )

    row = (await db.execute(stmt)).one()

    total_tasks: int = row.total_tasks or 0
    completed_tasks: int = row.completed_tasks or 0
    pending_tasks: int = total_tasks - completed_tasks

    support_end: date | None = project.support_end_date
    if support_end is not None:
        days_remaining = max(0, (support_end - today).days)
    else:
        days_remaining = 0

    is_active = support_end is not None and support_end >= today

    return {
        "id": project.id,
        "name": project.name,
        "identifier": project.identifier,
        "project_start_date": project.project_start_date,
        "project_end_date": project.project_end_date,
        "support_start_date": project.support_start_date,
        "support_end_date": project.support_end_date,
        "days_remaining": days_remaining,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "is_active": is_active,
    }
