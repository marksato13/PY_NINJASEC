import json
from datetime import datetime

from app.core.time_utils import utcnow

from sqlalchemy.orm import Session

from app.db.models.report import Report
from app.db.models.report_run import ReportRun


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def _slugify(self, value: str) -> str:
        safe = "".join(
            ch if ch.isalnum() or ch in "-_" else "-" for ch in value.lower()
        )
        return "-".join(part for part in safe.split("-") if part)

    def generate_report_run(self, report: Report) -> ReportRun:
        timestamp = utcnow().strftime("%Y%m%d-%H%M%S")
        slug = self._slugify(report.title)
        report_run = ReportRun(
            report_id=report.id,
            status="completed",
            started_at=utcnow(),
            finished_at=utcnow(),
            output_file=f"generated/{slug}-{timestamp}.pdf",
            summary_json=json.dumps(
                {
                    "status": "generated",
                    "delivery": "manual",
                    "report_id": report.id,
                    "generated_at": utcnow().isoformat(),
                    "template": report.template_name,
                },
                ensure_ascii=True,
            ),
        )
        self.db.add(report_run)
        self.db.commit()
        self.db.refresh(report_run)
        return report_run
