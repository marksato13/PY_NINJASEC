from datetime import datetime

from app.common.schemas.base import ORMModel


class AreaRead(ORMModel):
    id: int
    name: str
    slug: str
    is_active: bool
    created_at: datetime | None = None
