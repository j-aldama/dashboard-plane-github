"""Pydantic schemas for the sync schedule configuration endpoints."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, field_validator

try:
    from zoneinfo import available_timezones

    _VALID_TIMEZONES: frozenset[str] = frozenset(available_timezones())
except ImportError:  # pragma: no cover — Python < 3.9 fallback
    import pytz  # type: ignore[import]

    _VALID_TIMEZONES = frozenset(pytz.all_timezones)

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class SyncScheduleUpdate(BaseModel):
    """Request body for PUT /api/sync/schedule."""

    enabled: bool
    scheduled_time: str
    timezone: str

    @field_validator("scheduled_time")
    @classmethod
    def validate_time_format(cls, value: str) -> str:
        if not _TIME_RE.match(value):
            raise ValueError(
                "scheduled_time must be in HH:MM format (00:00 – 23:59)"
            )
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        if value not in _VALID_TIMEZONES:
            raise ValueError(
                f"'{value}' is not a valid IANA timezone identifier"
            )
        return value


class SyncScheduleResponse(BaseModel):
    """Response body for GET and PUT /api/sync/schedule."""

    id: int
    enabled: bool
    scheduled_time: str
    timezone: str
    last_run_at: datetime | None
    next_run_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
