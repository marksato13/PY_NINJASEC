from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CollaboratorProfile(Base):
    __tablename__ = "collaborator_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=False
    )
    position_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(255), nullable=True)
    skills_json: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    seniority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    availability_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    area: Mapped[str | None] = mapped_column(String(60), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user = relationship("User", back_populates="collaborator_profile")
