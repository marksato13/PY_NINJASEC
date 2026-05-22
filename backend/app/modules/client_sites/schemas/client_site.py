from app.common.schemas.base import ORMModel


class ClientSiteRead(ORMModel):
    id: int
    client_id: int
    name: str
    address: str | None = None
    city: str | None = None
    country: str | None = None
    status: str


class ClientSiteCreate(ORMModel):
    client_id: int
    name: str
    address: str | None = None
    city: str | None = None
    country: str | None = None
    status: str = "active"


class ClientSiteUpdate(ORMModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    status: str | None = None
