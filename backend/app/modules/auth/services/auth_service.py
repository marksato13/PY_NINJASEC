from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import create_access_token, verify_password
from app.core.time_utils import utcnow
from app.db.models.enums import RoleCode
from app.db.models.user import User
from app.db.repositories.users import UserRepository


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repository = UserRepository(db)

    def authenticate(self, email: str, password: str) -> User | None:
        user = self.user_repository.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise AppError("Invalid credentials", 401)
        user.last_login_at = utcnow()
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def build_login_response(self, user: User) -> dict[str, object]:
        token = create_access_token(user.email, extra={"role": user.role_code.value})
        redirect_to = (
            "/dashboard"
            if user.role_code in {RoleCode.SUPER_ADMIN, RoleCode.ADMIN}
            else "/portal"
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "redirect_to": redirect_to,
            "user": {
                "id": user.id,
                "name": user.full_name,
                "role": user.role_code.value,
                "email": user.email,
                "job_title": user.job_title or "",
            },
        }
