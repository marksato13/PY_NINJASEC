from datetime import datetime

from app.common.schemas.base import ORMModel


class DeviceRead(ORMModel):
    id: int
    integration_id: int | None = None
    hostname: str
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    device_type: str | None = None
    status: str
    last_seen_at: datetime | None = None
    # Campos de inventario
    site_id: int | None = None
    asset_tag: str | None = None
    serial_number: str | None = None
    device_owner: str | None = None
    # ISO 27001 A.8 / NIST CSF ID.AM — campos P1
    criticality: str | None = None
    data_classification: str | None = None
    responsible_user_id: int | None = None


class DeviceCreate(ORMModel):
    integration_id: int | None = None
    hostname: str
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    device_type: str | None = None
    status: str = "unknown"
    site_id: int | None = None
    asset_tag: str | None = None
    serial_number: str | None = None
    device_owner: str | None = None
    criticality: str | None = None
    data_classification: str | None = None
    responsible_user_id: int | None = None


class DeviceUpdate(ORMModel):
    integration_id: int | None = None
    hostname: str | None = None
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    device_type: str | None = None
    status: str | None = None
    site_id: int | None = None
    asset_tag: str | None = None
    serial_number: str | None = None
    device_owner: str | None = None
    criticality: str | None = None
    data_classification: str | None = None
    responsible_user_id: int | None = None
