from datetime import date

from pydantic import model_validator

from app.common.schemas.base import ORMModel


class IntegrationRead(ORMModel):
    id: int
    name: str
    connector_type: str
    base_url: str
    status: str
    config_json: str | None = None
    client_id: int | None = None
    # Campos de consola (Bloque 1)
    environment: str | None = None
    license_type: str | None = None
    license_expires_at: date | None = None
    responsible_user_id: int | None = None
    # Campos calculados — no persisten en BD (Regla 18)
    is_license_expired: bool = False
    effective_status: str = ""

    @model_validator(mode="after")
    def compute_license_status(self) -> "IntegrationRead":
        if self.license_expires_at is not None and self.license_expires_at < date.today():
            self.is_license_expired = True
            self.effective_status = "risk"
        else:
            self.is_license_expired = False
            self.effective_status = self.status
        return self


class IntegrationCreate(ORMModel):
    organization_id: int
    client_id: int          # Obligatorio — Regla 2 (doc 30)
    connector_type: str
    name: str
    base_url: str
    auth_type: str = "token"
    config_json: str | None = None
    environment: str | None = None
    license_type: str | None = None
    license_expires_at: date | None = None
    responsible_user_id: int | None = None


class IntegrationUpdate(ORMModel):
    name: str | None = None
    base_url: str | None = None
    status: str | None = None
    environment: str | None = None
    license_type: str | None = None
    license_expires_at: date | None = None
    responsible_user_id: int | None = None
    config_json: str | None = None
