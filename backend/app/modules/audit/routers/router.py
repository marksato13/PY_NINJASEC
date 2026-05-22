from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.audit_log import AuditLog
from app.db.models.enums import RoleCode
from app.db.repositories.base import Repository
from app.modules.audit.schemas import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("/", response_model=list[AuditLogRead])
def list_audit_logs(
    limit: int | None = None,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> list[AuditLogRead]:
    stmt = (
        select(AuditLog)
        .where(AuditLog.organization_id == current_user.organization_id)
        .order_by(AuditLog.created_at.desc())
    )
    if limit:
        stmt = stmt.limit(limit)
    return [AuditLogRead.model_validate(item) for item in db.scalars(stmt).all()]
