from app.common.schemas.base import ORMModel


class IntegrationTestRequest(ORMModel):
    connector_type: str
    base_url: str


class IntegrationTestResponse(ORMModel):
    connector_type: str
    reachable: bool
    message: str
