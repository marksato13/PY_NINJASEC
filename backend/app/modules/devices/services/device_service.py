from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models.client_profile import ClientProfile
from app.db.models.client_site import ClientSite
from app.db.models.device import Device
from app.db.models.enums import RoleCode
from app.db.models.integration import Integration
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.devices.schemas import DeviceCreate, DeviceUpdate

_RETIRED_STATUS = "retired"


class DeviceService:
    def __init__(self, db: Session, current_user):
        self.db = db
        self.current_user = current_user
        self._audit = AuditService(db)

    def _base_stmt(self):
        return (
            select(Device)
            .outerjoin(Integration, Device.integration_id == Integration.id)
            .outerjoin(ClientSite, Device.site_id == ClientSite.id)
            .where(
                or_(
                    Integration.organization_id == self.current_user.organization_id,
                    ClientSite.client.has(organization_id=self.current_user.organization_id),
                )
            )
        )

    def _client_profile(self) -> ClientProfile | None:
        return self.db.scalar(
            select(ClientProfile).where(ClientProfile.user_id == self.current_user.id)
        )

    def list(
        self,
        client_id: int | None = None,
        integration_id: int | None = None,
        site_id: int | None = None,
        device_status: str | None = None,
    ) -> list[Device]:
        if self.current_user.role == RoleCode.CLIENT.value:
            profile = self._client_profile()
            if not profile:
                return []
            stmt = (
                select(Device)
                .outerjoin(Integration, Device.integration_id == Integration.id)
                .outerjoin(ClientSite, Device.site_id == ClientSite.id)
                .where(
                    or_(
                        Integration.client_id == profile.client_id,
                        ClientSite.client_id == profile.client_id,
                    )
                )
            )
        else:
            stmt = self._base_stmt()
            if client_id:
                stmt = stmt.where(
                    or_(
                        Integration.client_id == client_id,
                        ClientSite.client_id == client_id,
                    )
                )

        if integration_id:
            stmt = stmt.where(Device.integration_id == integration_id)
        if site_id:
            stmt = stmt.where(Device.site_id == site_id)
        if device_status:
            stmt = stmt.where(Device.status == device_status)

        return list(self.db.scalars(stmt).all())

    def query_for_export(
        self,
        client_id: int | None = None,
        integration_id: int | None = None,
        site_id: int | None = None,
        device_status: str | None = None,
    ) -> list[Device]:
        stmt = self._base_stmt().options(
            selectinload(Device.integration), selectinload(Device.site)
        )
        if client_id:
            stmt = stmt.where(
                or_(
                    Integration.client_id == client_id,
                    ClientSite.client_id == client_id,
                )
            )
        if integration_id:
            stmt = stmt.where(Device.integration_id == integration_id)
        if site_id:
            stmt = stmt.where(Device.site_id == site_id)
        if device_status:
            stmt = stmt.where(Device.status == device_status)
        return list(self.db.scalars(stmt).all())

    def get_or_404(self, device_id: int) -> Device:
        device = Repository(self.db).get_by_id(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        integration = self.db.get(Integration, device.integration_id) if device.integration_id else None
        site = self.db.get(ClientSite, device.site_id) if device.site_id else None

        if self.current_user.role == RoleCode.CLIENT.value:
            profile = self._client_profile()
            site_client_id = site.client_id if site else None
            integration_client_id = integration.client_id if integration else None
            if not profile or (profile.client_id not in {site_client_id, integration_client_id}):
                raise HTTPException(status_code=404, detail="Device not found")
        else:
            org_allowed = False
            if integration and integration.organization_id == self.current_user.organization_id:
                org_allowed = True
            elif site and site.client and site.client.organization_id == self.current_user.organization_id:
                org_allowed = True
            if not org_allowed:
                raise HTTPException(status_code=404, detail="Device not found")

        return device

    def create(self, payload: DeviceCreate) -> Device:
        if payload.integration_id is not None:
            integration = self.db.get(Integration, payload.integration_id)
            if not integration or integration.organization_id != self.current_user.organization_id:
                raise HTTPException(status_code=403, detail="Integration not found or access denied")

        device = Device(**payload.model_dump())
        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        self._audit.record(
            self.current_user.organization_id,
            "device.created",
            "devices",
            str(device.id),
            self.current_user.id,
        )
        return device

    def update(self, device_id: int, payload: DeviceUpdate) -> Device:
        device = Repository(self.db).get_by_id(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        data = payload.model_dump(exclude_unset=True)
        if "integration_id" in data and data["integration_id"] is not None:
            new_integration = self.db.get(Integration, data["integration_id"])
            if not new_integration or new_integration.organization_id != self.current_user.organization_id:
                raise HTTPException(status_code=403, detail="Integration not found or access denied")

        for field, value in data.items():
            setattr(device, field, value)

        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        self._audit.record(
            self.current_user.organization_id,
            "device.updated",
            "devices",
            str(device.id),
            self.current_user.id,
        )
        return device

    def retire(self, device_id: int) -> Device:
        device = Repository(self.db).get_by_id(Device, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        integration = self.db.get(Integration, device.integration_id) if device.integration_id else None
        site = self.db.get(ClientSite, device.site_id) if device.site_id else None
        org_allowed = False
        if integration and integration.organization_id == self.current_user.organization_id:
            org_allowed = True
        elif site and site.client and site.client.organization_id == self.current_user.organization_id:
            org_allowed = True
        if not org_allowed:
            raise HTTPException(status_code=404, detail="Device not found")

        if device.status == _RETIRED_STATUS:
            raise HTTPException(status_code=409, detail="Device is already retired")

        device.status = _RETIRED_STATUS
        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        self._audit.record(
            self.current_user.organization_id,
            "device.retired",
            "devices",
            str(device.id),
            self.current_user.id,
        )
        return device
