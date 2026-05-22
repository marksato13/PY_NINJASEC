from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import ApplicationRecommendation


class ApplicationReview(Base):
    __tablename__ = "application_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("job_applications.id"), nullable=False
    )
    reviewer_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    recommendation: Mapped[ApplicationRecommendation] = mapped_column(
        Enum(ApplicationRecommendation, name="application_recommendation_enum"),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    application = relationship("JobApplication", back_populates="reviews")
    reviewer_user = relationship(
        "User",
        back_populates="application_reviews",
        foreign_keys=[reviewer_user_id],
    )
