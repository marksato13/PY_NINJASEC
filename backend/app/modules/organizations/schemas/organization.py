from app.common.schemas.base import ORMModel


class OrganizationRead(ORMModel):
    id: int
    name: str
    slug: str
    plan: str
    status: str
