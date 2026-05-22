from datetime import datetime

from pydantic import BaseModel


class AlertItem(BaseModel):
    type: str           # "license_expired" | "critical_finding_open" | "ticket_overdue"
    severity: str       # "critical" | "warning" | "info"
    entity_type: str    # "integration" | "review_finding" | "support_ticket"
    entity_id: int
    message: str
    created_at: datetime


class AlertRefreshResult(BaseModel):
    integrations_marked_risk: int
    devices_marked_pending_review: int
