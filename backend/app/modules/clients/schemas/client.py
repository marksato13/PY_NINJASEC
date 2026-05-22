from app.common.schemas.base import ORMModel


class ClientRead(ORMModel):
    id: int
    organization_id: int
    company_name: str
    commercial_status: str
    sector: str | None = None
    size: str | None = None
    city: str | None = None
    country: str | None = None
    notes: str | None = None
    devices_count: int = 0
    open_tickets_count: int = 0


class ClientAccessRead(ORMModel):
    client_id: int
    user_id: int
    full_name: str
    email: str
    position_title: str | None = None
    access_level: str | None = None
    phone: str | None = None


class ClientCreate(ORMModel):
    organization_id: int
    company_name: str
    commercial_status: str = "prospect"
    sector: str | None = None
    size: str | None = None
    city: str | None = None
    country: str | None = None
    notes: str | None = None


class ClientUpdate(ORMModel):
    commercial_status: str | None = None
    sector: str | None = None
    size: str | None = None
    city: str | None = None
    country: str | None = None
    notes: str | None = None
