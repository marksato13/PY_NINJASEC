from pydantic import Field

from app.common.schemas.base import ORMModel


class LoginRequest(ORMModel):
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=6, max_length=128)


class CurrentUser(ORMModel):
    id: int
    organization_id: int
    email: str
    role: str
    full_name: str


class LoginResponse(ORMModel):
    access_token: str
    token_type: str = "bearer"
    redirect_to: str
    user: dict[str, str | int]
