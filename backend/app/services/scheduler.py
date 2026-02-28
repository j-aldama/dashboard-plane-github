"""APScheduler service for the automatic sync schedule.

Responsibilities:
- Start and stop the AsyncIOScheduler alongside the FastAPI lifespan.
- Load the persisted SyncSchedule row from the database on startup and
  register the cron job when enabled.
- Provide helpers called by the sync_schedule router to add, replace, or
  remove the scheduled job when the configuration changes.
- Execute run_full_sync as the scheduled function, creating its own
  database session and writing to sync_logs with sync_type="auto".
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.sync_log import SyncLog
from app.models.sync_schedule import SyncSchedule
from app.services.sync_orchestrator import run_full_sync

logger = logging.getLogger(__name__)

_JOB_ID = "auto_sync"

# Module-level scheduler instance shared across the application.
scheduler = AsyncIOScheduler()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_trigger(scheduled_time: str, tz: str) -> CronTrigger:
    """Build an APScheduler CronTrigger from a 'HH:MM' string and timezone."""
    hour, minute = scheduled_time.split(":")
    return CronTrigger(hour=int(hour), minute=int(minute), timezone=tz)


async def _run_auto_sync() -> None:
    """Async job executed by APScheduler at the scheduled time.

    Creates its own database session, drains the run_full_sync generator to
    completion, and records the outcome in sync_logs with sync_type='auto'.
    Errors are logged internally and never propagated to the scheduler so the
    job remains scheduled for the next occurrence.
    """
    logger.info("Auto-sync job started at %s", datetime.now(timezone.utc).isoformat())
    async with AsyncSessionLocal() as db:
        try:
            results: dict = {}
            errors: list = []

            async for event in run_full_sync(db):
                # run_full_sync already handles its own SyncLog with
                # sync_type="manual".  We drain the generator to let it finish
                # and capture the final sync_complete event so we can update
                # the last_run_at timestamp on the SyncSchedule row.
                if event.get("event") == "sync_complete":
                    import json as _json  # local to avoid shadowing module-level

                    payload = _json.loads(event["data"])
                    errors = payload.get("errors", [])
                    results = payload.get("results", {})

            # Update sync_type on the SyncLog to "auto".  The orchestrator
            # writes a record with sync_type="manual"; we correct it here so
            # that the logs table reflects the actual trigger type.
            result = await db.execute(
                select(SyncLog)
                .order_by(SyncLog.id.desc())
                .limit(1)
            )
            last_log = result.scalar_one_or_none()
            if last_log is not None:
                last_log.sync_type = "auto"

            # Update last_run_at on the schedule config row.
            sched_result = await db.execute(
                select(SyncSchedule).order_by(SyncSchedule.id).limit(1)
            )
            schedule_row = sched_result.scalar_one_or_none()
            if schedule_row is not None:
                schedule_row.last_run_at = datetime.now(timezone.utc)

            await db.commit()

            status = "failed" if errors and len(errors) == len(results) + len(errors) else (
                "partial" if errors else "completed"
            )
            logger.info(
                "Auto-sync job finished — status=%s errors=%d",
                status,
                len(errors),
            )

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Auto-sync job raised an unhandled exception: %s",
                exc,
                exc_info=True,
            )
            await db.rollback()

            # Persist a failed SyncLog entry for this auto run.
            try:
                async with AsyncSessionLocal() as error_db:
                    error_log = SyncLog(
                        sync_type="auto",
                        status="failed",
                        completed_at=datetime.now(timezone.utc),
                        error_message=json.dumps(
                            [{"step": "scheduler", "error": "Error en sincronización automática"}]
                        ),
                    )
                    error_db.add(error_log)
                    await error_db.commit()
            except Exception as inner_exc:  # noqa: BLE001
                logger.error(
                    "Could not persist failed auto-sync log: %s", inner_exc, exc_info=True
                )


# ---------------------------------------------------------------------------
# Public API used by the router and the FastAPI lifespan
# ---------------------------------------------------------------------------


def schedule_job(scheduled_time: str, tz: str) -> None:
    """Register (or replace) the auto-sync cron job on the running scheduler."""
    trigger = _build_trigger(scheduled_time, tz)
    if scheduler.get_job(_JOB_ID):
        scheduler.reschedule_job(_JOB_ID, trigger=trigger)
        logger.info(
            "Auto-sync job rescheduled — time=%s tz=%s", scheduled_time, tz
        )
    else:
        scheduler.add_job(
            _run_auto_sync,
            trigger=trigger,
            id=_JOB_ID,
            replace_existing=True,
            misfire_grace_time=300,  # 5 minutes tolerance
        )
        logger.info(
            "Auto-sync job added — time=%s tz=%s", scheduled_time, tz
        )


def remove_job() -> None:
    """Remove the auto-sync cron job if it exists."""
    if scheduler.get_job(_JOB_ID):
        scheduler.remove_job(_JOB_ID)
        logger.info("Auto-sync job removed")


def get_next_run_time() -> datetime | None:
    """Return the next scheduled run time (UTC-aware) or None if not scheduled."""
    job = scheduler.get_job(_JOB_ID)
    if job is None:
        return None
    next_run = job.next_run_time
    if next_run is None:
        return None
    return next_run.astimezone(timezone.utc)


async def start_scheduler(db: AsyncSession) -> None:
    """Start the APScheduler and restore the job from the database.

    Called from the FastAPI lifespan ``startup`` phase.  If a SyncSchedule
    row exists and is enabled, the cron job is registered before the
    scheduler starts.
    """
    try:
        result = await db.execute(
            select(SyncSchedule).order_by(SyncSchedule.id).limit(1)
        )
        schedule_row = result.scalar_one_or_none()

        if schedule_row is not None and schedule_row.enabled:
            schedule_job(schedule_row.scheduled_time, schedule_row.timezone)
            logger.info(
                "Restored auto-sync schedule from DB — time=%s tz=%s",
                schedule_row.scheduled_time,
                schedule_row.timezone,
            )
        else:
            logger.info(
                "No active auto-sync schedule found in DB — scheduler starts idle"
            )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Could not restore sync schedule from DB: %s", exc, exc_info=True
        )

    if not scheduler.running:
        scheduler.start()
        logger.info("APScheduler started")


def stop_scheduler() -> None:
    """Stop the APScheduler gracefully.

    Called from the FastAPI lifespan ``shutdown`` phase.
    """
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
