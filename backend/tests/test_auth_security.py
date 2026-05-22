"""
Tests de seguridad para el módulo auth

Casos cubiertos:
  1. Token expirado → 401
  2. Token con firma incorrecta → 401
  3. SQL injection en email no rompe la app (→ 401 o 422, nunca 200/500)
  4. Login exitoso actualiza last_login_at en la DB
"""

from datetime import timedelta

import jwt
import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.db.models.user import User as UserModel

API = "/api/v1"


def test_expired_token_returns_401(http_client, seed_data):
    expired = create_access_token(
        "test-admin@ninjasec.local",
        expires_delta=timedelta(seconds=-1),
    )
    res = http_client.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert res.status_code == 401


def test_wrong_secret_token_returns_401(http_client):
    fake_token = jwt.encode(
        {"sub": "test-admin@ninjasec.local", "exp": 9_999_999_999},
        "clave-completamente-incorrecta",
        algorithm="HS256",
    )
    res = http_client.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {fake_token}"},
    )
    assert res.status_code == 401


@pytest.mark.parametrize("malicious_email", [
    "' OR '1'='1",
    "' OR 1=1 --@test.com",
    "admin'--@x.com",
    '" OR ""="',
])
def test_sql_injection_never_succeeds(http_client, malicious_email):
    res = http_client.post(f"{API}/auth/login", json={
        "email": malicious_email,
        "password": "testpassword123",
    })
    assert res.status_code in (401, 422), (
        f"Payload inesperado {res.status_code} para email: {malicious_email!r}"
    )
    assert res.status_code != 200
    assert res.status_code != 500


def test_login_updates_last_login_at(http_client, seed_data, db):
    # Capturar estado antes del login
    user_before = db.scalar(
        select(UserModel).where(UserModel.email == "test-admin@ninjasec.local")
    )
    last_login_before = user_before.last_login_at

    res = http_client.post(f"{API}/auth/login", json={
        "email": "test-admin@ninjasec.local",
        "password": "testpassword123",
    })
    assert res.status_code == 200

    # Expirar el caché de la sesión para ver los cambios del commit del handler
    db.expire_all()
    user_after = db.scalar(
        select(UserModel).where(UserModel.email == "test-admin@ninjasec.local")
    )

    assert user_after.last_login_at is not None
    if last_login_before is not None:
        assert user_after.last_login_at >= last_login_before
