"""
Regresion minima para modulos reports y services.
"""

from app.db.models.service import Service

API = "/api/v1"


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_reports_last_exports_available_for_collaborator(http_client, collaborator_token):
    res = http_client.get(f"{API}/reports/last-exports", headers=_auth_headers(collaborator_token))
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, dict)
    for key in ["consolidated", "devices", "tickets", "reviews", "review-pdf", "pipeline"]:
        assert key in data


def test_services_create_forbidden_for_collaborator(http_client, collaborator_token, seed_data):
    res = http_client.post(
        f"{API}/services/",
        json={
            "organization_id": seed_data["org"].id,
            "title": "Servicio QA",
            "slug": "servicio-qa-collab",
            "summary": "No debe permitir collaborator",
            "description": "Prueba de permisos",
        },
        headers=_auth_headers(collaborator_token),
    )
    assert res.status_code == 403


def test_services_create_and_delete_with_roles(http_client, admin_token, seed_data, db):
    # Admin puede crear
    create = http_client.post(
        f"{API}/services/",
        json={
            "organization_id": seed_data["org"].id,
            "title": "Servicio QA Admin",
            "slug": "servicio-qa-admin",
            "summary": "Creado por admin",
            "description": "Prueba de creacion",
        },
        headers=_auth_headers(admin_token),
    )
    assert create.status_code == 201, create.text
    service_id = create.json()["id"]

    # Admin NO puede eliminar (solo super_admin)
    del_admin = http_client.delete(f"{API}/services/{service_id}", headers=_auth_headers(admin_token))
    assert del_admin.status_code == 403

    # Como no hay fixture de super_admin en conftest, validamos que el servicio siga existiendo
    remaining = db.get(Service, service_id)
    assert remaining is not None
