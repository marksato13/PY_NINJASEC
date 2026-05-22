from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ApplicationAssignment(Base):
    __tablename__ = "application_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("job_applications.id"), nullable=False
    )
    reviewer_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    assigned_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    role: Mapped[str | None] = mapped_column(String(40), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    application = relationship("JobApplication", back_populates="assignments")
    reviewer_user = relationship(
        "User",
        back_populates="application_assignments",
        foreign_keys=[reviewer_user_id],
    )
    assigned_by_user = relationship(
        "User",
        back_populates="application_assignments_created",
        foreign_keys=[assigned_by_user_id],
    )
