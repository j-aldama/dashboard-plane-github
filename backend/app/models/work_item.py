from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.cycle import Cycle
    from app.models.project import Project
    from app.models.team_member import TeamMember


class WorkItem(Base, TimestampMixin):
    __tablename__ = "work_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), nullable=False, index=True
    )
    cycle_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cycles.id"), nullable=True, index=True
    )
    assignee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("team_members.id"), nullable=True, index=True
    )
    plane_issue_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    state_group: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    estimate_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    label_names: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    is_bug: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_client_blocked: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    project: Mapped[Project] = relationship("Project", back_populates="work_items")
    cycle: Mapped[Cycle | None] = relationship("Cycle", back_populates="work_items")
    assignee: Mapped[TeamMember | None] = relationship(
        "TeamMember", back_populates="work_items"
    )

    __table_args__ = (
        Index("ix_work_items_project_id", "project_id"),
        Index("ix_work_items_cycle_id", "cycle_id"),
        Index("ix_work_items_assignee_id", "assignee_id"),
        Index("ix_work_items_state", "state"),
        Index("ix_work_items_plane_issue_id", "plane_issue_id"),
    )
