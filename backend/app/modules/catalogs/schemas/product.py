from datetime import datetime

from app.common.schemas.base import ORMModel


class ProductRead(ORMModel):
    id: int
    organization_id: int
    area_id: int | None = None
    name: str
    slug: str
    summary: str | None = None
    is_active: bool
    created_at: datetime | None = None
