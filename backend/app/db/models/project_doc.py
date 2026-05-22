from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import DocStatus, DocVisibility


class ProjectDoc(Base):
    __tablename__ = "project_docs"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    doc_type_id: Mapped[int] = mapped_column(ForeignKey("doc_types.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str | None] = mapped_column(String(400), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preview_md: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    visibility: Mapped[DocVisibility] = mapped_column(
        Enum(DocVisibility, name="doc_visibility_enum"),
        default=DocVisibility.INTERNAL,
    )
    status: Mapped[DocStatus] = mapped_column(
        Enum(DocStatus, name="doc_status_enum"),
        default=DocStatus.DRAFT,
    )
    enabled: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    verified_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project = relationship("Project", back_populates="docs")
    doc_type = relationship("DocType", back_populates="docs")
    created_by_user = relationship("User", foreign_keys=[created_by])
    updated_by_user = relationship("User", foreign_keys=[updated_by])
    verified_by_user = relationship("User", foreign_keys=[verified_by])
