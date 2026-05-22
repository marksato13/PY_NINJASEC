from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.client import Client
from app.db.models.client_service import ClientService
from app.db.models.enums import RoleCode
from app.db.models.service import Service
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.client_services.schemas import (
    ClientServiceCreate,
    ClientServiceRead,
    ClientServiceUpdate,
)

router = APIRouter(prefix="/client-services", tags=["client-services"])


def _assert_client_in_org(client_id: int, org_id: int, db: Session) -> Client:
    client = db.get(Client, client_id)
    if not client or client.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Client not found or access denied")
    return client


def _assert_service_in_org(service_id: int, org_id: int, db: Session) -> Service:
    service = db.get(Service, service_id)
    if not service or service.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Service not found or access denied")
    return service


@router.get("/", response_model=list[ClientServiceRead])
def list_client_services(
    client_id: int | None = None,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[ClientServiceRead]:
    stmt = (
        select(ClientService)
        .join(Client, ClientService.client_id == Client.id)
        .where(Client.organization_id == current_user.organization_id)
    )
    if client_id:
        stmt = stmt.where(ClientService.client_id == client_id)
    return [ClientServiceRead.model_validate(cs) for cs in db.scalars(stmt).all()]


@router.post("/", response_model=ClientServiceRead, status_code=status.HTTP_201_CREATED)
def create_client_service(
    payload: ClientServiceCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ClientServiceRead:
    _assert_client_in_org(payload.client_id, current_user.organization_id, db)
    _assert_service_in_org(payload.service_id, current_user.organization_id, db)

    existing = db.scalar(
        select(ClientService).where(
            ClientService.client_id == payload.client_id,
            ClientService.service_id == payload.service_id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Service already linked to this client")

    cs = ClientService(**payload.model_dump())
    db.add(cs)
    db.commit()
    db.refresh(cs)
    AuditService(db).record(
        current_user.organization_id,
        "client_service.created",
        "client_services",
        str(cs.id),
        current_user.id,
    )
    return ClientServiceRead.model_validate(cs)


@router.patch("/{cs_id}", response_model=ClientServiceRead)
def update_client_service(
    cs_id: int,
    payload: ClientServiceUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ClientServiceRead:
    cs = Repository(db).get_by_id(ClientService, cs_id)
    if not cs:
        raise HTTPException(status_code=404, detail="Client service not found")
    _assert_client_in_org(cs.client_id, current_user.organization_id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cs, field, value)

    db.add(cs)
    db.commit()
    db.refresh(cs)
    AuditService(db).record(
        current_user.organization_id,
        "client_service.updated",
        "client_services",
        str(cs.id),
        current_user.id,
    )
    return ClientServiceRead.model_validate(cs)


@router.delete("/{cs_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_service(
    cs_id: int,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> None:
    cs = Repository(db).get_by_id(ClientService, cs_id)
    if not cs:
        raise HTTPException(status_code=404, detail="Client service not found")
    _assert_client_in_org(cs.client_id, current_user.organization_id, db)
    db.delete(cs)
    db.commit()
    AuditService(db).record(
        current_user.organization_id,
        "client_service.deleted",
        "client_services",
        str(cs_id),
        current_user.id,
    )
