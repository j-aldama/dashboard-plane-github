from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class SyncSchedule(Base):
    """Stores the single-row configuration for the automatic sync schedule."""

    __tablename__ = "sync_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    scheduled_time: Mapped[str] = mapped_column(
        String(5), nullable=False
    )  # format "HH:MM"
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="America/Mexico_City"
    )
    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
