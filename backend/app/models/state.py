from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project


class State(Base, TimestampMixin):
    __tablename__ = "states"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plane_state_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    group: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    project: Mapped[Project] = relationship("Project")

    __table_args__ = (
        Index("ix_states_plane_state_id", "plane_state_id"),
        Index("ix_states_project_id", "project_id"),
    )
