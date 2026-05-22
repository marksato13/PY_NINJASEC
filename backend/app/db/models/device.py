from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    integration_id: Mapped[int | None] = mapped_column(
        ForeignKey("integrations.id"), nullable=True
    )
    hostname: Mapped[str] = mapped_column(String(150), nullable=False)
    vendor: Mapped[str | None] = mapped_column(String(80), nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="unknown")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Campos de inventario
    site_id: Mapped[int | None] = mapped_column(
        ForeignKey("client_sites.id"), nullable=True
    )
    asset_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    device_owner: Mapped[str | None] = mapped_column(String(160), nullable=True)
    # ISO 27001 A.8 / NIST CSF ID.AM — campos P1
    criticality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    data_classification: Mapped[str | None] = mapped_column(String(20), nullable=True)
    responsible_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    integration = relationship("Integration", back_populates="devices")
    reports = relationship("Report", back_populates="device")
    snapshots = relationship("CollectionSnapshot", back_populates="device")
    site = relationship("ClientSite", back_populates="devices")
    support_tickets = relationship("SupportTicket", back_populates="device")
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
