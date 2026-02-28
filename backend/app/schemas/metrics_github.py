from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class GitHubOverviewResponse(BaseModel):
    total_commits: int
    total_prs: int
    total_prs_merged: int
    total_lines_added: int
    total_lines_removed: int


class GitHubUserMetrics(BaseModel):
    user_id: int
    name: str
    github_username: str | None
    commits: int
    prs: int
    prs_merged: int
    lines_added: int
    lines_removed: int


class GitHubByUserResponse(BaseModel):
    users: list[GitHubUserMetrics]


class GitHubRepoMetrics(BaseModel):
    repo_name: str
    commits: int
    prs: int
    prs_merged: int
    lines_added: int
    lines_removed: int


class GitHubByRepoResponse(BaseModel):
    repos: list[GitHubRepoMetrics]


class GitHubActivityEntry(BaseModel):
    date: date
    commits: int
    prs: int
    lines_added: int
    lines_removed: int


class GitHubActivityResponse(BaseModel):
    activity: list[GitHubActivityEntry]
