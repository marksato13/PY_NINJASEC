from datetime import datetime

from app.common.schemas.base import ORMModel


class ChecklistItemRead(ORMModel):
    id: int
    review_id: int
    criteria: str
    result: str | None = None
    notes: str | None = None


class ChecklistItemCreate(ORMModel):
    criteria: str
    result: str | None = None
    notes: str | None = None


class FindingRead(ORMModel):
    id: int
    review_id: int
    severity: str
    title: str
    description: str | None = None
    status: str
    evidence_url: str | None = None
    created_at: datetime


class FindingCreate(ORMModel):
    severity: str
    title: str
    description: str | None = None
    evidence_url: str | None = None
    recommendation: str | None = None
    recommendation_owner_user_id: int | None = None
    recommendation_due_date: datetime | None = None
    create_ticket: bool = False
    ticket_priority: str | None = None
    ticket_assigned_to: int | None = None
    ticket_category: str | None = None
    ticket_description_override: str | None = None


class FindingUpdate(ORMModel):
    severity: str | None = None
    title: str | None = None
    description: str | None = None
    status: str | None = None
    evidence_url: str | None = None


class RecommendationRead(ORMModel):
    id: int
    review_id: int
    finding_id: int | None = None
    recommendation: str
    owner_user_id: int | None = None
    due_date: datetime | None = None
    status: str


class RecommendationCreate(ORMModel):
    finding_id: int | None = None
    recommendation: str
    owner_user_id: int | None = None
    due_date: datetime | None = None


class AttachmentRead(ORMModel):
    id: int
    review_id: int
    finding_id: int | None = None
    file_url: str
    filename: str
    uploaded_at: datetime


class AttachmentCreate(ORMModel):
    finding_id: int | None = None
    file_url: str
    filename: str


class SecurityReviewRead(ORMModel):
    id: int
    organization_id: int
    client_id: int
    integration_id: int
    scheduled_at: datetime | None = None
    executed_at: datetime | None = None
    status: str
    reviewer_user_id: int | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    findings_count: int = 0
    critical_findings_count: int = 0


class SecurityReviewDetail(SecurityReviewRead):
    checklist_items: list[ChecklistItemRead] = []
    findings: list[FindingRead] = []
    recommendations: list[RecommendationRead] = []
    attachments: list[AttachmentRead] = []


class SecurityReviewCreate(ORMModel):
    client_id: int
    integration_id: int
    scheduled_at: datetime | None = None
    reviewer_user_id: int | None = None
    notes: str | None = None


class SecurityReviewUpdate(ORMModel):
    scheduled_at: datetime | None = None
    executed_at: datetime | None = None
    status: str | None = None
    reviewer_user_id: int | None = None
    notes: str | None = None
