from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.plane_snapshot import PlaneMetricsSnapshot
    from app.models.github_snapshot import GithubMetricsSnapshot


class TeamMember(Base):
    """Represents a team member with cross-platform identity mapping."""

    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    plane_member_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    github_username: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    plane_snapshots: Mapped[list[PlaneMetricsSnapshot]] = relationship(
        "PlaneMetricsSnapshot", back_populates="team_member", cascade="all, delete-orphan"
    )
    github_snapshots: Mapped[list[GithubMetricsSnapshot]] = relationship(
        "GithubMetricsSnapshot", back_populates="team_member", cascade="all, delete-orphan"
    )
