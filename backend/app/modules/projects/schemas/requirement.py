from datetime import datetime

from app.common.schemas.base import ORMModel


class ProjectRequirementRead(ORMModel):
    id: int
    project_id: int
    skill_id: int
    level: str | None = None
    is_required: bool
    created_at: datetime | None = None
    skill_name: str | None = None


class ProjectRequirementCreate(ORMModel):
    project_id: int
    skill_id: int
    level: str | None = None
    is_required: bool = True
