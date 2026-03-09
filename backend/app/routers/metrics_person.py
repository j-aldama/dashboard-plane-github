"""Router for per-person metrics endpoints."""
from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.metrics_person import (
    PersonGitHubResponse,
    PersonMetricsResponse,
    PersonPR,
    PersonTask,
    WeeklyActivity,
)
from app.services.metrics_person import get_person_github, get_person_metrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metrics/person", tags=["person-metrics"])


@router.get("/{user_id}", response_model=PersonMetricsResponse)
async def person_metrics(
    user_id: int,
    project_id: int | None = Query(default=None),
    cycle_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> PersonMetricsResponse:
    data = await get_person_metrics(
        db,
        user_id=user_id,
        project_id=project_id,
        cycle_id=cycle_id,
        date_from=date_from,
        date_to=date_to,
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Team member not found")

    return PersonMetricsResponse(
        user_id=data["user_id"],
        display_name=data["display_name"],
        email=data["email"],
        github_username=data["github_username"],
        avatar_url=data["avatar_url"],
        completed_tasks=data["completed_tasks"],
        completed_points=data["completed_points"],
        active_tasks=data["active_tasks"],
        overdue_tasks=data["overdue_tasks"],
        bug_tasks=data["bug_tasks"],
        assigned_tasks=[PersonTask(**t) for t in data["assigned_tasks"]],
    )


@router.get("/{user_id}/github", response_model=PersonGitHubResponse)
async def person_github(
    user_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> PersonGitHubResponse:
    data = await get_person_github(
        db,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Team member not found")

    return PersonGitHubResponse(
        user_id=data["user_id"],
        github_username=data["github_username"],
        commits=data["commits"],
        pull_requests=data["pull_requests"],
        prs_merged=data["prs_merged"],
        lines_added=data["lines_added"],
        lines_deleted=data["lines_deleted"],
        weekly_commits=[WeeklyActivity(**w) for w in data["weekly_commits"]],
        recent_prs=[PersonPR(**p) for p in data["recent_prs"]],
    )
