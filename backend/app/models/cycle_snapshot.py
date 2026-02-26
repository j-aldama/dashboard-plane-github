from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CycleSnapshot(Base):
    """Snapshot of cycle-level metrics at a point in time."""

    __tablename__ = "cycle_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cycle_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cycle_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tasks_assigned: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tasks_completed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
