from app.common.schemas.base import ORMModel


class AuditLogRead(ORMModel):
    id: int
    action: str
    entity_type: str
    entity_id: str | None = None
    metadata_json: str | None = None
