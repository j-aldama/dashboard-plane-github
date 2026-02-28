"""Router for support project management endpoints.

Provides endpoints to activate/deactivate support mode on projects
and to retrieve current support metrics.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.support import (
    SupportMetricsResponse,
    SupportProjectMetrics,
    SupportToggleRequest,
    SupportToggleResponse,
)
from app.services.support import get_support_metrics, toggle_project_support

logger = logging.getLogger(__name__)

router = APIRouter(tags=["support"])


# ---------------------------------------------------------------------------
# PATCH /api/projects/{project_id}/support
# ---------------------------------------------------------------------------


@router.patch("/api/projects/{project_id}/support", response_model=SupportToggleResponse)
async def toggle_support(
    project_id: int,
    body: SupportToggleRequest,
    db: AsyncSession = Depends(get_db),
) -> SupportToggleResponse:
    """Activate or deactivate support mode for a project.

    - activate=true: sets is_support=True, records today as support_start_date,
      calculates support_end_date as start + 21 days.
      Requires project_end_date to be set (project must be finished).
    - activate=false: sets is_support=False, clears support_start_date and
      support_end_date.
    """
    try:
        result = await toggle_project_support(db, project_id=project_id, activate=body.activate)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.error(
            "toggle_support failed for project_id=%s", project_id, exc_info=True
        )
        raise HTTPException(status_code=500, detail="An error occurred")

    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return SupportToggleResponse(**result)


# ---------------------------------------------------------------------------
# GET /api/metrics/support
# ---------------------------------------------------------------------------


@router.get("/api/metrics/support", response_model=SupportMetricsResponse)
async def support_metrics(
    db: AsyncSession = Depends(get_db),
) -> SupportMetricsResponse:
    """Return all projects currently in support mode with days remaining and task counts."""
    data = await get_support_metrics(db)
    projects = [SupportProjectMetrics(**p) for p in data]
    return SupportMetricsResponse(projects=projects)
