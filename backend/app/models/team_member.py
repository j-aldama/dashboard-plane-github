from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.github_commit import GitHubCommit
    from app.models.github_pull_request import GitHubPullRequest
    from app.models.work_item import WorkItem


class TeamMember(Base, TimestampMixin):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plane_user_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    github_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    work_items: Mapped[list[WorkItem]] = relationship(
        "WorkItem", back_populates="assignee"
    )
    github_commits: Mapped[list[GitHubCommit]] = relationship(
        "GitHubCommit", back_populates="team_member"
    )
    github_pull_requests: Mapped[list[GitHubPullRequest]] = relationship(
        "GitHubPullRequest", back_populates="team_member"
    )

    __table_args__ = (
        Index("ix_team_members_plane_user_id", "plane_user_id"),
    )
