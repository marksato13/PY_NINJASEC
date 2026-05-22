from datetime import datetime

from pydantic import Field

from app.common.schemas.base import ORMModel


class ApplicationReviewCreate(ORMModel):
    score: int = Field(ge=1, le=5)
    recommendation: str = Field(min_length=3, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)


class ApplicationReviewRead(ORMModel):
    id: int
    application_id: int
    reviewer_user_id: int
    score: int
    recommendation: str
    notes: str | None = None
    created_at: datetime | None = None
