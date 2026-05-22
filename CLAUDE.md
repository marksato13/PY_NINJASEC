# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

---

## Project Overview

**NinjaSec** es una plataforma full-stack de infraestructura + ciberseguridad para PYMEs, consultoras y MSPs. Genera reportes automáticos desde pfSense, FortiGate, Suricata IDS y similares, y sirve como portafolio de servicios profesionales.

**Estado:** MVP avanzado (backend v0.2.0). Se ejecutó un seed masivo con data peruana realista (17 clientes, 73 dispositivos, 28 revisiones con 62 hallazgos, 15 proyectos, etc.). Todos los módulos del checklist `IMPLEMENTACION/01–14.md` están cerrados.

**Origen:** consultoría inicial pensada para que estudiantes UPeU de Desarrollo, Infraestructura y Ciberseguridad practiquen y entreguen valor real a SMEs peruanas.

---

## 🚀 Cómo correr el proyecto

Todo el desarrollo local pasa por Docker Compose en `infra/`:

```powershell
# Desde la raíz del repo:
cd infra
docker compose up -d --build           # levantar todo
docker compose up -d --build backend   # rebuild sólo backend
docker compose up -d --build frontend  # rebuild sólo frontend
docker compose down                    # detener (mantiene volumen Postgres)
docker compose down -v                 # destructivo — borra DB
```

**Puertos:**
- Frontend (Next.js): http://localhost:3018
- Backend (FastAPI Swagger): http://localhost:8024/docs
- PostgreSQL: `localhost:5433` (externo) / `5432` (interno Docker)

API base: `http://localhost:8024/api/v1` (en producción Next.js hace proxy desde `/api/v1/*`)

### Credenciales seed
| Rol | Email | Contraseña |
|---|---|---|
| super_admin | `admin@ninjasec.local` | `change-me` |
| admin | `ops@ninjasec.local` | `admin123` |
| collaborator (seed-original) | `collab@ninjasec.local` | `temp123` |
| client | `client@ninjasec.local` | `NinjaSec2024!` |
| collaborators nuevos (12) | `andrea.castillo@ninjasec.local`, `bryan.huaman@ninjasec.local`, `joel.cardenas@ninjasec.local`, etc. | `colab123` |

---

## 🤖 MCP Servers — usar proactivamente

- **Context7** → docs actualizadas de FastAPI, Next.js 15, React 19, SQLAlchemy 2.0, Pydantic v2, TanStack Query, Alembic, Tailwind 3. Trigger: añadir `use context7` en prompts de librerías.
- **GitHub** → PRs, issues, commits, releases.
- **Playwright** → testing manual de flows. Decir explícitamente "playwright mcp". Frontend en `http://localhost:3018`, Swagger en `http://localhost:8024/docs`.
- **PostgreSQL (`postgres-ninjasec`)** → query directo a la DB para debug. **NUNCA** DELETE/DROP sin confirmación explícita del usuario.
- **Sequential Thinking** → planificación de módulos nuevos, migraciones Alembic.
- **Memory** → ya hay archivos en `~/.claude/projects/C--Users-markp/memory/`.
- **Firecrawl + Brave** → buscar CVE, docs de pfSense/FortiGate.
- **Filesystem** → acceso a archivos del proyecto.
- **DrawIO** → para diagramas (importante para el feature de network-map pendiente).

---

## 🏗️ Arquitectura

### Backend — `backend/app/` (Modular monolith en Python 3.12 / FastAPI)

```
backend/app/
├── main.py              # init FastAPI, CORS, lifespan (auto-create tables + seed)
├── api/router.py        # router central — registra todos los módulos
├── core/                # config (pydantic-settings), JWT, security, exceptions
├── db/
│   ├── models/          # 40+ modelos SQLAlchemy 2.0 organizados por dominio
│   ├── session.py       # engine + SessionLocal
│   ├── seed.py          # seed dev base
│   └── migrations/      # Alembic
├── common/
│   ├── deps/            # auth (CurrentUser, require_roles, get_current_user) + database
│   └── schemas/         # ORMModel base (Pydantic v2 con from_attributes=True)
└── modules/             # 18 módulos feature
    └── [module]/
        ├── routers/    # APIRouter + handlers
        ├── schemas/    # Pydantic request/response
        └── services/   # lógica de negocio
```

**Módulos activos:** `auth`, `organizations`, `users`, `clients`, `client_sites`, `client_contacts`, `collaborators`, `devices`, `catalogs`, `skills`, `certifications`, `projects`, `services`, `leads`, `recruitment` (job_applications), `integrations`, `collection`, `reports`, `docs`, `audit`, `support_tickets`, `security_reviews`, `dashboard`, `alerts`.

Para agregar un módulo nuevo: crear carpeta en `modules/`, implementar routers/schemas/services, registrar el router en `api/router.py`.

