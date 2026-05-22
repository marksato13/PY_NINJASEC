from app.common.schemas.base import ORMModel


class SnapshotRead(ORMModel):
    id: int
    integration_id: int
    device_id: int | None = None
    snapshot_type: str
    raw_payload: str | None = None
    normalized_payload: str | None = None
