from datetime import datetime

from app.common.schemas.base import ORMModel


class SkillRead(ORMModel):
    id: int
    name: str
    category: str | None = None
    is_active: bool
    created_at: datetime | None = None


class SkillCreate(ORMModel):
    name: str
    category: str | None = None
