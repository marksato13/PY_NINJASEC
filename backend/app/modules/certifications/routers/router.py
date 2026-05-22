import json
from datetime import datetime

from app.core.time_utils import utcnow

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, get_current_user, require_roles
from app.common.deps.database import get_db
from app.db.models.enums import CertificationStatus, RoleCode
from app.db.models.user import User
from app.db.models.user_certification import UserCertification
from app.modules.audit.services.audit_service import AuditService
from app.modules.certifications.schemas import (
    UserCertificationCreate,
    UserCertificationRead,
    UserCertificationUpdate,
    UserCertificationVerify,
)

router = APIRouter(prefix="/user-certifications", tags=["certifications"])


@router.get("/", response_model=list[UserCertificationRead])
def list_user_certifications(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserCertificationRead]:
    stmt = select(UserCertification).join(User, User.id == UserCertification.user_id)
    stmt = stmt.where(User.organization_id == current_user.organization_id)
    return [
        UserCertificationRead.model_validate(item) for item in db.scalars(stmt).all()
    ]


@router.post(
    "/", response_model=UserCertificationRead, status_code=status.HTTP_201_CREATED
)
def create_user_certification(
    payload: UserCertificationCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserCertificationRead:
    user_id = payload.user_id or current_user.id
    if user_id != current_user.id:
        if current_user.role != RoleCode.SUPER_ADMIN.value:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        target_user = db.scalar(select(User).where(User.id == user_id))
        if (
            not target_user
            or target_user.organization_id != current_user.organization_id
        ):
            raise HTTPException(status_code=404, detail="User not found")

    certification = UserCertification(
        user_id=user_id,
        name=payload.name,
        issuer=payload.issuer,
        credential_id=payload.credential_id,
        url=payload.url,
        status=CertificationStatus.PENDING,
        issued_at=payload.issued_at,
        expires_at=payload.expires_at,
    )
    db.add(certification)
    db.commit()
    db.refresh(certification)
    AuditService(db).record(
        current_user.organization_id,
        "user_certification.created",
        "user_certifications",
        str(certification.id),
        current_user.id,
        metadata_json=json.dumps(
            {"user_id": certification.user_id, "name": certification.name},
            ensure_ascii=True,
        ),
    )
    return UserCertificationRead.model_validate(certification)


@router.put("/{cert_id}", response_model=UserCertificationRead)
def update_user_certification(
    cert_id: int,
    payload: UserCertificationUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserCertificationRead:
    certification = db.scalar(
        select(UserCertification).where(UserCertification.id == cert_id)
    )
    if not certification:
        raise HTTPException(status_code=404, detail="Certification not found")
    if certification.user_id != current_user.id:
        if current_user.role not in (RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        target_user = db.scalar(select(User).where(User.id == certification.user_id))
        if (
            not target_user
            or target_user.organization_id != current_user.organization_id
        ):
            raise HTTPException(status_code=404, detail="User not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(certification, field, value)
    db.add(certification)
    db.commit()
    db.refresh(certification)
    AuditService(db).record(
        current_user.organization_id,
        "user_certification.updated",
        "user_certifications",
        str(certification.id),
        current_user.id,
        metadata_json=json.dumps(
            {"user_id": certification.user_id, "name": certification.name},
            ensure_ascii=True,
        ),
    )
    return UserCertificationRead.model_validate(certification)


@router.post("/{cert_id}/verify", response_model=UserCertificationRead)
def verify_user_certification(
    cert_id: int,
    payload: UserCertificationVerify,
    current_user: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> UserCertificationRead:
    certification = db.scalar(
        select(UserCertification).where(UserCertification.id == cert_id)
    )
    if not certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    target_user = db.scalar(select(User).where(User.id == certification.user_id))
    if not target_user or target_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        status_value = CertificationStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid status") from exc

    certification.status = status_value
    certification.verified_by = current_user.id
    certification.verified_at = utcnow()
    db.add(certification)
    db.commit()
    db.refresh(certification)

    AuditService(db).record(
        current_user.organization_id,
        f"user_certification.{certification.status.value}",
        "user_certifications",
        str(certification.id),
        current_user.id,
        metadata_json=json.dumps(
            {"user_id": certification.user_id, "name": certification.name},
            ensure_ascii=True,
        ),
    )
    return UserCertificationRead.model_validate(certification)
