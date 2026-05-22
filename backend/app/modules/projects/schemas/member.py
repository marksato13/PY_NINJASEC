from datetime import datetime

from app.common.schemas.base import ORMModel


class ProjectMemberCreate(ORMModel):
    project_id: int
    user_id: int
    role_in_project: str | None = None
    allocation_percentage: int | None = None
    can_publish_docs: bool = False
    assignment_type: str = "manual"
    is_required: bool = False


class ProjectMemberRead(ORMModel):
    id: int
    project_id: int
    user_id: int
    role_in_project: str | None = None
    allocation_percentage: int | None = None
    can_publish_docs: bool = False
    assignment_type: str = "manual"
    is_required: bool = False
    joined_at: datetime | None = None
    user_name: str | None = None
    user_email: str | None = None
    user_role_code: str | None = None
