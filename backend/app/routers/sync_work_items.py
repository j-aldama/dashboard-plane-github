import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import httpx

from app.database import get_db
from app.schemas.sync_work_items import SyncWorkItemsResponse
from app.services.sync_work_items import sync_work_items

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


@router.post("/sync/work-items", response_model=SyncWorkItemsResponse)
async def sync_work_items_endpoint(
    db: AsyncSession = Depends(get_db),
) -> SyncWorkItemsResponse:
    """Trigger a full sync of Plane work items (issues) into the local database.

    Iterates over all locally-known projects, fetches their issues from
    the Plane API with full pagination, and upserts each one keyed on
    ``plane_issue_id``.
    """
    try:
        result = await sync_work_items(db)
    except httpx.TimeoutException:
        logger.error("Plane API timed out during work items sync")
        raise HTTPException(
            status_code=504,
            detail="Plane API timed out. Please retry later.",
        )
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        logger.error("Plane API returned HTTP %s during work items sync", status)
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

    return SyncWorkItemsResponse(**result)