### Frontend — `frontend/src/` (Next.js 15 App Router + React 19)

```
src/
├── app/
│   ├── (public)/    # marketing, login, contacto
│   ├── (admin)/dashboard/    # backoffice (super_admin, admin, collaborator)
│   └── (portal)/portal/      # portal cliente (rol CLIENT)
├── components/
│   ├── dashboard/   # shell, sidebar, portal-shell, dashboard-shell, dashboard-widgets
│   ├── forms/       # client-form, user-form, project-form, collaborator-form
│   ├── public/      # marketing (lead-form, hero, etc.)
│   └── ui/          # Modal genérico
├── features/        # agenda-demo, colabora, etc.
├── lib/
│   ├── api/         # cliente HTTP modular (un archivo por dominio)
│   ├── alerts.ts    # SweetAlert2 wrappers (confirmDelete, confirmDeleteStrict, etc.)
│   ├── auth.ts      # localStorage helpers + isTokenExpired
│   ├── query-keys.ts # QK.* — clave estable por endpoint
│   └── validation.ts # Zod schemas
```

**State:** TanStack React Query para server state. **Forms:** React Hook Form + Zod.
**Iconos:** Lucide React. **CSS:** Tailwind 3 + globals.css con sistema de tokens (`--primary`, `--success`, etc.) y soporte tema claro/oscuro.

---

## 🔧 Decisiones técnicas importantes (no obvias)

### 1. **Next.js proxy con trailing slash explícito**
`frontend/next.config.ts` tiene **dos** rewrites — uno con slash al final, otro sin él — porque Next.js stripeaba el slash de la URL y FastAPI luego redirigía a `http://backend:8024/...` (DNS interno) generando un loop infinito en el browser. Setting `skipTrailingSlashRedirect: true` también activado.

```ts
async rewrites() {
  return [
    { source: "/api/v1/:path*/", destination: `${BACKEND_URL}/api/v1/:path*/` },
    { source: "/api/v1/:path*",  destination: `${BACKEND_URL}/api/v1/:path*` },
  ];
}
```

**NO QUITAR** estas configuraciones — son el fix de un bug que rompía todos los módulos.

### 2. **API base URL relativa**
`NEXT_PUBLIC_API_URL: /api/v1` (build arg en `infra/docker-compose.yml`). Todas las llamadas usan rutas relativas; Next.js proxy reenvía al backend. Esto permite que la app funcione tras cualquier dominio (Cloudflare tunnel, IP de red, etc.) sin rebuild.

### 3. **JWT expiry chequeado en el cliente**
`lib/auth.ts` tiene `isTokenExpired(token)` que decodifica el payload JWT. Se chequea en (1) `lib/api/client.ts` antes de cada fetch, (2) `dashboard-guard.tsx` al montar y (3) `portal-shell.tsx` al montar. Si expiró → `clearSession()` + redirect a `/login?expired=1`. El login muestra banner amarillo "Tu sesión expiró".

### 4. **`from __future__ import annotations` en servicios con método `list`**
Varios servicios (`clients`, `devices`, `leads`, `support_tickets`) tienen `def list(self) -> list[X]:`. En Python sin `from __future__ import annotations`, el método sombrea al builtin `list` y rompe los annotations subsiguientes con `TypeError: 'function' object is not subscriptable`. **NO QUITAR** los `from __future__` de esos archivos.

### 5. **Mock data fallback en dashboard**
`dashboard-widgets.tsx` exporta constantes `MOCK_*` (top vulns, top collaborators, etc.). Los widgets las usan **solo** cuando el endpoint real está vacío o no existe (sparklines de tendencia 7 días, por ejemplo). KPIs y conteos siempre vienen de queries reales.

### 6. **Dashboard tabbed con 5 vistas + auto-refresh**
`dashboard-shell.tsx` tiene tabs: General, Seguridad, Comercial, Operaciones, Infraestructura. Cada vista consume queries reales (clients, leads, projects, summary). El toggle "Auto ON/OFF" persiste en `localStorage.ninjasec_dashboard_autorefresh` y activa `refetchInterval: 60_000` en TanStack Query.

### 7. **Modales SweetAlert2 estilo "pill"**
`lib/alerts.ts` tiene `confirmDelete` (icono rojo X), `confirmApprove` (icono verde ✓), `confirmDeleteStrict` (requiere tipear el email para confirmar — usado en delete de usuarios) y `notifyError/Success/Warning/Info`. CSS en `globals.css` clase `.swal2-confirm-pill` y `.button-pill`. Los confirmation modals deben **siempre** verse con icono grande centrado y botón cápsula.

