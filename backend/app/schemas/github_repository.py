from __future__ import annotations

from pydantic import BaseModel, Field


class GitHubRepoOut(BaseModel):
    id: int
    repo_name: str
    is_active: bool

    model_config = {"from_attributes": True}


class GitHubRepoUpdate(BaseModel):
    is_active: bool = Field(description="Whether the repository is active in metrics")
