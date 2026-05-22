from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id"), nullable=True)
    project_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("project_types.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    price_label: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    organization = relationship("Organization", back_populates="services")
    area = relationship("Area", back_populates="services")
    project_type = relationship("ProjectType", back_populates="services")
    requests = relationship("ServiceRequest", back_populates="service")
    client_services = relationship("ClientService", back_populates="service")
