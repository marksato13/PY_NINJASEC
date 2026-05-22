from datetime import datetime

from pydantic import BaseModel

from app.common.schemas.base import ORMModel


class TicketEventRead(ORMModel):
    id: int
    ticket_id: int
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    user_id: int | None = None
    notes: str | None = None
    created_at: datetime


class TicketEventCreate(ORMModel):
    event_type: str
    notes: str | None = None


class SupportTicketRead(ORMModel):
    id: int
    organization_id: int
    client_id: int
    integration_id: int | None = None
    device_id: int | None = None
    review_id: int | None = None
    finding_id: int | None = None
    title: str
    description: str | None = None
    category: str | None = None
    priority: str
    status: str
    assigned_to: int | None = None
    resolution: str | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SupportTicketDetail(SupportTicketRead):
    events: list[TicketEventRead] = []


class SupportTicketCreate(ORMModel):
    client_id: int | None = None
    integration_id: int | None = None
    device_id: int | None = None
    review_id: int | None = None
    finding_id: int | None = None
    title: str
    description: str | None = None
    category: str | None = None
    priority: str
    assigned_to: int | None = None


class SupportTicketUpdate(ORMModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None
    status: str | None = None
    assigned_to: int | None = None
    resolution: str | None = None


class TicketImportRow(BaseModel):
    """Fila parseada de Excel durante importación."""
    row: int
    client_id: int
    title: str
    priority: str
    description: str | None = None
    category: str | None = None
    integration_id: int | None = None
    device_id: int | None = None


class TicketImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[str] = []


class TicketStats(BaseModel):
    total: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    open_count: int
    closed_count: int
    avg_resolution_hours: float | None


class TicketFromFindingCreate(ORMModel):
    """Body para crear un ticket pre-poblado desde un hallazgo (RF-11)."""
    priority: str
    assigned_to: int | None = None
    category: str | None = None
    description_override: str | None = None  # Si se omite, usa finding.description
