from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="enterprise")
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    users = relationship("User", back_populates="organization")
    clients = relationship("Client", back_populates="organization")
    services = relationship("Service", back_populates="organization")
    projects = relationship("Project", back_populates="organization")
    integrations = relationship("Integration", back_populates="organization")
    reports = relationship("Report", back_populates="organization")
    audit_logs = relationship("AuditLog", back_populates="organization")
    products = relationship("Product", back_populates="organization")
