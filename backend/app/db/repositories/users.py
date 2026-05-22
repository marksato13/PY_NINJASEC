from sqlalchemy import select

from app.db.models.user import User
from app.db.repositories.base import Repository


class UserRepository(Repository):
    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def list_users(self, organization_id: int | None = None) -> list[User]:
        if organization_id is None:
            return self.list_all(User)
        return self.db.scalars(
            select(User).where(User.organization_id == organization_id)
        ).all()
