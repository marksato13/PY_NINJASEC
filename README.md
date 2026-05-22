# 🥷 NinjaSec

Plataforma full-stack de **infraestructura + ciberseguridad** para PYMEs, consultoras y MSPs. Genera reportes automáticos desde pfSense, FortiGate, Suricata IDS y similares, y sirve como portafolio profesional.

> Estado: **MVP avanzado** (backend v0.2.0). 14 módulos cerrados. Data peruana realista seedeada (17 clientes, 73 dispositivos, ~42 conexiones de topología, etc.).

---

## 🦝 Conocé a Kuro

Kuro es la mascota de NinjaSec — un ninja-mapache cibernético que vigila la red 24/7. Lo vas a ver en el login, hero de marketing, página 404 y como botón flotante asistente en el portal cliente.

---

## 🚀 Cómo correr (dev local)

Requiere **Docker Desktop** y **Docker Compose v2**.

```bash
# 1. Clonar el repo
git clone https://github.com/marksato13/PY_NINJASEC.git
cd PY_NINJASEC

# 2. Crear .env desde la plantilla
cp .env.example infra/.env
# Editar infra/.env: generar JWT_SECRET_KEY y POSTGRES_PASSWORD
#   openssl rand -base64 64 > jwt.tmp
#   openssl rand -base64 24 > pgpass.tmp

# 3. Levantar el stack
cd infra
docker compose up -d --build

# 4. (Opcional) Cargar data demo peruana realista
docker exec ninjasec-backend python /app/seed_demo.py
```

URLs locales:

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3018 |
| API Swagger | http://localhost:8024/docs |
| PostgreSQL | localhost:5433 |

### Credenciales seed (cambiar después del primer login en prod)

| Rol | Email | Password |
|---|---|---|
| super_admin | `admin@ninjasec.local` | `change-me` |
| admin | `ops@ninjasec.local` | `admin123` |
| client | `client@ninjasec.local` | `NinjaSec2024!` |

---

## 🏗️ Stack

| Capa | Tecnologías |
|---|---|
| **Backend** | Python 3.12 · FastAPI · SQLAlchemy 2.0 · Alembic · Pydantic v2 · PyJWT · psycopg3 |
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · TanStack Query 5 · React Hook Form · Zod · SweetAlert2 |
| **DB** | PostgreSQL 16 |
| **Infra** | Docker Compose · Caddy (reverse proxy + HTTPS Let's Encrypt en prod) |

---

## 🧩 Módulos implementados

| # | Módulo | Funcionalidad clave |
|---|---|---|
| 01 | Roles y accesos | JWT, cross-admin protection, confirmDeleteStrict |
| 02 | Dashboard | 5 vistas tabuladas, auto-refresh, KPIs reales |
| 03 | Clientes | Multi-tenant, badges devices+tickets, export XLSX |
| 04 | Integraciones | Test/Collect, banner sin revisión >90 días |
| 05 | Dispositivos | **Campos ISO 27001 A.8** (criticality, classification, owner), topología |
| 06 | Revisiones de seguridad | Export PDF ejecutivo + findings |
| 07 | Tickets | Stats panel, "Desde hallazgo" trazable |
| 08 | Leads | Convertir a cliente, /contacto cableado |
| 09 | Reportes | Card PDF revisión, filtro fecha pipeline |
| 10 | Colaboradores | `area` + `photo_url`, certificaciones |
| 11 | Servicios | `price_label`, toggles is_public/active |
| 12 | Proyectos | Vista Kanban, budget, equipo en cards |
| 13 | Usuarios | Link "Ver auditoría" filtrado por entity_id |
| 14 | Portal Cliente | Cambio contraseña, **FAB asistente Kuro** |

---

## 🌐 Despliegue en producción

Ver **[DEPLOY.md](./DEPLOY.md)** para los pasos completos:

- Servidor Ubuntu 22.04+ en VLAN20 DMZ
- Caddy con HTTPS Let's Encrypt automático
- PostgreSQL aislado en VLAN30 DC (ISO 27001)
- Reglas pfSense (port-forward, firewall inter-VLAN)
- Hardening final + backups

---

## 📂 Estructura del repo

```
PY-MK/
├── backend/         # FastAPI app (modular monolith)
│   ├── app/
│   │   ├── api/          # router central
│   │   ├── core/         # config, security, exceptions
│   │   ├── common/       # deps compartidas
│   │   ├── db/           # models, session, migrations
│   │   └── modules/      # 18 features (auth, devices, clients, ...)
│   ├── alembic.ini
│   └── seed_demo.py      # data peruana demo
├── frontend/        # Next.js 15 App Router
│   ├── src/
│   │   ├── app/         # rutas (public, admin/dashboard, portal/portal)
│   │   ├── components/  # dashboard, forms, ui, public
│   │   └── lib/         # api client, auth, alerts, query-keys
│   └── public/mascot/   # 8 variantes de Kuro
├── infra/
│   ├── docker-compose.yml         # dev
│   ├── docker-compose.prod.yml    # producción
│   ├── Caddyfile                  # reverse proxy
│   └── .env                       # secretos LOCAL (NO commitear)
├── ARQUITECTURA/    # diagramas y decisiones técnicas
├── docs/            # documentación funcional
├── CLAUDE.md        # guía para Claude Code
└── README.md
```

---

## 🔧 Decisiones técnicas no obvias

Ver `CLAUDE.md` y `ARQUITECTURA/` para detalles. Resumen:

1. **Next.js proxy con DOS rewrites** (con/sin trailing slash) — fix de loop infinito
2. **`from __future__ import annotations`** en services con `def list()` (sombreo de builtin)
3. **JWT expiry chequeado client-side** en cada request
4. **Mock fallback solo si endpoint vacío** — KPIs nunca usan hardcoded
5. **Modales SweetAlert "pill"** estandarizados en `lib/alerts.ts`
6. **Audit log** después de toda mutación crítica

---

## 📝 Autor

**Rubén Mark Salazar Tocas** — UPeU · NinjaSec Founder

---

## 📄 Licencia

Por definir. El código actual es para fines educativos y comerciales del autor.
