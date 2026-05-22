from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import ServiceRequestStatus


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id"), nullable=True
    )
    requester_name: Mapped[str] = mapped_column(String(150), nullable=False)
    requester_email: Mapped[str] = mapped_column(String(180), nullable=False)
    request_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[ServiceRequestStatus] = mapped_column(
        Enum(ServiceRequestStatus, name="service_request_status_enum"),
        default=ServiceRequestStatus.NEW,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    service = relationship("Service", back_populates="requests")
    client = relationship("Client", back_populates="service_requests")
