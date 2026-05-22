"""
Regresion de permisos para users y exports de reports.
"""

from sqlalchemy import select

from app.db.models.client import Client
from app.db.models.enums import ClientStatus

API = "/api/v1"


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _ensure_client(db, organization_id: int) -> Client:
    client = db.scalar(select(Client).where(Client.organization_id == organization_id))
    if client:
        return client
    client = Client(
        organization_id=organization_id,
        company_name="Cliente Reportes QA",
        commercial_status=ClientStatus.ACTIVE,
        sector="Tecnologia",
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def test_users_module_permissions_for_collaborator(http_client, collaborator_token):
    # collaborator no puede listar usuarios
    res_list = http_client.get(f"{API}/users/", headers=_auth_headers(collaborator_token))
    assert res_list.status_code == 403

    # collaborator no puede crear usuarios
    res_create = http_client.post(
        f"{API}/users/",
        json={
            "organization_id": 1,
            "role_code": "client",
            "full_name": "No Permitido",
            "email": "blocked-create@example.com",
            "password": "testpassword123",
        },
        headers=_auth_headers(collaborator_token),
    )
    assert res_create.status_code == 403


def test_reports_consolidated_exports_permissions(http_client, admin_token, collaborator_token, seed_data, db):
    client = _ensure_client(db, seed_data["org"].id)

    # admin puede exportar PDF consolidado
    ok_pdf = http_client.get(
        f"{API}/reports/consolidated-pdf",
        params={"client_id": client.id},
        headers=_auth_headers(admin_token),
    )
    assert ok_pdf.status_code == 200, ok_pdf.text
    assert ok_pdf.headers.get("content-type", "").startswith("application/pdf")

    # admin puede exportar XLSX consolidado
    ok_xlsx = http_client.get(
        f"{API}/reports/consolidated-xlsx",
        params={"client_id": client.id},
        headers=_auth_headers(admin_token),
    )
    assert ok_xlsx.status_code == 200, ok_xlsx.text
    assert "spreadsheetml" in ok_xlsx.headers.get("content-type", "")

    # collaborator no puede usar exports consolidados
    forbidden_pdf = http_client.get(
        f"{API}/reports/consolidated-pdf",
        params={"client_id": client.id},
        headers=_auth_headers(collaborator_token),
    )
    assert forbidden_pdf.status_code == 403

    forbidden_xlsx = http_client.get(
        f"{API}/reports/consolidated-xlsx",
        params={"client_id": client.id},
        headers=_auth_headers(collaborator_token),
    )
    assert forbidden_xlsx.status_code == 403


def test_reports_unknown_client_returns_404(http_client, admin_token):
    res = http_client.get(
        f"{API}/reports/consolidated-pdf",
        params={"client_id": 999999},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 404
