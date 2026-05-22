from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import AssignmentType


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    project_role: Mapped[str | None] = mapped_column(String(80), nullable=True)
    role_in_project: Mapped[str | None] = mapped_column(String(80), nullable=True)
    allocation_percentage: Mapped[int | None] = mapped_column(nullable=True)
    can_publish_docs: Mapped[bool] = mapped_column(Boolean, default=False)
    assignment_type: Mapped[AssignmentType] = mapped_column(
        Enum(AssignmentType, name="assignment_type_enum"),
        default=AssignmentType.MANUAL,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")
