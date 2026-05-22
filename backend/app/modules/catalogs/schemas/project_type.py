from datetime import datetime

from app.common.schemas.base import ORMModel


class ProjectTypeRead(ORMModel):
    id: int
    name: str
    slug: str
    is_active: bool
    created_at: datetime | None = None
