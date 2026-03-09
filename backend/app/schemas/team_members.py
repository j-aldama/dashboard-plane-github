from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator


class TeamMemberOut(BaseModel):
    id: int
    name: str
    email: str | None = None
    plane_user_id: str
    github_username: str | None = None
    avatar_url: str | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class GitHubOrgMemberOut(BaseModel):
    login: str
    avatar_url: str | None = None


class TeamMemberUpdate(BaseModel):
    """Payload for updating a team member's settings."""

    github_username: str | None = Field(
        default=None,
        max_length=39,
        description="GitHub username (1-39 chars, alphanumeric/hyphens). Empty string or null to unlink.",
    )
    is_active: bool | None = Field(
        default=None,
        description="Whether the member is active and visible in dashboards.",
    )

    @field_validator("github_username", mode="before")
    @classmethod
    def validate_github_username(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        if not re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$", v):
            msg = "GitHub username must contain only alphanumeric characters or hyphens"
            raise ValueError(msg)
        if "--" in v:
            msg = "GitHub username cannot contain consecutive hyphens"
            raise ValueError(msg)
        return v
