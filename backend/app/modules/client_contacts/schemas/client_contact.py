from app.common.schemas.base import ORMModel


class ClientContactRead(ORMModel):
    id: int
    client_id: int
    name: str
    email: str | None = None
    phone: str | None = None
    role: str | None = None
    is_primary: bool


class ClientContactCreate(ORMModel):
    client_id: int
    name: str
    email: str | None = None
    phone: str | None = None
    role: str | None = None
    is_primary: bool = False


class ClientContactUpdate(ORMModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str | None = None
    is_primary: bool | None = None
