from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id"), nullable=True
    )
    connector_type: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_type: Mapped[str] = mapped_column(String(50), default="token")
    config_json: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Campos de consola de seguridad
    environment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    license_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    license_expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    responsible_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    organization = relationship("Organization", back_populates="integrations")
    client = relationship("Client", back_populates="integrations")
    devices = relationship("Device", back_populates="integration")
    reports = relationship("Report", back_populates="integration")
    snapshots = relationship("CollectionSnapshot", back_populates="integration")
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    security_reviews = relationship("SecurityReview", back_populates="integration")
    support_tickets = relationship("SupportTicket", back_populates="integration")
