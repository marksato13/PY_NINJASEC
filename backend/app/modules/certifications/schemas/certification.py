from datetime import datetime

from app.common.schemas.base import ORMModel


class UserCertificationRead(ORMModel):
    id: int
    user_id: int
    name: str
    issuer: str | None = None
    credential_id: str | None = None
    url: str | None = None
    status: str
    verified_by: int | None = None
    verified_at: datetime | None = None
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime | None = None


class UserCertificationCreate(ORMModel):
    name: str
    issuer: str | None = None
    credential_id: str | None = None
    url: str | None = None
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    user_id: int | None = None


class UserCertificationUpdate(ORMModel):
    name: str | None = None
    issuer: str | None = None
    credential_id: str | None = None
    url: str | None = None
    issued_at: datetime | None = None
    expires_at: datetime | None = None


class UserCertificationVerify(ORMModel):
    status: str
