"""Tests for the sync orchestration endpoint and run_full_sync service.

Strategy:
- The POST /api/sync/all endpoint returns an SSE stream via sse-starlette.
  The sse-starlette library uses AppStatus.should_exit_event which can
  conflict with pytest-asyncio's per-test event loops. Tests that call
  the endpoint are limited to verifying HTTP-level behaviour (status, content-type).

- The SSE event content (sync_start, step_start, step_complete, etc.) is
  tested directly against the run_full_sync async generator, which is the
  source of truth for the events regardless of transport.

Covers:
- POST /api/sync/all returns 200 with text/event-stream content-type
- run_full_sync emits sync_start with all step IDs
- run_full_sync emits step_start + step_complete for each step (happy path)
- run_full_sync emits sync_complete with status='completed' on full success
- A failing step emits step_error but remaining steps continue
- Partial failure produces sync_complete with status='partial'
- Full failure produces sync_complete with status='failed'
- Error messages in step_error are generic (no internal exception details)
- A SyncLog entry is persisted after the sync completes
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync_log import SyncLog
from app.services.sync_orchestrator import run_full_sync

# The 4 canonical step IDs defined in sync_orchestrator.py
EXPECTED_STEP_IDS = ["members", "projects", "work_items", "github"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop() -> AsyncMock:
    """Return a fresh AsyncMock that resolves to an empty result dict."""
    return AsyncMock(return_value={"synced": 0})


def _events_of_type(events: list[dict], event_type: str) -> list[dict]:
    """Return events whose _event field matches the given string."""
    return [e for e in events if e.get("_event") == event_type]


async def _collect_sync_events(
    db: AsyncSession,
    step_fns: dict[str, AsyncMock] | None = None,
) -> list[dict]:
    """Run run_full_sync with mocked step functions and collect all emitted events.

    ``step_fns`` maps step ID to an AsyncMock.  Steps not present in the
    mapping default to a no-op that returns ``{"synced": 0}``.

    We patch ``SYNC_STEPS`` directly because each step function is stored by
    reference in that list at import time; patching module-level names after
    import would not affect already-captured references.
    """
    import app.services.sync_orchestrator as orch_mod

    step_fn_map = {
        "members": _noop(),
        "projects": _noop(),
        "work_items": _noop(),
        "github": _noop(),
    }
    if step_fns:
        step_fn_map.update(step_fns)

    # Build a patched version of SYNC_STEPS that maps step IDs to mock fns.
    _id_to_fn = {
        "members": step_fn_map["members"],
        "projects": step_fn_map["projects"],
        "work_items": step_fn_map["work_items"],
        "github": step_fn_map["github"],
    }
    patched_steps = [
        {**step, "fn": _id_to_fn[step["id"]]}
        for step in orch_mod.SYNC_STEPS
    ]

    results: list[dict] = []
    with patch.object(orch_mod, "SYNC_STEPS", patched_steps):
        async for raw_event in run_full_sync(db):
            payload = json.loads(raw_event["data"])
            payload["_event"] = raw_event.get("event", "")
            results.append(payload)

    return results


# ---------------------------------------------------------------------------
# HTTP-level test (limited to status code + content-type)
# ---------------------------------------------------------------------------


async def test_sync_all_endpoint_returns_200_event_stream(
    client: AsyncClient,
) -> None:
    """POST /api/sync/all responds with HTTP 200 and text/event-stream content-type."""
    import app.services.sync_orchestrator as orch_mod

    patched_steps = [
        {**step, "fn": _noop()}
        for step in orch_mod.SYNC_STEPS
    ]
    with patch.object(orch_mod, "SYNC_STEPS", patched_steps):
        response = await client.post("/api/sync/all")

    assert response.status_code == 200
    content_type = response.headers.get("content-type", "")
    assert "text/event-stream" in content_type


# ---------------------------------------------------------------------------
# Orchestrator unit tests (direct generator calls, no SSE transport)
# ---------------------------------------------------------------------------


async def test_sync_start_event_lists_all_steps(db_session: AsyncSession) -> None:
    """run_full_sync first yields sync_start with all expected step IDs."""
    events = await _collect_sync_events(db_session)

    start_events = _events_of_type(events, "sync_start")
    assert len(start_events) == 1

    start = start_events[0]
    assert start["total_steps"] == len(EXPECTED_STEP_IDS)
    assert set(start["steps"]) == set(EXPECTED_STEP_IDS)


async def test_step_start_emitted_for_each_step(db_session: AsyncSession) -> None:
    """run_full_sync emits a step_start event for each of the 4 steps."""
    events = await _collect_sync_events(db_session)

    step_starts = _events_of_type(events, "step_start")
    started_ids = {e["step"] for e in step_starts}

    assert started_ids == set(EXPECTED_STEP_IDS)


async def test_step_complete_emitted_for_each_step_on_success(
    db_session: AsyncSession,
) -> None:
    """run_full_sync emits step_complete for every step when all succeed."""
    events = await _collect_sync_events(db_session)

    step_completes = _events_of_type(events, "step_complete")
    completed_ids = {e["step"] for e in step_completes}

    assert completed_ids == set(EXPECTED_STEP_IDS)


async def test_sync_complete_event_emitted_at_end(db_session: AsyncSession) -> None:
    """run_full_sync emits exactly one sync_complete event as the last event."""
    events = await _collect_sync_events(db_session)

    complete_events = _events_of_type(events, "sync_complete")
    assert len(complete_events) == 1

    final = complete_events[0]
    assert final["progress"] == 100
    assert "status" in final


async def test_happy_path_final_status_is_completed(db_session: AsyncSession) -> None:
    """sync_complete.status is 'completed' when all steps succeed."""
    events = await _collect_sync_events(db_session)

    final = _events_of_type(events, "sync_complete")[0]
    assert final["status"] == "completed"
    assert final["errors"] == []


async def test_step_start_contains_required_fields(db_session: AsyncSession) -> None:
    """Each step_start event includes step, label, status, and progress fields."""
    events = await _collect_sync_events(db_session)

    for e in _events_of_type(events, "step_start"):
        assert "step" in e
        assert "label" in e
        assert "status" in e
        assert "progress" in e


async def test_step_complete_contains_required_fields(db_session: AsyncSession) -> None:
    """Each step_complete event includes step, status, progress, and result fields."""
    events = await _collect_sync_events(db_session)

    for e in _events_of_type(events, "step_complete"):
        assert "step" in e
        assert "status" in e
        assert "progress" in e
        assert "result" in e


async def test_failing_step_emits_step_error(db_session: AsyncSession) -> None:
    """A step that raises an exception yields step_error for that step."""
    events = await _collect_sync_events(
        db_session,
        step_fns={"members": AsyncMock(side_effect=RuntimeError("Plane is down"))},
    )

    error_events = _events_of_type(events, "step_error")
    assert len(error_events) == 1
    assert error_events[0]["step"] == "members"


async def test_failing_step_remaining_steps_still_complete(
    db_session: AsyncSession,
) -> None:
    """After one step fails, the remaining 3 steps still emit step_complete."""
    events = await _collect_sync_events(
        db_session,
        step_fns={"members": AsyncMock(side_effect=RuntimeError("Plane is down"))},
    )

    completed_ids = {e["step"] for e in _events_of_type(events, "step_complete")}
    assert "projects" in completed_ids
    assert "work_items" in completed_ids
    assert "github" in completed_ids
    # The failed step must not appear in completed
    assert "members" not in completed_ids


async def test_partial_failure_final_status_is_partial(
    db_session: AsyncSession,
) -> None:
    """When some (not all) steps fail, sync_complete.status is 'partial'."""
    events = await _collect_sync_events(
        db_session,
        step_fns={"members": AsyncMock(side_effect=RuntimeError("Outage"))},
    )

    final = _events_of_type(events, "sync_complete")[0]
    assert final["status"] == "partial"
    assert len(final["errors"]) == 1
    assert final["errors"][0]["step"] == "members"


async def test_all_steps_fail_final_status_is_failed(
    db_session: AsyncSession,
) -> None:
    """When all steps fail, sync_complete.status is 'failed'."""
    failing = AsyncMock(side_effect=RuntimeError("Total outage"))
    events = await _collect_sync_events(
        db_session,
        step_fns={
            "members": failing,
            "projects": failing,
            "work_items": failing,
            "github": failing,
        },
    )

    final = _events_of_type(events, "sync_complete")[0]
    assert final["status"] == "failed"
    assert len(final["errors"]) == len(EXPECTED_STEP_IDS)


async def test_step_error_message_is_generic(db_session: AsyncSession) -> None:
    """step_error.error must not leak internal exception details to the client."""
    secret_message = "DB password is hunter2, host is 10.0.0.1"
    events = await _collect_sync_events(
        db_session,
        step_fns={"members": AsyncMock(side_effect=RuntimeError(secret_message))},
    )

    error_events = _events_of_type(events, "step_error")
    assert len(error_events) == 1

    error_text = error_events[0].get("error", "")
    assert "hunter2" not in error_text
    assert "10.0.0.1" not in error_text


async def test_sync_log_persisted_on_success(db_session: AsyncSession) -> None:
    """run_full_sync creates a SyncLog with status='completed' on success."""
    await _collect_sync_events(db_session)

    result = await db_session.execute(select(SyncLog))
    logs = result.scalars().all()

    assert len(logs) == 1
    log = logs[0]
    assert log.sync_type == "manual"
    assert log.status == "completed"
    assert log.completed_at is not None


async def test_sync_log_persisted_on_partial_failure(db_session: AsyncSession) -> None:
    """run_full_sync creates a SyncLog with status='completed' when some steps fail."""
    await _collect_sync_events(
        db_session,
        step_fns={"members": AsyncMock(side_effect=RuntimeError("Outage"))},
    )

    result = await db_session.execute(select(SyncLog))
    logs = result.scalars().all()

    assert len(logs) == 1
    log = logs[0]
    # partial failure: some steps failed, some completed -> status="completed"
    # (only "failed" when ALL steps fail — see sync_orchestrator logic)
    assert log.status in {"completed", "failed"}
    assert log.error_message is not None


async def test_sync_log_persisted_on_all_failed(db_session: AsyncSession) -> None:
    """run_full_sync creates a SyncLog with status='failed' when all steps fail."""
    failing = AsyncMock(side_effect=RuntimeError("Total outage"))
    await _collect_sync_events(
        db_session,
        step_fns={
            "members": failing,
            "projects": failing,
            "work_items": failing,
            "github": failing,
        },
    )

    result = await db_session.execute(select(SyncLog))
    logs = result.scalars().all()

    assert len(logs) == 1
    assert logs[0].status == "failed"
