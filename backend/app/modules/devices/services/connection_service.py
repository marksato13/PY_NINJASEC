from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.device import Device
from app.db.models.device_connection import DeviceConnection
from app.db.models.integration import Integration
from app.modules.audit.services.audit_service import AuditService
from app.modules.devices.schemas import DeviceConnectionCreate


class DeviceConnectionService:
    def __init__(self, db: Session, current_user):
        self.db = db
        self.current_user = current_user
        self._audit = AuditService(db)

    def _device_or_404(self, device_id: int) -> Device:
        device = self.db.get(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
        integration = self.db.get(Integration, device.integration_id) if device.integration_id else None
        if integration and integration.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
        return device

    def list_for_client(self, client_id: int) -> list[DeviceConnection]:
        device_ids = [
            d.id for d in self.db.scalars(
                select(Device).join(Integration, Device.integration_id == Integration.id)
                .where(Integration.client_id == client_id,
                       Integration.organization_id == self.current_user.organization_id)
            ).all()
        ]
        if not device_ids:
            return []
        return list(self.db.scalars(
            select(DeviceConnection).where(
                DeviceConnection.source_device_id.in_(device_ids),
                DeviceConnection.target_device_id.in_(device_ids),
            )
        ).all())

    def create(self, payload: DeviceConnectionCreate) -> DeviceConnection:
        if payload.source_device_id == payload.target_device_id:
            raise HTTPException(status_code=400, detail="source and target must be different devices")

        self._device_or_404(payload.source_device_id)
        self._device_or_404(payload.target_device_id)

        existing = self.db.scalar(
            select(DeviceConnection).where(
                DeviceConnection.source_device_id == payload.source_device_id,
                DeviceConnection.target_device_id == payload.target_device_id,
                DeviceConnection.link_type == payload.link_type,
            )
        )
        if existing:
            return existing

        conn = DeviceConnection(**payload.model_dump())
        self.db.add(conn)
        self.db.commit()
        self.db.refresh(conn)
        self._audit.record(
            self.current_user.organization_id,
            "device_connection.created",
            "device_connections",
            str(conn.id),
            self.current_user.id,
        )
        return conn

    def delete(self, connection_id: int) -> None:
        conn = self.db.get(DeviceConnection, connection_id)
        if not conn:
            raise HTTPException(status_code=404, detail="Connection not found")

        self._device_or_404(conn.source_device_id)

        self.db.delete(conn)
        self.db.commit()
        self._audit.record(
            self.current_user.organization_id,
            "device_connection.deleted",
            "device_connections",
            str(connection_id),
            self.current_user.id,
        )
