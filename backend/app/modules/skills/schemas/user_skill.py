from datetime import datetime

from app.common.schemas.base import ORMModel


class UserSkillRead(ORMModel):
    id: int
    user_id: int
    skill_id: int
    skill_name: str | None = None
    level: str | None = None
    status: str
    verified_by: int | None = None
    verified_at: datetime | None = None
    created_at: datetime | None = None


class UserSkillCreate(ORMModel):
    skill_id: int
    level: str | None = None
    user_id: int | None = None


class UserSkillUpdate(ORMModel):
    level: str | None = None


class UserSkillVerify(ORMModel):
    status: str
