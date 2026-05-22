from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ApplicationAttachment(Base):
    __tablename__ = "application_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("job_applications.id"), nullable=False
    )
    file_url: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    uploaded_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    application = relationship("JobApplication", back_populates="attachments")
    uploaded_by_user = relationship(
        "User",
        back_populates="application_attachments",
        foreign_keys=[uploaded_by_user_id],
    )
