from datetime import datetime

from pydantic import Field

from app.common.schemas.base import ORMModel


class ApplicationNoteCreate(ORMModel):
    note: str = Field(min_length=3, max_length=2000)
    visibility: str = Field(default="internal", max_length=30)


class ApplicationNoteRead(ORMModel):
    id: int
    application_id: int
    author_user_id: int
    note: str
    visibility: str
    created_at: datetime | None = None
