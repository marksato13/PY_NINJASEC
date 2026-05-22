from datetime import datetime

from app.common.schemas.base import ORMModel


class ProjectRecommendationRead(ORMModel):
    id: int
    project_id: int
    user_id: int
    score: float
    status: str | None = None
    reason_json: str | None = None
    created_at: datetime | None = None
    user_name: str | None = None
    user_email: str | None = None
