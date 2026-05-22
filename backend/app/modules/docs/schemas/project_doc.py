from datetime import datetime

from app.common.schemas.base import ORMModel


class ProjectDocRead(ORMModel):
    id: int
    project_id: int
    doc_type_id: int
    title: str
    summary: str | None = None
    github_url: str | None = None
    preview_md: str | None = None
    visibility: str
    status: str
    enabled: bool
    created_by: int | None = None
    updated_by: int | None = None
    verified_by: int | None = None
    verified_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectDocCreate(ORMModel):
    project_id: int
    doc_type_id: int
    title: str
    summary: str | None = None
    github_url: str | None = None
    preview_md: str | None = None
    visibility: str = "internal"
    status: str = "draft"
    enabled: bool = True


class ProjectDocUpdate(ORMModel):
    title: str | None = None
    summary: str | None = None
    github_url: str | None = None
    preview_md: str | None = None
    visibility: str | None = None
    status: str | None = None
    enabled: bool | None = None


class ProjectDocVerify(ORMModel):
    status: str | None = None
    enabled: bool | None = None


class ProjectDocToggle(ORMModel):
    enabled: bool
