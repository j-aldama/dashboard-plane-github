"""Schemas for support project management endpoints."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# PATCH /api/projects/{project_id}/support
# ---------------------------------------------------------------------------


class SupportToggleRequest(BaseModel):
    activate: bool


class SupportToggleResponse(BaseModel):
    id: int
    name: str
    identifier: str | None
    is_support: bool
    project_start_date: date | None
    project_end_date: date | None
    support_start_date: date | None
    support_end_date: date | None


# ---------------------------------------------------------------------------
# GET /api/metrics/support
# ---------------------------------------------------------------------------


class SupportProjectMetrics(BaseModel):
    id: int
    name: str
    identifier: str | None
    project_start_date: date | None
    project_end_date: date | None
    support_start_date: date | None
    support_end_date: date | None
    days_remaining: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    is_active: bool


class SupportMetricsResponse(BaseModel):
    projects: list[SupportProjectMetrics]
