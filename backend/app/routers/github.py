"""GitHub API router — EXEC-003: team code metrics, member detail, and rate limit."""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.github import (
    MemberDetailResponse,
    RateLimitResponse,
    TeamGitHubMetricsResponse,
)
from app.services.github_service import GitHubAPIError, GitHubService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/github", tags=["github"])


def _get_service(db: AsyncSession = Depends(get_db)) -> GitHubService:
    return GitHubService(db)


@router.get("/ping", summary="GitHub router ping")
async def github_ping() -> dict:
    """Health-check endpoint kept for backward compatibility."""
    return {"message": "GitHub router ready"}


@router.get(
    "/team-metrics",
    response_model=TeamGitHubMetricsResponse,
    summary="Team GitHub metrics",
)
async def team_metrics(
    service: GitHubService = Depends(_get_service),
    from_date: date | None = Query(
        None,
        alias="from",
        description="Period start date (YYYY-MM-DD)",
    ),
    to_date: date | None = Query(
        None,
        alias="to",
        description="Period end date (YYYY-MM-DD)",
    ),
) -> TeamGitHubMetricsResponse:
    """Return PRs (open/merged/rejected), commits, and lines of code per team member.

    Includes rankings by PRs merged, commits, and net lines contributed.
    Supports date filtering via ``?from=YYYY-MM-DD&to=YYYY-MM-DD``.
    """
    try:
        return await service.get_team_metrics(from_date, to_date)
    except GitHubAPIError as exc:
        logger.warning("team-metrics endpoint failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="GitHub data is temporarily unavailable. Please retry later.",
        ) from exc
    except Exception as exc:
        logger.warning("Unexpected error in team-metrics: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="GitHub data is temporarily unavailable. Please retry later.",
        ) from exc


@router.get(
    "/member/{username}/detail",
    response_model=MemberDetailResponse,
    summary="Member GitHub detail",
)
async def member_detail(
    username: str,
    service: GitHubService = Depends(_get_service),
    from_date: date | None = Query(
        None,
        alias="from",
        description="Period start date (YYYY-MM-DD)",
    ),
    to_date: date | None = Query(
        None,
        alias="to",
        description="Period end date (YYYY-MM-DD)",
    ),
) -> MemberDetailResponse:
    """Return detailed GitHub metrics and snapshot history for a single team member.

    Includes cross-platform mapping to Plane when a ``TeamMember`` link exists.
    """
    try:
        return await service.get_member_detail(username, from_date, to_date)
    except GitHubAPIError as exc:
        logger.warning("member-detail endpoint failed for %s: %s", username, exc)
        raise HTTPException(
            status_code=503,
            detail="GitHub data is temporarily unavailable. Please retry later.",
        ) from exc
    except Exception as exc:
        logger.warning("Unexpected error in member-detail for %s: %s", username, exc)
        raise HTTPException(
            status_code=503,
            detail="GitHub data is temporarily unavailable. Please retry later.",
        ) from exc


@router.get(
    "/rate-limit",
    response_model=RateLimitResponse,
    summary="GitHub API rate limit",
)
async def rate_limit(
    service: GitHubService = Depends(_get_service),
) -> RateLimitResponse:
    """Return current GitHub API rate-limit consumption and remaining quota."""
    try:
        return await service.get_rate_limit()
    except Exception as exc:
        logger.warning("rate-limit endpoint failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="GitHub rate limit data is temporarily unavailable.",
        ) from exc
