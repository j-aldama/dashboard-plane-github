from __future__ import annotations

from pydantic import BaseModel


class PersonTask(BaseModel):
    id: int
    title: str
    project: str
    state: str
    state_group: str
    points: int | None
    cycle: str | None
    is_bug: bool


class PersonPR(BaseModel):
    id: int
    title: str | None
    repo: str
    state: str
    merged_at: str | None
    created_at: str
    url: str | None


class WeeklyActivity(BaseModel):
    week: str
    commits: int


class PersonMetricsResponse(BaseModel):
    user_id: str
    display_name: str
    email: str | None
    github_username: str | None
    avatar_url: str | None
    completed_tasks: int
    completed_points: int
    active_tasks: int
    overdue_tasks: int
    bug_tasks: int
    assigned_tasks: list[PersonTask]


class PersonGitHubResponse(BaseModel):
    user_id: str
    github_username: str | None
    commits: int
    pull_requests: int
    prs_merged: int
    lines_added: int
    lines_deleted: int
    weekly_commits: list[WeeklyActivity]
    recent_prs: list[PersonPR]
