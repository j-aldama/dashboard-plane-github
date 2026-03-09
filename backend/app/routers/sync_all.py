"""Router for the full synchronization SSE endpoint."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.models.sync_log import SyncLog
from app.rate_limit import check_rate_limit
from app.redis_client import cache_get
from app.schemas.sync_status import LastSyncInfo, SyncStepStatus, SyncStatusResponse
from app.services.sync_orchestrator import SYNC_PROGRESS_KEY, run_full_sync

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


@router.get("/sync/status")
async def sync_status_endpoint(
    db: AsyncSession = Depends(get_db),
) -> SyncStatusResponse:
    """Return current sync status and last sync info."""

    # Check if a sync is currently running
    running_stmt = (
        select(SyncLog)
        .where(SyncLog.status == "running")
        .order_by(SyncLog.started_at.desc())
        .limit(1)
    )
    running_result = await db.execute(running_stmt)
    running_log = running_result.scalar_one_or_none()

    # Get last completed/failed sync
    last_stmt = (
        select(SyncLog)
        .where(SyncLog.status.in_(["completed", "failed"]))
        .order_by(SyncLog.started_at.desc())
        .limit(1)
    )
    last_result = await db.execute(last_stmt)
    last_log = last_result.scalar_one_or_none()

    last_sync: LastSyncInfo | None = None
    if last_log:
        duration = None
        if last_log.completed_at and last_log.started_at:
            duration = (last_log.completed_at - last_log.started_at).total_seconds()

        error_count = 0
        if last_log.error_message:
            try:
                errors = json.loads(last_log.error_message)
                error_count = len(errors) if isinstance(errors, list) else 1
            except (json.JSONDecodeError, TypeError):
                error_count = 1

        last_sync = LastSyncInfo(
            id=last_log.id,
            status=last_log.status,
            started_at=last_log.started_at,
            completed_at=last_log.completed_at,
            duration_seconds=duration,
            error_count=error_count,
        )

    # When sync is running, read detailed progress from Redis
    progress = 0
    current_step = None
    steps: list[SyncStepStatus] = []

    if running_log is not None:
        redis_progress = await cache_get(SYNC_PROGRESS_KEY)
        if redis_progress and isinstance(redis_progress, dict):
            progress = redis_progress.get("progress", 0)
            current_step = redis_progress.get("current_step")
            raw_steps = redis_progress.get("steps", [])
            steps = [
                SyncStepStatus(
                    id=s.get("id", ""),
                    label=s.get("label", ""),
                    status=s.get("status", "pending"),
                    records_synced=s.get("records_synced"),
                    error=s.get("error"),
                )
                for s in raw_steps
                if isinstance(s, dict)
            ]

    return SyncStatusResponse(
        is_running=running_log is not None,
        progress=progress if running_log else 100,
        current_step=current_step,
        started_at=running_log.started_at if running_log else None,
        steps=steps,
        last_sync=last_sync,
    )


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

    check_rate_limit("sync_all")

    async def event_generator():
        async for event in run_full_sync(db):
            yield event

    return EventSourceResponse(event_generator())
