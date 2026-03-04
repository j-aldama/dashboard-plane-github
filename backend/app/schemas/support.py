"""Schemas for support project management endpoints."""
from __future__ import annotations

from pydantic import BaseModel


class SupportProjectMetrics(BaseModel):
    id: int
    name: str
    identifier: str | None
    is_support: bool
    project_type: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int


class SupportMetricsResponse(BaseModel):
    projects: list[SupportProjectMetrics]
