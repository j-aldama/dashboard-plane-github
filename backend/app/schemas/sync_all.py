"""Pydantic schemas for the SSE event payloads emitted by /api/sync/all.

These models are used for documentation and type-checking purposes only;
the actual SSE stream serialises data as JSON strings inside each event.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# sync_start
# ---------------------------------------------------------------------------


class SyncStartPayload(BaseModel):
    """Payload for the ``sync_start`` SSE event."""

    total_steps: int
    steps: list[str]


# ---------------------------------------------------------------------------
# step_start
# ---------------------------------------------------------------------------


class StepStartPayload(BaseModel):
    """Payload for the ``step_start`` SSE event."""

    step: str
    label: str
    status: str  # always "running"
    progress: int  # 0–100


# ---------------------------------------------------------------------------
# step_complete
# ---------------------------------------------------------------------------


class StepCompletePayload(BaseModel):
    """Payload for the ``step_complete`` SSE event."""

    step: str
    status: str  # always "completed"
    progress: int  # 0–100
    result: dict[str, Any]


# ---------------------------------------------------------------------------
# step_error
# ---------------------------------------------------------------------------


class StepErrorPayload(BaseModel):
    """Payload for the ``step_error`` SSE event."""

    step: str
    status: str  # always "error"
    progress: int  # 0–100
    error: str  # generic client-facing message


# ---------------------------------------------------------------------------
# sync_complete
# ---------------------------------------------------------------------------


class StepError(BaseModel):
    """Individual step error entry in the final ``sync_complete`` event."""

    step: str
    error: str


class SyncCompletePayload(BaseModel):
    """Payload for the ``sync_complete`` SSE event."""

    status: str  # "completed" | "partial" | "failed"
    progress: int  # always 100
    results: dict[str, Any]
    errors: list[StepError]
