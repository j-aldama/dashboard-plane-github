"""Orchestrator service for full synchronization with SSE progress events.

Runs all sync steps in order, emitting SSE-compatible event dicts for each
step start, completion, or error.  A step failure does NOT abort the remaining
steps — partial success is reported in the final event.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync_log import SyncLog
from app.redis_client import cache_delete, cache_set
from app.services.sync_github import sync_github
from app.services.sync_members import sync_members
from app.services.sync_projects import sync_projects_and_cycles
from app.services.sync_work_items import sync_work_items

logger = logging.getLogger(__name__)

SYNC_PROGRESS_KEY = "sync:progress"
SYNC_PROGRESS_TTL = 3600  # 1h safety net

SYNC_STEPS: list[dict[str, Any]] = [
    {"id": "members", "label": "Sincronizando miembros", "fn": sync_members},
    {
        "id": "projects",
        "label": "Sincronizando proyectos y ciclos",
        "fn": sync_projects_and_cycles,
    },
    {"id": "work_items", "label": "Sincronizando tareas", "fn": sync_work_items},
    {"id": "github", "label": "Sincronizando GitHub", "fn": sync_github},
]

# Per-step timeout — GitHub can take 20+ minutes for large orgs
STEP_TIMEOUTS: dict[str, int] = {
    "members": 120,
    "projects": 300,
    "work_items": 600,
    "github": 1800,
}
DEFAULT_TIMEOUT = 300


def _event(event_type: str, data: dict[str, Any]) -> dict[str, str]:
    """Build an SSE-compatible event dict."""
    return {"event": event_type, "data": json.dumps(data)}


async def _update_redis_progress(state: dict[str, Any]) -> None:
    """Persist current sync progress to Redis so polling clients can read it."""
    try:
        await cache_set(SYNC_PROGRESS_KEY, state, ttl=SYNC_PROGRESS_TTL)
    except Exception as exc:
        logger.warning("Failed to update sync progress in Redis: %s", exc)


async def _safe_rollback(db: AsyncSession) -> None:
    """Rollback the session, ignoring errors if already clean."""
    try:
        await db.rollback()
    except Exception:
        pass


async def run_full_sync(db: AsyncSession) -> AsyncGenerator[dict[str, str], None]:
    """Async generator that yields SSE event dicts for each sync step.

    Yields one ``sync_start`` event, then for each step a ``step_start``
    followed by either ``step_complete`` or ``step_error``, and finally a
    ``sync_complete`` event with the aggregated results.

    Errors in individual steps are logged internally; only a generic
    message is included in the SSE payload to avoid leaking internal
    details to clients.
    """
    # Create a running sync log entry
    sync_log = SyncLog(sync_type="manual", status="running")
    db.add(sync_log)
    await db.commit()
    await db.refresh(sync_log)
    sync_log_id = sync_log.id

    total_steps = len(SYNC_STEPS)
    results: dict[str, Any] = {}
    errors: list[dict[str, str]] = []

    # Build initial Redis progress state
    redis_steps = [
        {"id": s["id"], "label": s["label"], "status": "pending"}
        for s in SYNC_STEPS
    ]
    redis_state: dict[str, Any] = {
        "sync_log_id": sync_log_id,
        "status": "running",
        "progress": 0,
        "current_step": None,
        "steps": redis_steps,
    }
    await _update_redis_progress(redis_state)

    yield _event(
        "sync_start",
        {
            "total_steps": total_steps,
            "steps": [s["id"] for s in SYNC_STEPS],
        },
    )

    for i, step in enumerate(SYNC_STEPS):
        step_id: str = step["id"]
        step_label: str = step["label"]
        timeout = STEP_TIMEOUTS.get(step_id, DEFAULT_TIMEOUT)

        # Update Redis: step starting
        step_progress = int((i / total_steps) * 100)
        for rs in redis_state["steps"]:
            if rs["id"] == step_id:
                rs["status"] = "running"
        redis_state["current_step"] = step_id
        redis_state["progress"] = step_progress
        await _update_redis_progress(redis_state)

        yield _event(
            "step_start",
            {
                "step": step_id,
                "label": step_label,
                "status": "running",
                "progress": step_progress,
            },
        )

        try:
            result = await asyncio.wait_for(step["fn"](db), timeout=timeout)
            results[step_id] = result

            completed_progress = int(((i + 1) / total_steps) * 100)

            # Update Redis: step completed
            records = result.get("synced", 0) if isinstance(result, dict) else 0
            for rs in redis_state["steps"]:
                if rs["id"] == step_id:
                    rs["status"] = "completed"
                    rs["records_synced"] = records
            redis_state["progress"] = completed_progress
            await _update_redis_progress(redis_state)

            yield _event(
                "step_complete",
                {
                    "step": step_id,
                    "status": "completed",
                    "progress": completed_progress,
                    "result": result,
                },
            )

        except asyncio.TimeoutError:
            error_msg = f"Timeout after {timeout}s"
            logger.error("Sync step %s timed out after %ds", step_id, timeout)
            errors.append({"step": step_id, "error": error_msg})
            await _safe_rollback(db)

            error_progress = int(((i + 1) / total_steps) * 100)

            # Update Redis: step error
            for rs in redis_state["steps"]:
                if rs["id"] == step_id:
                    rs["status"] = "error"
                    rs["error"] = error_msg
            redis_state["progress"] = error_progress
            await _update_redis_progress(redis_state)

            yield _event(
                "step_error",
                {
                    "step": step_id,
                    "status": "error",
                    "progress": error_progress,
                    "error": error_msg,
                },
            )

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Sync step %s failed: %s",
                step_id,
                exc,
                exc_info=True,
            )
            errors.append({"step": step_id, "error": "Error en sincronización"})
            await _safe_rollback(db)

            error_progress = int(((i + 1) / total_steps) * 100)

            # Update Redis: step error
            for rs in redis_state["steps"]:
                if rs["id"] == step_id:
                    rs["status"] = "error"
                    rs["error"] = "Error en sincronización"
            redis_state["progress"] = error_progress
            await _update_redis_progress(redis_state)

            yield _event(
                "step_error",
                {
                    "step": step_id,
                    "status": "error",
                    "progress": error_progress,
                    # Generic message — do NOT expose internal exception details
                    "error": "Error en sincronización",
                },
            )

    # Persist sync log outcome — re-fetch after potential rollbacks
    try:
        from sqlalchemy import select

        result = await db.execute(
            select(SyncLog).where(SyncLog.id == sync_log_id)
        )
        sync_log = result.scalar_one()

        sync_log.completed_at = datetime.now(timezone.utc)
        if errors:
            sync_log.status = "failed" if len(errors) == total_steps else "completed"
            sync_log.error_message = json.dumps(errors)
        else:
            sync_log.status = "completed"

        await db.commit()
        duration = (sync_log.completed_at - sync_log.started_at).total_seconds()
        logger.info(
            "Sync log #%d finalised as %r in %.1fs",
            sync_log_id,
            sync_log.status,
            duration,
        )
    except Exception as exc:
        logger.error("Failed to persist sync log: %s", exc)
        await _safe_rollback(db)

    # Determine overall status for the final event
    if not errors:
        final_status = "completed"
    elif len(errors) < total_steps:
        final_status = "partial"
    else:
        final_status = "failed"

    # Clean up Redis progress key now that sync is done
    await cache_delete(SYNC_PROGRESS_KEY)

    yield _event(
        "sync_complete",
        {
            "status": final_status,
            "progress": 100,
            "results": results,
            "errors": errors,
        },
    )
