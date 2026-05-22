from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CollectionSnapshot(Base):
    __tablename__ = "collection_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    integration_id: Mapped[int] = mapped_column(
        ForeignKey("integrations.id"), nullable=False
    )
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("devices.id"), nullable=True
    )
    snapshot_type: Mapped[str] = mapped_column(String(80), nullable=False)
    raw_payload: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    normalized_payload: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    integration = relationship("Integration", back_populates="snapshots")
    device = relationship("Device", back_populates="snapshots")
