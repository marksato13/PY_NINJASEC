from app.common.schemas.base import ORMModel


class ReportRead(ORMModel):
    id: int
    title: str
    report_type: str
    template_name: str | None = None
    definition_json: str | None = None


class ReportCreate(ORMModel):
    organization_id: int
    client_id: int | None = None
    integration_id: int | None = None
    device_id: int | None = None
    title: str
    report_type: str
    template_name: str | None = None
    definition_json: str | None = None
