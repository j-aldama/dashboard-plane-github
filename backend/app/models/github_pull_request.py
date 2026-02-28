from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.team_member import TeamMember


class GitHubPullRequest(Base, TimestampMixin):
    __tablename__ = "github_pull_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id"), nullable=False, index=True
    )
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    merged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    team_member: Mapped[TeamMember] = relationship(
        "TeamMember", back_populates="github_pull_requests"
    )

    __table_args__ = (
        UniqueConstraint("repo_name", "pr_number", name="uq_github_pull_requests_repo_pr"),
        Index("ix_github_pull_requests_team_member_id", "team_member_id"),
        Index("ix_github_pull_requests_repo_name", "repo_name"),
    )
