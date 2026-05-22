import json
from datetime import datetime

from app.core.time_utils import utcnow

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, get_current_user, require_roles
from app.common.deps.database import get_db
from app.db.models.client import Client
from app.db.models.client_profile import ClientProfile
from app.db.models.doc_type import DocType
from app.db.models.enums import (
    ClientStatus,
    DocScope,
    DocStatus,
    DocVisibility,
    RoleCode,
)
from app.db.models.project import Project
from app.db.models.project_doc import ProjectDoc
from app.db.models.project_member import ProjectMember
from app.modules.audit.services.audit_service import AuditService
from app.modules.docs.schemas import (
    DocTypeCreate,
    DocTypeRead,
    DocTypeUpdate,
    ProjectDocCreate,
    ProjectDocRead,
    ProjectDocToggle,
    ProjectDocUpdate,
    ProjectDocVerify,
)

router = APIRouter(prefix="", tags=["docs"])


def _get_client_profile(db: Session, user_id: int) -> ClientProfile | None:
    return db.scalar(select(ClientProfile).where(ClientProfile.user_id == user_id))


def _get_project_member(
    db: Session, project_id: int, user_id: int
) -> ProjectMember | None:
    return db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )


@router.get("/doc-types", response_model=list[DocTypeRead])
def list_doc_types(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocTypeRead]:
    return [
        DocTypeRead.model_validate(item) for item in db.scalars(select(DocType)).all()
    ]


