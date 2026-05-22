from datetime import datetime

from app.common.schemas.base import ORMModel


class ApplicationEventRead(ORMModel):
    id: int
    application_id: int
    event_type: str
    payload_json: str | None = None
    created_at: datetime | None = None
