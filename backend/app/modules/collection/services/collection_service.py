import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.collection_snapshot import CollectionSnapshot
from app.db.models.device import Device
from app.db.models.integration import Integration


class CollectionService:
    def __init__(self, db: Session):
        self.db = db

    def register_collection_result(
        self, integration: Integration, payload: dict[str, object]
    ) -> list[Device]:
        created_devices: list[Device] = []
        devices = payload.get("devices", [])
        snapshot_data = payload.get("snapshot", {})
        snapshot_type = str(snapshot_data.get("snapshot_type", "generic"))
        raw_payload = snapshot_data.get("raw_payload", "{}")
        normalized_payload = snapshot_data.get("normalized_payload", "{}")
        raw_payload = (
            json.dumps(raw_payload, ensure_ascii=True)
            if isinstance(raw_payload, (dict, list))
            else str(raw_payload)
        )
        normalized_payload = (
            json.dumps(normalized_payload, ensure_ascii=True)
            if isinstance(normalized_payload, (dict, list))
            else str(normalized_payload)
        )

        for item in devices:
            hostname = str(item.get("hostname", "unknown-device"))
            device = self.db.scalar(
                select(Device).where(
                    Device.integration_id == integration.id,
                    Device.hostname == hostname,
                )
            )
            if device:
                device.vendor = item.get("vendor")
                device.model = item.get("model")
                device.ip_address = item.get("ip_address")
                device.device_type = item.get("device_type")
                device.status = str(item.get("status", device.status))
            else:
                device = Device(
                    integration_id=integration.id,
                    hostname=hostname,
                    vendor=item.get("vendor"),
                    model=item.get("model"),
                    ip_address=item.get("ip_address"),
                    device_type=item.get("device_type"),
                    status=str(item.get("status", "unknown")),
                )
                self.db.add(device)
                self.db.flush()
            created_devices.append(device)

            snapshot = CollectionSnapshot(
                integration_id=integration.id,
                device_id=device.id,
                snapshot_type=snapshot_type,
                raw_payload=raw_payload,
                normalized_payload=normalized_payload,
            )
            self.db.add(snapshot)

        if not devices:
            snapshot = CollectionSnapshot(
                integration_id=integration.id,
                device_id=None,
                snapshot_type=snapshot_type,
                raw_payload=raw_payload,
                normalized_payload=normalized_payload,
            )
            self.db.add(snapshot)

        self.db.commit()
        return created_devices
