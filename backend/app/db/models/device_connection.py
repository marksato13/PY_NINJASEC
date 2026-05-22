from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DeviceConnection(Base):
    __tablename__ = "device_connections"
    __table_args__ = (
        UniqueConstraint("source_device_id", "target_device_id", "link_type", name="uq_device_connection_triplet"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    target_device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    link_type: Mapped[str] = mapped_column(String(30), nullable=False, default="ethernet")
    port_source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    port_target: Mapped[str | None] = mapped_column(String(40), nullable=True)
    vlan_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bandwidth_mbps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    source_device = relationship("Device", foreign_keys=[source_device_id])
    target_device = relationship("Device", foreign_keys=[target_device_id])
