from datetime import datetime

from pydantic import EmailStr, Field

from app.common.schemas.base import ORMModel


class LeadRead(ORMModel):
    id: int
    contact_name: str
    email: str
    status: str
    company_name: str | None = None
    interest_area: str | None = None
    source: str | None = None
    phone: str | None = None
    message: str | None = None
    created_at: datetime | None = None


class LeadCreate(ORMModel):
    company_name: str | None = Field(default=None, max_length=150)
    contact_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    interest_area: str | None = Field(default=None, max_length=120)
    message: str | None = Field(default=None, max_length=1000)
    source: str | None = Field(default=None, max_length=80)


class LeadUpdate(ORMModel):
    status: str


class LeadInfoUpdate(ORMModel):
    contact_name: str | None = Field(default=None, min_length=2, max_length=150)
    email: EmailStr | None = None
    company_name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=50)
    interest_area: str | None = Field(default=None, max_length=120)
    message: str | None = Field(default=None, max_length=1000)
    source: str | None = Field(default=None, max_length=80)
