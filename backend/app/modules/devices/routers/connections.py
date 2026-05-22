from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.enums import RoleCode
from app.modules.devices.schemas import DeviceConnectionCreate, DeviceConnectionRead
from app.modules.devices.services.connection_service import DeviceConnectionService

router = APIRouter(prefix="/device-connections", tags=["device-connections"])


@router.get("/", response_model=list[DeviceConnectionRead])
def list_connections(
    client_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[DeviceConnectionRead]:
    conns = DeviceConnectionService(db, current_user).list_for_client(client_id)
    return [DeviceConnectionRead.model_validate(c) for c in conns]


@router.post("/", response_model=DeviceConnectionRead, status_code=status.HTTP_201_CREATED)
def create_connection(
    payload: DeviceConnectionCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
    db: Session = Depends(get_db),
) -> DeviceConnectionRead:
    conn = DeviceConnectionService(db, current_user).create(payload)
    return DeviceConnectionRead.model_validate(conn)


@router.delete("/{connection_id}")
def delete_connection(
    connection_id: int,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    DeviceConnectionService(db, current_user).delete(connection_id)
    return {"message": "Connection deleted"}
