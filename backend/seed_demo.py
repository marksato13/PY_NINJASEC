"""
Seeder demo — Datos peruanos realistas para NinjaSec.
Ejecutar dentro del container: docker exec ninjasec-backend python /app/seed_demo.py

Idempotente: si un registro ya existe (por nombre/email/slug), no lo duplica.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.time_utils import utcnow
from app.db.session import SessionLocal
from app.db.models.area import Area
from app.db.models.audit_log import AuditLog
from app.db.models.client import Client
from app.db.models.client_contact import ClientContact
from app.db.models.client_profile import ClientProfile
from app.db.models.client_site import ClientSite
from app.db.models.collaborator_profile import CollaboratorProfile
from app.db.models.device import Device
from app.db.models.device_connection import DeviceConnection
from app.db.models.enums import (
    AssignmentType,
    CertificationStatus,
    ClientStatus,
    FindingSeverity,
    FindingStatus,
    JobApplicationStatus,
    LeadStatus,
    ProjectStatus,
    ReviewStatus,
    RoleCode,
    ServiceRequestStatus,
    SiteStatus,
    SkillStatus,
    TicketPriority,
    TicketStatus,
    UserStatus,
)
from app.db.models.integration import Integration
from app.db.models.job_application import JobApplication
from app.db.models.lead import Lead
from app.db.models.organization import Organization
from app.db.models.project import Project
from app.db.models.project_member import ProjectMember
from app.db.models.project_type import ProjectType
from app.db.models.role import Role
from app.db.models.security_review import (
    ReviewChecklistItem,
    ReviewFinding,
    SecurityReview,
)
from app.db.models.service import Service
from app.db.models.service_request import ServiceRequest
from app.db.models.skill import Skill
from app.db.models.support_ticket import SupportTicket, SupportTicketEvent
from app.db.models.user import User
from app.db.models.user_certification import UserCertification
from app.db.models.user_skill import UserSkill


random.seed(42)


def now_minus(days=0, hours=0, minutes=0) -> datetime:
    return utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


def run(db: Session) -> None:
    org = db.scalar(select(Organization).where(Organization.slug == "ninjasec-internal"))
    if not org:
        raise SystemExit("Organization ninjasec-internal not found — run base seed first")

    org_id = org.id
    roles = {r.code: r for r in db.scalars(select(Role)).all()}
    role_collab_id = roles[RoleCode.COLLABORATOR.value].id

    # ── 1. CLIENTES (empresas peruanas) ────────────────────────────────────
    print("== Clientes ==")
    extra_clients = [
        ("Hospital Pacifico Norte",      "Salud",            "mediana",  "Lima",     "Peru", "Red hospitalaria privada - 3 sedes"),
        ("Universidad Tecnologica del Sur", "Educacion",     "grande",   "Arequipa", "Peru", "Universidad privada - 12K alumnos"),
        ("Banco Andino MicroCredito",    "Finanzas",         "mediana",  "Lima",     "Peru", "Microfinanciera regulada SBS"),
        ("Cafe del Valle SAC",           "Retail / F&B",     "pyme",     "Cusco",    "Peru", "Cadena de 8 cafeterias + e-commerce"),
        ("Municipalidad de San Borja",   "Gobierno Local",   "grande",   "Lima",     "Peru", "Gobierno municipal - TI compartida"),
        ("AgroExportadora del Norte",    "Agroindustria",    "mediana",  "Trujillo", "Peru", "Exportador de frutas - palta y arandano"),
        ("ClickPay Peru",                "Fintech",          "pyme",     "Lima",     "Peru", "Pasarela de pagos B2C"),
        ("Naviera Pacifico Sur",         "Transporte",       "mediana",  "Callao",   "Peru", "Operador logistico portuario"),
    ]
    created_clients = []
    for name, sector, size, city, country, notes in extra_clients:
        if db.scalar(select(Client).where(Client.company_name == name)):
            continue
        c = Client(
            organization_id=org_id,
            company_name=name,
            commercial_status=ClientStatus.ACTIVE,
            sector=sector,
            size=size,
            city=city,
            country=country,
            notes=notes,
        )
        db.add(c)
        created_clients.append(c)
    db.commit()
    for c in created_clients:
        db.refresh(c)
        db.add(AuditLog(organization_id=org_id, action="client.created", entity_type="clients", entity_id=str(c.id), user_id=1, created_at=now_minus(days=random.randint(1, 90))))
    db.commit()
    print(f"  + {len(created_clients)} clientes nuevos")

    all_clients = db.scalars(select(Client).where(Client.organization_id == org_id)).all()
    client_by_name = {c.company_name: c for c in all_clients}

    # ── 2. SITES ────────────────────────────────────────────────────────────
    print("== Sites ==")
    sites_data = [
        ("Hospital Pacifico Norte",      "Sede Central",        "Av. Javier Prado Este 4200", "Lima",     "Peru"),
        ("Hospital Pacifico Norte",      "Sede Surco",          "Av. Caminos del Inca 1850",  "Lima",     "Peru"),
        ("Universidad Tecnologica del Sur", "Campus Cayma",     "Av. Cayma 506",              "Arequipa", "Peru"),
        ("Banco Andino MicroCredito",    "HQ Lima",             "Calle Las Begonias 415",     "Lima",     "Peru"),
        ("Banco Andino MicroCredito",    "Sucursal Norte",      "Av. Espana 1200",            "Trujillo", "Peru"),
        ("Cafe del Valle SAC",           "Tienda Plaza Norte",  "C.C. Plaza Norte L-204",     "Lima",     "Peru"),
        ("Cafe del Valle SAC",           "Bodega Central",      "Av. Industrial 425",         "Cusco",    "Peru"),
        ("Municipalidad de San Borja",   "Palacio Municipal",   "Av. Joaquin Madrid 200",     "Lima",     "Peru"),
        ("AgroExportadora del Norte",    "Planta Empacadora",   "Carr. Panamericana Km 567",  "Trujillo", "Peru"),
        ("ClickPay Peru",                "Oficina San Isidro",  "Av. Pardo y Aliaga 699",     "Lima",     "Peru"),
        ("Naviera Pacifico Sur",         "Terminal Callao",     "Terminal Norte Multiproposito", "Callao", "Peru"),
        ("Blue Shield Tech",             "Oficina Miraflores",  "Av. Larco 1301",             "Lima",     "Peru"),
        ("Orion Logistics",              "Almacen Ate",         "Carr. Central Km 9.5",       "Lima",     "Peru"),
        ("Nova Retail",                  "Tienda Real Plaza",   "Av. Cayma 519",              "Arequipa", "Peru"),
    ]
    site_count = 0
    for cname, sname, addr, city, country in sites_data:
        client = client_by_name.get(cname)
        if not client:
            continue
        if db.scalar(select(ClientSite).where(ClientSite.client_id == client.id, ClientSite.name == sname)):
            continue
        db.add(ClientSite(
            client_id=client.id, name=sname, address=addr,
            city=city, country=country, status=SiteStatus.ACTIVE,
        ))
        site_count += 1
    db.commit()
    print(f"  + {site_count} sites")

    # ── 3. CONTACTOS ───────────────────────────────────────────────────────
    print("== Contactos ==")
    contacts_data = [
        ("Hospital Pacifico Norte",      "Dra. Carla Mendoza Rivera", "cmendoza@hospitalpacifico.pe",  "+51 1 4561234", "Directora TI",        True),
        ("Hospital Pacifico Norte",      "Ing. Felipe Quiroz",        "fquiroz@hospitalpacifico.pe",   "+51 999 121212", "Jefe de Seguridad",   False),
        ("Universidad Tecnologica del Sur", "Mg. Ana Paredes",        "aparedes@uts.edu.pe",           "+51 54 234567", "Decana de Sistemas",  True),
        ("Banco Andino MicroCredito",    "Lic. Renato Salinas",       "rsalinas@bancoandino.pe",       "+51 1 6234500", "CISO",                True),
        ("Cafe del Valle SAC",           "Lucia Quispe",              "lucia@cafedelvalle.pe",         "+51 984 222 333", "Founder & CEO",      True),
        ("Municipalidad de San Borja",   "Ing. Marco Villarroel",     "mvillarroel@msb.gob.pe",        "+51 1 4111000", "Jefe TI Municipal",   True),
        ("AgroExportadora del Norte",    "Ing. Patricia Larrea",      "plarrea@agronorte.pe",          "+51 44 234 567", "Gerente Operaciones", True),
        ("ClickPay Peru",                "Diego Cano",                "dcano@clickpay.pe",             "+51 982 555 121", "CTO",                 True),
        ("Naviera Pacifico Sur",         "Cap. Eduardo Acuna",        "eacuna@navpacsur.pe",           "+51 1 4221122", "Gerente TI",          True),
        ("Blue Shield Tech",             "Sr. Walter Rios",           "walter@blueshield.pe",          "+51 988 433 221", "Gerente General",    True),
    ]
    contact_count = 0
    for cname, name, email, phone, role, primary in contacts_data:
        client = client_by_name.get(cname)
        if not client:
            continue
        if db.scalar(select(ClientContact).where(ClientContact.client_id == client.id, ClientContact.email == email)):
            continue
        db.add(ClientContact(
            client_id=client.id, name=name, email=email,
            phone=phone, role=role, is_primary=primary,
        ))
        contact_count += 1
    db.commit()
    print(f"  + {contact_count} contactos")

    # ── 4. USUARIOS COLABORADORES ──────────────────────────────────────────
    print("== Usuarios colaboradores ==")
    collabs_data = [
        ("Andrea Castillo Vega",       "andrea.castillo@ninjasec.local", "Frontend Junior",       "junior",  "Desarrollo",     "available"),
        ("Bryan Huaman Cardenas",      "bryan.huaman@ninjasec.local",    "Pentester Trainee",     "junior",  "Seguridad",      "available"),
        ("Camila Reategui Quispe",     "camila.reategui@ninjasec.local", "DevOps Junior",         "junior",  "Infraestructura","busy"),
        ("Diego Saldana Torres",       "diego.saldana@ninjasec.local",   "Network Technician",    "junior",  "Infraestructura","available"),
        ("Estefania Llanos Sotomayor", "estefania.llanos@ninjasec.local","Backend Mid",           "mid",     "Desarrollo",     "available"),
        ("Fernando Quiroz Perez",      "fernando.quiroz@ninjasec.local", "SOC Analyst Junior",    "junior",  "Seguridad",      "partial"),
        ("Gabriela Yanez Mamani",      "gabriela.yanez@ninjasec.local",  "QA / Automation",       "junior",  "Desarrollo",     "available"),
        ("Hector Ramirez Espinoza",    "hector.ramirez@ninjasec.local",  "Cloud Architect",       "senior",  "Infraestructura","busy"),
        ("Isabel Tito Aliaga",         "isabel.tito@ninjasec.local",     "Data Engineer Jr",      "junior",  "Datos",          "available"),
        ("Joel Cardenas Inca",         "joel.cardenas@ninjasec.local",   "Cybersec Researcher",   "mid",     "Seguridad",      "available"),
        ("Karla Morales Vasquez",      "karla.morales@ninjasec.local",   "Tech Lead",             "senior",  "Desarrollo",     "available"),
        ("Luis Tafur Sanchez",         "luis.tafur@ninjasec.local",      "Pentester Senior",      "senior",  "Seguridad",      "busy"),
    ]
    collab_skills_map = {
        "Frontend Junior":      [("Python", "junior"), ("CI/CD", "trainee")],
        "Pentester Trainee":    [("Ciberseguridad", "trainee"), ("Threat Hunting", "junior")],
        "DevOps Junior":        [("DevOps", "junior"), ("CI/CD", "junior"), ("Kubernetes", "trainee")],
        "Network Technician":   [("Redes", "junior"), ("FortiGate", "junior")],
        "Backend Mid":          [("Python", "mid"), ("Automatizacion", "mid")],
        "SOC Analyst Junior":   [("SOC", "junior"), ("SIEM", "junior"), ("Incident Response", "junior")],
        "QA / Automation":      [("Automatizacion", "junior"), ("Python", "junior")],
        "Cloud Architect":      [("AWS", "senior"), ("Azure", "senior"), ("Kubernetes", "senior")],
        "Data Engineer Jr":     [("Python", "junior")],
        "Cybersec Researcher":  [("Ciberseguridad", "mid"), ("Threat Hunting", "mid"), ("SIEM", "mid")],
        "Tech Lead":            [("Python", "senior"), ("AWS", "senior"), ("DevOps", "senior")],
        "Pentester Senior":     [("Ciberseguridad", "senior"), ("Incident Response", "senior")],
    }
    created_users = []
    for full_name, email, pos, seniority, area, avail in collabs_data:
        if db.scalar(select(User).where(User.email == email)):
            continue
        u = User(
            organization_id=org_id, role_id=role_collab_id,
            role_code=RoleCode.COLLABORATOR,
            full_name=full_name, email=email,
            password_hash=hash_password("colab123"),
            status=UserStatus.ACTIVE, job_title=pos, is_active=True,
            last_login_at=now_minus(days=random.randint(0, 14)),
        )
        db.add(u)
        created_users.append((u, pos, seniority, area, avail))
    db.commit()

    skills_by_name = {s.name: s for s in db.scalars(select(Skill)).all()}

    for u, pos, seniority, area, avail in created_users:
        db.refresh(u)
        cp = CollaboratorProfile(
            user_id=u.id, position_title=pos,
            bio=f"{pos} en NinjaSec - apasionado por {area.lower()}",
            seniority=seniority, availability_status=avail, area=area,
            skills_json=json.dumps([s for s, _ in collab_skills_map.get(pos, [])]),
        )
        db.add(cp)
        for sname, slevel in collab_skills_map.get(pos, []):
            skill = skills_by_name.get(sname)
            if skill and not db.scalar(select(UserSkill).where(UserSkill.user_id == u.id, UserSkill.skill_id == skill.id)):
                db.add(UserSkill(
                    user_id=u.id, skill_id=skill.id, level=slevel,
                    status=SkillStatus.APPROVED, verified_by=1,
                    verified_at=now_minus(days=random.randint(5, 90)),
                ))
        db.add(AuditLog(organization_id=org_id, action="user.created", entity_type="users", entity_id=str(u.id), user_id=1, created_at=now_minus(days=random.randint(1, 120))))
    db.commit()
    print(f"  + {len(created_users)} colaboradores")

    # ── 5. CERTIFICACIONES ─────────────────────────────────────────────────
    print("== Certificaciones ==")
    all_collab_users = list(db.scalars(
        select(User).where(User.organization_id == org_id, User.role_code == RoleCode.COLLABORATOR)
    ).all())
    if not all_collab_users:
        print("  ! Sin colaboradores - skip")
    else:
        certs_pool = [
            ("CCNA 200-301",              "Cisco",     CertificationStatus.APPROVED),
            ("FortiGate NSE 4",           "Fortinet",  CertificationStatus.APPROVED),
            ("eJPT - eLearnSecurity",     "INE",        CertificationStatus.APPROVED),
            ("AWS Cloud Practitioner",    "AWS",       CertificationStatus.APPROVED),
            ("Azure Fundamentals AZ-900", "Microsoft", CertificationStatus.APPROVED),
            ("ITIL 4 Foundation",         "AXELOS",    CertificationStatus.APPROVED),
            ("CompTIA Security+",         "CompTIA",   CertificationStatus.PENDING),
            ("CKAD - Kubernetes App Dev", "CNCF",      CertificationStatus.APPROVED),
            ("Splunk Core Certified User","Splunk",    CertificationStatus.PENDING),
            ("Scrum Master PSM I",        "Scrum.org", CertificationStatus.APPROVED),
            ("OSCP - Offensive Security", "Offensive Security", CertificationStatus.PENDING),
            ("Google Cloud Associate",    "Google",    CertificationStatus.APPROVED),
        ]
        cert_count = 0
        for user in all_collab_users:
            picks = random.sample(certs_pool, k=random.randint(1, 3))
            for cname, issuer, status_ in picks:
                if db.scalar(select(UserCertification).where(UserCertification.user_id == user.id, UserCertification.name == cname)):
                    continue
                db.add(UserCertification(
                    user_id=user.id, name=cname, issuer=issuer,
                    credential_id=f"PE-{user.id:03d}-{random.randint(10000, 99999)}",
                    url=f"https://credly.com/c/{user.id}/{random.randint(1000, 9999)}",
                    status=status_,
                    verified_by=1 if status_ == CertificationStatus.APPROVED else None,
                    verified_at=now_minus(days=random.randint(10, 200)) if status_ == CertificationStatus.APPROVED else None,
                    issued_at=now_minus(days=random.randint(30, 730)),
                    expires_at=now_minus(days=-random.randint(180, 720)),
                ))
                cert_count += 1
        db.commit()
        print(f"  + {cert_count} certificaciones")

    # ── 6. INTEGRACIONES ───────────────────────────────────────────────────
    print("== Integraciones ==")
    integ_data = [
        ("Hospital Pacifico Norte",   "pfSense HQ HPN",                  "pfsense",     "https://pf-hpn.local",   "prod"),
        ("Hospital Pacifico Norte",   "FortiGate Surco",                 "fortigate",   "https://fg-surco.hospital", "prod"),
        ("Universidad Tecnologica del Sur", "pfSense Campus Cayma",      "pfsense",     "https://pf-uts.edu.pe",  "prod"),
        ("Universidad Tecnologica del Sur", "Suricata IDS Lab",          "suricata",    "https://suricata.uts.edu.pe", "dev"),
        ("Banco Andino MicroCredito", "FortiGate HQ Andino",             "fortigate",   "https://fg-andino.pe",   "prod"),
        ("Banco Andino MicroCredito", "FortiAnalyzer",                   "fortianalyzer", "https://fa-andino.pe", "prod"),
        ("Cafe del Valle SAC",        "pfSense Tienda Plaza Norte",      "pfsense",     "https://pf-cdv-pn.local","prod"),
        ("Municipalidad de San Borja","FortiGate Palacio Municipal",     "fortigate",   "https://fg-msb.gob.pe",  "prod"),
        ("AgroExportadora del Norte", "pfSense Planta Trujillo",         "pfsense",     "https://pf-agro.pe",     "prod"),
        ("ClickPay Peru",             "FortiGate AWS VPC",               "fortigate",   "https://fg-clickpay.io", "prod"),
        ("ClickPay Peru",             "Suricata Production Sensors",     "suricata",    "https://suricata.clickpay.io", "prod"),
        ("Naviera Pacifico Sur",      "pfSense Terminal Callao",         "pfsense",     "https://pf-naviera.pe",  "prod"),
    ]
    integ_created = 0
    for cname, name, ctype, url, env in integ_data:
        client = client_by_name.get(cname)
        if not client:
            continue
        if db.scalar(select(Integration).where(Integration.name == name, Integration.client_id == client.id)):
            continue
        db.add(Integration(
            organization_id=org_id, client_id=client.id, name=name,
            connector_type=ctype, base_url=url, auth_type="api_key",
            status="active", environment=env,
            license_type="commercial",
            license_expires_at=date.today() + timedelta(days=random.randint(-15, 365)),
            last_sync_at=now_minus(minutes=random.randint(2, 600)),
            responsible_user_id=random.choice(all_collab_users).id if all_collab_users else None,
        ))
        integ_created += 1
    db.commit()
    print(f"  + {integ_created} integraciones")

    all_integrations = list(db.scalars(select(Integration).where(Integration.organization_id == org_id)).all())

    # ── 7. DEVICES ─────────────────────────────────────────────────────────
    print("== Devices ==")
    device_types_per_int = {
        "pfsense":     [("firewall", "Netgate", "1100"), ("switch", "Cisco", "Catalyst 2960"), ("router", "MikroTik", "RB4011"), ("ap", "Ubiquiti", "UniFi 6 Pro")],
        "fortigate":   [("firewall", "Fortinet", "FG-60F"), ("switch", "FortiSwitch", "124F"), ("ap", "Fortinet", "FortiAP 231F"), ("endpoint", "Lenovo", "ThinkPad E15")],
        "suricata":    [("server", "Dell",  "PowerEdge R350"), ("server", "Supermicro", "AS-1014TS-TR")],
        "fortianalyzer": [("server", "Fortinet", "FortiAnalyzer-200F"), ("endpoint", "HP", "ProDesk 600")],
    }
    statuses = ["active", "active", "active", "pending_review", "maintenance"]
    # ISO 27001 A.8 — criticidad y clasificación de datos por tipo de activo
    criticality_pool_by_type = {
        "firewall": ["critical", "critical", "critical", "high"],
        "server":   ["critical", "critical", "high", "high"],
        "router":   ["high", "high", "medium"],
        "switch":   ["high", "medium", "medium"],
        "ap":       ["medium", "medium", "low"],
        "endpoint": ["medium", "low", "low"],
        "camera":   ["medium", "low"],
        "other":    ["low", "medium"],
    }
    classification_pool_by_type = {
        "firewall": ["restricted", "restricted", "confidential"],
        "server":   ["confidential", "confidential", "restricted"],
        "router":   ["internal", "confidential"],
        "switch":   ["internal", "internal", "confidential"],
        "ap":       ["internal", "internal", "public"],
        "endpoint": ["internal", "internal", "confidential"],
        "camera":   ["internal", "internal"],
        "other":    ["internal", "public"],
    }
    devices_added = 0
    for integ in all_integrations:
        existing_count = db.scalar(select(Device.id).where(Device.integration_id == integ.id))
        if existing_count:
            continue
        pool = device_types_per_int.get(integ.connector_type, [("server", "Generic", "Box")])
        n = random.randint(2, 5)
        for i in range(n):
            dt, vendor, model = random.choice(pool)
            hostname = f"{integ.connector_type[:2]}-{integ.client_id}-{dt[:3]}-{i+1:02d}"
            ip = f"10.{integ.client_id}.{random.randint(1, 250)}.{random.randint(2, 250)}"
            crit_pool = criticality_pool_by_type.get(dt, ["medium"])
            class_pool = classification_pool_by_type.get(dt, ["internal"])
            db.add(Device(
                integration_id=integ.id, hostname=hostname,
                vendor=vendor, model=model, ip_address=ip,
                device_type=dt, status=random.choice(statuses),
                last_seen_at=now_minus(minutes=random.randint(1, 1200)),
                asset_tag=f"AT-{integ.client_id:03d}-{i+1:03d}",
                serial_number=f"SN-{vendor[:2].upper()}{random.randint(100000, 999999)}",
                criticality=random.choice(crit_pool),
                data_classification=random.choice(class_pool),
                responsible_user_id=random.choice(all_collab_users).id if all_collab_users else None,
            ))
            devices_added += 1
    db.commit()
    print(f"  + {devices_added} devices")

    # Backfill: si ya había devices sin estos campos, asignar valores ahora.
    # También re-evalúa devices con device_type capitalizado que cayeron al default genérico.
    print("== Backfill criticidad / clasificación ==")
    legacy_devices = list(db.scalars(
        select(Device).join(Integration, Device.integration_id == Integration.id)
        .where(Integration.organization_id == org_id)
    ).all())
    backfilled = 0
    for d in legacy_devices:
        dt = (d.device_type or "other").lower()
        # Solo escribir si está vacío o si era un legacy con device_type capitalizado
        needs_update = (
            d.criticality is None
            or d.data_classification is None
            or (d.device_type and d.device_type != dt and dt in criticality_pool_by_type)
        )
        if not needs_update:
            continue
        if d.criticality is None or (d.device_type and d.device_type != dt and dt in criticality_pool_by_type):
            d.criticality = random.choice(criticality_pool_by_type.get(dt, ["medium"]))
        if d.data_classification is None or (d.device_type and d.device_type != dt and dt in classification_pool_by_type):
            d.data_classification = random.choice(classification_pool_by_type.get(dt, ["internal"]))
        if all_collab_users and not d.responsible_user_id:
            d.responsible_user_id = random.choice(all_collab_users).id
        backfilled += 1
    db.commit()
    print(f"  ~ {backfilled} devices con campos ISO completados")

    # ── 8. SECURITY REVIEWS + FINDINGS ─────────────────────────────────────
    print("== Security reviews ==")
    review_status_pool = [ReviewStatus.SCHEDULED, ReviewStatus.IN_PROGRESS, ReviewStatus.CLOSED, ReviewStatus.CLOSED]
    review_count = 0
    finding_count = 0
    findings_pool = [
        ("Acceso administrativo expuesto en interfaz WAN", "CRITICAL", "El panel admin del firewall responde en la IP publica sin restriccion de IP"),
        ("Certificado HTTPS expirado",                      "HIGH",     "El certificado del portal admin vencio hace 14 dias"),
        ("Politica firewall demasiado permisiva any-any",   "HIGH",     "Una regla en posicion 3 permite egress sin restriccion"),
        ("Reglas IDS Suricata desactualizadas (>30 dias)",  "MEDIUM",   "El ultimo update del ruleset ET es del 2026-03-12"),
        ("Logs no enviados a SIEM",                          "MEDIUM",   "El sistema no exporta logs a syslog central"),
        ("Backup de configuracion sin cifrar",               "MEDIUM",   "Los archivos de backup se guardan en texto plano"),
        ("Version de firmware con CVE conocido",             "CRITICAL", "FortiOS 6.4.2 - vulnerable a CVE-2025-2188"),
        ("Cuentas con contrasena por defecto",               "CRITICAL", "Encontrados 2 usuarios admin con password 'admin'"),
        ("WAF sin reglas OWASP Top 10 habilitadas",          "HIGH",     "Las reglas criticas SQLi y XSS estan deshabilitadas"),
        ("Logs de auditoria solo locales",                   "LOW",      "No hay envio a almacenamiento externo (cumplimiento)"),
        ("MFA no aplicado a cuentas administrativas",        "HIGH",     "12 cuentas admin sin segundo factor"),
        ("Servicio innecesario expuesto (Telnet)",           "MEDIUM",   "Puerto 23/tcp accesible en gestion interna"),
    ]
    for integ in all_integrations:
        existing_for_int = db.scalar(select(SecurityReview.id).where(SecurityReview.integration_id == integ.id))
        if existing_for_int:
            continue
        for _ in range(random.randint(1, 2)):
            status_ = random.choice(review_status_pool)
            scheduled_at = now_minus(days=random.randint(5, 90))
            executed_at = None if status_ == ReviewStatus.SCHEDULED else scheduled_at + timedelta(days=random.randint(0, 5))
            reviewer = random.choice(all_collab_users) if status_ != ReviewStatus.SCHEDULED and all_collab_users else None
            review = SecurityReview(
                organization_id=org_id, client_id=integ.client_id, integration_id=integ.id,
                scheduled_at=scheduled_at, executed_at=executed_at,
                status=status_,
                reviewer_user_id=reviewer.id if reviewer else None,
                notes=f"Revision periodica trimestral - {integ.name}",
            )
            db.add(review)
            db.flush()
            review_count += 1
            if status_ != ReviewStatus.SCHEDULED:
                n_findings = random.randint(1, 4)
                for title, sev, descr in random.sample(findings_pool, k=n_findings):
                    db.add(ReviewFinding(
                        review_id=review.id,
                        severity=FindingSeverity[sev],
                        title=title,
                        description=descr,
                        status=random.choice([FindingStatus.OPEN, FindingStatus.OPEN, FindingStatus.IN_PROGRESS, FindingStatus.RESOLVED]),
                        created_at=executed_at or scheduled_at,
                    ))
                    finding_count += 1
                checklist_items = [
                    ("Reglas firewall siguen politica least-privilege",     "OK"),
                    ("Certificado HTTPS valido y renovado en < 60 dias",   "FAIL"),
                    ("Logs enviados a SIEM/syslog central",                 "FAIL"),
                    ("MFA aplicado en cuentas administrativas",             "OK"),
                    ("Backup automatizado y cifrado",                       "NA"),
                    ("Firmware actualizado sin CVE criticos",               "OK"),
                ]
                for crit, res in random.sample(checklist_items, k=random.randint(3, 5)):
                    db.add(ReviewChecklistItem(review_id=review.id, criteria=crit, result=res, notes=None))
    db.commit()
    print(f"  + {review_count} revisiones, {finding_count} hallazgos")

    # ── 9. TICKETS ─────────────────────────────────────────────────────────
    print("== Tickets ==")
    tickets_data = [
        ("VPN site-to-site con caidas intermitentes",   "Conexion entre HQ y sucursal cae cada 3-4 horas", "incident",     TicketPriority.HIGH),
        ("Configurar nueva regla de firewall para servicio interno", "Solicito apertura puerto 5432 para nueva DB", "support", TicketPriority.MEDIUM),
        ("Wi-Fi de visitantes lento en sala de espera",  "Reportan ~3 Mbps en lobby", "incident",     TicketPriority.LOW),
        ("Solicitud - Whitelist IP de proveedor",        "Whitelist 200.48.225.10 para acceso al portal", "support",     TicketPriority.LOW),
        ("Alerta IDS - multiples intentos de SSH",       "Suricata detecta brute force desde IPs externas", "incident",  TicketPriority.CRITICAL),
        ("Renovacion certificado HTTPS del portal admin","Cert vence en 14 dias", "maintenance",   TicketPriority.HIGH),
        ("Perdida de paquetes en enlace MPLS",            "10% packet loss reportado por monitoreo", "incident",          TicketPriority.HIGH),
        ("Habilitar auditoria AAA en switches Cisco",    "Compliance interno requiere logs en TACACS+", "request",       TicketPriority.MEDIUM),
        ("Actualizacion firmware FortiGate a 7.4.5",      "Liberar parche con CVE conocido", "maintenance",                TicketPriority.HIGH),
        ("Bloqueo accidental - usuario CFO sin acceso",   "Politica agresiva bloqueo MAC del laptop del CFO", "incident",  TicketPriority.CRITICAL),
        ("Reporte mensual de trafico no llega por email", "Reporte programado dejo de enviarse hace 3 dias", "support",   TicketPriority.LOW),
        ("Onboarding nuevo colaborador - credenciales VPN", "Crear cuenta + cert VPN para Mario Lozada", "request",        TicketPriority.MEDIUM),
    ]
    statuses_pool = [TicketStatus.OPEN, TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CLOSED]
    tickets_created = 0
    for title, desc, category, priority in tickets_data:
        if db.scalar(select(SupportTicket).where(SupportTicket.title == title)):
            continue
        client = random.choice(all_clients)
        status_ = random.choice(statuses_pool)
        opened = now_minus(days=random.randint(0, 25), hours=random.randint(0, 23))
        closed = opened + timedelta(hours=random.randint(2, 96)) if status_ in (TicketStatus.RESOLVED, TicketStatus.CLOSED) else None
        assigned = random.choice(all_collab_users) if all_collab_users else None
        t = SupportTicket(
            organization_id=org_id, client_id=client.id, title=title, description=desc,
            category=category, priority=priority, status=status_,
            assigned_to=assigned.id if assigned else None,
            resolution="Aplicado parche + monitoreo 24h sin reportes" if closed else None,
            opened_at=opened, closed_at=closed,
        )
        db.add(t)
        db.flush()
        db.add(SupportTicketEvent(
            ticket_id=t.id, event_type="opened", to_status=TicketStatus.OPEN.value,
            user_id=1, notes="Ticket creado por gestion",
            created_at=opened,
        ))
        if status_ != TicketStatus.OPEN and assigned:
            db.add(SupportTicketEvent(
                ticket_id=t.id, event_type="assigned",
                from_status=TicketStatus.OPEN.value, to_status=status_.value,
                user_id=1, notes=f"Asignado a {assigned.full_name}",
                created_at=opened + timedelta(minutes=15),
            ))
        if closed:
            db.add(SupportTicketEvent(
                ticket_id=t.id, event_type="closed",
                from_status=status_.value, to_status=TicketStatus.CLOSED.value,
                user_id=assigned.id if assigned else 1, notes="Ticket cerrado con exito",
                created_at=closed,
            ))
        tickets_created += 1
    db.commit()
    print(f"  + {tickets_created} tickets")

    # ── 10. LEADS ──────────────────────────────────────────────────────────
    print("== Leads ==")
    leads_data = [
        ("Fabrica Textil Andina",     "Roxana Pizarro",  "rpizarro@textilandina.pe",   "+51 1 4561009", "Firewall pfSense + capacitacion", "NEW",       "linkedin"),
        ("Clinica Pediatrica El Olivar","Dr. Hugo Ferrer","hferrer@cpolivar.pe",       "+51 1 4561200", "Auditoria LOPD + plan de remediacion", "QUALIFIED", "referral"),
        ("Estudio Juridico Salgado",  "Lic. Marina Salgado", "marina@salgadoabogados.pe", "+51 998 100 200", "Hardening de endpoints (12 abogados)", "CONTACTED", "website"),
        ("Cooperativa Cafetalera Chanchamayo", "Ing. Pedro Atauchi","patauchi@chanchamayo.coop", "+51 64 778 111", "Conectividad MPLS + monitoreo", "PROPOSAL",  "event"),
        ("Centro Comercial Plaza Lima","Lic. Veronica Cano","vcano@plazalima.pe",      "+51 1 4111400", "Reemplazo FortiGate + retain SOC",  "CLOSED_WON","linkedin"),
        ("Distribuidora Sur Sac",     "Sr. Jose Rivera",  "jrivera@distsur.pe",        "+51 54 777 333", "Migracion VPN a Always-On",       "CLOSED_LOST","cold_outreach"),
        ("Editorial Andina",          "Mg. Lucia Torres", "ltorres@editorialandina.pe","+51 1 4225600", "Backup en la nube + Disaster Recovery", "NEW",  "linkedin"),
        ("Inmobiliaria Vivanco",      "Sr. Marco Vivanco","mvivanco@vivanco.com.pe",   "+51 999 444 555","Pentest a portal interno",          "QUALIFIED","website"),
        ("Restaurante Gourmet Norte", "Chef Ricardo Mejia","rmejia@gourmetnorte.pe",   "+51 44 888 999", "Wi-Fi y POS seguros - 5 locales",  "CONTACTED","referral"),
        ("Constructora Cervantes",    "Ing. Andrea Cervantes","acervantes@cervantes.pe", "+51 1 6101234","SIEM + capacitacion SOC",          "PROPOSAL",  "google_ads"),
    ]
    leads_created = 0
    for company, contact, email, phone, message, status, source in leads_data:
        if db.scalar(select(Lead).where(Lead.email == email)):
            continue
        db.add(Lead(
            company_name=company, contact_name=contact, email=email, phone=phone,
            interest_area="Firewall / IDS / Pentest" if ("Firewall" in message or "Pentest" in message) else "Consultoria TI",
            message=message, source=source,
            status=status,
            created_at=now_minus(days=random.randint(1, 60)),
        ))
        leads_created += 1
    db.commit()
    print(f"  + {leads_created} leads")

    # ── 11. SERVICE REQUESTS ───────────────────────────────────────────────
    print("== Service requests ==")
    all_services = list(db.scalars(select(Service).where(Service.organization_id == org_id)).all())
    sr_data = [
        ("Hospital Pacifico Norte",   "Dra. Carla Mendoza Rivera", "cmendoza@hospitalpacifico.pe", "Necesitamos dashboard SOC para 24h",           ServiceRequestStatus.NEW),
        ("Universidad Tecnologica del Sur", "Mg. Ana Paredes",     "aparedes@uts.edu.pe",          "Migracion firewall del campus principal",      ServiceRequestStatus.REVIEW),
        ("Banco Andino MicroCredito", "Lic. Renato Salinas",       "rsalinas@bancoandino.pe",      "Auditoria de compliance - SBS Reglamento 504", ServiceRequestStatus.NEW),
        ("Cafe del Valle SAC",        "Lucia Quispe",              "lucia@cafedelvalle.pe",        "Reporting de trafico mensual + alertas basicas", ServiceRequestStatus.CLOSED),
        ("Municipalidad de San Borja","Ing. Marco Villarroel",     "mvillarroel@msb.gob.pe",       "Implementar baseline de compliance MINGOB",     ServiceRequestStatus.REVIEW),
        ("AgroExportadora del Norte", "Ing. Patricia Larrea",      "plarrea@agronorte.pe",         "Monitoreo de red en planta empacadora",         ServiceRequestStatus.NEW),
        ("ClickPay Peru",             "Diego Cano",                "dcano@clickpay.pe",            "Asesoria arquitectura zero-trust",              ServiceRequestStatus.REVIEW),
    ]
    sr_created = 0
    for cname, rname, remail, msg, status_ in sr_data:
        client = client_by_name.get(cname)
        if not client or not all_services:
            continue
        service = random.choice(all_services)
        if db.scalar(select(ServiceRequest).where(ServiceRequest.client_id == client.id, ServiceRequest.message == msg)):
            continue
        db.add(ServiceRequest(
            service_id=service.id, client_id=client.id,
            requester_name=rname, requester_email=remail,
            request_type="consulting", message=msg,
            status=status_,
            created_at=now_minus(days=random.randint(1, 30)),
        ))
        sr_created += 1
    db.commit()
    print(f"  + {sr_created} service requests")

    # ── 12. PROJECTS + MEMBERS ─────────────────────────────────────────────
    print("== Projects ==")
    pt_implementation = db.scalar(select(ProjectType).where(ProjectType.slug == "implementation"))
    pt_consulting    = db.scalar(select(ProjectType).where(ProjectType.slug == "consulting"))
    pt_support       = db.scalar(select(ProjectType).where(ProjectType.slug == "support"))
    area_sec   = db.scalar(select(Area).where(Area.slug == "cybersecurity"))
    area_net   = db.scalar(select(Area).where(Area.slug == "network"))
    area_dops  = db.scalar(select(Area).where(Area.slug == "devops"))
    area_comp  = db.scalar(select(Area).where(Area.slug == "compliance-grc"))

    proj_data = [
        ("Hospital Pacifico Norte",   "Hardening pfSense + Suricata HPN",      pt_implementation, area_sec,  "Implementar reglas estrictas + IDS en sede central + Surco", ProjectStatus.ACTIVE,    "S/ 35.000", -30, 60),
        ("Universidad Tecnologica del Sur", "Lab Cibersec - Capacitacion Estudiantes", pt_consulting, area_sec, "Plataforma de practicas en Suricata + pfSense para curso de Cibersec", ProjectStatus.ACTIVE, "S/ 18.000", -45, 90),
        ("Banco Andino MicroCredito", "Migracion FortiGate 60F -> 200F",       pt_implementation, area_net,  "Reemplazo de equipos + migracion de politicas", ProjectStatus.PLANNING,  "S/ 78.000", 15, 120),
        ("ClickPay Peru",             "Arquitectura Zero-Trust AWS",            pt_consulting,    area_dops, "Diseno + roadmap de implementacion", ProjectStatus.ACTIVE,    "S/ 52.000", -15, 75),
        ("Municipalidad de San Borja","Auditoria Compliance MINGOB",            pt_consulting,    area_comp, "Diagnostico de cumplimiento normativo y plan de accion", ProjectStatus.COMPLETED, "S/ 22.000", -90, -10),
        ("Cafe del Valle SAC",        "Soporte recurrente Wi-Fi multipunto",    pt_support,       area_net,  "Mantenimiento mensual + visitas tecnicas", ProjectStatus.ACTIVE,    "S/ 1.200/mes", -180, 365),
        ("AgroExportadora del Norte", "Implementacion Suricata IDS - Planta",   pt_implementation, area_sec,  "Sensor IDS en red de empacadora", ProjectStatus.ACTIVE,    "S/ 14.500", -10, 45),
        ("Naviera Pacifico Sur",      "Diagnostico red MPLS Terminal Callao",   pt_consulting,    area_net,  "Analisis de latencia + recomendaciones", ProjectStatus.PLANNING,  "S/ 9.800",  20, 60),
        ("Hospital Pacifico Norte",   "Onboarding equipo TI a SOC NinjaSec",    pt_support,       area_sec,  "Monitoreo 24x7 - primer trimestre", ProjectStatus.PLANNING,  "S/ 5.500/mes", 30, 365),
    ]
    proj_created = 0
    new_projects = []
    for cname, name, ptype, area, descr, status, budget, days_off_start, days_off_end in proj_data:
        client = client_by_name.get(cname)
        if not client or not ptype:
            continue
        if db.scalar(select(Project).where(Project.name == name)):
            continue
        sd = (datetime.utcnow() + timedelta(days=days_off_start)).date()
        ed = (datetime.utcnow() + timedelta(days=days_off_end)).date()
        p = Project(
            organization_id=org_id, client_id=client.id, project_type_id=ptype.id,
            area_id=area.id if area else None,
            name=name, description=descr, status=status,
            start_date=sd, end_date=ed, budget_label=budget,
        )
        db.add(p)
        new_projects.append(p)
        proj_created += 1
    db.commit()
    for p in new_projects:
        db.refresh(p)
        members = random.sample(all_collab_users, k=min(random.randint(2, 4), len(all_collab_users)))
        for i, m in enumerate(members):
            db.add(ProjectMember(
                project_id=p.id, user_id=m.id,
                project_role="Project Lead" if i == 0 else "Member",
                role_in_project="Lead" if i == 0 else "Engineer",
                allocation_percentage=random.choice([25, 50, 75, 100]),
                can_publish_docs=(i == 0),
                assignment_type=AssignmentType.MANUAL,
                is_required=(i == 0),
            ))
        db.add(AuditLog(organization_id=org_id, action="project.created", entity_type="projects", entity_id=str(p.id), user_id=1, created_at=now_minus(days=random.randint(1, 60))))
    db.commit()
    print(f"  + {proj_created} proyectos")

    # ── 13. JOB APPLICATIONS ───────────────────────────────────────────────
    print("== Job applications ==")
    applications_data = [
        ("Daniela Cisneros Vargas",    "dcisneros@students.pe",    "Frontend Junior",        "React, TypeScript, Tailwind",   "linkedin",     JobApplicationStatus.NEW),
        ("Manuel Espinoza Rojas",      "mespinoza@students.pe",    "Backend Junior",         "Python, FastAPI, PostgreSQL",   "website",      JobApplicationStatus.SCREENING),
        ("Patricia Yarihuaman",        "pyarihuaman@students.pe",  "QA / Automation Trainee","Cypress, Playwright, Python",   "referral",     JobApplicationStatus.INTERVIEW),
        ("Christian Vilcahuaman",      "cvilcahuaman@students.pe", "Pentester Trainee",      "TryHackMe top 5%, Burp Suite",  "linkedin",     JobApplicationStatus.NEW),
        ("Romina Carbajal Vergara",    "rcarbajal@students.pe",    "DevOps Junior",          "Docker, K8s basico, GitLab CI", "website",      JobApplicationStatus.SCREENING),
        ("Ivan Quinonez Salazar",      "iquinonez@students.pe",    "SOC Analyst Trainee",    "Splunk Fundamentals, Wireshark", "event",       JobApplicationStatus.OFFER),
        ("Jhoselyn Sanchez Tito",      "jsanchez@students.pe",     "Backend Junior",         "Python, Django, REST APIs",     "referral",     JobApplicationStatus.HIRED),
        ("Carlos Mejia Inca",          "cmejia@students.pe",       "Frontend Junior",        "Next.js, Vue, Figma",           "linkedin",     JobApplicationStatus.REJECTED),
        ("Mariana Reyes Quispe",       "mreyes@students.pe",       "Data Engineer Trainee",  "SQL, Python, dbt basico",       "website",      JobApplicationStatus.NEW),
        ("Sebastian Aguilar Bocanegra","saguilar@students.pe",     "Pentester Trainee",      "HackTheBox top 20%, Nmap",      "linkedin",     JobApplicationStatus.SCREENING),
        ("Adriana Cardenas Mendoza",   "acardenas@students.pe",    "Cloud Junior",           "AWS CCP, Terraform basico",     "event",        JobApplicationStatus.INTERVIEW),
        ("Bruno Yanez Quispe",         "byanez@students.pe",       "Pentester Junior",       "eJPT, Metasploit, redes",       "referral",     JobApplicationStatus.OFFER),
    ]
    apps_created = 0
    for name, email, role, summary, source, status_ in applications_data:
        if db.scalar(select(JobApplication).where(JobApplication.email == email)):
            continue
        db.add(JobApplication(
            full_name=name, email=email, desired_role=role,
            skills_summary=summary, source=source, status=status_,
            phone="+51 9" + str(random.randint(10000000, 99999999)),
            cv_url=f"https://drive.google.com/file/d/{random.randint(1000000, 9999999)}/view",
            portfolio_url=f"https://github.com/{email.split('@')[0]}",
            created_at=now_minus(days=random.randint(1, 45)),
        ))
        apps_created += 1
    db.commit()
    print(f"  + {apps_created} postulaciones")

    # ── 13.5 DEVICE CONNECTIONS (topología) ────────────────────────────────
    print("== Topología de devices ==")
    conn_added = 0

    def _add_conn(src_id: int, tgt_id: int, link_type: str,
                  port_s: str | None = None, port_t: str | None = None,
                  vlan: int | None = None, bw: int | None = None,
                  notes: str | None = None) -> None:
        nonlocal conn_added
        if db.scalar(select(DeviceConnection).where(
            DeviceConnection.source_device_id == src_id,
            DeviceConnection.target_device_id == tgt_id,
            DeviceConnection.link_type == link_type,
        )):
            return
        db.add(DeviceConnection(
            source_device_id=src_id, target_device_id=tgt_id,
            link_type=link_type, port_source=port_s, port_target=port_t,
            vlan_id=vlan, bandwidth_mbps=bw, notes=notes,
        ))
        conn_added += 1

    for client in all_clients:
        client_devices = list(db.scalars(
            select(Device).join(Integration, Device.integration_id == Integration.id)
            .where(Integration.client_id == client.id, Integration.organization_id == org_id)
        ).all())
        if not client_devices:
            continue

        by_type: dict[str, list[Device]] = {}
        for d in client_devices:
            key = (d.device_type or "other").lower()
            by_type.setdefault(key, []).append(d)

        firewalls = by_type.get("firewall", [])
        switches  = by_type.get("switch", [])
        routers   = by_type.get("router", [])
        aps       = by_type.get("ap", [])
        servers   = by_type.get("server", [])
        endpoints = by_type.get("endpoint", [])
        cameras   = by_type.get("camera", [])

        # Router → firewall (WAN uplink)
        if routers and firewalls:
            for i, r in enumerate(routers):
                fw = firewalls[i % len(firewalls)]
                _add_conn(r.id, fw.id, "wan",
                          port_s=f"WAN{i+1}", port_t=f"WAN{i+1}",
                          bw=1000, notes="Uplink WAN")

        # HA entre firewalls (si hay 2+)
        if len(firewalls) >= 2:
            _add_conn(firewalls[0].id, firewalls[1].id, "trunk",
                      port_s="HA1", port_t="HA1", vlan=99, bw=10000, notes="Cluster HA")

        # Firewall → switches (trunk con VLANs)
        if firewalls and switches:
            for i, sw in enumerate(switches):
                fw = firewalls[i % len(firewalls)]
                _add_conn(fw.id, sw.id, "trunk",
                          port_s=f"LAN{i+1}", port_t="Uplink",
                          vlan=10, bw=1000, notes="Distribución LAN")
        elif firewalls and not switches:
            # Sin switches: conectar APs/servers/endpoints directo al firewall
            pass

        # Switch ↔ switch (mesh sencillo en 2+ switches)
        if len(switches) >= 2:
            for i in range(len(switches) - 1):
                _add_conn(switches[i].id, switches[i+1].id, "trunk",
                          port_s="Gi0/24", port_t="Gi0/1", vlan=10, bw=1000,
                          notes="Inter-switch link")

        # Helper para distribuir endpoints entre switches (o firewall si no hay switches)
        def _distribute(items: list[Device], vlan: int, link: str, label: str) -> None:
            anchors = switches or firewalls
            if not anchors:
                return
            for idx, item in enumerate(items):
                anchor = anchors[idx % len(anchors)]
                port_n = (idx // max(len(anchors), 1)) + 1
                _add_conn(anchor.id, item.id, link,
                          port_s=f"Gi0/{port_n + 1}", port_t="eth0",
                          vlan=vlan, bw=1000 if link == "ethernet" else 300,
                          notes=label)

        _distribute(aps, vlan=20, link="ethernet", label="Acceso WiFi")
        _distribute(servers, vlan=30, link="ethernet", label="Server farm")
        _distribute(endpoints, vlan=40, link="ethernet", label="Estaciones de trabajo")
        _distribute(cameras, vlan=50, link="ethernet", label="CCTV")

    db.commit()
    print(f"  + {conn_added} conexiones de topología")

    # ── 14. AUDIT LOG sinteticos ───────────────────────────────────────────
    print("== Audit log ==")
    actions = [
        ("review.created",   "security_reviews"),
        ("review.closed",    "security_reviews"),
        ("ticket.created",   "support_tickets"),
        ("ticket.updated",   "support_tickets"),
        ("device.created",   "devices"),
        ("integration.created", "integrations"),
        ("client.updated",   "clients"),
    ]
    audit_extra = 0
    existing_user_ids = [row[0] for row in db.execute(select(User.id)).all()]
    extra_user_ids = existing_user_ids[:6]
    for _ in range(20):
        action, entity = random.choice(actions)
        db.add(AuditLog(
            organization_id=org_id, action=action, entity_type=entity,
            entity_id=str(random.randint(1, 30)),
            user_id=random.choice(extra_user_ids),
            created_at=now_minus(days=random.randint(1, 90), hours=random.randint(0, 23)),
        ))
        audit_extra += 1
    db.commit()
    print(f"  + {audit_extra} eventos extras")

    print("\n[OK] Seed demo completado")


if __name__ == "__main__":
    with SessionLocal() as session:
        run(session)
