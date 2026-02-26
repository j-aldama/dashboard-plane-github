"""Pydantic schemas for GitHub API responses."""

from datetime import datetime

from pydantic import BaseModel, Field


class GitHubMemberMetrics(BaseModel):
    """Aggregated GitHub metrics for a single team member."""

    username: str
    name: str | None = None
    avatar_url: str | None = None
    prs_open: int = 0
    prs_merged: int = 0
    prs_rejected: int = 0
    commits_total: int = 0
    lines_added: int = 0
    lines_removed: int = 0
    lines_net: int = 0

    # Cross-platform mapping (populated when TeamMember link exists)
    team_member_id: int | None = None
    plane_member_id: str | None = None


class RankingEntry(BaseModel):
    """A single ranking position."""

    username: str
    value: int | float


class Rankings(BaseModel):
    """Rankings across key metrics."""

    by_prs_merged: list[RankingEntry] = Field(default_factory=list)
    by_commits: list[RankingEntry] = Field(default_factory=list)
    by_lines_net: list[RankingEntry] = Field(default_factory=list)


class TeamGitHubMetricsResponse(BaseModel):
    """Aggregated GitHub metrics for the full team."""

    members: list[GitHubMemberMetrics]
    rankings: Rankings
    period_start: str | None = None
    period_end: str | None = None
    last_updated: datetime
    is_cached: bool = False


class MemberDetailResponse(BaseModel):
    """Detailed GitHub metrics for a single member, including snapshot history."""

    username: str
    name: str | None = None
    avatar_url: str | None = None
    prs_open: int = 0
    prs_merged: int = 0
    prs_rejected: int = 0
    commits_total: int = 0
    lines_added: int = 0
    lines_removed: int = 0
    lines_net: int = 0

    # Historical snapshots
    history: list[dict] = Field(default_factory=list)

    # Cross-platform mapping
    team_member_id: int | None = None
    plane_member_id: str | None = None

    last_updated: datetime
    is_cached: bool = False


class RateLimitResponse(BaseModel):
    """GitHub API rate limit status."""

    limit: int = 0
    remaining: int = 0
    used: int = 0
    reset_at: datetime | None = None
