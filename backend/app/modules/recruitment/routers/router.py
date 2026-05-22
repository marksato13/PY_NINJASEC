import json
from datetime import date, datetime, time

from app.core.time_utils import utcnow

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.deps.auth import CurrentUser, require_roles
from app.common.deps.database import get_db
from app.db.models.application_assignment import ApplicationAssignment
from app.db.models.application_attachment import ApplicationAttachment
from app.db.models.application_event import ApplicationEvent
from app.db.models.application_note import ApplicationNote
from app.db.models.application_review import ApplicationReview
from app.db.models.enums import (
    ApplicationRecommendation,
    JobApplicationStatus,
    RoleCode,
)
from app.db.models.job_application import JobApplication
from app.db.models.user import User
from app.modules.audit.services.audit_service import AuditService
from app.modules.recruitment.schemas import (
    ApplicationAssignmentCreate,
    ApplicationAssignmentRead,
    ApplicationAttachmentCreate,
    ApplicationAttachmentRead,
    ApplicationEventRead,
    ApplicationNoteCreate,
    ApplicationNoteRead,
    ApplicationReviewCreate,
    ApplicationReviewRead,
    JobApplicationCreate,
    JobApplicationRead,
    JobApplicationUpdate,
)

router = APIRouter(prefix="/job-applications", tags=["job-applications"])


