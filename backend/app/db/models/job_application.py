from datetime import datetime

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import JobApplicationStatus


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(180), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    desired_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    skills_summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    cv_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[JobApplicationStatus] = mapped_column(
        Enum(JobApplicationStatus, name="job_application_status_enum"),
        default=JobApplicationStatus.NEW,
    )
    source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    assignments = relationship("ApplicationAssignment", back_populates="application")
    reviews = relationship("ApplicationReview", back_populates="application")
    notes = relationship("ApplicationNote", back_populates="application")
    attachments = relationship("ApplicationAttachment", back_populates="application")
    events = relationship("ApplicationEvent", back_populates="application")
