from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.core.security import hash_password
from app.db.models.enums import RoleCode, UserStatus
from app.db.models.role import Role
from app.db.models.user import User
from app.db.repositories.base import Repository
from app.db.repositories.users import UserRepository
from app.modules.audit.services.audit_service import AuditService
from app.modules.users.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserRead])
def list_users(
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> list[UserRead]:
    return [
        UserRead.model_validate(user)
        for user in UserRepository(db).list_users(current_user.organization_id)
    ]


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> UserRead:
    if payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Organization access denied")
    repository = UserRepository(db)
    if repository.get_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already exists")

    role = db.scalar(select(Role).where(Role.code == payload.role_code))
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = User(
        organization_id=payload.organization_id,
        role_id=role.id,
        role_code=RoleCode(payload.role_code),
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        status=UserStatus.ACTIVE,
        job_title=payload.job_title,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    AuditService(db).record(
        current_user.organization_id,
        "user.created",
        "users",
        str(user.id),
        current_user.id,
    )
    return UserRead.model_validate(user)


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> UserRead:
    user = Repository(db).get_by_id(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Admin no puede editar a super_admin ni a otros admin (solo a su propio registro)
    if current_user.role == RoleCode.ADMIN.value:
        target_role = user.role_code.value if user.role_code else None
        if target_role == RoleCode.SUPER_ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin cannot modify super_admin users")
        if target_role == RoleCode.ADMIN.value and user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Admin cannot modify other admin users")

    data = payload.model_dump(exclude_unset=True)

    # Cambio de rol: solo super_admin puede hacerlo
    if "role_code" in data and data["role_code"] is not None:
        if current_user.role != RoleCode.SUPER_ADMIN.value:
            raise HTTPException(status_code=403, detail="Only super_admin can change roles")
        new_role = db.scalar(select(Role).where(Role.code == data["role_code"]))
        if not new_role:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role_id = new_role.id
        user.role_code = RoleCode(data.pop("role_code"))

    for field, value in data.items():
        setattr(user, field, value)

    db.add(user)
    db.commit()
    db.refresh(user)
    AuditService(db).record(
        current_user.organization_id,
        "user.updated",
        "users",
        str(user.id),
        current_user.id,
    )
    return UserRead.model_validate(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = Repository(db).get_by_id(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    AuditService(db).record(
        current_user.organization_id,
        "user.deleted",
        "users",
        str(user_id),
        current_user.id,
    )
    return {"message": "User deleted"}
