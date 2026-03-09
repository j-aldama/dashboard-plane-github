from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SyncStepStatus(BaseModel):
    id: str
    label: str
    status: str  # pending | running | completed | error
    records_synced: int | None = None
    error: str | None = None


class LastSyncInfo(BaseModel):
    id: int
    status: str
    started_at: datetime
    completed_at: datetime | None = None
    duration_seconds: float | None = None
    error_count: int = 0


class SyncStatusResponse(BaseModel):
    is_running: bool
    progress: int
    current_step: str | None = None
    started_at: datetime | None = None
    steps: list[SyncStepStatus] = []
    last_sync: LastSyncInfo | None = None
