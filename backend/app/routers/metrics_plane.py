"""Router for Plane metrics endpoints.

All endpoints accept optional query parameters for filtering and return
aggregated metrics from the local database.
"""
from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.metrics_plane import (
    CycleDetail,
    CycleMetrics,
    CyclesMetricsResponse,
    OverviewMetrics,
    ProjectDetail,
    ProjectMetrics,
    ProjectsMetricsResponse,
    StateBreakdownItem,
    LabelBreakdownItem,
    WorkItemSummary,
)
from app.services.metrics_plane import (
    get_cycle_detail,
    get_cycles_metrics,
    get_overview_metrics,
    get_project_detail,
    get_projects_metrics,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


@router.get("/overview", response_model=OverviewMetrics)
async def overview(
    project_id: int | None = Query(default=None, description="Filter by project ID"),
    user_id: int | None = Query(default=None, description="Filter by team member ID"),
    date_from: date | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
) -> OverviewMetrics:
    data = await get_overview_metrics(
        db,
        project_id=project_id,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    return OverviewMetrics(**data)


# ---------------------------------------------------------------------------
# Projects list
# ---------------------------------------------------------------------------


@router.get("/projects", response_model=ProjectsMetricsResponse)
async def projects_list(
    user_id: int | None = Query(default=None, description="Filter by team member ID"),
    date_from: date | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
) -> ProjectsMetricsResponse:
    data = await get_projects_metrics(
        db, user_id=user_id, date_from=date_from, date_to=date_to
    )
    projects = [ProjectMetrics(**p) for p in data]
    return ProjectsMetricsResponse(projects=projects)


# ---------------------------------------------------------------------------
# Project detail
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}", response_model=ProjectDetail)
async def project_detail(
    project_id: int,
    user_id: int | None = Query(default=None, description="Filter by team member ID"),
    date_from: date | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
) -> ProjectDetail:
    data = await get_project_detail(
        db,
        project_id=project_id,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectDetail(
        id=data["id"],
        name=data["name"],
        identifier=data["identifier"],
        is_support=data["is_support"],
        total_tasks=data["total_tasks"],
        completed_tasks=data["completed_tasks"],
        pending_tasks=data["pending_tasks"],
        total_points=data["total_points"],
        completed_points=data["completed_points"],
        total_bugs=data["total_bugs"],
        active_cycle=data["active_cycle"],
        state_breakdown=[StateBreakdownItem(**s) for s in data["state_breakdown"]],
        label_breakdown=[LabelBreakdownItem(**l) for l in data["label_breakdown"]],
        bugs=[WorkItemSummary(**b) for b in data["bugs"]],
        client_blocked=[WorkItemSummary(**c) for c in data["client_blocked"]],
    )


# ---------------------------------------------------------------------------
# Cycles list
# ---------------------------------------------------------------------------


@router.get("/cycles", response_model=CyclesMetricsResponse)
async def cycles_list(
    project_id: int | None = Query(default=None, description="Filter by project ID"),
    date_from: date | None = Query(default=None, description="Filter from date (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, description="Filter to date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
) -> CyclesMetricsResponse:
    data = await get_cycles_metrics(
        db, project_id=project_id, date_from=date_from, date_to=date_to
    )
    cycles = [CycleMetrics(**c) for c in data]
    return CyclesMetricsResponse(cycles=cycles)


# ---------------------------------------------------------------------------
# Cycle detail
# ---------------------------------------------------------------------------


@router.get("/cycles/{cycle_id}", response_model=CycleDetail)
async def cycle_detail(
    cycle_id: int,
    db: AsyncSession = Depends(get_db),
) -> CycleDetail:
    data = await get_cycle_detail(db, cycle_id=cycle_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Cycle not found")

    return CycleDetail(
        id=data["id"],
        name=data["name"],
        project_name=data["project_name"],
        project_id=data["project_id"],
        start_date=data["start_date"],
        end_date=data["end_date"],
        is_active=data["is_active"],
        total_tasks=data["total_tasks"],
        completed_tasks=data["completed_tasks"],
        pending_tasks=data["pending_tasks"],
        total_points=data["total_points"],
        completed_points=data["completed_points"],
        tasks=[WorkItemSummary(**t) for t in data["tasks"]],
    )