### 8. **Backend roles guards** (`require_roles`)
- `super_admin` ve y hace todo
- `admin` ve todo de su org pero **no puede editar a super_admin ni a otros admin** (sólo a sí mismo y a roles inferiores)
- `collaborator` ve sus revisiones asignadas (`reviewer_user_id == current_user.id`) y proyectos asignados (join con `ProjectMember`); sólo puede editar su propio perfil
- `client` ve sólo su empresa, sus tickets, sus revisiones cerradas, sus docs (`visibility=CLIENT`)

### 9. **Convención de fechas / nombres**
Documentación y comentarios en **español**. Identificadores de código en **inglés**. Fechas absolutas en memoria/notas (nunca "el martes" — siempre `2026-05-21`).

---

## 🔑 Configuración (`.env`)

| Variable | Notas |
|---|---|
| `JWT_SECRET_KEY` | Definida en docker-compose.yml para dev. Cambiar en producción |
| `NEXT_PUBLIC_API_URL` | `/api/v1` — inyectada al build del frontend |
| `DATABASE_URL` | `postgresql+psycopg://postgres:123456@postgres:5432/ninjasec` |
| `CORS_ORIGINS` | Lista explícita en docker-compose.yml — incluye IPs LAN |

---

## 🗂️ Convenciones de código

### Backend
- Modelos SQLAlchemy con `Mapped[...]` (estilo 2.0)
- Schemas Pydantic v2 heredan de `ORMModel` (en `common/schemas/base.py`) que tiene `from_attributes=True`
- Endpoints siempre validan rol con `require_roles(...)` y filtran por `current_user.organization_id`
- Audit log via `AuditService(db).record(...)` después de mutaciones

### Frontend
- Toda llamada HTTP usa `request<T>` o `requestPublic<T>` de `lib/api/client.ts`
- Query keys centralizadas en `lib/query-keys.ts` (`QK.users()`, `QK.projects()`, etc.)
- Forms con `useForm` + `zodResolver` + schema en `lib/validation.ts`
- Confirmaciones con `confirmDelete()` / `confirmApprove()` — nunca `window.confirm`
- Notificaciones con `notifySuccess()` / `notifyError()` — nunca `alert()`

---

## 🌎 Tech Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PyJWT, psycopg3, openpyxl, ReportLab (PDFs)
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Framer Motion, Lucide React, TanStack Query 5, React Hook Form, Zod, SweetAlert2
- **Infra:** Docker Compose (`infra/docker-compose.yml`), PostgreSQL 16

---

## ✅ Estado actual de los módulos

Cada checklist en `DOCUMENTOS/PLATAFORMA/IMPLEMENTACION/0X-*.md` está cerrado (todos los P-XX en ✅ excepto algunos menores documentados como "mejoras futuras"). Resumen:

| # | Módulo | Última implementación destacada |
|---|---|---|
| 01 | Roles y accesos | JWT expiry frontend, cross-admin protection, confirmDeleteStrict |
| 02 | Dashboard | Tabbed con 5 vistas, auto-refresh, hallazgos clickeables |
| 03 | Clientes | city/country, badges devices+tickets, export XLSX, findings_count en reviews |
| 04 | Integraciones | Test/Collect para collaborator, banner "sin revisión >90 días" |
| 05 | Dispositivos | Portal sin IPs sensibles, sede en cards |
| 06 | Revisiones | **Export PDF individual** con resumen ejecutivo coloreado + checklist + findings |
| 07 | Tickets | Stats panel KPIs, "Desde hallazgo" en listado |
| 08 | Leads | Convertir a cliente, /contacto cableado, source en modal |
| 09 | Reportes | Card PDF revisión, `lastRun` en localStorage, filtro fecha en pipeline |
| 10 | Colaboradores | `area` + `photo_url`, certificaciones visibles |
| 11 | Servicios | `price_label`, toggles is_public/active |
| 12 | Proyectos | Vista Kanban, budget, equipo en cards, estado inline |
| 13 | Usuarios | Link "Ver auditoría" filtrado por entity_id |
| 14 | Portal Cliente | Cambio de contraseña, KPI servicios reales |

---

## 🔜 Próximos pasos pendientes — **PRIORITARIO**

### 🎯 Módulo Dispositivos — innovación / valor agregado (PEDIDO ACTIVO DEL USUARIO)

El usuario pidió **mejorar `/dashboard/devices`** (que es la parte de inventario) con:

1. **Diagrama de red automático** por empresa (seleccionar cliente → diagrama de topología)
   - Conexiones entre devices (firewall → switch → APs → endpoints)
   - Distintos aspectos: red on-prem, nube (AWS/Azure), híbrido
   - El usuario sugiere usar DrawIO (MCP disponible) o similar
   - Auto-layout según instrucciones / heurística
