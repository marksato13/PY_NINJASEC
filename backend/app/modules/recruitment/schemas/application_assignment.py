from datetime import datetime

from pydantic import Field

from app.common.schemas.base import ORMModel


class ApplicationAssignmentCreate(ORMModel):
    reviewer_user_id: int = Field(ge=1)
    role: str | None = Field(default=None, max_length=40)


class ApplicationAssignmentRead(ORMModel):
    id: int
    application_id: int
    reviewer_user_id: int
    assigned_by_user_id: int
    role: str | None = None
    assigned_at: datetime | None = None
