from datetime import date, datetime, timedelta

from app.core.time_utils import utcnow

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.device import Device
from app.db.models.enums import FindingSeverity, FindingStatus, ReviewStatus, RoleCode, TicketStatus
from app.db.models.integration import Integration
from app.db.models.security_review import ReviewFinding, SecurityReview
from app.db.models.support_ticket import SupportTicket
from app.modules.dashboard.schemas import (
    DashboardSummary,
    FindingSummary,
    InventorySummary,
    ReviewSummary,
    TicketSummaryDash,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Umbral para considerar un ticket "vencido" (días sin cierre)
_OVERDUE_DAYS = 7
# Estados activos de consola (no en error ni riesgo)
_INACTIVE_CONSOLE_STATUSES = {"error", "risk", "inactive", "disconnected"}


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    client_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    org_id = current_user.organization_id

    return DashboardSummary(
        reviews=_build_review_summary(db, org_id, client_id, date_from, date_to),
        findings=_build_finding_summary(db, org_id, client_id, date_from, date_to),
        tickets=_build_ticket_summary(db, org_id, client_id, date_from, date_to),
        inventory=_build_inventory_summary(db, org_id, client_id),
        generated_at=utcnow(),
    )


# ---------------------------------------------------------------------------
# Helpers por sección
# ---------------------------------------------------------------------------

def _build_review_summary(
    db: Session,
    org_id: int,
    client_id: int | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> ReviewSummary:
    stmt = select(SecurityReview).where(SecurityReview.organization_id == org_id)
    if client_id:
        stmt = stmt.where(SecurityReview.client_id == client_id)
    if date_from:
        stmt = stmt.where(SecurityReview.scheduled_at >= date_from)
    if date_to:
        stmt = stmt.where(SecurityReview.scheduled_at <= date_to)

    reviews = db.scalars(stmt).all()
    total = len(reviews)
    executed = sum(1 for r in reviews if r.executed_at is not None)
    closed = sum(1 for r in reviews if str(r.status) == ReviewStatus.CLOSED)
    open_count = sum(
        1 for r in reviews
        if str(r.status) in (ReviewStatus.SCHEDULED, ReviewStatus.IN_PROGRESS)
    )

    return ReviewSummary(
        total_scheduled=total,
        total_executed=executed,
        execution_rate_pct=round(executed / total * 100, 1) if total else 0.0,
        open_count=open_count,
        closed_count=closed,
    )


def _build_finding_summary(
    db: Session,
    org_id: int,
    client_id: int | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> FindingSummary:
    # JOIN a security_reviews para filtrar por org / cliente / fecha
    stmt = (
        select(ReviewFinding)
        .join(SecurityReview, ReviewFinding.review_id == SecurityReview.id)
        .where(SecurityReview.organization_id == org_id)
    )
    if client_id:
        stmt = stmt.where(SecurityReview.client_id == client_id)
    if date_from:
        stmt = stmt.where(SecurityReview.scheduled_at >= date_from)
    if date_to:
        stmt = stmt.where(SecurityReview.scheduled_at <= date_to)

    findings = db.scalars(stmt).all()

    by_severity: dict[str, int] = {}
    by_status: dict[str, int] = {}
    critical_open = 0

    for f in findings:
        sev = str(f.severity)
        fst = str(f.status)
        by_severity[sev] = by_severity.get(sev, 0) + 1
        by_status[fst] = by_status.get(fst, 0) + 1
        # Regla 6 (doc 30): críticos y altos abiertos son indicador de riesgo
        if sev in (FindingSeverity.CRITICAL, FindingSeverity.HIGH) and fst == FindingStatus.OPEN:
            critical_open += 1

    return FindingSummary(
        total=len(findings),
        by_severity=by_severity,
        by_status=by_status,
        critical_open=critical_open,
    )


def _build_ticket_summary(
    db: Session,
    org_id: int,
    client_id: int | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> TicketSummaryDash:
    stmt = select(SupportTicket).where(SupportTicket.organization_id == org_id)
    if client_id:
        stmt = stmt.where(SupportTicket.client_id == client_id)
    if date_from:
        stmt = stmt.where(SupportTicket.opened_at >= date_from)
    if date_to:
        stmt = stmt.where(SupportTicket.opened_at <= date_to)

    tickets = db.scalars(stmt).all()

    _open_statuses   = {TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING}
    _closed_statuses = {TicketStatus.RESOLVED, TicketStatus.CLOSED}
    overdue_threshold = utcnow() - timedelta(days=_OVERDUE_DAYS)

    open_count   = 0
    closed_count = 0
    overdue      = 0
    resolution_hours: list[float] = []

    for t in tickets:
        st = str(t.status)
        if st in _open_statuses:
            open_count += 1
            if t.opened_at and t.opened_at < overdue_threshold:
                overdue += 1
        elif st in _closed_statuses:
            closed_count += 1
            # Regla 20: SLA solo con tickets en estado final
            if t.closed_at and t.opened_at:
                hours = (t.closed_at - t.opened_at).total_seconds() / 3600
                resolution_hours.append(hours)

    avg_hours = round(sum(resolution_hours) / len(resolution_hours), 2) if resolution_hours else None

    return TicketSummaryDash(
        total=len(tickets),
        open_count=open_count,
        closed_count=closed_count,
        avg_resolution_hours=avg_hours,
        overdue_count=overdue,
    )


def _build_inventory_summary(
    db: Session,
    org_id: int,
    client_id: int | None,
) -> InventorySummary:
    # Dispositivos — filtrando por org vía integración
    dev_stmt = (
        select(Device)
        .join(Integration, Device.integration_id == Integration.id)
        .where(Integration.organization_id == org_id)
    )
    if client_id:
        dev_stmt = dev_stmt.where(Integration.client_id == client_id)

    devices = db.scalars(dev_stmt).all()

    by_status: dict[str, int] = {}
    for d in devices:
        s = str(d.status)
        by_status[s] = by_status.get(s, 0) + 1

    # Consolas — estado y licencias
    int_stmt = select(Integration).where(Integration.organization_id == org_id)
    if client_id:
        int_stmt = int_stmt.where(Integration.client_id == client_id)

    integrations = db.scalars(int_stmt).all()
    today = date.today()

    active_consoles  = sum(
        1 for i in integrations
        if str(i.status) not in _INACTIVE_CONSOLE_STATUSES
    )
    expired_licenses = sum(
        1 for i in integrations
        if i.license_expires_at is not None and i.license_expires_at < today
    )

    return InventorySummary(
        total_devices=len(devices),
        by_status=by_status,
        active_consoles=active_consoles,
        expired_licenses=expired_licenses,
    )
