from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.client import Client
from app.db.models.client_profile import ClientProfile
from app.db.models.project import Project
from app.db.models.project_member import ProjectMember
from app.db.models.project_type import ProjectType
from app.db.models.product import Product
from app.db.models.enums import ProjectStatus, RoleCode
from app.db.models.service import Service
from app.db.repositories.base import Repository
from app.modules.projects.schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=list[ProjectRead])
def list_projects(
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
            RoleCode.CLIENT.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[ProjectRead]:
    if current_user.role == RoleCode.CLIENT.value:
        profile = db.scalar(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        if not profile:
            return []
        stmt = select(Project).where(Project.client_id == profile.client_id)
    elif current_user.role == RoleCode.COLLABORATOR.value:
        stmt = (
            select(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(ProjectMember.user_id == current_user.id)
        )
    else:
        stmt = select(Project).where(
            Project.organization_id == current_user.organization_id
        )
    return [ProjectRead.model_validate(item) for item in db.scalars(stmt).all()]


@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ProjectRead:
    if payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Organization access denied")
    if not payload.client_id:
        raise HTTPException(status_code=400, detail="Client is required")
    if not payload.project_type_id:
        raise HTTPException(status_code=400, detail="Project type is required")
    if not payload.service_id and not payload.product_id:
        raise HTTPException(status_code=400, detail="Service or product is required")

    project_type = db.scalar(
        select(ProjectType).where(ProjectType.id == payload.project_type_id)
    )
    if not project_type:
        raise HTTPException(status_code=404, detail="Project type not found")

    client = db.scalar(
        select(Client).where(
            Client.id == payload.client_id,
            Client.organization_id == current_user.organization_id,
        )
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    area_id = None
    service_id = payload.service_id
    product_id = payload.product_id

    if service_id:
        service = db.scalar(
            select(Service).where(
                Service.id == service_id,
                Service.organization_id == current_user.organization_id,
            )
        )
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        area_id = service.area_id

    if product_id:
        product = db.scalar(
            select(Product).where(
                Product.id == product_id,
                Product.organization_id == current_user.organization_id,
            )
        )
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        area_id = area_id or product.area_id

    if not area_id:
        raise HTTPException(status_code=400, detail="Area could not be resolved")

    try:
        status_value = ProjectStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid status") from exc

    if status_value == ProjectStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Project cannot be active without collaborators",
        )

    project = Project(
        organization_id=payload.organization_id,
        client_id=payload.client_id,
        project_type_id=payload.project_type_id,
        area_id=area_id,
        service_id=service_id,
        product_id=product_id,
        name=payload.name,
        description=payload.description,
        status=status_value,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectRead.model_validate(project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
            RoleCode.CLIENT.value,
        )
    ),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = Repository(db).get_by_id(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role == RoleCode.CLIENT.value:
        profile = db.scalar(
            select(ClientProfile).where(ClientProfile.user_id == current_user.id)
        )
        if not profile or project.client_id != profile.client_id:
            raise HTTPException(status_code=404, detail="Project not found")
    elif current_user.role == RoleCode.COLLABORATOR.value:
        membership = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == current_user.id,
            )
        )
        if not membership:
            raise HTTPException(status_code=404, detail="Project not found")
    else:
        if project.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Project not found")

    return ProjectRead.model_validate(project)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    project = Repository(db).get_by_id(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ProjectRead:
    project = Repository(db).get_by_id(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.status:
        try:
            status_value = ProjectStatus(payload.status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid status") from exc
        if status_value == ProjectStatus.ACTIVE:
            member_exists = db.scalar(
                select(ProjectMember).where(ProjectMember.project_id == project.id)
            )
            if not member_exists:
                raise HTTPException(
                    status_code=400,
                    detail="Project cannot be active without collaborators",
                )
        project.status = status_value

    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    if payload.start_date is not None:
        project.start_date = payload.start_date
    if payload.end_date is not None:
        project.end_date = payload.end_date

    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectRead.model_validate(project)
