from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.client import Client
from app.db.models.client_profile import ClientProfile
from app.db.models.device import Device
from app.db.models.enums import ClientStatus, RoleCode, TicketStatus
from app.db.models.integration import Integration
from app.db.models.support_ticket import SupportTicket
from app.db.models.user import User
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.clients.schemas import ClientAccessRead, ClientCreate, ClientUpdate


class ClientService:
    def __init__(self, db: Session, current_user):
        self.db = db
        self.current_user = current_user
        self._audit = AuditService(db)

    def _client_profile(self) -> ClientProfile | None:
        return self.db.scalar(
            select(ClientProfile).where(ClientProfile.user_id == self.current_user.id)
        )

    def list(self) -> list[Client]:
        if self.current_user.role == RoleCode.CLIENT.value:
            profile = self._client_profile()
            if not profile:
                return []
            stmt = select(Client).where(Client.id == profile.client_id)
        else:
            stmt = select(Client).where(
                Client.organization_id == self.current_user.organization_id
            )
        clients = list(self.db.scalars(stmt).all())
        self._enrich_counts(clients)
        return clients

    def _enrich_counts(self, clients: list[Client]) -> None:
        """Attach devices_count + open_tickets_count attributes on each client."""
        if not clients:
            return
        client_ids = [c.id for c in clients]

        device_counts = dict(
            self.db.execute(
                select(Integration.client_id, func.count(Device.id))
                .join(Device, Device.integration_id == Integration.id)
                .where(Integration.client_id.in_(client_ids))
                .group_by(Integration.client_id)
            ).all()
        )
        ticket_counts = dict(
            self.db.execute(
                select(SupportTicket.client_id, func.count(SupportTicket.id))
                .where(SupportTicket.client_id.in_(client_ids))
                .where(SupportTicket.status == TicketStatus.OPEN)
                .group_by(SupportTicket.client_id)
            ).all()
        )
        for client in clients:
            client.devices_count = device_counts.get(client.id, 0)
            client.open_tickets_count = ticket_counts.get(client.id, 0)

    def get_or_404(self, client_id: int) -> Client:
        client = Repository(self.db).get_by_id(Client, client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        if self.current_user.role == RoleCode.CLIENT.value:
            profile = self._client_profile()
            if not profile or profile.client_id != client_id:
                raise HTTPException(status_code=404, detail="Client not found")
        elif client.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Client not found")
        return client

    def create(self, payload: ClientCreate) -> Client:
        if payload.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=403, detail="Organization access denied")
        client = Client(
            organization_id=payload.organization_id,
            company_name=payload.company_name,
            commercial_status=ClientStatus(payload.commercial_status),
            sector=payload.sector,
            size=payload.size,
            city=payload.city,
            country=payload.country,
            notes=payload.notes,
        )
        self.db.add(client)
        self.db.commit()
        self.db.refresh(client)
        self._audit.record(
            self.current_user.organization_id,
            "client.created",
            "clients",
            str(client.id),
            self.current_user.id,
        )
        return client

    def update(self, client_id: int, payload: ClientUpdate) -> Client:
        client = Repository(self.db).get_by_id(Client, client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        if client.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Client not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field == "commercial_status" and value is not None:
                value = ClientStatus(value)
            setattr(client, field, value)
        self.db.add(client)
        self.db.commit()
        self.db.refresh(client)
        self._audit.record(
            self.current_user.organization_id,
            "client.updated",
            "clients",
            str(client.id),
            self.current_user.id,
        )
        return client

    def delete(self, client_id: int) -> None:
        client = Repository(self.db).get_by_id(Client, client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        if client.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Client not found")
        self.db.delete(client)
        self.db.commit()
        self._audit.record(
            self.current_user.organization_id,
            "client.deleted",
            "clients",
            str(client_id),
            self.current_user.id,
        )

    def list_access(self, client_id: int) -> list[ClientAccessRead]:
        client = Repository(self.db).get_by_id(Client, client_id)
        if not client or client.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Client not found")
        stmt = (
            select(ClientProfile, User)
            .join(User, ClientProfile.user_id == User.id)
            .where(ClientProfile.client_id == client_id)
            .order_by(User.full_name)
        )
        return [
            ClientAccessRead(
                client_id=profile.client_id,
                user_id=user.id,
                full_name=user.full_name,
                email=user.email,
                position_title=profile.position_title,
                access_level=profile.access_level,
                phone=profile.phone,
            )
            for profile, user in self.db.execute(stmt).all()
        ]
