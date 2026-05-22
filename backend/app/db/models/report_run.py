from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ReportRun(Base):
    __tablename__ = "report_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    output_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary_json: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    report = relationship("Report", back_populates="runs")
