"""Router for the full synchronization SSE endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.services.sync_orchestrator import run_full_sync

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


@router.post("/sync/all")
async def sync_all_endpoint(db: AsyncSession = Depends(get_db)) -> EventSourceResponse:
    """Trigger a full synchronization and stream progress via SSE.

    The response is a text/event-stream that emits one event per sync step:

    - ``sync_start``   — fired once at the beginning with step list
    - ``step_start``   — fired when a step begins
    - ``step_complete``— fired on successful step completion
    - ``step_error``   — fired when a step fails (sync continues)
    - ``sync_complete``— fired once at the end with aggregated results

    Each event's ``data`` field is a JSON-encoded object.
    """

    async def event_generator():
        async for event in run_full_sync(db):
            yield event

    return EventSourceResponse(event_generator())
