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
from app.services.sync_github import sync_github
from app.services.sync_members import sync_members
from app.services.sync_projects import sync_projects_and_cycles
from app.services.sync_work_items import sync_work_items

logger = logging.getLogger(__name__)

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

STEP_TIMEOUT = 120  # seconds per step


def _event(event_type: str, data: dict[str, Any]) -> dict[str, str]:
    """Build an SSE-compatible event dict."""
    return {"event": event_type, "data": json.dumps(data)}


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

    total_steps = len(SYNC_STEPS)
    results: dict[str, Any] = {}
    errors: list[dict[str, str]] = []

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

        yield _event(
            "step_start",
            {
                "step": step_id,
                "label": step_label,
                "status": "running",
                "progress": int((i / total_steps) * 100),
            },
        )

        try:
            result = await asyncio.wait_for(step["fn"](db), timeout=STEP_TIMEOUT)
            results[step_id] = result

            yield _event(
                "step_complete",
                {
                    "step": step_id,
                    "status": "completed",
                    "progress": int(((i + 1) / total_steps) * 100),
                    "result": result,
                },
            )

        except asyncio.TimeoutError:
            error_msg = f"Timeout after {STEP_TIMEOUT}s"
            logger.error("Sync step %s timed out after %ds", step_id, STEP_TIMEOUT)
            errors.append({"step": step_id, "error": error_msg})

            yield _event(
                "step_error",
                {
                    "step": step_id,
                    "status": "error",
                    "progress": int(((i + 1) / total_steps) * 100),
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

            yield _event(
                "step_error",
                {
                    "step": step_id,
                    "status": "error",
                    "progress": int(((i + 1) / total_steps) * 100),
                    # Generic message — do NOT expose internal exception details
                    "error": "Error en sincronización",
                },
            )

    # Persist sync log outcome
    sync_log.completed_at = datetime.now(timezone.utc)
    if errors:
        # All steps failed → "failed"; some steps failed → "completed" (partial)
        sync_log.status = "failed" if len(errors) == total_steps else "completed"
        sync_log.error_message = json.dumps(errors)
    else:
        sync_log.status = "completed"

    await db.commit()

    # Determine overall status for the final event
    if not errors:
        final_status = "completed"
    elif len(errors) < total_steps:
        final_status = "partial"
    else:
        final_status = "failed"

    yield _event(
        "sync_complete",
        {
            "status": final_status,
            "progress": 100,
            "results": results,
            "errors": errors,
        },
    )
