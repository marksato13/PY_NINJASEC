"""
Tests para GET /api/v1/auth/me

Casos cubiertos:
  1. Token válido → 200 con datos del usuario
  2. Sin token → 401
  3. Token malformado → 401
"""

API = "/api/v1"


def test_me_valid_token(http_client, admin_token):
    res = http_client.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "test-admin@ninjasec.local"
    assert data["role"] == "admin"
    assert "id" in data
    assert "full_name" in data
    assert "organization_id" in data


def test_me_no_token(http_client):
    res = http_client.get(f"{API}/auth/me")
    assert res.status_code == 401


def test_me_malformed_token(http_client):
    res = http_client.get(
        f"{API}/auth/me",
        headers={"Authorization": "Bearer esto.no.es.un.jwt"},
    )
    assert res.status_code == 401
