from __future__ import annotations

import logging
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.metrics_github import (
    GitHubActivityResponse,
    GitHubByRepoResponse,
    GitHubByUserResponse,
    GitHubOverviewResponse,
)
from app.services.metrics_github import (
    get_github_activity,
    get_github_by_repo,
    get_github_by_user,
    get_github_overview,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metrics/github", tags=["metrics-github"])


@router.get("/overview", response_model=GitHubOverviewResponse)
async def github_overview(
    user_id: int | None = Query(default=None, description="Filter by team member ID"),
    repo_name: str | None = Query(default=None, description="Filter by repository name"),
    date_from: date | None = Query(default=None, description="Start date (inclusive), YYYY-MM-DD"),
    date_to: date | None = Query(default=None, description="End date (inclusive), YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
) -> GitHubOverviewResponse:
    """Aggregate GitHub metrics for the given filters."""
    try:
        data = await get_github_overview(
            db,
            user_id=user_id,
            repo_name=repo_name,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception:
        logger.exception("Unexpected error in github_overview")
        raise HTTPException(status_code=500, detail="An error occurred")
    return GitHubOverviewResponse(**data)


@router.get("/by-user", response_model=GitHubByUserResponse)
async def github_by_user(
    repo_name: str | None = Query(default=None, description="Filter by repository name"),
    date_from: date | None = Query(default=None, description="Start date (inclusive), YYYY-MM-DD"),
    date_to: date | None = Query(default=None, description="End date (inclusive), YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
) -> GitHubByUserResponse:
    """GitHub metrics broken down by team member."""
    try:
        users = await get_github_by_user(
            db,
            repo_name=repo_name,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception:
        logger.exception("Unexpected error in github_by_user")
        raise HTTPException(status_code=500, detail="An error occurred")
    return GitHubByUserResponse(users=users)


@router.get("/by-repo", response_model=GitHubByRepoResponse)
async def github_by_repo(
    user_id: int | None = Query(default=None, description="Filter by team member ID"),
    date_from: date | None = Query(default=None, description="Start date (inclusive), YYYY-MM-DD"),
    date_to: date | None = Query(default=None, description="End date (inclusive), YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
) -> GitHubByRepoResponse:
    """GitHub metrics broken down by repository."""
    try:
        repos = await get_github_by_repo(
            db,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception:
        logger.exception("Unexpected error in github_by_repo")
        raise HTTPException(status_code=500, detail="An error occurred")
    return GitHubByRepoResponse(repos=repos)


@router.get("/activity", response_model=GitHubActivityResponse)
async def github_activity(
    user_id: int | None = Query(default=None, description="Filter by team member ID"),
    repo_name: str | None = Query(default=None, description="Filter by repository name"),
    date_from: date | None = Query(default=None, description="Start date (inclusive), YYYY-MM-DD"),
    date_to: date | None = Query(default=None, description="End date (inclusive), YYYY-MM-DD"),
    group_by: Literal["daily", "weekly"] = Query(
        default="daily", description="Grouping granularity: daily or weekly"
    ),
    db: AsyncSession = Depends(get_db),
) -> GitHubActivityResponse:
    """Time-bucketed GitHub activity.

    Returns one entry per day (or week) in the requested range, including
    periods with zero activity when date_from and date_to are provided.
    """
    try:
        activity = await get_github_activity(
            db,
            user_id=user_id,
            repo_name=repo_name,
            date_from=date_from,
            date_to=date_to,
            group_by=group_by,
        )
    except Exception:
        logger.exception("Unexpected error in github_activity")
        raise HTTPException(status_code=500, detail="An error occurred")
    return GitHubActivityResponse(activity=activity)