def _get_application(db: Session, application_id: int) -> JobApplication:
    application = db.scalar(
        select(JobApplication).where(JobApplication.id == application_id)
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _ensure_application_access(
    db: Session, application_id: int, current_user: CurrentUser
) -> JobApplication:
    application = _get_application(db, application_id)
    if current_user.role in (RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value):
        return application

    assignment = db.scalar(
        select(ApplicationAssignment).where(
            ApplicationAssignment.application_id == application_id,
            ApplicationAssignment.reviewer_user_id == current_user.id,
        )
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _record_application_event(
    db: Session, application_id: int, event_type: str, payload: dict[str, object]
) -> None:
    event = ApplicationEvent(
        application_id=application_id,
        event_type=event_type,
        payload_json=json.dumps(payload, ensure_ascii=True),
    )
    db.add(event)


def _record_audit_log(
    db: Session,
    current_user: CurrentUser,
    action: str,
    application_id: int,
    metadata: dict[str, object],
) -> None:
    AuditService(db).record(
        organization_id=current_user.organization_id,
        action=action,
        entity_type="job_application",
        entity_id=str(application_id),
        user_id=current_user.id,
        metadata_json=json.dumps(metadata, ensure_ascii=True),
    )


@router.get("/", response_model=list[JobApplicationRead])
def list_job_applications(
    status_filter: JobApplicationStatus | None = Query(default=None, alias="status"),
    desired_role: str | None = Query(default=None),
    reviewer_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[JobApplicationRead]:
    if current_user.role == RoleCode.COLLABORATOR.value:
        stmt = (
            select(JobApplication)
            .join(
                ApplicationAssignment,
                ApplicationAssignment.application_id == JobApplication.id,
            )
            .where(ApplicationAssignment.reviewer_user_id == current_user.id)
            .distinct()
        )
    else:
        stmt = select(JobApplication)
        if reviewer_id is not None:
            stmt = (
                stmt.join(
                    ApplicationAssignment,
                    ApplicationAssignment.application_id == JobApplication.id,
                )
                .where(ApplicationAssignment.reviewer_user_id == reviewer_id)
                .distinct()
            )

    if status_filter is not None:
        stmt = stmt.where(JobApplication.status == status_filter)
    if desired_role:
        stmt = stmt.where(JobApplication.desired_role == desired_role)
    if date_from is not None:
        stmt = stmt.where(
            JobApplication.created_at >= datetime.combine(date_from, time.min)
        )
    if date_to is not None:
        stmt = stmt.where(
            JobApplication.created_at <= datetime.combine(date_to, time.max)
        )

    return [JobApplicationRead.model_validate(item) for item in db.scalars(stmt).all()]


@router.post(
    "/", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED
)
def create_job_application(
    payload: JobApplicationCreate, db: Session = Depends(get_db)
) -> JobApplicationRead:
    application = JobApplication(
        **{**payload.model_dump(), "status": JobApplicationStatus.NEW}
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return JobApplicationRead.model_validate(application)


@router.get("/{application_id}", response_model=JobApplicationRead)
def get_job_application(
    application_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> JobApplicationRead:
    application = _ensure_application_access(db, application_id, current_user)
    return JobApplicationRead.model_validate(application)


@router.patch("/{application_id}", response_model=JobApplicationRead)
def update_job_application_status(
    application_id: int,
    payload: JobApplicationUpdate,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> JobApplicationRead:
    application = _ensure_application_access(db, application_id, current_user)
    try:
        new_status = JobApplicationStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid status") from exc

    if new_status in (JobApplicationStatus.OFFER, JobApplicationStatus.HIRED):
        if current_user.role not in (
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
        ):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions for offer/hired status",
            )

    old_status = application.status
    if new_status == old_status:
        return JobApplicationRead.model_validate(application)

    application.status = new_status
    _record_application_event(
        db,
        application.id,
        "status_change",
        {
            "actor_id": current_user.id,
            "actor_role": current_user.role,
            "from": old_status.value,
            "to": new_status.value,
        },
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    _record_audit_log(
        db,
        current_user,
        "application_status_changed",
        application.id,
        {"from": old_status.value, "to": new_status.value},
    )
    return JobApplicationRead.model_validate(application)


@router.post(
    "/{application_id}/assign",
    response_model=ApplicationAssignmentRead,
    status_code=status.HTTP_201_CREATED,
)
def assign_application_reviewer(
    application_id: int,
    payload: ApplicationAssignmentCreate,
    current_user: CurrentUser = Depends(
        require_roles(RoleCode.SUPER_ADMIN.value, RoleCode.ADMIN.value)
    ),
    db: Session = Depends(get_db),
) -> ApplicationAssignmentRead:
    application = _get_application(db, application_id)
    reviewer = db.scalar(
        select(User).where(
            User.id == payload.reviewer_user_id,
            User.organization_id == current_user.organization_id,
        )
    )
    if not reviewer or reviewer.role_code == RoleCode.CLIENT:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    existing = db.scalar(
        select(ApplicationAssignment).where(
            ApplicationAssignment.application_id == application.id,
            ApplicationAssignment.reviewer_user_id == payload.reviewer_user_id,
        )
    )
    if existing:
        return ApplicationAssignmentRead.model_validate(existing)

    assignment = ApplicationAssignment(
        application_id=application.id,
        reviewer_user_id=payload.reviewer_user_id,
        assigned_by_user_id=current_user.id,
        role=payload.role or "reviewer",
        assigned_at=utcnow(),
    )
    _record_application_event(
        db,
        application.id,
        "assignment",
        {
            "actor_id": current_user.id,
            "reviewer_user_id": payload.reviewer_user_id,
            "role": assignment.role,
        },
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    _record_audit_log(
        db,
        current_user,
        "application_assignment_created",
        application.id,
        {"reviewer_user_id": payload.reviewer_user_id, "role": assignment.role},
    )
    return ApplicationAssignmentRead.model_validate(assignment)


@router.get(
    "/{application_id}/assignments", response_model=list[ApplicationAssignmentRead]
)
def list_application_assignments(
    application_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[ApplicationAssignmentRead]:
    _ensure_application_access(db, application_id, current_user)
    stmt = (
        select(ApplicationAssignment)
        .where(ApplicationAssignment.application_id == application_id)
        .order_by(ApplicationAssignment.assigned_at.desc())
    )
    return [
        ApplicationAssignmentRead.model_validate(item)
        for item in db.scalars(stmt).all()
    ]


@router.post(
    "/{application_id}/reviews",
    response_model=ApplicationReviewRead,
    status_code=status.HTTP_201_CREATED,
)
def create_application_review(
    application_id: int,
    payload: ApplicationReviewCreate,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> ApplicationReviewRead:
    application = _ensure_application_access(db, application_id, current_user)
    try:
        recommendation = ApplicationRecommendation(payload.recommendation)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid recommendation") from exc

    review = ApplicationReview(
        application_id=application.id,
        reviewer_user_id=current_user.id,
        score=payload.score,
        recommendation=recommendation,
        notes=payload.notes,
    )
    _record_application_event(
        db,
        application.id,
        "review",
        {
            "actor_id": current_user.id,
            "score": payload.score,
            "recommendation": recommendation.value,
        },
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    _record_audit_log(
        db,
        current_user,
        "application_review_created",
        application.id,
        {"score": payload.score, "recommendation": recommendation.value},
    )
    return ApplicationReviewRead.model_validate(review)


@router.get("/{application_id}/reviews", response_model=list[ApplicationReviewRead])
def list_application_reviews(
    application_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[ApplicationReviewRead]:
    _ensure_application_access(db, application_id, current_user)
    stmt = (
        select(ApplicationReview)
        .where(ApplicationReview.application_id == application_id)
        .order_by(ApplicationReview.created_at.desc())
    )
    return [
        ApplicationReviewRead.model_validate(item) for item in db.scalars(stmt).all()
    ]


@router.post(
    "/{application_id}/notes",
    response_model=ApplicationNoteRead,
    status_code=status.HTTP_201_CREATED,
)
def create_application_note(
    application_id: int,
    payload: ApplicationNoteCreate,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> ApplicationNoteRead:
    application = _ensure_application_access(db, application_id, current_user)
    note = ApplicationNote(
        application_id=application.id,
        author_user_id=current_user.id,
        note=payload.note,
        visibility=payload.visibility,
    )
    _record_application_event(
        db,
        application.id,
        "note",
        {"actor_id": current_user.id, "visibility": payload.visibility},
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    _record_audit_log(
        db,
        current_user,
        "application_note_created",
        application.id,
        {"visibility": payload.visibility},
    )
    return ApplicationNoteRead.model_validate(note)


@router.get("/{application_id}/notes", response_model=list[ApplicationNoteRead])
def list_application_notes(
    application_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[ApplicationNoteRead]:
    _ensure_application_access(db, application_id, current_user)
    stmt = (
        select(ApplicationNote)
        .where(ApplicationNote.application_id == application_id)
        .order_by(ApplicationNote.created_at.desc())
    )
    return [ApplicationNoteRead.model_validate(item) for item in db.scalars(stmt).all()]


@router.post(
    "/{application_id}/attachments",
    response_model=ApplicationAttachmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_application_attachment(
    application_id: int,
    payload: ApplicationAttachmentCreate,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> ApplicationAttachmentRead:
    application = _ensure_application_access(db, application_id, current_user)
    attachment = ApplicationAttachment(
        application_id=application.id,
        file_url=payload.file_url,
        file_type=payload.file_type,
        uploaded_by_user_id=current_user.id,
    )
    _record_application_event(
        db,
        application.id,
        "attachment",
        {"actor_id": current_user.id, "file_type": payload.file_type},
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    _record_audit_log(
        db,
        current_user,
        "application_attachment_created",
        application.id,
        {"file_type": payload.file_type},
    )
    return ApplicationAttachmentRead.model_validate(attachment)


@router.get(
    "/{application_id}/attachments", response_model=list[ApplicationAttachmentRead]
)
def list_application_attachments(
    application_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[ApplicationAttachmentRead]:
    _ensure_application_access(db, application_id, current_user)
    stmt = (
        select(ApplicationAttachment)
        .where(ApplicationAttachment.application_id == application_id)
        .order_by(ApplicationAttachment.created_at.desc())
    )
    return [
        ApplicationAttachmentRead.model_validate(item)
        for item in db.scalars(stmt).all()
    ]


@router.get("/{application_id}/timeline", response_model=list[ApplicationEventRead])
def list_application_timeline(
    application_id: int,
    current_user: CurrentUser = Depends(
        require_roles(
            RoleCode.SUPER_ADMIN.value,
            RoleCode.ADMIN.value,
            RoleCode.COLLABORATOR.value,
        )
    ),
    db: Session = Depends(get_db),
) -> list[ApplicationEventRead]:
    _ensure_application_access(db, application_id, current_user)
    stmt = (
        select(ApplicationEvent)
        .where(ApplicationEvent.application_id == application_id)
        .order_by(ApplicationEvent.created_at)
    )
    return [
        ApplicationEventRead.model_validate(item) for item in db.scalars(stmt).all()
    ]
