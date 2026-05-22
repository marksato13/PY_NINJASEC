from datetime import datetime

from pydantic import BaseModel


class ReviewSummary(BaseModel):
    total_scheduled: int
    total_executed: int
    execution_rate_pct: float       # ejecutadas / programadas * 100
    open_count: int
    closed_count: int


class FindingSummary(BaseModel):
    total: int
    by_severity: dict[str, int]     # {"critical": 3, "high": 5, ...}
    by_status: dict[str, int]       # {"open": 4, "resolved": 2, ...}
    critical_open: int              # hallazgos críticos/altos sin cerrar


class TicketSummaryDash(BaseModel):
    total: int
    open_count: int
    closed_count: int
    avg_resolution_hours: float | None
    overdue_count: int              # abiertos con opened_at > OVERDUE_DAYS días


class InventorySummary(BaseModel):
    total_devices: int
    by_status: dict[str, int]
    active_consoles: int
    expired_licenses: int           # integraciones con license_expires_at < hoy


class DashboardSummary(BaseModel):
    reviews: ReviewSummary
    findings: FindingSummary
    tickets: TicketSummaryDash
    inventory: InventorySummary
    generated_at: datetime
