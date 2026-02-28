"""Router for reading and updating the automatic sync schedule configuration."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.sync_schedule import SyncSchedule
from app.schemas.sync_schedule import SyncScheduleResponse, SyncScheduleUpdate
from app.services.scheduler import get_next_run_time, remove_job, schedule_job

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_or_create_schedule(db: AsyncSession) -> SyncSchedule:
    """Return the first SyncSchedule row, creating a default one if absent."""
    result = await db.execute(
        select(SyncSchedule).order_by(SyncSchedule.id).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = SyncSchedule(
            enabled=False,
            scheduled_time="08:00",
            timezone="America/Mexico_City",
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _build_response(row: SyncSchedule) -> SyncScheduleResponse:
    """Merge the ORM row with the live next_run_at from the scheduler."""
    return SyncScheduleResponse(
        id=row.id,
        enabled=row.enabled,
        scheduled_time=row.scheduled_time,
        timezone=row.timezone,
        last_run_at=row.last_run_at,
        next_run_at=get_next_run_time() if row.enabled else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/sync/schedule", response_model=SyncScheduleResponse)
async def get_sync_schedule(
    db: AsyncSession = Depends(get_db),
) -> SyncScheduleResponse:
    """Return the current sync schedule configuration and next execution time.

    If no configuration row exists yet, a default disabled schedule is created
    and returned.
    """
    row = await _get_or_create_schedule(db)
    return _build_response(row)


@router.put("/sync/schedule", response_model=SyncScheduleResponse)
async def update_sync_schedule(
    body: SyncScheduleUpdate,
    db: AsyncSession = Depends(get_db),
) -> SyncScheduleResponse:
    """Update the sync schedule configuration and reschedule the job.

    - Setting ``enabled=true`` with a valid ``scheduled_time`` and ``timezone``
      registers (or replaces) the cron job.
    - Setting ``enabled=false`` removes the cron job without deleting the
      stored configuration.

    The ``scheduled_time`` must match ``HH:MM`` (00:00 – 23:59).
    The ``timezone`` must be a valid IANA timezone identifier.
    """
    row = await _get_or_create_schedule(db)

    row.enabled = body.enabled
    row.scheduled_time = body.scheduled_time
    row.timezone = body.timezone

    try:
        await db.commit()
        await db.refresh(row)
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        logger.error(
            "Failed to persist sync schedule update: %s", exc, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo guardar la configuración del schedule.",
        ) from exc

    # Sync the APScheduler job with the new configuration.
    if row.enabled:
        schedule_job(row.scheduled_time, row.timezone)
    else:
        remove_job()

    logger.info(
        "Sync schedule updated — enabled=%s time=%s tz=%s",
        row.enabled,
        row.scheduled_time,
        row.timezone,
    )

    return _build_response(row)