@router.post(
    "/doc-types", response_model=DocTypeRead, status_code=status.HTTP_201_CREATED
)
def create_doc_type(
    payload: DocTypeCreate,
    _: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> DocTypeRead:
    existing = db.scalar(select(DocType).where(DocType.name == payload.name))
    if existing:
        return DocTypeRead.model_validate(existing)
    try:
        scope_value = DocScope(payload.scope)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid scope") from exc

    doc_type = DocType(
        name=payload.name, scope=scope_value, is_active=payload.is_active
    )
    db.add(doc_type)
    db.commit()
    db.refresh(doc_type)
    return DocTypeRead.model_validate(doc_type)


@router.put("/doc-types/{doc_type_id}", response_model=DocTypeRead)
def update_doc_type(
    doc_type_id: int,
    payload: DocTypeUpdate,
    _: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> DocTypeRead:
    doc_type = db.scalar(select(DocType).where(DocType.id == doc_type_id))
    if not doc_type:
        raise HTTPException(status_code=404, detail="Doc type not found")
    updates = payload.model_dump(exclude_unset=True)
    if "scope" in updates:
        try:
            updates["scope"] = DocScope(updates["scope"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid scope") from exc
    for field, value in updates.items():
        setattr(doc_type, field, value)
    db.add(doc_type)
    db.commit()
    db.refresh(doc_type)
    return DocTypeRead.model_validate(doc_type)


@router.get("/project-docs", response_model=list[ProjectDocRead])
def list_project_docs(
    project_id: int | None = Query(default=None),
    visibility: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectDocRead]:
    stmt = select(ProjectDoc).join(Project, Project.id == ProjectDoc.project_id)
    if project_id:
        stmt = stmt.where(Project.id == project_id)

    if current_user.role in (RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value):
        stmt = stmt.where(Project.organization_id == current_user.organization_id)
    elif current_user.role == RoleCode.COLLABORATOR.value:
        stmt = stmt.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == current_user.id
        )
    else:
        profile = _get_client_profile(db, current_user.id)
        if not profile:
            return []
        stmt = stmt.join(Client, Client.id == Project.client_id).where(
            Project.client_id == profile.client_id,
            Client.commercial_status == ClientStatus.ACTIVE,
            ProjectDoc.enabled == True,
            ProjectDoc.visibility == DocVisibility.CLIENT,
        )

    if visibility:
        try:
            visibility_value = DocVisibility(visibility)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid visibility") from exc
        stmt = stmt.where(ProjectDoc.visibility == visibility_value)

    if status_filter:
        try:
            status_value = DocStatus(status_filter)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid status") from exc
        stmt = stmt.where(ProjectDoc.status == status_value)

    return [ProjectDocRead.model_validate(item) for item in db.scalars(stmt).all()]


@router.post(
    "/project-docs", response_model=ProjectDocRead, status_code=status.HTTP_201_CREATED
)
def create_project_doc(
    payload: ProjectDocCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDocRead:
    project = db.scalar(select(Project).where(Project.id == payload.project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role in (RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value):
        if project.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Project not found")
    else:
        member = _get_project_member(db, payload.project_id, current_user.id)
        if not member or not member.can_publish_docs:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    doc_type = db.scalar(select(DocType).where(DocType.id == payload.doc_type_id))
    if not doc_type:
        raise HTTPException(status_code=404, detail="Doc type not found")

    try:
        visibility_value = DocVisibility(payload.visibility)
        status_value = DocStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid visibility or status"
        ) from exc

    doc = ProjectDoc(
        project_id=payload.project_id,
        doc_type_id=payload.doc_type_id,
        title=payload.title,
        summary=payload.summary,
        github_url=payload.github_url,
        preview_md=payload.preview_md,
        visibility=visibility_value,
        status=status_value,
        enabled=payload.enabled,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    AuditService(db).record(
        project.organization_id,
        "project_doc.created",
        "project_docs",
        str(doc.id),
        current_user.id,
        metadata_json=json.dumps(
            {"project_id": doc.project_id, "doc_type_id": doc.doc_type_id},
            ensure_ascii=True,
        ),
    )
    return ProjectDocRead.model_validate(doc)


@router.put("/project-docs/{doc_id}", response_model=ProjectDocRead)
def update_project_doc(
    doc_id: int,
    payload: ProjectDocUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDocRead:
    doc = db.scalar(select(ProjectDoc).where(ProjectDoc.id == doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role in (RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value):
        project = db.scalar(select(Project).where(Project.id == doc.project_id))
        if not project or project.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Document not found")
    else:
        member = _get_project_member(db, doc.project_id, current_user.id)
        if not member or not member.can_publish_docs:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    updates = payload.model_dump(exclude_unset=True)
    if "visibility" in updates:
        try:
            updates["visibility"] = DocVisibility(updates["visibility"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid visibility") from exc
    if "status" in updates:
        try:
            updates["status"] = DocStatus(updates["status"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid status") from exc

    for field, value in updates.items():
        setattr(doc, field, value)
    doc.updated_by = current_user.id
    db.add(doc)
    db.commit()
    db.refresh(doc)

    AuditService(db).record(
        project.organization_id,
        "project_doc.updated",
        "project_docs",
        str(doc.id),
        current_user.id,
        metadata_json=json.dumps(
            {"project_id": doc.project_id, "doc_type_id": doc.doc_type_id},
            ensure_ascii=True,
        ),
    )
    return ProjectDocRead.model_validate(doc)


@router.post("/project-docs/{doc_id}/verify", response_model=ProjectDocRead)
def verify_project_doc(
    doc_id: int,
    payload: ProjectDocVerify,
    current_user: CurrentUser = Depends(require_roles(RoleCode.SUPER_ADMIN.value)),
    db: Session = Depends(get_db),
) -> ProjectDocRead:
    doc = db.scalar(select(ProjectDoc).where(ProjectDoc.id == doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    project = db.scalar(select(Project).where(Project.id == doc.project_id))
    if not project or project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Document not found")

    if payload.status is not None:
        try:
            doc.status = DocStatus(payload.status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid status") from exc
    if payload.enabled is not None:
        doc.enabled = payload.enabled

    doc.verified_by = current_user.id
    doc.verified_at = utcnow()
    db.add(doc)
    db.commit()
    db.refresh(doc)

    AuditService(db).record(
        project.organization_id,
        "project_doc.verified",
        "project_docs",
        str(doc.id),
        current_user.id,
        metadata_json=json.dumps(
            {
                "project_id": doc.project_id,
                "doc_type_id": doc.doc_type_id,
                "enabled": doc.enabled,
                "status": doc.status.value,
            },
            ensure_ascii=True,
        ),
    )
    return ProjectDocRead.model_validate(doc)


@router.post("/project-docs/{doc_id}/toggle", response_model=ProjectDocRead)
def toggle_project_doc(
    doc_id: int,
    payload: ProjectDocToggle,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDocRead:
    doc = db.scalar(select(ProjectDoc).where(ProjectDoc.id == doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role in (RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value):
        project = db.scalar(select(Project).where(Project.id == doc.project_id))
        if not project or project.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Document not found")
    else:
        member = _get_project_member(db, doc.project_id, current_user.id)
        if not member or not member.can_publish_docs:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    doc.enabled = payload.enabled
    doc.updated_by = current_user.id
    db.add(doc)
    db.commit()
    db.refresh(doc)

    AuditService(db).record(
        project.organization_id,
        "project_doc.toggled",
        "project_docs",
        str(doc.id),
        current_user.id,
        metadata_json=json.dumps(
            {"project_id": doc.project_id, "enabled": doc.enabled},
            ensure_ascii=True,
        ),
    )
    return ProjectDocRead.model_validate(doc)
