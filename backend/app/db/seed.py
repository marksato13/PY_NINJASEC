from datetime import date, datetime

from app.core.time_utils import utcnow

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models.application_assignment import ApplicationAssignment
from app.db.models.area import Area
from app.db.models.client import Client
from app.db.models.client_profile import ClientProfile
from app.db.models.collaborator_profile import CollaboratorProfile
from app.db.models.doc_type import DocType
from app.db.models.enums import (
    AssignmentType,
    ClientStatus,
    DocScope,
    JobApplicationStatus,
    ProjectStatus,
    RoleCode,
    SkillStatus,
    UserStatus,
)
from app.db.models.organization import Organization
from app.db.models.product import Product
from app.db.models.project import Project
from app.db.models.project_member import ProjectMember
from app.db.models.project_requirement import ProjectRequirement
from app.db.models.project_type import ProjectType
from app.db.models.role import Role
from app.db.models.service import Service
from app.db.models.skill import Skill
from app.db.models.user import User
from app.db.models.integration import Integration
from app.db.models.job_application import JobApplication
from app.db.models.report import Report
from app.db.models.user_skill import UserSkill


def apply_inline_migrations(db: Session) -> None:
    """ALTER TABLE inline para columnas agregadas post-creación.

    Idempotente (IF NOT EXISTS). Se ejecuta antes del seed para garantizar
    que las nuevas columnas existan aunque la tabla `devices` haya sido
    creada en una versión anterior del esquema.
    """
    statements = [
        # Devices — ISO 27001 A.8 / NIST CSF ID.AM (P1)
        "ALTER TABLE devices ADD COLUMN IF NOT EXISTS criticality VARCHAR(20)",
        "ALTER TABLE devices ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20)",
        "ALTER TABLE devices ADD COLUMN IF NOT EXISTS responsible_user_id INTEGER REFERENCES users(id)",
    ]
    for stmt in statements:
        db.execute(text(stmt))
    db.commit()


