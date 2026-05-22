import json
from datetime import datetime

from app.core.time_utils import utcnow

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.enums import AssignmentType, RoleCode, SkillStatus
from app.db.models.project import Project
from app.db.models.project_member import ProjectMember
from app.db.models.project_recommendation import ProjectRecommendation
from app.db.models.project_requirement import ProjectRequirement
from app.db.models.skill import Skill
from app.db.models.user import User
from app.db.models.user_skill import UserSkill
from app.modules.projects.schemas import (
    ProjectMemberCreate,
    ProjectMemberRead,
    ProjectRecommendationRead,
    ProjectRequirementCreate,
    ProjectRequirementRead,
)

router = APIRouter(prefix="", tags=["projects"])


def _level_weight(level: str | None) -> float:
    if not level:
        return 1.0
    value = level.lower()
    if "lead" in value:
        return 4.0
    if "senior" in value:
        return 3.0
    if "mid" in value:
        return 2.0
    if "junior" in value:
        return 1.0
    return 1.0


def _compute_recommendations(
    db: Session, project: Project
) -> list[ProjectRecommendation]:
    requirements = db.scalars(
        select(ProjectRequirement).where(ProjectRequirement.project_id == project.id)
    ).all()
    if not requirements:
        return []

    db.execute(
        delete(ProjectRecommendation).where(
            ProjectRecommendation.project_id == project.id
        )
    )
    db.commit()

    users = db.scalars(
        select(User).where(
            User.organization_id == project.organization_id,
            User.role_code != RoleCode.CLIENT.value,
        )
    ).all()

    recommendations: list[ProjectRecommendation] = []
    for user in users:
        user_skills = db.scalars(
            select(UserSkill).where(
                UserSkill.user_id == user.id,
                UserSkill.status == SkillStatus.APPROVED,
            )
        ).all()
        if not user_skills:
            continue
        total = 0.0
        matches = []
        for requirement in requirements:
            for user_skill in user_skills:
                if user_skill.skill_id != requirement.skill_id:
                    continue
                weight = _level_weight(user_skill.level) * _level_weight(
                    requirement.level
                )
                total += weight
                matches.append({"skill_id": requirement.skill_id, "score": weight})
        if total <= 0:
            continue
        recommendations.append(
            ProjectRecommendation(
                project_id=project.id,
                user_id=user.id,
                score=total,
                status="suggested",
                reason_json=json.dumps({"matches": matches}, ensure_ascii=True),
            )
        )

    db.add_all(recommendations)
    db.commit()
    return recommendations


@router.post("/project-requirements", response_model=ProjectRequirementRead)
def create_project_requirement(
    payload: ProjectRequirementCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ProjectRequirementRead:
    project = db.scalar(
        select(Project).where(
            Project.id == payload.project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    skill = db.scalar(select(Skill).where(Skill.id == payload.skill_id))
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    requirement = ProjectRequirement(
        project_id=payload.project_id,
        skill_id=payload.skill_id,
        level=payload.level,
        is_required=payload.is_required,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return ProjectRequirementRead.model_validate(requirement)


@router.get("/project-recommendations", response_model=list[ProjectRecommendationRead])
def list_project_recommendations(
    project_id: int = Query(...),
    refresh: bool = Query(default=False),
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> list[ProjectRecommendationRead]:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if refresh:
        _compute_recommendations(db, project)

    results = db.execute(
        select(ProjectRecommendation, User)
        .join(User, User.id == ProjectRecommendation.user_id)
        .where(ProjectRecommendation.project_id == project.id)
    ).all()

    response: list[ProjectRecommendationRead] = []
    for recommendation, user in results:
        response.append(
            ProjectRecommendationRead(
                id=recommendation.id,
                project_id=recommendation.project_id,
                user_id=recommendation.user_id,
                score=recommendation.score,
                status=recommendation.status,
                reason_json=recommendation.reason_json,
                created_at=recommendation.created_at,
                user_name=user.full_name,
                user_email=user.email,
            )
        )
    return response


@router.get("/project-members", response_model=list[ProjectMemberRead])
def list_project_members(
    project_id: int | None = Query(default=None),
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> list[ProjectMemberRead]:
    if project_id is not None:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.organization_id == current_user.organization_id,
            )
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        results = db.execute(
            select(ProjectMember, User)
            .join(User, User.id == ProjectMember.user_id)
            .where(ProjectMember.project_id == project.id)
        ).all()
    else:
        # Sin filtro: devolver todos los miembros de proyectos de la org actual
        results = db.execute(
            select(ProjectMember, User)
            .join(Project, Project.id == ProjectMember.project_id)
            .join(User, User.id == ProjectMember.user_id)
            .where(Project.organization_id == current_user.organization_id)
        ).all()

    response: list[ProjectMemberRead] = []
    for member, user in results:
        response.append(
            ProjectMemberRead(
                id=member.id,
                project_id=member.project_id,
                user_id=member.user_id,
                role_in_project=member.role_in_project,
                allocation_percentage=member.allocation_percentage,
                can_publish_docs=member.can_publish_docs,
                assignment_type=member.assignment_type.value,
                is_required=member.is_required,
                joined_at=member.joined_at,
                user_name=user.full_name,
                user_email=user.email,
                user_role_code=user.role_code.value,
            )
        )
    return response


@router.get("/project-requirements", response_model=list[ProjectRequirementRead])
def list_project_requirements(
    project_id: int = Query(...),
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> list[ProjectRequirementRead]:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    results = db.execute(
        select(ProjectRequirement, Skill)
        .join(Skill, Skill.id == ProjectRequirement.skill_id)
        .where(ProjectRequirement.project_id == project.id)
    ).all()

    response: list[ProjectRequirementRead] = []
    for requirement, skill in results:
        response.append(
            ProjectRequirementRead(
                id=requirement.id,
                project_id=requirement.project_id,
                skill_id=requirement.skill_id,
                level=requirement.level,
                is_required=requirement.is_required,
                created_at=requirement.created_at,
                skill_name=skill.name,
            )
        )
    return response


@router.post("/project-members", response_model=dict)
def create_project_member(
    payload: ProjectMemberCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    project = db.scalar(
        select(Project).where(
            Project.id == payload.project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = db.scalar(
        select(User).where(
            User.id == payload.user_id,
            User.organization_id == current_user.organization_id,
        )
    )
    if not user or user.role_code == RoleCode.CLIENT:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == payload.project_id,
            ProjectMember.user_id == payload.user_id,
        )
    )
    if existing:
        return {"message": "Member already assigned"}

    try:
        assignment_type = AssignmentType(payload.assignment_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid assignment type") from exc

    member = ProjectMember(
        project_id=payload.project_id,
        user_id=payload.user_id,
        role_in_project=payload.role_in_project,
        allocation_percentage=payload.allocation_percentage,
        can_publish_docs=payload.can_publish_docs,
        assignment_type=assignment_type,
        is_required=payload.is_required,
        joined_at=utcnow(),
    )
    db.add(member)
    db.commit()
    return {"message": "Member assigned"}
