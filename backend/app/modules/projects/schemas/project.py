from datetime import date, datetime

from app.common.schemas.base import ORMModel


class ProjectRead(ORMModel):
    id: int
    organization_id: int
    client_id: int | None = None
    project_type_id: int | None = None
    area_id: int | None = None
    service_id: int | None = None
    product_id: int | None = None
    name: str
    status: str
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget_label: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectCreate(ORMModel):
    organization_id: int
    client_id: int
    project_type_id: int
    service_id: int | None = None
    product_id: int | None = None
    name: str
    description: str | None = None
    status: str = "planning"
    start_date: date | None = None
    end_date: date | None = None
    budget_label: str | None = None
    area_id: int | None = None


class ProjectUpdate(ORMModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget_label: str | None = None
