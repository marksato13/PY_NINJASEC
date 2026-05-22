from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import (
    ChecklistResult,
    FindingSeverity,
    FindingStatus,
    RecommendationStatus,
    ReviewStatus,
)


class SecurityReview(Base):
    __tablename__ = "security_reviews"
    __table_args__ = (
        Index("ix_security_reviews_client_status", "client_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"), nullable=False
    )
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    integration_id: Mapped[int] = mapped_column(
        ForeignKey("integrations.id"), nullable=False
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="review_status_enum"), default=ReviewStatus.SCHEDULED
    )
    reviewer_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    organization = relationship("Organization")
    client = relationship("Client", back_populates="security_reviews")
    integration = relationship("Integration", back_populates="security_reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_user_id])
    checklist_items = relationship(
        "ReviewChecklistItem", back_populates="review", cascade="all, delete-orphan"
    )
    findings = relationship(
        "ReviewFinding", back_populates="review", cascade="all, delete-orphan"
    )
    recommendations = relationship(
        "ReviewRecommendation", back_populates="review", cascade="all, delete-orphan"
    )
    attachments = relationship(
        "ReviewAttachment", back_populates="review", cascade="all, delete-orphan"
    )
    support_tickets = relationship("SupportTicket", back_populates="review")


class ReviewChecklistItem(Base):
    __tablename__ = "review_checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("security_reviews.id"), nullable=False
    )
    criteria: Mapped[str] = mapped_column(String(255), nullable=False)
    result: Mapped[ChecklistResult | None] = mapped_column(
        Enum(ChecklistResult, name="checklist_result_enum"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    review = relationship("SecurityReview", back_populates="checklist_items")


class ReviewFinding(Base):
    __tablename__ = "review_findings"
    __table_args__ = (
        Index("ix_review_findings_review_severity", "review_id", "severity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("security_reviews.id"), nullable=False
    )
    severity: Mapped[FindingSeverity] = mapped_column(
        Enum(FindingSeverity, name="finding_severity_enum"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[FindingStatus] = mapped_column(
        Enum(FindingStatus, name="finding_status_enum"), default=FindingStatus.OPEN
    )
    evidence_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    review = relationship("SecurityReview", back_populates="findings")
    recommendations = relationship("ReviewRecommendation", back_populates="finding")
    attachments = relationship("ReviewAttachment", back_populates="finding")
    support_tickets = relationship("SupportTicket", back_populates="finding")


class ReviewRecommendation(Base):
    __tablename__ = "review_recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("security_reviews.id"), nullable=False
    )
    finding_id: Mapped[int | None] = mapped_column(
        ForeignKey("review_findings.id"), nullable=True
    )
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[RecommendationStatus] = mapped_column(
        Enum(RecommendationStatus, name="recommendation_status_enum"),
        default=RecommendationStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    review = relationship("SecurityReview", back_populates="recommendations")
    finding = relationship("ReviewFinding", back_populates="recommendations")
    owner = relationship("User", foreign_keys=[owner_user_id])


class ReviewAttachment(Base):
    __tablename__ = "review_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("security_reviews.id"), nullable=False
    )
    finding_id: Mapped[int | None] = mapped_column(
        ForeignKey("review_findings.id"), nullable=True
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    review = relationship("SecurityReview", back_populates="attachments")
    finding = relationship("ReviewFinding", back_populates="attachments")
