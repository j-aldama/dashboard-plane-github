from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.team_member import TeamMember


class GithubMetricsSnapshot(Base):
    """Stores a point-in-time snapshot of GitHub metrics for a team member."""

    __tablename__ = "github_metrics_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_member_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prs_opened: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prs_merged: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prs_rejected: Mapped[int | None] = mapped_column(Integer, nullable=True)
    commits_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lines_added: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lines_deleted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    team_member: Mapped[TeamMember] = relationship(
        "TeamMember", back_populates="github_snapshots"
    )
