"""Service layer for support project management.

Handles retrieval of support metrics for projects with intake enabled in Plane.
Projects are marked as is_support=True during sync when intake_view is active.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.work_item import WorkItem

logger = logging.getLogger(__name__)

_SUPPORT_DURATION_DAYS = 21
_COMPLETED_GROUPS = ("completed",)
_INACTIVE_GROUPS = ("completed", "cancelled", "backlog")


async def toggle_project_support(
    db: AsyncSession,
    *,
    project_id: int,
    activate: bool,
) -> dict | None:
    """Activate or deactivate support mode for a project.

    Returns a dict with the updated project fields, or None if not found.
    Raises ValueError if activation is requested but project_end_date is not set.
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project: Project | None = result.scalar_one_or_none()
    if project is None:
        return None

    if activate:
        if project.project_end_date is None:
            raise ValueError(
                "Cannot activate support: project must have a project_end_date set."
            )
        today = date.today()
        project.is_support = True
        project.project_type = "support"
        project.support_start_date = today
        project.support_end_date = today + timedelta(days=_SUPPORT_DURATION_DAYS)
    else:
        project.is_support = False
        project.project_type = "client"
        project.support_start_date = None
        project.support_end_date = None

    await db.commit()
    await db.refresh(project)

    return {
        "id": project.id,
        "name": project.name,
        "is_support": project.is_support,
        "project_type": project.project_type,
        "support_start_date": project.support_start_date,
        "support_end_date": project.support_end_date,
    }


async def get_support_metrics(db: AsyncSession) -> list[dict]:
    """Return metrics for all projects currently in support mode (intake active)."""
    try:
        projects_result = await db.execute(
            select(Project)
            .where(Project.project_type == "support")
            .where(Project.is_archived.is_(False))
            .order_by(Project.name.asc())
        )
        projects = projects_result.scalars().all()

        if not projects:
            return []

        result = []
        for project in projects:
            metrics = await _compute_support_project_metrics(db, project)
            result.append(metrics)

        return result
    except Exception:
        logger.error("get_support_metrics failed", exc_info=True)
        return []


async def _compute_support_project_metrics(
    db: AsyncSession,
    project: Project,
) -> dict:
    """Compute task aggregates for a single project in support mode."""
    stmt = select(
        func.count(WorkItem.id).label("total_tasks"),
        func.sum(
            case((WorkItem.state_group.in_(_COMPLETED_GROUPS), 1), else_=0)
        ).label("completed_tasks"),
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

    row = (await db.execute(stmt)).one()

    total_tasks: int = row.total_tasks or 0
    completed_tasks: int = row.completed_tasks or 0
    pending_tasks: int = row.active_tasks or 0

    today = date.today()
    support_end = project.support_end_date
    is_active = support_end is not None and support_end >= today
    days_remaining = max((support_end - today).days, 0) if support_end else 0

    return {
        "id": project.id,
        "name": project.name,
        "identifier": project.identifier,
        "is_support": project.is_support,
        "project_type": project.project_type,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "is_active": is_active,
        "days_remaining": days_remaining,
    }
