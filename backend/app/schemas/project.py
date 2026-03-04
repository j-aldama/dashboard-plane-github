"""Schemas for project management endpoints."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ProjectOut(BaseModel):
    id: int
    name: str
    identifier: str | None
    project_type: str
    is_archived: bool


class ProjectTypeUpdate(BaseModel):
    project_type: Literal["client", "support", "internal"]