2. **Cumplir estándares e ISOs** — ej. ISO/IEC 27001 inventory, NIST CSF asset management
   - Más metadatos por dispositivo: clasificación de criticidad, owner, data classification, lifecycle status (in-use / spare / retired), warranty expiration, last patch date, compliance tags
   - Posibles campos nuevos en `Device`: `criticality` (low/medium/high/critical), `data_classification` (public/internal/confidential/restricted), `compliance_tags[]`, `lifecycle_state`, `warranty_expires_at`, `last_patched_at`, `responsible_user_id`, `cost_center`, `physical_location`
3. **Cada activo con más opciones** — vista detalle enriquecida (timeline, eventos de auditoría, attachments, fotos, manuales)
4. **Mejor visualmente** — quizás cards con hero image del modelo, badges de criticidad, iconos por tipo

**Estado:** Sólo planificado. NO empezar a codear sin que el usuario apruebe el plan primero.

**Recomendación de arquitectura (a discutir con usuario):**
- Backend: ampliar `Device` con columnas ISO 27001-aligned + endpoint nuevo `GET /devices/topology?client_id=N` que devuelve nodes + edges
- Tabla nueva `device_connections` (origin_device_id, target_device_id, link_type=ethernet|wifi|wan|vpn|cloud-peering, port, vlan, bandwidth)
- Frontend: integrar `@xyflow/react` (React Flow) o `mermaid` para el diagrama. DrawIO podría usarse para export/import de diagramas existentes
- Vista "Topología" como tab nuevo en la página de devices o como sección en `/dashboard/clients/[id]`

### Mejoras menores documentadas

- **02-P-05:** WebSocket real-time para alertas (vs polling 60s actual)
- **05-P-05:** Filtro UI por `site_id` en portal cliente (backend ya lo acepta)
- **06-P-05:** Botón PDF desde listado de revisiones (ya está en el detalle)
- **08-P-02:** Drag & drop real en Kanban de leads (requiere `@dnd-kit`)
- **09-P-05:** Mover `lastRun` de localStorage a server-side
- **10-P-05:** Upload de imagen real para `photo_url` (S3/MinIO/filesystem)
- **10-P-06 / 03-P-06 / 11-P-05 / 12-P-06:** Migraciones Alembic formales para columnas agregadas con `ALTER TABLE` directo (`city`, `country`, `area`, `photo_url`, `price_label`, `budget_label`, `is_public`)
- **13-P-05:** Persistir reportes pre-generados (no solo runs)

---

## 🧪 Comandos útiles

```bash
# Type-check frontend
cd frontend && npx tsc --noEmit 2>&1 | grep -v "^\.next/" | grep -v "Cannot find module '"

# Ejecutar seed manual desde container
docker cp backend/seed_demo.py ninjasec-backend:/app/seed_demo.py
docker exec ninjasec-backend bash -c "python /app/seed_demo.py"

# Ver logs en vivo
docker logs ninjasec-backend -f
docker logs ninjasec-frontend -f

# Conectar a Postgres
docker exec -it ninjasec-postgres psql -U postgres -d ninjasec

# Smoke test de todas las rutas del dashboard
for p in /dashboard /dashboard/projects /dashboard/integrations /dashboard/devices /dashboard/security-reviews /dashboard/support-tickets /dashboard/clients /dashboard/collaborators /dashboard/leads /dashboard/services /dashboard/users /dashboard/applications /dashboard/audit /dashboard/reports; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3018$p"); echo "$p -> $code"
done
```

---

## 🚨 Seguridad y conducta

- NinjaSec es una **plataforma de seguridad** — extra cuidado con endpoints de auth, sesiones, validación de roles
- **JWT tokens** deben validarse en todas las rutas protegidas (backend hace esto via `Depends(require_roles)`)
- **Nunca** loguear passwords, tokens ni datos sensibles
- **CORS** debe ser lista explícita en producción
- **Confirmaciones destructivas** siempre con `confirmDeleteStrict` (escribir email del usuario) o `confirmDelete` con texto descriptivo
- **Audit log** después de toda operación crítica vía `AuditService(db).record(...)`

---

## 📚 Documentación viva del proyecto

- `DOCUMENTOS/PLATAFORMA/*.md` — Especificación funcional original por módulo (Source of Truth de requisitos)
- `DOCUMENTOS/PLATAFORMA/IMPLEMENTACION/0X-*.md` — Checklist de implementación con estado actual + pendientes
- Cada `.md` de IMPLEMENTACION mantiene el "diario" de cambios — actualizarlo después de cada feature

---

## 🎓 Convenciones de lenguaje

- **Documentación, comentarios, mensajes de UI:** español
- **Identificadores de código (variables, funciones, archivos):** inglés
- **Commits:** breve en español ("agregar export PDF de revisión")
- **PRs:** título corto, body con summary + test plan
