from fastapi import APIRouter

from app.modules.alerts.routers.router import router as alerts_router
from app.modules.audit.routers.router import router as audit_router
from app.modules.auth.routers.router import router as auth_router
from app.modules.dashboard.routers.router import router as dashboard_router
from app.modules.clients.routers.router import router as clients_router
from app.modules.clients.routers.sites import router as client_sites_router
from app.modules.clients.routers.contacts import router as client_contacts_router
from app.modules.clients.routers.client_services import router as client_services_router
from app.modules.collaborators.routers.router import router as collaborators_router
from app.modules.collection.routers.router import router as collection_router
from app.modules.devices.routers.router import router as devices_router
from app.modules.devices.routers.connections import router as device_connections_router
from app.modules.catalogs.routers.router import router as catalogs_router
from app.modules.docs.routers.router import router as docs_router
from app.modules.integrations.routers.router import router as integrations_router
from app.modules.leads.routers.router import router as leads_router
from app.modules.organizations.routers.router import router as organizations_router
from app.modules.projects.routers.router import router as projects_router
from app.modules.projects.routers.extras import router as project_extras_router
from app.modules.security_reviews.routers.router import router as security_reviews_router
from app.modules.skills.routers.router import router as skills_router
from app.modules.recruitment.routers.router import router as recruitment_router
from app.modules.reports.routers.router import router as reports_router
from app.modules.services.routers.router import router as services_router
from app.modules.support_tickets.routers.router import router as support_tickets_router
from app.modules.users.routers.router import router as users_router
from app.modules.certifications.routers.router import router as certifications_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(organizations_router)
api_router.include_router(users_router)
api_router.include_router(clients_router)
api_router.include_router(client_sites_router)
api_router.include_router(client_contacts_router)
api_router.include_router(client_services_router)
api_router.include_router(collaborators_router)
api_router.include_router(devices_router)
api_router.include_router(device_connections_router)
api_router.include_router(catalogs_router)
api_router.include_router(skills_router)
api_router.include_router(certifications_router)
api_router.include_router(projects_router)
api_router.include_router(project_extras_router)
api_router.include_router(services_router)
api_router.include_router(leads_router)
api_router.include_router(recruitment_router)
api_router.include_router(integrations_router)
api_router.include_router(collection_router)
api_router.include_router(security_reviews_router)
api_router.include_router(support_tickets_router)
api_router.include_router(alerts_router)
api_router.include_router(reports_router)
api_router.include_router(docs_router)
api_router.include_router(audit_router)


@api_router.get("/")
def root() -> dict[str, object]:
    return {
        "message": "Welcome to NinjaSec API",
        "docs": "/docs",
        "modules": [
            "auth",
            "dashboard",
            "organizations",
            "users",
            "clients",
            "client-sites",
            "client-contacts",
            "client-services",
            "collaborators",
            "devices",
            "catalogs",
            "skills",
            "certifications",
            "projects",
            "services",
            "leads",
            "recruitment",
            "integrations",
            "collection",
            "security-reviews",
            "support-tickets",
            "alerts",
            "reports",
            "docs",
            "audit",
        ],
    }
