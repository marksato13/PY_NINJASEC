from datetime import datetime

from app.core.time_utils import utcnow

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, get_current_user, require_roles
from app.common.deps.database import get_db
from app.db.models.enums import RoleCode, SkillStatus
from app.db.models.skill import Skill
from app.db.models.user import User
from app.db.models.user_skill import UserSkill
from app.modules.audit.services.audit_service import AuditService
from app.modules.skills.schemas import (
    SkillCreate,
    SkillRead,
    UserSkillCreate,
    UserSkillRead,
    UserSkillUpdate,
    UserSkillVerify,
)

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("/", response_model=list[SkillRead])
def list_skills(db: Session = Depends(get_db)) -> list[SkillRead]:
    return [
        SkillRead.model_validate(item)
        for item in db.scalars(select(Skill).where(Skill.is_active == True)).all()
    ]


@router.post("/", response_model=SkillRead, status_code=status.HTTP_201_CREATED)
def create_skill(
    payload: SkillCreate,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SkillRead:
    existing = db.scalar(select(Skill).where(Skill.name == payload.name))
    if existing:
        return SkillRead.model_validate(existing)
    skill = Skill(name=payload.name, category=payload.category, is_active=True)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    AuditService(db).record(
        _.organization_id,
        "skill.created",
        "skills",
        str(skill.id),
        _.id,
        metadata_json=json.dumps({"name": skill.name}, ensure_ascii=True),
    )
    return SkillRead.model_validate(skill)


@router.get("/user-skills", response_model=list[UserSkillRead])
def list_user_skills(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserSkillRead]:
    stmt = select(UserSkill, Skill.name).join(Skill, Skill.id == UserSkill.skill_id)
    if current_user.role != RoleCode.SUPER_ADMIN.value:
        stmt = stmt.join(User, User.id == UserSkill.user_id).where(
            User.organization_id == current_user.organization_id
        )
        if current_user.role not in (RoleCode.ADMIN.value, RoleCode.SUPER_ADMIN.value):
            stmt = stmt.where(UserSkill.user_id == current_user.id)

    rows = db.execute(stmt).all()
    response: list[UserSkillRead] = []
    for item, skill_name in rows:
        response.append(
            UserSkillRead(
                id=item.id,
                user_id=item.user_id,
                skill_id=item.skill_id,
                skill_name=skill_name,
                level=item.level,
                status=item.status.value,
                verified_by=item.verified_by,
                verified_at=item.verified_at,
                created_at=item.created_at,
            )
        )
    return response


@router.post(
    "/user-skills", response_model=UserSkillRead, status_code=status.HTTP_201_CREATED
)
def create_user_skill(
    payload: UserSkillCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSkillRead:
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

    skill = db.scalar(select(Skill).where(Skill.id == payload.skill_id))
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    existing = db.scalar(
        select(UserSkill).where(
            UserSkill.user_id == user_id, UserSkill.skill_id == payload.skill_id
        )
    )
    if existing:
        return UserSkillRead(
            id=existing.id,
            user_id=existing.user_id,
            skill_id=existing.skill_id,
            skill_name=skill.name,
            level=existing.level,
            status=existing.status.value,
            verified_by=existing.verified_by,
            verified_at=existing.verified_at,
            created_at=existing.created_at,
        )

    user_skill = UserSkill(
        user_id=user_id,
        skill_id=payload.skill_id,
        level=payload.level,
        status=SkillStatus.PENDING,
    )
    db.add(user_skill)
    db.commit()
    db.refresh(user_skill)
    AuditService(db).record(
        current_user.organization_id,
        "user_skill.created",
        "user_skills",
        str(user_skill.id),
        current_user.id,
        metadata_json=json.dumps(
            {"user_id": user_skill.user_id, "skill_id": user_skill.skill_id},
            ensure_ascii=True,
        ),
    )
    return UserSkillRead(
        id=user_skill.id,
        user_id=user_skill.user_id,
        skill_id=user_skill.skill_id,
        skill_name=skill.name,
        level=user_skill.level,
        status=user_skill.status.value,
        verified_by=user_skill.verified_by,
        verified_at=user_skill.verified_at,
        created_at=user_skill.created_at,
    )


@router.put("/user-skills/{user_skill_id}", response_model=UserSkillRead)
def update_user_skill(
    user_skill_id: int,
    payload: UserSkillUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSkillRead:
    user_skill = db.scalar(select(UserSkill).where(UserSkill.id == user_skill_id))
    if not user_skill:
        raise HTTPException(status_code=404, detail="User skill not found")
    if user_skill.user_id != current_user.id:
        if current_user.role not in (RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        target_user = db.scalar(select(User).where(User.id == user_skill.user_id))
        if (
            not target_user
            or target_user.organization_id != current_user.organization_id
        ):
            raise HTTPException(status_code=404, detail="User not found")

    if payload.level is not None:
        user_skill.level = payload.level
    db.add(user_skill)
    db.commit()
    db.refresh(user_skill)

    AuditService(db).record(
        current_user.organization_id,
        "user_skill.updated",
        "user_skills",
        str(user_skill.id),
        current_user.id,
        metadata_json=json.dumps(
            {"user_id": user_skill.user_id, "skill_id": user_skill.skill_id},
            ensure_ascii=True,
        ),
    )

    skill_name = db.scalar(select(Skill.name).where(Skill.id == user_skill.skill_id))
    return UserSkillRead(
        id=user_skill.id,
        user_id=user_skill.user_id,
        skill_id=user_skill.skill_id,
        skill_name=skill_name,
        level=user_skill.level,
        status=user_skill.status.value,
        verified_by=user_skill.verified_by,
        verified_at=user_skill.verified_at,
        created_at=user_skill.created_at,
    )


@router.post("/user-skills/{user_skill_id}/verify", response_model=UserSkillRead)
def verify_user_skill(
    user_skill_id: int,
    payload: UserSkillVerify,
    current_user: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> UserSkillRead:
    user_skill = db.scalar(select(UserSkill).where(UserSkill.id == user_skill_id))
    if not user_skill:
        raise HTTPException(status_code=404, detail="User skill not found")

    target_user = db.scalar(select(User).where(User.id == user_skill.user_id))
    if not target_user or target_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        status_value = SkillStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid status") from exc

    user_skill.status = status_value
    user_skill.verified_by = current_user.id
    user_skill.verified_at = utcnow()
    db.add(user_skill)
    db.commit()
    db.refresh(user_skill)

    AuditService(db).record(
        current_user.organization_id,
        f"user_skill.{user_skill.status.value}",
        "user_skills",
        str(user_skill.id),
        current_user.id,
        metadata_json=json.dumps(
            {"user_id": user_skill.user_id, "skill_id": user_skill.skill_id},
            ensure_ascii=True,
        ),
    )

    skill_name = db.scalar(select(Skill.name).where(Skill.id == user_skill.skill_id))
    return UserSkillRead(
        id=user_skill.id,
        user_id=user_skill.user_id,
        skill_id=user_skill.skill_id,
        skill_name=skill_name,
        level=user_skill.level,
        status=user_skill.status.value,
        verified_by=user_skill.verified_by,
        verified_at=user_skill.verified_at,
        created_at=user_skill.created_at,
    )
