from pydantic import EmailStr, Field

from app.common.schemas.base import ORMModel


class ServiceRead(ORMModel):
    id: int
    title: str
    slug: str
    category: str | None = None
    summary: str | None = None
    description: str | None = None
    price_label: str | None = None
    is_public: bool = True
    active: bool


class ServiceCreate(ORMModel):
    organization_id: int
    title: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120)
    category: str | None = Field(default=None, max_length=80)
    summary: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price_label: str | None = Field(default=None, max_length=80)
    is_public: bool = True
    active: bool = True


class ServiceRequestRead(ORMModel):
    id: int
    service_id: int
    requester_name: str
    requester_email: str
    status: str
    request_type: str | None = None
    message: str | None = None
    created_at: str | None = None


class ServiceRequestUpdate(ORMModel):
    status: str


class ServiceRequestCreate(ORMModel):
    service_id: int
    client_id: int | None = None
    requester_name: str = Field(min_length=2, max_length=150)
    requester_email: EmailStr
    request_type: str | None = Field(default=None, max_length=80)
    message: str | None = Field(default=None, min_length=5, max_length=1000)
