from datetime import date

from app.common.schemas.base import ORMModel


class ClientServiceRead(ORMModel):
    id: int
    client_id: int
    service_id: int
    starts_at: date | None = None
    ends_at: date | None = None


class ClientServiceCreate(ORMModel):
    client_id: int
    service_id: int
    starts_at: date | None = None
    ends_at: date | None = None


class ClientServiceUpdate(ORMModel):
    starts_at: date | None = None
    ends_at: date | None = None
