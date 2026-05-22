from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.enums import RoleCode
from app.db.models.organization import Organization
from app.db.repositories.base import Repository
from app.modules.organizations.schemas import OrganizationRead

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/", response_model=list[OrganizationRead])
def list_organizations(
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> list[OrganizationRead]:
    return [
        OrganizationRead.model_validate(item)
        for item in db.scalars(
            select(Organization).where(Organization.id == current_user.organization_id)
        ).all()
    ]
