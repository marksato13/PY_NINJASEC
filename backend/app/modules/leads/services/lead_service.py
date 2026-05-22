from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models.enums import LeadStatus
from app.db.models.lead import Lead
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.leads.schemas import LeadCreate, LeadInfoUpdate, LeadUpdate


class LeadService:
    def __init__(self, db: Session, current_user=None):
        self.db = db
        self.current_user = current_user

    def list(self) -> list[Lead]:
        return list(Repository(self.db).list_all(Lead))

    def create(self, payload: LeadCreate) -> Lead:
        lead = Lead(**{**payload.model_dump(), "status": LeadStatus.NEW})
        self.db.add(lead)
        self.db.commit()
        self.db.refresh(lead)
        return lead

    def update_info(self, lead_id: int, payload: LeadInfoUpdate) -> Lead:
        lead = Repository(self.db).get_by_id(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(lead, field, value)
        self.db.commit()
        self.db.refresh(lead)
        if self.current_user:
            AuditService(self.db).record(
                self.current_user.organization_id,
                "lead.updated",
                "leads",
                str(lead.id),
                self.current_user.id,
            )
        return lead

    def delete(self, lead_id: int) -> None:
        lead = Repository(self.db).get_by_id(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        self.db.delete(lead)
        self.db.commit()
        if self.current_user:
            AuditService(self.db).record(
                self.current_user.organization_id,
                "lead.deleted",
                "leads",
                str(lead_id),
                self.current_user.id,
            )

    def update_status(self, lead_id: int, payload: LeadUpdate) -> Lead:
        lead = Repository(self.db).get_by_id(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        try:
            lead.status = LeadStatus(payload.status)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {payload.status}")
        self.db.commit()
        self.db.refresh(lead)
        if self.current_user:
            AuditService(self.db).record(
                self.current_user.organization_id,
                "lead.status_updated",
                "leads",
                str(lead.id),
                self.current_user.id,
            )
        return lead
