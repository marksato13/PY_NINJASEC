from datetime import datetime

from app.common.schemas.base import ORMModel


class UserRead(ORMModel):
    id: int
    full_name: str
    email: str
    role_code: str
    job_title: str | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserCreate(ORMModel):
    organization_id: int
    role_code: str
    full_name: str
    email: str
    password: str
    job_title: str | None = None


class UserUpdate(ORMModel):
    full_name: str | None = None
    job_title: str | None = None
    is_active: bool | None = None
    role_code: str | None = None  # solo super_admin puede modificar este campo
