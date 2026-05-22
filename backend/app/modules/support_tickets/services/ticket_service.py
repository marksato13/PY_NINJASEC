from __future__ import annotations

from datetime import datetime

from app.core.time_utils import utcnow
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models.client_profile import ClientProfile
from app.db.models.enums import RoleCode, TicketPriority, TicketStatus
from app.db.models.security_review import ReviewFinding, SecurityReview
from app.db.models.support_ticket import SupportTicket, SupportTicketEvent
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.support_tickets.schemas import (
    SupportTicketCreate,
    SupportTicketUpdate,
    TicketEventCreate,
    TicketFromFindingCreate,
    TicketStats,
)


class TicketService:
    def __init__(self, db: Session, current_user):
        self.db = db
        self.current_user = current_user
        self._audit = AuditService(db)

    def _client_profile(self) -> ClientProfile | None:
        return self.db.scalar(
            select(ClientProfile).where(ClientProfile.user_id == self.current_user.id)
        )

    def _base_stmt(self):
        return select(SupportTicket).where(
            SupportTicket.organization_id == self.current_user.organization_id
        )

    def list(
        self,
        client_id: int | None = None,
        ticket_status: str | None = None,
        priority: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[SupportTicket]:
        stmt = self._base_stmt()
        if self.current_user.role == RoleCode.CLIENT.value:
            profile = self._client_profile()
            if not profile:
                return []
            stmt = stmt.where(SupportTicket.client_id == profile.client_id)
        elif client_id:
            stmt = stmt.where(SupportTicket.client_id == client_id)
        if ticket_status:
            stmt = stmt.where(SupportTicket.status == ticket_status)
        if priority:
            stmt = stmt.where(SupportTicket.priority == priority)
        if date_from:
            stmt = stmt.where(SupportTicket.opened_at >= date_from)
        if date_to:
            stmt = stmt.where(SupportTicket.opened_at <= date_to)
        stmt = stmt.order_by(SupportTicket.opened_at.desc())
        return list(self.db.scalars(stmt).all())

    def query_for_export(
        self,
        client_id: int | None = None,
        ticket_status: str | None = None,
        priority: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[SupportTicket]:
        stmt = self._base_stmt()
        if client_id:
            stmt = stmt.where(SupportTicket.client_id == client_id)
        if ticket_status:
            stmt = stmt.where(SupportTicket.status == ticket_status)
        if priority:
            stmt = stmt.where(SupportTicket.priority == priority)
        if date_from:
            stmt = stmt.where(SupportTicket.opened_at >= date_from)
        if date_to:
            stmt = stmt.where(SupportTicket.opened_at <= date_to)
        stmt = stmt.order_by(SupportTicket.opened_at.desc())
        return list(self.db.scalars(stmt).all())

    def stats(
        self,
        client_id: int | None = None,
        date_from: datetime | None = None,
    ) -> TicketStats:
        stmt = self._base_stmt()
        if client_id:
            stmt = stmt.where(SupportTicket.client_id == client_id)
        if date_from:
            stmt = stmt.where(SupportTicket.opened_at >= date_from)

        tickets = self.db.scalars(stmt).all()
        by_status: dict[str, int] = {}
        by_priority: dict[str, int] = {}
        resolution_hours: list[float] = []

        for t in tickets:
            s = str(t.status)
            p = str(t.priority)
            by_status[s] = by_status.get(s, 0) + 1
            by_priority[p] = by_priority.get(p, 0) + 1
            if t.closed_at and t.opened_at:
                delta = (t.closed_at - t.opened_at).total_seconds() / 3600
                resolution_hours.append(delta)

        avg_hours = round(sum(resolution_hours) / len(resolution_hours), 2) if resolution_hours else None
        return TicketStats(
            total=len(tickets),
            by_status=by_status,
            by_priority=by_priority,
            open_count=by_status.get(TicketStatus.OPEN, 0) + by_status.get(TicketStatus.IN_PROGRESS, 0),
            closed_count=by_status.get(TicketStatus.CLOSED, 0),
            avg_resolution_hours=avg_hours,
        )

    def get_or_404(self, ticket_id: int) -> SupportTicket:
        stmt = (
            select(SupportTicket)
            .where(
                SupportTicket.id == ticket_id,
                SupportTicket.organization_id == self.current_user.organization_id,
            )
            .options(selectinload(SupportTicket.events))
        )
        ticket = self.db.scalar(stmt)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        if self.current_user.role == RoleCode.CLIENT.value:
            profile = self._client_profile()
            if not profile or ticket.client_id != profile.client_id:
                raise HTTPException(status_code=404, detail="Ticket not found")
        return ticket

    def create(self, payload: SupportTicketCreate) -> SupportTicket:
        ticket = SupportTicket(
            organization_id=self.current_user.organization_id,
            client_id=payload.client_id,
            integration_id=payload.integration_id,
            device_id=payload.device_id,
            review_id=payload.review_id,
            finding_id=payload.finding_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            priority=TicketPriority(payload.priority),
            status=TicketStatus.OPEN,
            assigned_to=payload.assigned_to,
        )
        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)
        self._audit.record(
            self.current_user.organization_id,
            "support_ticket.created",
            "support_tickets",
            str(ticket.id),
            self.current_user.id,
        )
        return ticket

    def create_from_finding(self, finding_id: int, payload: TicketFromFindingCreate) -> SupportTicket:
        finding = Repository(self.db).get_by_id(ReviewFinding, finding_id)
        if not finding:
            raise HTTPException(status_code=404, detail="Finding not found")

        review = Repository(self.db).get_by_id(SecurityReview, finding.review_id)
        if not review or review.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Finding not found")

        ticket = SupportTicket(
            organization_id=self.current_user.organization_id,
            client_id=review.client_id,
            integration_id=review.integration_id,
            review_id=review.id,
            finding_id=finding.id,
            title=f"[{str(finding.severity).upper()}] {finding.title}",
            description=payload.description_override or finding.description,
            category=payload.category,
            priority=TicketPriority(payload.priority),
            status=TicketStatus.OPEN,
            assigned_to=payload.assigned_to,
        )
        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)
        self._audit.record(
            self.current_user.organization_id,
            "support_ticket.created_from_finding",
            "support_tickets",
            str(ticket.id),
            self.current_user.id,
        )
        return ticket

    def update(self, ticket_id: int, payload: SupportTicketUpdate) -> SupportTicket:
        ticket = Repository(self.db).get_by_id(SupportTicket, ticket_id)
        if not ticket or ticket.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Ticket not found")

        data = payload.model_dump(exclude_unset=True)
        new_status = data.get("status") or str(ticket.status)

        if new_status == TicketStatus.CLOSED and not (data.get("resolution") or ticket.resolution):
            raise HTTPException(status_code=422, detail="resolution is required to close a ticket")

        prev_status = str(ticket.status)
        for field, value in data.items():
            if field == "status" and value is not None:
                value = TicketStatus(value)
            if field == "priority" and value is not None:
                value = TicketPriority(value)
            setattr(ticket, field, value)

        if new_status == TicketStatus.CLOSED and not ticket.closed_at:
            ticket.closed_at = utcnow()

        self.db.add(ticket)

        if "status" in data and prev_status != str(ticket.status):
            self.db.add(SupportTicketEvent(
                ticket_id=ticket.id,
                event_type="status_change",
                from_status=prev_status,
                to_status=str(ticket.status),
                user_id=self.current_user.id,
            ))

        self.db.commit()
        self.db.refresh(ticket)
        self._audit.record(
            self.current_user.organization_id,
            "support_ticket.updated",
            "support_tickets",
            str(ticket.id),
            self.current_user.id,
        )
        return ticket

    def delete(self, ticket_id: int) -> None:
        ticket = Repository(self.db).get_by_id(SupportTicket, ticket_id)
        if not ticket or ticket.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Ticket not found")
        self.db.delete(ticket)
        self.db.commit()
        self._audit.record(
            self.current_user.organization_id,
            "support_ticket.deleted",
            "support_tickets",
            str(ticket_id),
            self.current_user.id,
        )

    def add_event(self, ticket_id: int, payload: TicketEventCreate) -> SupportTicketEvent:
        ticket = Repository(self.db).get_by_id(SupportTicket, ticket_id)
        if not ticket or ticket.organization_id != self.current_user.organization_id:
            raise HTTPException(status_code=404, detail="Ticket not found")
        event = SupportTicketEvent(
            ticket_id=ticket_id,
            event_type=payload.event_type,
            user_id=self.current_user.id,
            notes=payload.notes,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event
