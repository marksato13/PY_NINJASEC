from sqlalchemy.orm import Session

from app.db.models.audit_log import AuditLog


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def record(
        self,
        organization_id: int,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        user_id: int | None = None,
        metadata_json: str | None = None,
    ) -> AuditLog:
        log = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata_json,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log