def seed_initial_data(db: Session) -> None:
    apply_inline_migrations(db)

    organization = db.scalar(
        select(Organization).where(Organization.slug == "ninjasec-internal")
    )
    if not organization:
        organization = Organization(
            name="NinjaSec Internal",
            slug="ninjasec-internal",
            plan="enterprise",
            status="active",
        )
        db.add(organization)
        db.commit()
        db.refresh(organization)

    role_map: dict[str, str] = {
        RoleCode.SUPER_ADMIN.value: "Super Admin",
        RoleCode.ADMIN.value: "Admin",
        RoleCode.COLLABORATOR.value: "Collaborator",
        RoleCode.CLIENT.value: "Client",
    }
    for code, name in role_map.items():
        role = db.scalar(select(Role).where(Role.code == code))
        if not role:
            db.add(Role(code=code, name=name, description=f"System role: {name}"))
    db.commit()

    roles = {role.code: role for role in db.scalars(select(Role)).all()}

    project_type_seed = [
        ("Implementacion", "implementation"),
        ("Consultoria", "consulting"),
        ("Soporte", "support"),
    ]
    for name, slug in project_type_seed:
        if not db.scalar(select(ProjectType).where(ProjectType.slug == slug)):
            db.add(ProjectType(name=name, slug=slug, is_active=True))
    db.commit()

    area_seed = [
        ("Redes", "network"),
        ("Seguridad de redes", "network-security"),
        ("Ciberseguridad", "cybersecurity"),
        ("Desarrollo", "development"),
        ("DevOps", "devops"),
        ("Gestion TI", "it-management"),
        ("Consultoria", "consulting"),
        ("Datos y analitica", "data-analytics"),
        ("Compliance / GRC", "compliance-grc"),
    ]
    for name, slug in area_seed:
        if not db.scalar(select(Area).where(Area.slug == slug)):
            db.add(Area(name=name, slug=slug, is_active=True))
    db.commit()

    doc_types_seed = [
        ("Implementacion tecnica", DocScope.PUBLIC),
        ("Manual de uso", DocScope.PUBLIC),
        ("Reporte ejecutivo", DocScope.PUBLIC),
        ("Runbook operativo", DocScope.PRIVATE),
        ("Acta de proyecto", DocScope.PRIVATE),
        ("Contrato y anexos", DocScope.PRIVATE),
        ("Procedimientos internos", DocScope.PRIVATE),
        ("SLA", DocScope.BOTH),
    ]

    for name, scope in doc_types_seed:
        if not db.scalar(select(DocType).where(DocType.name == name)):
            db.add(DocType(name=name, scope=scope, is_active=True))
    db.commit()

    def upsert_user(
        email: str, full_name: str, role_code: RoleCode, password: str, job_title: str
    ) -> User:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(
                organization_id=organization.id,
                role_id=roles[role_code.value].id,
                role_code=role_code,
                full_name=full_name,
                email=email,
                password_hash=hash_password(password),
                status=UserStatus.ACTIVE,
                job_title=job_title,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    admin = upsert_user(
        "admin@ninjasec.local",
        "Ruben Mark Salazar Tocas",
        RoleCode.SUPER_ADMIN,
        "change-me",
        "Founder",
    )
    admin_ops = upsert_user(
        "ops@ninjasec.local",
        "Paola Rojas",
        RoleCode.ADMIN,
        "admin123",
        "Operations Manager",
    )
    collaborator = upsert_user(
        "collab@ninjasec.local",
        "Demo Collaborator",
        RoleCode.COLLABORATOR,
        "temp123",
        "SOC Analyst",
    )
    collaborator_2 = upsert_user(
        "maria@ninjasec.local",
        "Maria Torres",
        RoleCode.COLLABORATOR,
        "temp123",
        "Network Engineer",
    )
    collaborator_3 = upsert_user(
        "luis@ninjasec.local",
        "Luis Arce",
        RoleCode.COLLABORATOR,
        "temp123",
        "Security Analyst",
    )
    collaborator_4 = upsert_user(
        "carla@ninjasec.local",
        "Carla Paredes",
        RoleCode.COLLABORATOR,
        "temp123",
        "DevOps Engineer",
    )
    collaborator_5 = upsert_user(
        "diego@ninjasec.local",
        "Diego Castillo",
        RoleCode.COLLABORATOR,
        "temp123",
        "Cloud Engineer",
    )
    collaborator_6 = upsert_user(
        "sofia@ninjasec.local",
        "Sofia Vargas",
        RoleCode.COLLABORATOR,
        "temp123",
        "Threat Analyst",
    )
    client_user = upsert_user(
        "client@ninjasec.local",
        "Ana Torres",
        RoleCode.CLIENT,
        "client123",
        "Operations Lead",
    )
    client_user_2 = upsert_user(
        "client2@ninjasec.local",
        "Ricardo Nunez",
        RoleCode.CLIENT,
        "client123",
        "IT Manager",
    )
    client_user_3 = upsert_user(
        "client3@ninjasec.local",
        "Valeria Soto",
        RoleCode.CLIENT,
        "client123",
        "Security Lead",
    )

    def upsert_collaborator_profile(
        user: User,
        position_title: str,
        seniority: str,
        availability_status: str,
        bio: str | None = None,
    ) -> None:
        if not db.scalar(
            select(CollaboratorProfile).where(CollaboratorProfile.user_id == user.id)
        ):
            db.add(
                CollaboratorProfile(
                    user_id=user.id,
                    position_title=position_title,
                    seniority=seniority,
                    availability_status=availability_status,
                    bio=bio,
                )
            )

    upsert_collaborator_profile(
        collaborator,
        "SOC Analyst",
        "Mid",
        "available",
        "Monitorea alertas y coordina respuesta inicial.",
    )
    upsert_collaborator_profile(
        collaborator_2,
        "Network Engineer",
        "Senior",
        "available",
        "Especialista en redes y despliegues en campo.",
    )
    upsert_collaborator_profile(
        collaborator_3,
        "Security Analyst",
        "Mid",
        "busy",
        "Analiza incidentes y prepara reportes ejecutivos.",
    )
    upsert_collaborator_profile(
        collaborator_4,
        "DevOps Engineer",
        "Senior",
        "available",
        "Automatiza despliegues y pipelines de seguridad.",
    )
    upsert_collaborator_profile(
        collaborator_5,
        "Cloud Engineer",
        "Mid",
        "available",
        "Gestiona entornos cloud y observabilidad.",
    )
    upsert_collaborator_profile(
        collaborator_6,
        "Threat Analyst",
        "Senior",
        "available",
        "Analisis avanzado de amenazas y hunting.",
    )

    client = db.scalar(select(Client).where(Client.company_name == "Blue Shield Tech"))
    if not client:
        client = Client(
            organization_id=organization.id,
            company_name="Blue Shield Tech",
            commercial_status=ClientStatus.ACTIVE,
            sector="Cybersecurity",
            size="SMB",
            notes="Initial demo client",
        )
        db.add(client)
        db.commit()
        db.refresh(client)

    if not db.scalar(select(Client).where(Client.company_name == "Orion Logistics")):
        db.add(
            Client(
                organization_id=organization.id,
                company_name="Orion Logistics",
                commercial_status=ClientStatus.ACTIVE,
                sector="Logistics",
                size="Enterprise",
                notes="Expansion client",
            )
        )

    if not db.scalar(select(Client).where(Client.company_name == "Nova Retail")):
        db.add(
            Client(
                organization_id=organization.id,
                company_name="Nova Retail",
                commercial_status=ClientStatus.ACTIVE,
                sector="Retail",
                size="Mid",
                notes="Retail pilot",
            )
        )

    def upsert_client_profile(user: User, client_ref: Client, title: str) -> None:
        if not db.scalar(select(ClientProfile).where(ClientProfile.user_id == user.id)):
            db.add(
                ClientProfile(
                    client_id=client_ref.id,
                    user_id=user.id,
                    position_title=title,
                    access_level="standard",
                )
            )

    upsert_client_profile(client_user, client, "Operations Lead")
    orion_client = db.scalar(
        select(Client).where(Client.company_name == "Orion Logistics")
    )
    if orion_client:
        upsert_client_profile(client_user_2, orion_client, "IT Manager")
    nova_client = db.scalar(select(Client).where(Client.company_name == "Nova Retail"))
    if nova_client:
        upsert_client_profile(client_user_3, nova_client, "Security Lead")

    if not db.scalar(select(Service).where(Service.slug == "api-reporting")):
        cybersecurity = db.scalar(select(Area).where(Area.slug == "cybersecurity"))
        implementation = db.scalar(
            select(ProjectType).where(ProjectType.slug == "implementation")
        )
        db.add(
            Service(
                organization_id=organization.id,
                area_id=cybersecurity.id if cybersecurity else None,
                project_type_id=implementation.id if implementation else None,
                title="API Reporting",
                slug="api-reporting",
                category="core",
                summary="Automated reporting from infrastructure APIs",
                description="Connect devices and systems such as pfSense and FortiGate to generate automated reports.",
                is_public=True,
                active=True,
            )
        )

    if not db.scalar(select(Service).where(Service.slug == "soc-dashboard")):
        cybersecurity = db.scalar(select(Area).where(Area.slug == "cybersecurity"))
        consulting = db.scalar(
            select(ProjectType).where(ProjectType.slug == "consulting")
        )
        db.add(
            Service(
                organization_id=organization.id,
                area_id=cybersecurity.id if cybersecurity else None,
                project_type_id=consulting.id if consulting else None,
                title="SOC Dashboard",
                slug="soc-dashboard",
                category="security",
                summary="Security operations dashboard",
                description="Operational visibility for SOC teams.",
                is_public=True,
                active=True,
            )
        )

    if not db.scalar(select(Service).where(Service.slug == "network-monitoring")):
        network = db.scalar(select(Area).where(Area.slug == "network"))
        implementation = db.scalar(
            select(ProjectType).where(ProjectType.slug == "implementation")
        )
        db.add(
            Service(
                organization_id=organization.id,
                area_id=network.id if network else None,
                project_type_id=implementation.id if implementation else None,
                title="Network Monitoring",
                slug="network-monitoring",
                category="network",
                summary="Network visibility and alerts",
                description="Monitoring and observability for network operations.",
                is_public=True,
                active=True,
            )
        )

    if not db.scalar(select(Service).where(Service.slug == "compliance-baseline")):
        compliance = db.scalar(select(Area).where(Area.slug == "compliance-grc"))
        consulting = db.scalar(
            select(ProjectType).where(ProjectType.slug == "consulting")
        )
        db.add(
            Service(
                organization_id=organization.id,
                area_id=compliance.id if compliance else None,
                project_type_id=consulting.id if consulting else None,
                title="Compliance Baseline",
                slug="compliance-baseline",
                category="compliance",
                summary="Baseline compliance assessment",
                description="Compliance assessment and remediation plan.",
                is_public=True,
                active=True,
            )
        )

    if not db.scalar(select(Product).where(Product.slug == "ninjasec-core")):
        cybersecurity = db.scalar(select(Area).where(Area.slug == "cybersecurity"))
        db.add(
            Product(
                organization_id=organization.id,
                area_id=cybersecurity.id if cybersecurity else None,
                name="NinjaSec Core",
                slug="ninjasec-core",
                summary="Core platform for automated reporting",
                is_active=True,
            )
        )

    if not db.scalar(select(Product).where(Product.slug == "ninjasec-observability")):
        network = db.scalar(select(Area).where(Area.slug == "network"))
        db.add(
            Product(
                organization_id=organization.id,
                area_id=network.id if network else None,
                name="NinjaSec Observability",
                slug="ninjasec-observability",
                summary="Network observability suite",
                is_active=True,
            )
        )

    if not db.scalar(
        select(Integration).where(Integration.name == "pfSense Main Edge")
    ):
        db.add(
            Integration(
                organization_id=organization.id,
                client_id=client.id,
                connector_type="pfSense",
                name="pfSense Main Edge",
                base_url="https://pfsense.local/api",
                auth_type="token",
                config_json='{"environment":"demo","site":"hq"}',
                status="pending",
            )
        )

    if not db.scalar(
        select(Integration).where(Integration.name == "FortiGate Branch 01")
    ):
        db.add(
            Integration(
                organization_id=organization.id,
                client_id=client.id,
                connector_type="FortiGate",
                name="FortiGate Branch 01",
                base_url="https://fortigate.local/api",
                auth_type="token",
                config_json='{"environment":"demo","site":"branch-01"}',
                status="pending",
            )
        )

    db.commit()

    skill_seed = [
        "Redes",
        "FortiGate",
        "Seguridad de redes",
        "Ciberseguridad",
        "SOC",
        "Threat Hunting",
        "DevOps",
        "Automatizacion",
        "CI/CD",
        "Python",
        "SIEM",
        "AWS",
        "Azure",
        "Kubernetes",
        "Incident Response",
    ]
    for name in skill_seed:
        if not db.scalar(select(Skill).where(Skill.name == name)):
            db.add(Skill(name=name, category="core", is_active=True))
    db.commit()

    def upsert_skill(user: User, skill_name: str, level: str) -> None:
        skill = db.scalar(select(Skill).where(Skill.name == skill_name))
        if not skill:
            return
        existing = db.scalar(
            select(UserSkill).where(
                UserSkill.user_id == user.id, UserSkill.skill_id == skill.id
            )
        )
        if not existing:
            db.add(
                UserSkill(
                    user_id=user.id,
                    skill_id=skill.id,
                    level=level,
                    status=SkillStatus.APPROVED,
                )
            )

    upsert_skill(collaborator_2, "Redes", "Senior")
    upsert_skill(collaborator_2, "FortiGate", "Mid")
    upsert_skill(collaborator_2, "Seguridad de redes", "Mid")
    upsert_skill(collaborator_3, "Ciberseguridad", "Senior")
    upsert_skill(collaborator_3, "SOC", "Mid")
    upsert_skill(collaborator_3, "Threat Hunting", "Mid")
    upsert_skill(collaborator_4, "DevOps", "Senior")
    upsert_skill(collaborator_4, "Automatizacion", "Mid")
    upsert_skill(collaborator_4, "CI/CD", "Mid")
    upsert_skill(collaborator_5, "AWS", "Senior")
    upsert_skill(collaborator_5, "Kubernetes", "Mid")
    upsert_skill(collaborator_5, "DevOps", "Mid")
    upsert_skill(collaborator_6, "Threat Hunting", "Senior")
    upsert_skill(collaborator_6, "SIEM", "Senior")
    upsert_skill(collaborator_6, "Incident Response", "Mid")
    db.commit()

    api_reporting = db.scalar(select(Service).where(Service.slug == "api-reporting"))
    soc_dashboard = db.scalar(select(Service).where(Service.slug == "soc-dashboard"))
    network_monitoring = db.scalar(
        select(Service).where(Service.slug == "network-monitoring")
    )
    compliance_baseline = db.scalar(
        select(Service).where(Service.slug == "compliance-baseline")
    )
    core_product = db.scalar(select(Product).where(Product.slug == "ninjasec-core"))
    observability_product = db.scalar(
        select(Product).where(Product.slug == "ninjasec-observability")
    )
    implementation = db.scalar(
        select(ProjectType).where(ProjectType.slug == "implementation")
    )
    consulting = db.scalar(select(ProjectType).where(ProjectType.slug == "consulting"))
    support = db.scalar(select(ProjectType).where(ProjectType.slug == "support"))

    def upsert_project(
        name: str,
        client_ref: Client,
        project_type: ProjectType | None,
        service: Service | None,
        product: Product | None,
        status: ProjectStatus,
        description: str,
    ) -> Project:
        project = db.scalar(select(Project).where(Project.name == name))
        if not project:
            area_id = None
            if service:
                area_id = service.area_id
            if not area_id and product:
                area_id = product.area_id
            project = Project(
                organization_id=organization.id,
                client_id=client_ref.id,
                project_type_id=project_type.id if project_type else None,
                area_id=area_id,
                service_id=service.id if service else None,
                product_id=product.id if product else None,
                name=name,
                description=description,
                status=status,
                start_date=date.today(),
            )
            db.add(project)
            db.commit()
            db.refresh(project)
        return project

    project_1 = upsert_project(
        "API Reporting - Blue Shield",
        client,
        implementation,
        api_reporting,
        None,
        ProjectStatus.ACTIVE,
        "Implementacion de reporting automatizado y dashboards ejecutivos.",
    )
    project_2 = upsert_project(
        "SOC Dashboard - Blue Shield",
        client,
        consulting,
        soc_dashboard,
        None,
        ProjectStatus.PLANNING,
        "Definicion de requerimientos para SOC y tablero operativo.",
    )
    if orion_client:
        project_3 = upsert_project(
            "Network Monitoring - Orion",
            orion_client,
            implementation,
            network_monitoring,
            None,
            ProjectStatus.ACTIVE,
            "Despliegue de monitoreo y alertas de red en multiples sedes.",
        )
    else:
        project_3 = None
    if nova_client:
        project_4 = upsert_project(
            "Compliance Baseline - Nova",
            nova_client,
            consulting,
            compliance_baseline,
            None,
            ProjectStatus.PAUSED,
            "Evaluacion de compliance y plan de remediacion.",
        )
    else:
        project_4 = None
    project_5 = upsert_project(
        "Observability Pilot",
        client,
        support,
        None,
        observability_product,
        ProjectStatus.ACTIVE,
        "Piloto de observabilidad con agentes y paneles de salud.",
    )

    def upsert_member(
        project: Project | None,
        user: User,
        role_in_project: str,
        allocation: int,
        required: bool,
    ) -> None:
        if not project:
            return
        if db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == user.id,
            )
        ):
            return
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=user.id,
                role_in_project=role_in_project,
                allocation_percentage=allocation,
                can_publish_docs=True,
                assignment_type=AssignmentType.MANUAL,
                is_required=required,
            )
        )

    upsert_member(project_1, collaborator_2, "Lead Engineer", 70, True)
    upsert_member(project_1, collaborator_3, "Security Analyst", 40, True)
    upsert_member(project_1, collaborator, "SOC Analyst", 30, False)
    upsert_member(project_2, collaborator_6, "Threat Lead", 50, True)
    upsert_member(project_2, collaborator_3, "Security Analyst", 40, False)
    if project_3:
        upsert_member(project_3, collaborator_2, "Network Lead", 60, True)
        upsert_member(project_3, collaborator_5, "Cloud Engineer", 40, False)
    if project_4:
        upsert_member(project_4, collaborator_3, "Compliance Analyst", 40, True)
        upsert_member(project_4, collaborator_6, "Threat Analyst", 30, False)
    upsert_member(project_5, collaborator_4, "DevOps Lead", 60, True)
    upsert_member(project_5, collaborator_5, "Platform Engineer", 40, False)

    def upsert_requirement(
        project: Project | None, skill_name: str, level: str, required: bool
    ) -> None:
        if not project:
            return
        skill = db.scalar(select(Skill).where(Skill.name == skill_name))
        if not skill:
            return
        if db.scalar(
            select(ProjectRequirement).where(
                ProjectRequirement.project_id == project.id,
                ProjectRequirement.skill_id == skill.id,
            )
        ):
            return
        db.add(
            ProjectRequirement(
                project_id=project.id,
                skill_id=skill.id,
                level=level,
                is_required=required,
            )
        )

    upsert_requirement(project_1, "Redes", "Senior", True)
    upsert_requirement(project_1, "FortiGate", "Mid", True)
    upsert_requirement(project_1, "Ciberseguridad", "Mid", False)
    upsert_requirement(project_2, "SOC", "Mid", True)
    upsert_requirement(project_2, "Threat Hunting", "Mid", False)
    upsert_requirement(project_3, "Redes", "Senior", True)
    upsert_requirement(project_3, "SIEM", "Mid", False)
    upsert_requirement(project_4, "Incident Response", "Mid", False)
    upsert_requirement(project_5, "DevOps", "Senior", True)
    upsert_requirement(project_5, "Kubernetes", "Mid", True)

    db.commit()

    pfsense_integration = db.scalar(
        select(Integration).where(Integration.name == "pfSense Main Edge")
    )

    if pfsense_integration and not db.scalar(
        select(Report).where(Report.title == "Reporte Ejecutivo Mensual")
    ):
        db.add(
            Report(
                organization_id=organization.id,
                client_id=client.id,
                integration_id=pfsense_integration.id,
                created_by=admin.id,
                title="Reporte Ejecutivo Mensual",
                report_type="executive",
                template_name="executive-v1",
                definition_json='{"widgets":["traffic","vpn","uptime"]}',
            )
        )

    db.commit()

    demo_application = db.scalar(
        select(JobApplication).where(JobApplication.email == "talent@ninjasec.local")
    )
    if not demo_application:
        demo_application = JobApplication(
            full_name="Carlos Bravo",
            email="talent@ninjasec.local",
            phone="+51 999 111 222",
            desired_role="SOC Analyst",
            skills_summary="SOC, SIEM, incident response",
            cv_url="https://example.com/cv/carlos-bravo.pdf",
            portfolio_url="https://example.com/portfolio/carlos-bravo",
            status=JobApplicationStatus.NEW,
            source="web",
        )
        db.add(demo_application)
        db.commit()
        db.refresh(demo_application)

    demo_application_2 = db.scalar(
        select(JobApplication).where(JobApplication.email == "talent2@ninjasec.local")
    )
    if not demo_application_2:
        demo_application_2 = JobApplication(
            full_name="Lucia Vargas",
            email="talent2@ninjasec.local",
            phone="+51 999 222 333",
            desired_role="Network Engineer",
            skills_summary="Routing, switching, FortiGate",
            cv_url="https://example.com/cv/lucia-vargas.pdf",
            portfolio_url="https://example.com/portfolio/lucia-vargas",
            status=JobApplicationStatus.SCREENING,
            source="referral",
        )
        db.add(demo_application_2)
        db.commit()
        db.refresh(demo_application_2)

    assignment_exists = db.scalar(
        select(ApplicationAssignment).where(
            ApplicationAssignment.application_id == demo_application.id,
            ApplicationAssignment.reviewer_user_id == collaborator.id,
        )
    )
    if not assignment_exists:
        db.add(
            ApplicationAssignment(
                application_id=demo_application.id,
                reviewer_user_id=collaborator.id,
                assigned_by_user_id=admin.id,
                role="reviewer",
                assigned_at=utcnow(),
            )
        )

    assignment_exists_2 = db.scalar(
        select(ApplicationAssignment).where(
            ApplicationAssignment.application_id == demo_application_2.id,
            ApplicationAssignment.reviewer_user_id == collaborator_2.id,
        )
    )
    if not assignment_exists_2:
        db.add(
            ApplicationAssignment(
                application_id=demo_application_2.id,
                reviewer_user_id=collaborator_2.id,
                assigned_by_user_id=admin.id,
                role="reviewer",
                assigned_at=utcnow(),
            )
        )

    db.commit()
