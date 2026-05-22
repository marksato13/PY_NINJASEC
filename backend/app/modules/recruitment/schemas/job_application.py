from datetime import datetime

from pydantic import EmailStr, Field

from app.common.schemas.base import ORMModel


class JobApplicationRead(ORMModel):
    id: int
    full_name: str
    email: str
    status: str
    desired_role: str | None = None
    phone: str | None = None
    skills_summary: str | None = None
    cv_url: str | None = None
    portfolio_url: str | None = None
    source: str | None = None
    created_at: datetime | None = None


class JobApplicationCreate(ORMModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    desired_role: str | None = Field(default=None, max_length=100)
    skills_summary: str | None = Field(default=None, min_length=5, max_length=1000)
    cv_url: str | None = Field(default=None, max_length=255)
    portfolio_url: str | None = Field(default=None, max_length=255)
    source: str | None = Field(default=None, max_length=80)


class JobApplicationUpdate(ORMModel):
    status: str
