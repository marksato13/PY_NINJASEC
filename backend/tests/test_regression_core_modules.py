"""
Regresion minima de modulos criticos:
- leads
- support_tickets
- users (guardas de permisos)
"""

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models.client import Client
from app.db.models.enums import ClientStatus, RoleCode, UserStatus
from app.db.models.role import Role
from app.db.models.user import User

API = "/api/v1"


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _ensure_client(db, organization_id: int) -> Client:
    client = db.scalar(select(Client).where(Client.organization_id == organization_id))
    if client:
        return client
    client = Client(
        organization_id=organization_id,
        company_name="Cliente Test QA",
        commercial_status=ClientStatus.ACTIVE,
        sector="Tecnologia",
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def test_leads_create_list_and_move_status(http_client, admin_token):
    # Crear lead (endpoint publico)
    created = http_client.post(
        f"{API}/leads/",
        json={
            "contact_name": "Lead QA",
            "email": "lead-qa@example.com",
            "company_name": "Lead QA SAC",
            "message": "Necesitamos auditoria",
        },
    )
    assert created.status_code == 201, created.text
    lead = created.json()
    assert lead["status"] == "NEW"

    # Listar como admin
    listed = http_client.get(f"{API}/leads/", headers=_auth_headers(admin_token))
    assert listed.status_code == 200
    assert any(item["id"] == lead["id"] for item in listed.json())

    # Mover a CONTACTED
    moved = http_client.patch(
        f"{API}/leads/{lead['id']}",
        json={"status": "CONTACTED"},
        headers=_auth_headers(admin_token),
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["status"] == "CONTACTED"


def test_support_ticket_close_requires_resolution(http_client, admin_token, seed_data, db):
    client = _ensure_client(db, seed_data["org"].id)

    created = http_client.post(
        f"{API}/support-tickets/",
        json={
            "client_id": client.id,
            "title": "Ticket QA",
            "priority": "medium",
            "description": "Incidente de prueba",
        },
        headers=_auth_headers(admin_token),
    )
    assert created.status_code == 201, created.text
    ticket = created.json()

    # Cerrar sin resolucion debe fallar
    close_without_resolution = http_client.patch(
        f"{API}/support-tickets/{ticket['id']}",
        json={"status": "closed"},
        headers=_auth_headers(admin_token),
    )
    assert close_without_resolution.status_code == 422

    # Cerrar con resolucion debe funcionar
    close_with_resolution = http_client.patch(
        f"{API}/support-tickets/{ticket['id']}",
        json={"status": "closed", "resolution": "Aplicado fix de configuracion"},
        headers=_auth_headers(admin_token),
    )
    assert close_with_resolution.status_code == 200, close_with_resolution.text
    assert close_with_resolution.json()["status"] == "closed"


def test_admin_cannot_modify_other_admin_or_change_roles(http_client, admin_token, seed_data, db):
    admin_role = db.scalar(select(Role).where(Role.code == RoleCode.ADMIN.value))
    assert admin_role is not None

    other_admin = db.scalar(select(User).where(User.email == "other-admin@ninjasec.local"))
    if not other_admin:
        other_admin = User(
            organization_id=seed_data["org"].id,
            role_id=admin_role.id,
            role_code=RoleCode.ADMIN,
            full_name="Other Admin",
            email="other-admin@ninjasec.local",
            password_hash=hash_password("testpassword123"),
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add(other_admin)
        db.commit()
        db.refresh(other_admin)

    # Un admin no puede editar a otro admin
    forbidden_update = http_client.put(
        f"{API}/users/{other_admin.id}",
        json={"full_name": "Intento bloqueado"},
        headers=_auth_headers(admin_token),
    )
    assert forbidden_update.status_code == 403

    # Un admin no puede cambiar roles
    collaborator_user = seed_data["collab"]
    forbidden_role_change = http_client.put(
        f"{API}/users/{collaborator_user.id}",
        json={"role_code": "admin"},
        headers=_auth_headers(admin_token),
    )
    assert forbidden_role_change.status_code == 403
