from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import RoleCode, UserStatus


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status_enum"), default=UserStatus.ACTIVE
    )
    role_code: Mapped[RoleCode] = mapped_column(
        Enum(RoleCode, name="role_code_enum"), nullable=False
    )
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    organization = relationship("Organization", back_populates="users")
    role = relationship("Role", back_populates="users")
    collaborator_profile = relationship(
        "CollaboratorProfile", back_populates="user", uselist=False
    )
    client_profile = relationship("ClientProfile", back_populates="user", uselist=False)
    project_memberships = relationship("ProjectMember", back_populates="user")
    skills = relationship(
        "UserSkill", back_populates="user", foreign_keys="UserSkill.user_id"
    )
    certifications = relationship(
        "UserCertification",
        back_populates="user",
        foreign_keys="UserCertification.user_id",
    )
    created_reports = relationship("Report", back_populates="created_by_user")
    audit_logs = relationship("AuditLog", back_populates="user")
    application_assignments = relationship(
        "ApplicationAssignment",
        back_populates="reviewer_user",
        foreign_keys="ApplicationAssignment.reviewer_user_id",
    )
    application_assignments_created = relationship(
        "ApplicationAssignment",
        back_populates="assigned_by_user",
        foreign_keys="ApplicationAssignment.assigned_by_user_id",
    )
    application_reviews = relationship(
        "ApplicationReview",
        back_populates="reviewer_user",
        foreign_keys="ApplicationReview.reviewer_user_id",
    )
    application_notes = relationship(
        "ApplicationNote",
        back_populates="author_user",
        foreign_keys="ApplicationNote.author_user_id",
    )
    application_attachments = relationship(
        "ApplicationAttachment",
        back_populates="uploaded_by_user",
        foreign_keys="ApplicationAttachment.uploaded_by_user_id",
    )
