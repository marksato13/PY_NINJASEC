from datetime import datetime

from pydantic import Field

from app.common.schemas.base import ORMModel


class ApplicationAttachmentCreate(ORMModel):
    file_url: str = Field(min_length=6, max_length=255)
    file_type: str | None = Field(default=None, max_length=80)


class ApplicationAttachmentRead(ORMModel):
    id: int
    application_id: int
    file_url: str
    file_type: str | None = None
    uploaded_by_user_id: int
    created_at: datetime | None = None
