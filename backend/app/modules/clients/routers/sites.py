from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.client_site import ClientSite
from app.db.models.enums import RoleCode, SiteStatus
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.client_sites.schemas import ClientSiteCreate, ClientSiteRead, ClientSiteUpdate

router = APIRouter(prefix="/client-sites", tags=["client-sites"])


@router.get("/", response_model=list[ClientSiteRead])
def list_client_sites(
    client_id: int | None = None,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
    db: Session = Depends(get_db),
) -> list[ClientSiteRead]:
    stmt = select(ClientSite)
    if client_id:
        stmt = stmt.where(ClientSite.client_id == client_id)
    return [ClientSiteRead.model_validate(s) for s in db.scalars(stmt).all()]


@router.post("/", response_model=ClientSiteRead, status_code=status.HTTP_201_CREATED)
def create_client_site(
    payload: ClientSiteCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ClientSiteRead:
    site = ClientSite(
        client_id=payload.client_id,
        name=payload.name,
        address=payload.address,
        city=payload.city,
        country=payload.country,
        status=SiteStatus(payload.status),
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    AuditService(db).record(
        current_user.organization_id, "client_site.created", "client_sites", str(site.id), current_user.id
    )
    return ClientSiteRead.model_validate(site)


@router.put("/{site_id}", response_model=ClientSiteRead)
def update_client_site(
    site_id: int,
    payload: ClientSiteUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ClientSiteRead:
    site = Repository(db).get_by_id(ClientSite, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "status" and value is not None:
            value = SiteStatus(value)
        setattr(site, field, value)
    db.add(site)
    db.commit()
    db.refresh(site)
    AuditService(db).record(
        current_user.organization_id, "client_site.updated", "client_sites", str(site.id), current_user.id
    )
    return ClientSiteRead.model_validate(site)


@router.delete("/{site_id}")
def delete_client_site(
    site_id: int,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    site = Repository(db).get_by_id(ClientSite, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    db.delete(site)
    db.commit()
    return {"message": "Site deleted"}
