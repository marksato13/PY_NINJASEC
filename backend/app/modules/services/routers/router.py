from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.service import Service
from app.db.models.service_request import ServiceRequest
from app.db.models.enums import RoleCode, ServiceRequestStatus
from app.db.repositories.base import Repository
from app.modules.services.schemas import (
    ServiceCreate,
    ServiceRead,
    ServiceRequestCreate,
    ServiceRequestRead,
    ServiceRequestUpdate,
)

router = APIRouter(prefix="/services", tags=["services"])


@router.get("/", response_model=list[ServiceRead])
def list_services(db: Session = Depends(get_db)) -> list[ServiceRead]:
    return [
        ServiceRead.model_validate(item) for item in Repository(db).list_all(Service)
    ]


@router.post("/", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ServiceRead:
    if payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Organization access denied")
    service = Service(**payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return ServiceRead.model_validate(service)


@router.delete("/{service_id}")
def delete_service(
    service_id: int,
    current_user: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    service = Repository(db).get_by_id(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if service.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(service)
    db.commit()
    return {"message": "Service deleted"}


@router.get("/requests", response_model=list[ServiceRequestRead])
def list_service_requests(
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.CLIENT.value)
    ),
    db: Session = Depends(get_db),
) -> list[ServiceRequestRead]:
    stmt = (
        select(ServiceRequest)
        .join(Service, ServiceRequest.service_id == Service.id)
        .where(Service.organization_id == current_user.organization_id)
    )
    if current_user.role == RoleCode.CLIENT.value:
        stmt = stmt.where(ServiceRequest.requester_email == current_user.email)
    return [ServiceRequestRead.model_validate(item) for item in db.scalars(stmt).all()]


@router.post(
    "/requests", response_model=ServiceRequestRead, status_code=status.HTTP_201_CREATED
)
def create_service_request(
    payload: ServiceRequestCreate, db: Session = Depends(get_db)
) -> ServiceRequestRead:
    req = ServiceRequest(
        **{**payload.model_dump(), "status": ServiceRequestStatus.NEW}
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return ServiceRequestRead.model_validate(req)


@router.patch("/requests/{request_id}", response_model=ServiceRequestRead)
def update_service_request(
    request_id: int,
    payload: ServiceRequestUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ServiceRequestRead:
    req = Repository(db).get_by_id(ServiceRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Service request not found")
    try:
        req.status = ServiceRequestStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {payload.status}")
    db.commit()
    db.refresh(req)
    return ServiceRequestRead.model_validate(req)
