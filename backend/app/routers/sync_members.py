import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.sync_members import SyncMembersResponse
from app.services.sync_members import sync_members

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


@router.post("/sync/members", response_model=SyncMembersResponse)
async def sync_members_endpoint(
    db: AsyncSession = Depends(get_db),
) -> SyncMembersResponse:
    result = await sync_members(db)
    return SyncMembersResponse(**result)
