from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


class OverviewMetrics(BaseModel):
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    total_points: int
    completed_points: int
    total_cycles: int
    active_cycles: int
    total_bugs: int


# ---------------------------------------------------------------------------
# Projects list
# ---------------------------------------------------------------------------


class ProjectMetrics(BaseModel):
    id: int
    name: str
    identifier: str | None
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    total_points: int
    completed_points: int
    total_bugs: int
    active_cycle: str | None
    is_support: bool
    project_type: str
    is_archived: bool
    project_start_date: date | None
    project_end_date: date | None


class ProjectsMetricsResponse(BaseModel):
    projects: list[ProjectMetrics]


# ---------------------------------------------------------------------------
# Project detail
# ---------------------------------------------------------------------------


class StateBreakdownItem(BaseModel):
    state: str
    count: int


class LabelBreakdownItem(BaseModel):
    label: str
    count: int


class WorkItemSummary(BaseModel):
    id: int
    plane_issue_id: str
    title: str
    state: str | None
    priority: str | None
    assignee_name: str | None


class ProjectDetail(BaseModel):
    id: int
    name: str
    identifier: str | None
    is_support: bool
    project_type: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    total_points: int
    completed_points: int
    total_bugs: int
    active_cycle: str | None
    is_archived: bool
    project_start_date: date | None
    project_end_date: date | None
    state_breakdown: list[StateBreakdownItem]
    label_breakdown: list[LabelBreakdownItem]
    bugs: list[WorkItemSummary]
    client_blocked: list[WorkItemSummary]
    pending_items: list[WorkItemSummary]


# ---------------------------------------------------------------------------
# Cycles list
# ---------------------------------------------------------------------------


class CycleMetrics(BaseModel):
    id: int
    name: str
    project_name: str
    project_id: int
    start_date: date | None
    end_date: date | None
    is_active: bool
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    total_points: int
    completed_points: int


class CyclesMetricsResponse(BaseModel):
    cycles: list[CycleMetrics]


# ---------------------------------------------------------------------------
# Cycle detail
# ---------------------------------------------------------------------------


class CycleDetail(BaseModel):
    id: int
    name: str
    project_name: str
    project_id: int
    start_date: date | None
    end_date: date | None
    is_active: bool
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    total_points: int
    completed_points: int
    tasks: list[WorkItemSummary]
