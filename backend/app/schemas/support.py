"""Schemas for support project management endpoints."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class SupportToggleRequest(BaseModel):
    """Payload for activating or deactivating support mode on a project."""

    activate: bool


class SupportToggleResponse(BaseModel):
    """Response returned after toggling support mode."""

    id: int
    name: str
    is_support: bool
    project_type: str
    support_start_date: date | None
    support_end_date: date | None


class SupportProjectMetrics(BaseModel):
    id: int
    name: str
    identifier: str | None
    is_support: bool
    project_type: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    is_active: bool
    days_remaining: int


class SupportMetricsResponse(BaseModel):
    projects: list[SupportProjectMetrics]
