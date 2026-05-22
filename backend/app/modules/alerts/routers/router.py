from datetime import date, datetime, timedelta

from app.core.time_utils import utcnow

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.device import Device
from app.db.models.enums import FindingSeverity, FindingStatus, RoleCode, TicketStatus
from app.db.models.integration import Integration
from app.db.models.security_review import ReviewFinding, ReviewRecommendation, SecurityReview
from app.db.models.support_ticket import SupportTicket
from app.modules.alerts.schemas import AlertItem, AlertRefreshResult
from app.modules.audit.services.audit_service import AuditService

router = APIRouter(prefix="/alerts", tags=["alerts"])

_OVERDUE_DAYS    = 7
_NO_REVIEW_DAYS  = 30
_INACTIVE_DEVICE = {"retired", "inactive"}


# ---------------------------------------------------------------------------
# 8.1 — GET /alerts/active
# ---------------------------------------------------------------------------

@router.get("/active", response_model=list[AlertItem])
def get_active_alerts(
    client_id: int | None = None,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[AlertItem]:
    org_id = current_user.organization_id
    now    = utcnow()
    today  = date.today()
    alerts: list[AlertItem] = []

    alerts.extend(_license_expired_alerts(db, org_id, client_id, now))
    alerts.extend(_critical_finding_alerts(db, org_id, client_id, now))
    alerts.extend(_ticket_overdue_alerts(db, org_id, client_id, now, today))

    # Ordenar: critical primero, luego warning, luego info
    _order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: _order.get(a.severity, 9))
    return alerts


# ---------------------------------------------------------------------------
# 8.2 — POST /alerts/refresh
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=AlertRefreshResult)
def refresh_alerts(
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> AlertRefreshResult:
    """
    Actualiza estados en batch:
    - Integrations con licencia vencida → status = "risk"
    - Devices sin revisión en >30 días → status = "pending_review"  (Regla 19)
    """
    org_id = current_user.organization_id
    today  = date.today()
    cutoff = utcnow() - timedelta(days=_NO_REVIEW_DAYS)

    # --- Integrations con licencia vencida → "risk" ---
    expired_stmt = select(Integration).where(
        Integration.organization_id == org_id,
        Integration.license_expires_at.isnot(None),
        Integration.license_expires_at < today,
        Integration.status != "risk",
    )
    expired_integrations = db.scalars(expired_stmt).all()
    for i in expired_integrations:
        i.status = "risk"
        db.add(i)

    # --- Devices sin revisión en >30 días → "pending_review" ---
    # Un device se considera revisado si su integration tiene alguna revisión
    # cerrada con executed_at > (now - 30 días)
    reviewed_integration_ids: set[int] = set(
        db.scalars(
            select(SecurityReview.integration_id)
            .where(
                SecurityReview.organization_id == org_id,
                SecurityReview.executed_at.isnot(None),
                SecurityReview.executed_at >= cutoff,
            )
        ).all()
    )

    unreviewed_stmt = select(Device).join(
        Integration, Device.integration_id == Integration.id
    ).where(
        Integration.organization_id == org_id,
        Device.status.notin_(list(_INACTIVE_DEVICE) + ["pending_review"]),
    )
    unreviewed_devices = [
        d for d in db.scalars(unreviewed_stmt).all()
        if d.integration_id not in reviewed_integration_ids
    ]
    for d in unreviewed_devices:
        d.status = "pending_review"
        db.add(d)

    db.commit()
    AuditService(db).record(
        org_id,
        "alerts.refresh",
        "alerts",
        f"integrations:{len(expired_integrations)},devices:{len(unreviewed_devices)}",
        current_user.id,
    )

    return AlertRefreshResult(
        integrations_marked_risk=len(expired_integrations),
        devices_marked_pending_review=len(unreviewed_devices),
    )


# ---------------------------------------------------------------------------
# Helpers privados
# ---------------------------------------------------------------------------

def _license_expired_alerts(
    db: Session,
    org_id: int,
    client_id: int | None,
    now: datetime,
) -> list[AlertItem]:
    stmt = select(Integration).where(
        Integration.organization_id == org_id,
        Integration.license_expires_at.isnot(None),
        Integration.license_expires_at < date.today(),
    )
    if client_id:
        stmt = stmt.where(Integration.client_id == client_id)

    alerts = []
    for i in db.scalars(stmt).all():
        days_ago = (date.today() - i.license_expires_at).days
        alerts.append(AlertItem(
            type="license_expired",
            severity="critical",
            entity_type="integration",
            entity_id=i.id,
            message=f"Consola '{i.name}' con licencia vencida hace {days_ago} día(s) ({i.license_expires_at})",
            created_at=now,
        ))
    return alerts


def _critical_finding_alerts(
    db: Session,
    org_id: int,
    client_id: int | None,
    now: datetime,
) -> list[AlertItem]:
    # Hallazgos críticos/altos abiertos
    stmt = (
        select(ReviewFinding)
        .join(SecurityReview, ReviewFinding.review_id == SecurityReview.id)
        .where(
            SecurityReview.organization_id == org_id,
            ReviewFinding.severity.in_([FindingSeverity.CRITICAL, FindingSeverity.HIGH]),
            ReviewFinding.status == FindingStatus.OPEN,
        )
    )
    if client_id:
        stmt = stmt.where(SecurityReview.client_id == client_id)

    findings = db.scalars(stmt).all()
    if not findings:
        return []

    # Finding_ids que ya tienen ticket asociado
    finding_ids = [f.id for f in findings]
    ticketed: set[int] = set(
        db.scalars(
            select(SupportTicket.finding_id).where(
                SupportTicket.finding_id.in_(finding_ids)
            )
        ).all()
    )
    # Finding_ids que ya tienen recomendación asociada
    recommended: set[int] = set(
        db.scalars(
            select(ReviewRecommendation.finding_id).where(
                ReviewRecommendation.finding_id.in_(finding_ids)
            )
        ).all()
    )

    alerts = []
    for f in findings:
        if f.id not in ticketed and f.id not in recommended:
            sev_label = str(f.severity).upper()
            alerts.append(AlertItem(
                type="critical_finding_open",
                severity="critical" if str(f.severity) == FindingSeverity.CRITICAL else "warning",
                entity_type="review_finding",
                entity_id=f.id,
                message=f"[{sev_label}] Hallazgo '{f.title}' sin ticket ni recomendación asociada",
                created_at=now,
            ))
    return alerts


def _ticket_overdue_alerts(
    db: Session,
    org_id: int,
    client_id: int | None,
    now: datetime,
    today: date,
) -> list[AlertItem]:
    cutoff = utcnow() - timedelta(days=_OVERDUE_DAYS)
    stmt = select(SupportTicket).where(
        SupportTicket.organization_id == org_id,
        SupportTicket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS]),
        SupportTicket.opened_at < cutoff,
    )
    if client_id:
        stmt = stmt.where(SupportTicket.client_id == client_id)

    alerts = []
    for t in db.scalars(stmt).all():
        days_open = (now - t.opened_at).days if t.opened_at else 0
        alerts.append(AlertItem(
            type="ticket_overdue",
            severity="warning",
            entity_type="support_ticket",
            entity_id=t.id,
            message=f"Ticket #{t.id} '{t.title}' lleva {days_open} día(s) abierto sin cierre",
            created_at=now,
        ))
    return alerts
