from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.team_member import TeamMember


class GitHubCommit(Base):
    __tablename__ = "github_commits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id"), nullable=False, index=True
    )
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sha: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    lines_added: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lines_removed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    committed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    team_member: Mapped[TeamMember] = relationship(
        "TeamMember", back_populates="github_commits"
    )

    __table_args__ = (
        Index("ix_github_commits_team_member_id", "team_member_id"),
        Index("ix_github_commits_repo_name", "repo_name"),
    )
