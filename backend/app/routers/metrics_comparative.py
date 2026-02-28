"""Router for the comparative metrics endpoint.

Exposes GET /api/metrics/comparative, which returns cross-member productivity
metrics with optional filtering by project, cycle, and date range.
"""
from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.metrics_comparative import (
    ComparativeMetricsResponse,
    MemberComparativeMetrics,
    MemberRankings,
)
from app.services.metrics_comparative import get_comparative_metrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/comparative", response_model=ComparativeMetricsResponse)
async def comparative(
    project_id: int | None = Query(
        default=None, description="Filter by project ID"
    ),
    cycle_id: int | None = Query(
        default=None, description="Filter by cycle ID"
    ),
    date_from: date | None = Query(
        default=None, description="Filter from date (YYYY-MM-DD)"
    ),
    date_to: date | None = Query(
        default=None, description="Filter to date (YYYY-MM-DD)"
    ),
    db: AsyncSession = Depends(get_db),
) -> ComparativeMetricsResponse:
    records = await get_comparative_metrics(
        db,
        project_id=project_id,
        cycle_id=cycle_id,
        date_from=date_from,
        date_to=date_to,
    )

    members = [
        MemberComparativeMetrics(
            id=r["id"],
            name=r["name"],
            avatar_url=r["avatar_url"],
            github_username=r["github_username"],
            tasks_completed=r["tasks_completed"],
            points_completed=r["points_completed"],
            avg_complexity=r["avg_complexity"],
            active_workload=r["active_workload"],
            overdue_tasks=r["overdue_tasks"],
            commits=r["commits"],
            prs_merged=r["prs_merged"],
            lines_written=r["lines_written"],
            rankings=MemberRankings(**r["rankings"]),
        )
        for r in records
    ]

    return ComparativeMetricsResponse(members=members)
