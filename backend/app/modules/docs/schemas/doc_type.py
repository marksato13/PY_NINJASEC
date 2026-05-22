from datetime import datetime

from app.common.schemas.base import ORMModel


class DocTypeRead(ORMModel):
    id: int
    name: str
    scope: str
    is_active: bool
    created_at: datetime | None = None


class DocTypeCreate(ORMModel):
    name: str
    scope: str
    is_active: bool = True


class DocTypeUpdate(ORMModel):
    name: str | None = None
    scope: str | None = None
    is_active: bool | None = None
