"""
Tests para POST /api/v1/auth/login

Casos cubiertos:
  1. Login exitoso → admin redirige a /dashboard
  2. Login exitoso → collaborator redirige a /portal
  3. Password incorrecto → 401
  4. Email no registrado → 401
  5. Email demasiado corto (< 5 chars) → 422
  6. Password demasiado corta (< 6 chars) → 422
  7. Body vacío → 422
"""

API = "/api/v1"


def test_login_admin_success(http_client, seed_data):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "test-admin@ninjasec.local",
        "password": "testpassword123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["redirect_to"] == "/dashboard"
    assert "user" in data


def test_login_collaborator_redirect_portal(http_client, seed_data):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "test-collab@ninjasec.local",
        "password": "testpassword123",
    })
    assert res.status_code == 200
    assert res.json()["redirect_to"] == "/portal"


def test_login_wrong_password(http_client, seed_data):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "test-admin@ninjasec.local",
        "password": "passwordincorrecto",
    })
    assert res.status_code == 401


def test_login_unknown_email(http_client, seed_data):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "noexiste@ninjasec.local",
        "password": "testpassword123",
    })
    assert res.status_code == 401


def test_login_email_too_short(http_client):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "a@b",
        "password": "testpassword123",
    })
    assert res.status_code == 422


def test_login_password_too_short(http_client):
    res = http_client.post(f"{API}/auth/login", json={
        "email": "user@test.com",
        "password": "abc",
    })
    assert res.status_code == 422


def test_login_empty_body(http_client):
    res = http_client.post(f"{API}/auth/login", json={})
    assert res.status_code == 422
