from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.collection_snapshot import CollectionSnapshot
from app.db.models.integration import Integration
from app.db.models.enums import RoleCode
from app.db.repositories.base import Repository
from app.modules.collection.schemas import SnapshotRead

router = APIRouter(prefix="/collection", tags=["collection"])


@router.get("/snapshots", response_model=list[SnapshotRead])
def list_snapshots(
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[SnapshotRead]:
    stmt = (
        select(CollectionSnapshot)
        .join(Integration, CollectionSnapshot.integration_id == Integration.id)
        .where(Integration.organization_id == current_user.organization_id)
    )
    return [SnapshotRead.model_validate(item) for item in db.scalars(stmt).all()]
