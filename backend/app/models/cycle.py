from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.work_item import WorkItem


class Cycle(Base, TimestampMixin):
    __tablename__ = "cycles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), nullable=False, index=True
    )
    plane_cycle_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    project: Mapped[Project] = relationship("Project", back_populates="cycles")
    work_items: Mapped[list[WorkItem]] = relationship(
        "WorkItem", back_populates="cycle"
    )

    __table_args__ = (
        Index("ix_cycles_project_id", "project_id"),
        Index("ix_cycles_plane_cycle_id", "plane_cycle_id"),
    )
