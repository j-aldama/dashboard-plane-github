from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProjectStatusHistory(Base):
    """Tracks the status history of a Plane project over time."""

    __tablename__ = "project_status_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # status: green | yellow | red | blue
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    progress_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
