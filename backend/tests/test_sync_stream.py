"""Tests for the sync router: POST /api/sync and POST /api/sync/stream."""

import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

# Expected step IDs emitted during a full sync stream.
EXPECTED_STEPS = [
    "clear_cache",
    "fetch_plane_metrics",
    "fetch_plane_projects",
    "fetch_plane_cycles",
    "fetch_github_metrics",
]


def _parse_sse_events(raw: str) -> list[dict]:
    """Parse a raw SSE text body into a list of JSON data payloads."""
    events: list[dict] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("data: "):
            payload = stripped[len("data: "):]
            events.append(json.loads(payload))
    return events


# --------------------------------------------------------------------------- #
# 1. POST /api/sync/stream returns 200 with text/event-stream content-type
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_sync_stream_returns_event_stream(client):
    """POST /api/sync/stream should return 200 with Content-Type text/event-stream."""
    mock_plane = MagicMock()
    mock_plane.return_value.get_team_metrics = AsyncMock(return_value={})
    mock_plane.return_value.get_projects = AsyncMock(return_value=[])
    mock_plane.return_value.get_cycles = AsyncMock(return_value=[])

    mock_github = MagicMock()
    mock_github.return_value.get_team_metrics = AsyncMock(return_value={})

    with (
        patch("app.routers.sync.PlaneService", mock_plane),
        patch("app.routers.sync.GitHubService", mock_github),
    ):
        response = await client.post("/api/sync/stream")

    assert response.status_code == 200
    content_type = response.headers.get("content-type", "")
    assert "text/event-stream" in content_type


# --------------------------------------------------------------------------- #
# 2. Stream emits events for all 5 steps in order (happy path)
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_sync_stream_emits_all_steps(client):
    """All 5 sync steps should appear as in_progress + completed events."""
    mock_plane = MagicMock()
    mock_plane.return_value.get_team_metrics = AsyncMock(return_value={})
    mock_plane.return_value.get_projects = AsyncMock(return_value=[])
    mock_plane.return_value.get_cycles = AsyncMock(return_value=[])

    mock_github = MagicMock()
    mock_github.return_value.get_team_metrics = AsyncMock(return_value={})

    with (
        patch("app.routers.sync.PlaneService", mock_plane),
        patch("app.routers.sync.GitHubService", mock_github),
    ):
        response = await client.post("/api/sync/stream")

    events = _parse_sse_events(response.text)
    assert len(events) > 0, "Expected at least one SSE event"

    # Collect all step IDs that had an in_progress event.
    in_progress_steps = [e["step"] for e in events if e.get("status") == "in_progress"]
    completed_steps = [e["step"] for e in events if e.get("status") == "completed" and e["step"] != "complete"]

    for step_id in EXPECTED_STEPS:
        assert step_id in in_progress_steps, f"Step '{step_id}' missing in_progress event"
        assert step_id in completed_steps, f"Step '{step_id}' missing completed event"

    # Order should be preserved.
    assert in_progress_steps == EXPECTED_STEPS

    # Final event must be the summary with step == "complete".
    final = events[-1]
    assert final["step"] == "complete"
    assert final["progress"] == 100
    assert final["summary"]["successful_count"] == 5
    assert final["summary"]["failed_count"] == 0


# --------------------------------------------------------------------------- #
# 3. Stream handles a service failure but continues remaining steps
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_sync_stream_handles_service_failure(client):
    """If one service raises, the step emits an error but remaining steps still run."""
    mock_plane = MagicMock()
    # get_team_metrics will raise to simulate failure in fetch_plane_metrics.
    mock_plane.return_value.get_team_metrics = AsyncMock(
        side_effect=RuntimeError("Plane API unreachable"),
    )
    mock_plane.return_value.get_projects = AsyncMock(return_value=[])
    mock_plane.return_value.get_cycles = AsyncMock(return_value=[])

    mock_github = MagicMock()
    mock_github.return_value.get_team_metrics = AsyncMock(return_value={})

    with (
        patch("app.routers.sync.PlaneService", mock_plane),
        patch("app.routers.sync.GitHubService", mock_github),
    ):
        response = await client.post("/api/sync/stream")

    assert response.status_code == 200

    events = _parse_sse_events(response.text)

    # fetch_plane_metrics should have emitted an error event.
    plane_metrics_events = [e for e in events if e["step"] == "fetch_plane_metrics"]
    statuses = [e["status"] for e in plane_metrics_events]
    assert "error" in statuses, "fetch_plane_metrics should have an error event"

    # The steps after the failure should still have run.
    projects_completed = any(
        e["step"] == "fetch_plane_projects" and e["status"] == "completed"
        for e in events
    )
    assert projects_completed, "fetch_plane_projects should still complete after earlier failure"

    github_completed = any(
        e["step"] == "fetch_github_metrics" and e["status"] == "completed"
        for e in events
    )
    assert github_completed, "fetch_github_metrics should still complete after earlier failure"

    # Summary should reflect the failure.
    final = events[-1]
    assert final["step"] == "complete"
    assert "fetch_plane_metrics" in final["summary"]["failed"]
    assert final["summary"]["failed_count"] == 1
    assert final["summary"]["successful_count"] == 4


# --------------------------------------------------------------------------- #
# 4. POST /api/sync (original endpoint) returns JSON with status ok
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_original_sync_endpoint_still_works(client):
    """POST /api/sync should return 200 with JSON containing status: ok."""
    response = await client.post("/api/sync")

    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert "deleted_keys" in body
    assert isinstance(body["deleted_keys"], int)
    assert "message" in body
