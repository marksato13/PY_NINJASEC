from datetime import datetime

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import DocScope


class DocType(Base):
    __tablename__ = "doc_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    scope: Mapped[DocScope] = mapped_column(
        Enum(DocScope, name="doc_scope_enum"),
        default=DocScope.BOTH,
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    docs = relationship("ProjectDoc", back_populates="doc_type")
