from datetime import datetime

from app.common.schemas.base import ORMModel


class DeviceConnectionRead(ORMModel):
    id: int
    source_device_id: int
    target_device_id: int
    link_type: str
    port_source: str | None = None
    port_target: str | None = None
    vlan_id: int | None = None
    bandwidth_mbps: int | None = None
    notes: str | None = None
    created_at: datetime | None = None


class DeviceConnectionCreate(ORMModel):
    source_device_id: int
    target_device_id: int
    link_type: str = "ethernet"
    port_source: str | None = None
    port_target: str | None = None
    vlan_id: int | None = None
    bandwidth_mbps: int | None = None
    notes: str | None = None
