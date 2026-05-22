from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.collaborator_profile import CollaboratorProfile
from app.db.models.user import User
from app.db.models.enums import RoleCode
from app.db.repositories.base import Repository
from app.modules.collaborators.schemas import CollaboratorCreate, CollaboratorRead, CollaboratorUpdate

router = APIRouter(prefix="/collaborators", tags=["collaborators"])
_UPLOAD_DIR = Path("app/static/uploads/collaborators")


@router.get("/", response_model=list[CollaboratorRead])
def list_collaborators(
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
    db: Session = Depends(get_db),
) -> list[CollaboratorRead]:
    stmt = (
        select(CollaboratorProfile)
        .join(User, CollaboratorProfile.user_id == User.id)
        .where(User.organization_id == current_user.organization_id)
    )
    return [CollaboratorRead.model_validate(item) for item in db.scalars(stmt).all()]


@router.post("/", response_model=CollaboratorRead, status_code=status.HTTP_201_CREATED)
def create_collaborator(
    payload: CollaboratorCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> CollaboratorRead:
    user = Repository(db).get_by_id(User, payload.user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    if Repository(db).get_by_id(CollaboratorProfile, payload.user_id):
        raise HTTPException(
            status_code=400, detail="Collaborator profile already exists"
        )
    profile = CollaboratorProfile(**payload.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return CollaboratorRead.model_validate(profile)


@router.patch("/{profile_id}", response_model=CollaboratorRead)
def update_collaborator(
    profile_id: int,
    payload: CollaboratorUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
    db: Session = Depends(get_db),
) -> CollaboratorRead:
    profile = Repository(db).get_by_id(CollaboratorProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collaborator profile not found")
    user = Repository(db).get_by_id(User, profile.user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Collaborator profile not found")
    if current_user.role == RoleCode.COLLABORATOR.value and profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Collaborators can only edit their own profile")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return CollaboratorRead.model_validate(profile)


@router.post("/{profile_id}/photo", response_model=CollaboratorRead)
async def upload_collaborator_photo(
    profile_id: int,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value, RoleCode.COLLABORATOR.value)
    ),
    db: Session = Depends(get_db),
) -> CollaboratorRead:
    profile = Repository(db).get_by_id(CollaboratorProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collaborator profile not found")
    user = Repository(db).get_by_id(User, profile.user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Collaborator profile not found")
    if current_user.role == RoleCode.COLLABORATOR.value and profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Collaborators can only edit their own profile")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file")
    content_type = (file.content_type or "").lower()
    allowed = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    ext = allowed.get(content_type)
    if ext is None:
        raise HTTPException(status_code=400, detail="Only JPG, PNG or WEBP images are allowed")

    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"collab_{profile_id}_{uuid4().hex[:10]}{ext}"
    save_path = _UPLOAD_DIR / filename
    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    save_path.write_bytes(file_bytes)

    profile.photo_url = f"/static/uploads/collaborators/{filename}"
    db.commit()
    db.refresh(profile)
    return CollaboratorRead.model_validate(profile)


@router.delete("/{profile_id}")
def delete_collaborator(
    profile_id: int,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    profile = Repository(db).get_by_id(CollaboratorProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collaborator profile not found")
    user = Repository(db).get_by_id(User, profile.user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Collaborator profile not found")
    db.delete(profile)
    db.commit()
    return {"message": "Collaborator deleted"}
