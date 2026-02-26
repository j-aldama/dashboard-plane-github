"""Pydantic schemas for Plane API responses."""

from datetime import date, datetime

from pydantic import BaseModel


class TeamMemberMetrics(BaseModel):
    """Metrics for a single team member."""

    member_id: str
    name: str
    avatar_url: str | None = None
    story_points_completed: float = 0.0
    tasks_completed: int = 0
    tasks_assigned: int = 0
    priority_avg: float = 0.0
    relative_effort: float = 0.0


class TeamMetricsResponse(BaseModel):
    """Aggregated team metrics response."""

    members: list[TeamMemberMetrics]
    total_story_points: float = 0.0
    total_tasks_completed: int = 0
    last_updated: datetime
    is_cached: bool = False


class ProjectInfo(BaseModel):
    """Information about a single Plane project."""

    project_id: str
    name: str
    project_type: str  # "dev" | "support"
    status: str  # "green" | "yellow" | "red" | "blue"
    progress_pct: float = 0.0
    start_date: date | None = None
    end_date: date | None = None
    member_count: int = 0


class ProjectsResponse(BaseModel):
    """List of projects with metadata."""

    projects: list[ProjectInfo]
    last_updated: datetime
    is_cached: bool = False


class CycleInfo(BaseModel):
    """Information about a single cycle."""

    cycle_id: str
    cycle_name: str
    project_name: str = ""
    start_date: date | None = None
    end_date: date | None = None
    tasks_assigned: int = 0
    tasks_completed: int = 0
    completion_rate: float = 0.0
    is_active: bool = False


class CyclesResponse(BaseModel):
    """List of cycles with metadata."""

    cycles: list[CycleInfo]
    last_updated: datetime
    is_cached: bool = False


class MemberCyclePerformance(BaseModel):
    """Performance metrics for a member within a specific cycle."""

    member_id: str
    name: str
    avatar_url: str | None = None
    points_completed: float = 0.0
    tasks_completed: int = 0
    tasks_assigned: int = 0
    max_task_complexity: float = 0.0
    avg_task_complexity: float = 0.0


class CycleAnalysisResponse(BaseModel):
    """Detailed analysis of a specific cycle."""

    cycle_id: str
    cycle_name: str
    completion_rate: float = 0.0
    members: list[MemberCyclePerformance]
    rankings: dict = {}
    last_updated: datetime
    is_cached: bool = False
