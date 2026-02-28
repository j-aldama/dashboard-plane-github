import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import httpx

from app.database import get_db
from app.schemas.sync_projects import SyncProjectsCyclesResponse
from app.services.sync_projects import sync_projects_and_cycles

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


@router.post("/sync/projects-cycles", response_model=SyncProjectsCyclesResponse)
async def sync_projects_cycles_endpoint(
    db: AsyncSession = Depends(get_db),
) -> SyncProjectsCyclesResponse:
    """Trigger a full sync of Plane projects and cycles into the local database.

    Performs upserts keyed on plane_project_id / plane_cycle_id and returns
    a summary of records created and updated.
    """
    try:
        result = await sync_projects_and_cycles(db)
    except httpx.TimeoutException:
        logger.error("Plane API timed out during projects/cycles sync")
        raise HTTPException(
            status_code=504,
            detail="Plane API timed out. Please retry later.",
        )
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        logger.error("Plane API returned HTTP %s during sync", status)
        if status == 401:
            raise HTTPException(
                status_code=502,
                detail="Invalid or missing Plane API key.",
            )
        if status == 429:
            raise HTTPException(
                status_code=502,
                detail="Plane API rate limit exceeded. Please retry later.",
            )
        raise HTTPException(
            status_code=502,
            detail=f"Plane API error: HTTP {status}.",
        )

    return SyncProjectsCyclesResponse(**result)
