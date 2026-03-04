"""Service layer for support project management.

Handles retrieval of support metrics for projects with intake enabled in Plane.
Projects are marked as is_support=True during sync when intake_view is active.
"""
from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.work_item import WorkItem

logger = logging.getLogger(__name__)

_COMPLETED_GROUPS = ("completed",)
_INACTIVE_GROUPS = ("completed", "cancelled", "backlog")


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

    return {
        "id": project.id,
        "name": project.name,
        "identifier": project.identifier,
        "is_support": project.is_support,
        "project_type": project.project_type,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
    }
