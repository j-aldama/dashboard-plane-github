from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.team_member import TeamMember


class PlaneMetricsSnapshot(Base):
    """Historical snapshot of Plane metrics for a team member in a given cycle."""

    __tablename__ = "plane_metrics_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_member_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cycle_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    story_points_completed: Mapped[float | None] = mapped_column(Float, nullable=True)
    tasks_completed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tasks_assigned: Mapped[int | None] = mapped_column(Integer, nullable=True)
    priority_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    team_member: Mapped[TeamMember] = relationship(
        "TeamMember", back_populates="plane_snapshots"
    )
