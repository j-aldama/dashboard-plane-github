"""Plane API router — EXEC-002: team metrics, projects, and cycle analytics."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.plane import (
    CycleAnalysisResponse,
    CyclesResponse,
    ProjectsResponse,
    TeamMetricsResponse,
)
from app.services.plane_service import PlaneAPIError, PlaneService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plane", tags=["plane"])


def _get_service(db: AsyncSession = Depends(get_db)) -> PlaneService:
    return PlaneService(db)


@router.get("/ping", summary="Plane router ping")
async def plane_ping() -> dict:
    """Health-check endpoint kept for backward compatibility."""
    return {"message": "Plane router ready"}


@router.get(
    "/team-metrics",
    response_model=TeamMetricsResponse,
    summary="Team member metrics",
)
async def team_metrics(
    service: PlaneService = Depends(_get_service),
) -> TeamMetricsResponse:
    """Return aggregated Fibonacci points, completed tasks, average priority,
    and relative effort for each workspace member."""
    try:
        return await service.get_team_metrics()
    except PlaneAPIError as exc:
        logger.warning("team-metrics endpoint failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc
    except Exception as exc:
        logger.warning("Unexpected error in team-metrics: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc


@router.get(
    "/projects",
    response_model=ProjectsResponse,
    summary="Projects with classification",
)
async def projects(
    service: PlaneService = Depends(_get_service),
) -> ProjectsResponse:
    """Return projects classified as dev/support with traffic-light status."""
    try:
        return await service.get_projects()
    except PlaneAPIError as exc:
        logger.warning("projects endpoint failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc
    except Exception as exc:
        logger.warning("Unexpected error in projects: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc


@router.get(
    "/cycles",
    response_model=CyclesResponse,
    summary="Cycle metrics",
)
async def cycles(
    service: PlaneService = Depends(_get_service),
) -> CyclesResponse:
    """Return cycle-level metrics: assigned vs completed, completion rate, history."""
    try:
        return await service.get_cycles()
    except PlaneAPIError as exc:
        logger.warning("cycles endpoint failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc
    except Exception as exc:
        logger.warning("Unexpected error in cycles: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc


@router.get(
    "/cycles/{cycle_id}/analysis",
    response_model=CycleAnalysisResponse,
    summary="Cycle member analysis",
)
async def cycle_analysis(
    cycle_id: str,
    service: PlaneService = Depends(_get_service),
) -> CycleAnalysisResponse:
    """Return per-member ranking by points, tasks, and complexity for a cycle."""
    try:
        return await service.get_cycle_analysis(cycle_id)
    except PlaneAPIError as exc:
        logger.warning("cycle-analysis endpoint failed for %s: %s", cycle_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc
    except Exception as exc:
        logger.warning("Unexpected error in cycle-analysis: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Plane data is temporarily unavailable. Please retry later.",
        ) from exc
