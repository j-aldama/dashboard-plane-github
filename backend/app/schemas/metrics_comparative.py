"""Pydantic schemas for comparative metrics endpoint."""
from __future__ import annotations

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Rankings
# ---------------------------------------------------------------------------


class MemberRankings(BaseModel):
    tasks_completed: int
    points_completed: int
    avg_complexity: int
    active_workload: int
    overdue_tasks: int
    commits: int
    prs_merged: int
    lines_written: int


# ---------------------------------------------------------------------------
# Per-member comparative metrics
# ---------------------------------------------------------------------------


class MemberComparativeMetrics(BaseModel):
    id: int
    name: str
    avatar_url: str | None
    github_username: str | None
    tasks_completed: int
    points_completed: int
    avg_complexity: float
    active_workload: int
    overdue_tasks: int
    commits: int
    prs_merged: int
    lines_written: int
    rankings: MemberRankings


# ---------------------------------------------------------------------------
# Response envelope
# ---------------------------------------------------------------------------


class ComparativeMetricsResponse(BaseModel):
    members: list[MemberComparativeMetrics]
