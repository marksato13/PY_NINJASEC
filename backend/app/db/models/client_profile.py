from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=False
    )
    position_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    access_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferences_json: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    client = relationship("Client", back_populates="client_profiles")
    user = relationship("User", back_populates="client_profile")
