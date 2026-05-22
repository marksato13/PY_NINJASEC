from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import ClientStatus


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(160), nullable=False)
    commercial_status: Mapped[ClientStatus] = mapped_column(
        Enum(ClientStatus, name="client_status_enum"), default=ClientStatus.PROSPECT
    )
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    organization = relationship("Organization", back_populates="clients")
    client_profiles = relationship("ClientProfile", back_populates="client")
    projects = relationship("Project", back_populates="client")
    integrations = relationship("Integration", back_populates="client")
    reports = relationship("Report", back_populates="client")
    service_requests = relationship("ServiceRequest", back_populates="client")
    sites = relationship("ClientSite", back_populates="client")
    contacts = relationship("ClientContact", back_populates="client")
    client_services = relationship("ClientService", back_populates="client")
    security_reviews = relationship("SecurityReview", back_populates="client")
    support_tickets = relationship("SupportTicket", back_populates="client")
