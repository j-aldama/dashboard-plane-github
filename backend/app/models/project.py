from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.cycle import Cycle
    from app.models.work_item import WorkItem


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plane_project_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    identifier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_support: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    support_start_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    support_end_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    project_start_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    project_end_date: Mapped[Date | None] = mapped_column(Date, nullable=True)

    # Relationships
    cycles: Mapped[list[Cycle]] = relationship(
        "Cycle", back_populates="project"
    )
    work_items: Mapped[list[WorkItem]] = relationship(
        "WorkItem", back_populates="project"
    )

    __table_args__ = (
        Index("ix_projects_plane_project_id", "plane_project_id"),
    )
