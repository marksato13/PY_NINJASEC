from datetime import datetime

from app.core.time_utils import utcnow

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.client import Client
from app.db.models.client_profile import ClientProfile
from app.db.models.enums import RoleCode
from app.db.models.integration import Integration
from app.db.repositories.base import Repository
from app.modules.audit.services.audit_service import AuditService
from app.modules.collection.services.collection_service import CollectionService
from app.modules.integrations.schemas import (
    IntegrationCreate,
    IntegrationRead,
    IntegrationTestRequest,
    IntegrationTestResponse,
    IntegrationUpdate,
)
from app.modules.integrations.services.connectors import simulate_connector_test

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ---------------------------------------------------------------------------
# Rutas estáticas primero
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[IntegrationRead])
def list_integrations(
    client_id: int | None = None,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
            RoleCode.CLIENT.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[IntegrationRead]:
    if current_user.role == RoleCode.CLIENT.value:
        profile = db.scalar(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        if not profile:
            return []
        stmt = select(Integration).where(Integration.client_id == profile.client_id)
    else:
        stmt = select(Integration).where(
            Integration.organization_id == current_user.organization_id
        )
        if client_id:
            stmt = stmt.where(Integration.client_id == client_id)
    return [IntegrationRead.model_validate(item) for item in db.scalars(stmt).all()]


@router.post("/", response_model=IntegrationRead, status_code=status.HTTP_201_CREATED)
def create_integration(
    payload: IntegrationCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> IntegrationRead:
    if payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Organization access denied")

    # Regla 2 (doc 30): client_id obligatorio y debe pertenecer a la misma org
    client = db.get(Client, payload.client_id)
    if not client or client.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Client not found or access denied")

    integration = Integration(**payload.model_dump())
    db.add(integration)
    db.commit()
    db.refresh(integration)
    AuditService(db).record(
        current_user.organization_id,
        "integration.created",
        "integrations",
        str(integration.id),
        current_user.id,
    )
    return IntegrationRead.model_validate(integration)


@router.post("/test-connection", response_model=IntegrationTestResponse)
def test_connection(
    payload: IntegrationTestRequest,
    _: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
) -> IntegrationTestResponse:
    result = simulate_connector_test(payload.connector_type, payload.base_url)
    return IntegrationTestResponse(
        connector_type=payload.connector_type,
        reachable=bool(result["reachable"]),
        message=str(result["message"]),
    )


# ---------------------------------------------------------------------------
# Rutas con path param — siempre después de estáticas
# ---------------------------------------------------------------------------

@router.get("/{integration_id}", response_model=IntegrationRead)
def get_integration(
    integration_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
            RoleCode.CLIENT.value,
        )
    ),
    db: Session = Depends(get_db),
) -> IntegrationRead:
    integration = Repository(db).get_by_id(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # CLIENT solo puede ver integraciones de su propio cliente
    if current_user.role == RoleCode.CLIENT.value:
        profile = db.scalar(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        if not profile or integration.client_id != profile.client_id:
            raise HTTPException(status_code=404, detail="Integration not found")
    elif integration.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    return IntegrationRead.model_validate(integration)


@router.patch("/{integration_id}", response_model=IntegrationRead)
def update_integration(
    integration_id: int,
    payload: IntegrationUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> IntegrationRead:
    integration = Repository(db).get_by_id(Integration, integration_id)
    if not integration or integration.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(integration, field, value)

    db.add(integration)
    db.commit()
    db.refresh(integration)
    AuditService(db).record(
        current_user.organization_id,
        "integration.updated",
        "integrations",
        str(integration.id),
        current_user.id,
    )
    # effective_status y is_license_expired se recalculan en el model_validator de IntegrationRead
    return IntegrationRead.model_validate(integration)


@router.delete("/{integration_id}")
def delete_integration(
    integration_id: int,
    current_user: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    integration = Repository(db).get_by_id(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    if integration.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Integration not found")
    db.delete(integration)
    db.commit()
    AuditService(db).record(
        current_user.organization_id,
        "integration.deleted",
        "integrations",
        str(integration_id),
        current_user.id,
    )
    return {"message": "Integration deleted"}


@router.post("/{integration_id}/collect")
def collect_integration_data(
    integration_id: int,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    integration = Repository(db).get_by_id(Integration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    if integration.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    result = simulate_connector_test(integration.connector_type, integration.base_url)
    integration.status = "connected" if result["reachable"] else "error"
    integration.last_sync_at = utcnow()
    db.add(integration)
    db.commit()
    db.refresh(integration)

    if not result["reachable"]:
        return {
            "message": "Collection skipped: connector unreachable",
            "status": integration.status,
        }

    background_tasks.add_task(
        CollectionService(db).register_collection_result, integration, result
    )
    return {"message": "Collection scheduled", "status": integration.status}
