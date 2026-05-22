import os

# Debe ir ANTES de cualquier import de la app para que pydantic-settings
# lea estos valores al instanciar Settings().
os.environ["DATABASE_URL"] = "sqlite:///./tests/test.db"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["APP_ENV"] = "testing"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.common.deps.database import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.db.models.enums import RoleCode, UserStatus
from app.db.models.organization import Organization
from app.db.models.role import Role
from app.db.models.user import User
from app.db.session import engine
from app.main import app

TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

API = "/api/v1"


# ---------------------------------------------------------------------------
# Tablas — una sola vez por sesión de pytest
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()  # libera el archivo antes de borrarlo (necesario en Windows)
    import pathlib
    pathlib.Path("./tests/test.db").unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Datos base — org, roles y usuarios creados una vez por sesión
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def seed_data(setup_db):
    db = TestingSession()
    try:
        org = Organization(name="NinjaSec Test", slug="ninjasec-test")
        db.add(org)
        db.flush()

        admin_role = Role(code=RoleCode.ADMIN.value, name="Admin")
        collab_role = Role(code=RoleCode.COLLABORATOR.value, name="Collaborator")
        db.add_all([admin_role, collab_role])
        db.flush()

        admin = User(
            organization_id=org.id,
            role_id=admin_role.id,
            full_name="Test Admin",
            email="test-admin@ninjasec.local",
            password_hash=hash_password("testpassword123"),
            role_code=RoleCode.ADMIN,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        collab = User(
            organization_id=org.id,
            role_id=collab_role.id,
            full_name="Test Collaborator",
            email="test-collab@ninjasec.local",
            password_hash=hash_password("testpassword123"),
            role_code=RoleCode.COLLABORATOR,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add_all([admin, collab])
        db.commit()

        yield {"org": org, "admin": admin, "collab": collab}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Sesión de DB por test (función)
# ---------------------------------------------------------------------------

@pytest.fixture
def db(setup_db):
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Cliente HTTP — sobreescribe get_db para usar la sesión del test
# ---------------------------------------------------------------------------

@pytest.fixture
def http_client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tokens de conveniencia
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_token(http_client, seed_data):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "test-admin@ninjasec.local",
        "password": "testpassword123",
    })
    assert res.status_code == 200, f"No se pudo obtener token admin: {res.text}"
    return res.json()["access_token"]


@pytest.fixture
def collaborator_token(http_client, seed_data):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "test-collab@ninjasec.local",
        "password": "testpassword123",
    })
    assert res.status_code == 200, f"No se pudo obtener token collaborator: {res.text}"
    return res.json()["access_token"]
