from app.common.schemas.base import ORMModel


class ReportRunRead(ORMModel):
    id: int
    report_id: int
    status: str
    output_file: str | None = None
    summary_json: str | None = None
