from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import TicketLinkEntity, TicketPriority, TicketStatus


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        Index("ix_support_tickets_client_status", "client_id", "status"),
        Index("ix_support_tickets_org_opened", "organization_id", "opened_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    integration_id: Mapped[int | None] = mapped_column(
        ForeignKey("integrations.id"), nullable=True
    )
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("devices.id"), nullable=True
    )
    review_id: Mapped[int | None] = mapped_column(
        ForeignKey("security_reviews.id"), nullable=True
    )
    finding_id: Mapped[int | None] = mapped_column(
        ForeignKey("review_findings.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum"), nullable=False
    )
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum"), default=TicketStatus.OPEN
    )
    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    organization = relationship("Organization")
    client = relationship("Client", back_populates="support_tickets")
    integration = relationship("Integration", back_populates="support_tickets")
    device = relationship("Device", back_populates="support_tickets")
    review = relationship("SecurityReview", back_populates="support_tickets")
    finding = relationship("ReviewFinding", back_populates="support_tickets")
    assignee = relationship("User", foreign_keys=[assigned_to])
    events = relationship(
        "SupportTicketEvent", back_populates="ticket", cascade="all, delete-orphan"
    )
    links = relationship(
        "TicketLink", back_populates="ticket", cascade="all, delete-orphan"
    )


class SupportTicketEvent(Base):
    __tablename__ = "support_ticket_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("support_tickets.id"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ticket = relationship("SupportTicket", back_populates="events")
    user = relationship("User", foreign_keys=[user_id])


class TicketLink(Base):
    __tablename__ = "ticket_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("support_tickets.id"), nullable=False
    )
    entity_type: Mapped[TicketLinkEntity] = mapped_column(
        Enum(TicketLinkEntity, name="ticket_link_entity_enum"), nullable=False
    )
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)

    ticket = relationship("SupportTicket", back_populates="links")
