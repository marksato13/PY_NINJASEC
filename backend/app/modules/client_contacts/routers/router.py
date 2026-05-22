from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.client_contact import ClientContact
from app.db.models.enums import RoleCode
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.client_contacts.schemas import (
    ClientContactCreate,
    ClientContactRead,
    ClientContactUpdate,
)

router = APIRouter(prefix="/client-contacts", tags=["client-contacts"])


@router.get("/", response_model=list[ClientContactRead])
def list_client_contacts(
    client_id: int | None = None,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
    db: Session = Depends(get_db),
) -> list[ClientContactRead]:
    stmt = select(ClientContact)
    if client_id:
        stmt = stmt.where(ClientContact.client_id == client_id)
    return [ClientContactRead.model_validate(c) for c in db.scalars(stmt).all()]


@router.post("/", response_model=ClientContactRead, status_code=status.HTTP_201_CREATED)
def create_client_contact(
    payload: ClientContactCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ClientContactRead:
    contact = ClientContact(**payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    AuditService(db).record(
        current_user.organization_id, "client_contact.created", "client_contacts", str(contact.id), current_user.id
    )
    return ClientContactRead.model_validate(contact)


@router.put("/{contact_id}", response_model=ClientContactRead)
def update_client_contact(
    contact_id: int,
    payload: ClientContactUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ClientContactRead:
    contact = Repository(db).get_by_id(ClientContact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    AuditService(db).record(
        current_user.organization_id, "client_contact.updated", "client_contacts", str(contact.id), current_user.id
    )
    return ClientContactRead.model_validate(contact)


@router.delete("/{contact_id}")
def delete_client_contact(
    contact_id: int,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    contact = Repository(db).get_by_id(ClientContact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"message": "Contact deleted"}
