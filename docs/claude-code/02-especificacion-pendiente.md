# Especificación de Pendientes — Iteración Consolas / Inventario / Soporte

> Generado: 2026-05-02  
> Basado en: docs 27–32  
> Estado de referencia: modelos ORM creados, módulos `client_sites`, `client_contacts`, `security_reviews`, `support_tickets` implementados.

---

## Resumen ejecutivo de gaps

| Área | Implementado | Pendiente |
|---|---|---|
| Modelos ORM | ✅ 11 tablas nuevas + extensiones | ❌ Índices DB explícitos |
| Módulo `integrations` | ✅ CRUD básico | ❌ PATCH, campos nuevos expuestos, licencia-riesgo |
| Módulo `devices` | ✅ GET básico | ❌ POST, PATCH, soft-delete, export XLSX, filtro client_id |
| Módulo `client_sites` | ✅ CRUD completo | — |
| Módulo `client_contacts` | ✅ CRUD completo | — |
| Módulo `client_services` | ✅ Modelo ORM | ❌ Endpoints HTTP |
| Módulo `security_reviews` | ✅ CRUD + findings + checklist | ❌ Export XLSX |
| Módulo `support_tickets` | ✅ CRUD + import + export + stats | ❌ Crear ticket desde hallazgo |
| Dashboard | ❌ No existe | ❌ Endpoint `/dashboard/summary` |
| Alertas internas | ❌ No existe | ❌ Job licencias/hallazgos/activos |
| Reporte consolidado | ❌ No existe | ❌ Export xlsx multi-entidad por cliente |
| Paginación | ❌ Ningún listado | ❌ Todos los listados |
| Frontend Admin | ❌ No existe | ❌ 8 páginas |
| Frontend Portal | ❌ No existe | ❌ 3 páginas |

---

## BLOQUE 1 — Backend: Módulo `integrations` (actualizar)

### 1.1 Actualizar schema `IntegrationRead`

**Archivo:** `backend/app/modules/integrations/schemas/integration.py`

```python
class IntegrationRead(ORMModel):
    id: int
    name: str
    connector_type: str
    base_url: str
    status: str
    config_json: str | None = None
    client_id: int | None = None
    # Campos nuevos de consola
    environment: str | None = None          # prod / dev / lab
    license_type: str | None = None
    license_expires_at: date | None = None
    responsible_user_id: int | None = None
    # Campo calculado (no en BD, se computa al leer)
    is_license_expired: bool = False        # True si license_expires_at < hoy
    effective_status: str = ""              # "risk" si licencia vencida, si no status normal

class IntegrationCreate(ORMModel):
    organization_id: int
    client_id: int                          # Obligatorio (Regla 2)
    connector_type: str
    name: str
    base_url: str
    auth_type: str = "token"
    config_json: str | None = None
    environment: str | None = None
    license_type: str | None = None
    license_expires_at: date | None = None
    responsible_user_id: int | None = None

class IntegrationUpdate(ORMModel):
    name: str | None = None
    base_url: str | None = None
    status: str | None = None
    environment: str | None = None
    license_type: str | None = None
    license_expires_at: date | None = None
    responsible_user_id: int | None = None
    config_json: str | None = None
```

> **Regla 18 (doc 30):** Al serializar `IntegrationRead`, si `license_expires_at < date.today()` entonces `is_license_expired = True` y `effective_status = "risk"`. Implementar como validador Pydantic `@model_validator(mode="after")` o en el endpoint al construir la respuesta.

### 1.2 Nuevo endpoint `PATCH /integrations/{id}`

```
PATCH /integrations/{integration_id}
Auth: admin / super_admin
Body: IntegrationUpdate
Response: IntegrationRead
```

- Actualiza campos de licencia, entorno, responsable.
- Registra en `audit_logs`: `"integration.updated"`.
- Si cambia `license_expires_at`, recalcular `effective_status`.

### 1.3 Reforzar `POST /integrations` — `client_id` obligatorio

- Actualmente `client_id` es nullable. Validar que no sea null al crear (Regla 2).
- Si `client_id` no pertenece a `organization_id` del usuario → HTTP 403.

---

## BLOQUE 2 — Backend: Módulo `devices` (ampliar)

### 2.1 Actualizar schema `DeviceRead`

**Archivo:** `backend/app/modules/devices/schemas/device.py`

```python
class DeviceRead(ORMModel):
    id: int
    integration_id: int
    hostname: str
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    device_type: str | None = None
    status: str
    # Campos nuevos de inventario
    site_id: int | None = None
    asset_tag: str | None = None
    serial_number: str | None = None
    device_owner: str | None = None

class DeviceCreate(ORMModel):
    integration_id: int
    hostname: str
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    device_type: str | None = None
    status: str = "unknown"
    site_id: int | None = None
    asset_tag: str | None = None
    serial_number: str | None = None
    device_owner: str | None = None

class DeviceUpdate(ORMModel):
    hostname: str | None = None
    vendor: str | None = None
    model: str | None = None
    ip_address: str | None = None
    device_type: str | None = None
    status: str | None = None
    site_id: int | None = None
    asset_tag: str | None = None
    serial_number: str | None = None
    device_owner: str | None = None
```

### 2.2 Nuevos endpoints en `/devices`

```
POST   /devices                    Crear activo (admin / collaborator)
PATCH  /devices/{id}               Actualizar activo incluyendo campos nuevos
DELETE /devices/{id}               Soft-delete: status = "retired" (Regla 10)
GET    /devices?client_id=&site_id=&status=&integration_id=   Filtros ampliados
GET    /devices/export-xlsx        Export inventario (RF-16)
```

**Regla 10 (doc 30):** `DELETE /devices/{id}` NO elimina físicamente — hace `device.status = "retired"` y guarda `audit_log`.

**Export inventario** — columnas Excel:

| ID | Hostname | Tipo | Vendor | Modelo | IP | S/N | Asset Tag | Propietario | Sede | Consola | Estado | Última vista |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

### 2.3 Filtro `client_id` en listado

```python
# En list_devices, cuando no es CLIENT:
if client_id:
    stmt = stmt.where(Integration.client_id == client_id)
```

---

## BLOQUE 3 — Backend: Módulo `client_services` (crear)

**Modelo ORM:** ya existe (`client_service.py`)  
**Falta:** módulo completo con endpoints HTTP.

**Directorio a crear:** `backend/app/modules/client_services/`

### Endpoints

```
GET    /client-services?client_id=   Lista servicios contratados por cliente
POST   /client-services              Vincular servicio a cliente
PATCH  /client-services/{id}         Actualizar fechas
DELETE /client-services/{id}         Desvincular
```

### Schema

```python
class ClientServiceRead(ORMModel):
    id: int
    client_id: int
    service_id: int
    starts_at: date | None = None
    ends_at: date | None = None

class ClientServiceCreate(ORMModel):
    client_id: int
    service_id: int
    starts_at: date | None = None
    ends_at: date | None = None
```

---

## BLOQUE 4 — Backend: Módulo `security_reviews` — Export XLSX (RF-17)

### Nuevo endpoint

```
GET /security-reviews/export-xlsx?client_id=&status=&date_from=&date_to=
Auth: admin / super_admin / collaborator
Response: StreamingResponse (.xlsx)
```

**Hoja 1 — Revisiones:**

| ID | Cliente | Consola | Estado | Revisor | Fecha programada | Fecha ejecución | Notas |
|---|---|---|---|---|---|---|---|

**Hoja 2 — Hallazgos:**

| ID | Revisión | Severidad | Título | Estado | Descripción | Evidencia URL |
|---|---|---|---|---|---|---|

**Hoja 3 — Recomendaciones:**

| ID | Revisión | Hallazgo | Recomendación | Responsable | Fecha límite | Estado |
|---|---|---|---|---|---|---|

> Mismo patrón `_build_workbook` que tickets: colores slate, freeze_panes, autofilter.  
> Orden de rutas: `/export-xlsx` ANTES de `/{review_id}`.

---

## BLOQUE 5 — Backend: Ticket desde hallazgo (RF-11)

### Nuevo endpoint

```
POST /support-tickets/from-finding/{finding_id}
Auth: admin / super_admin / collaborator
Body: { priority, assigned_to?, category?, description_override? }
Response: SupportTicketRead
```

**Lógica:**
1. Cargar `ReviewFinding` por `finding_id`.
2. Cargar `SecurityReview` padre → obtener `client_id`, `integration_id`.
3. Crear `SupportTicket` pre-poblado:
   - `title` = `"[{severity.upper()}] {finding.title}"`
   - `description` = `finding.description`
   - `finding_id`, `review_id`, `client_id`, `integration_id` del hallazgo
4. Audit log: `"support_ticket.created_from_finding"`.

---

## BLOQUE 6 — Backend: Dashboard (RF-18, Regla 20)

### Nuevo módulo `dashboard`

**Directorio:** `backend/app/modules/dashboard/`

### Endpoint

```
GET /dashboard/summary?client_id=&date_from=&date_to=
Auth: admin / super_admin / collaborator
Response: DashboardSummary
```

### Schema respuesta

```python
class ReviewSummary(BaseModel):
    total_scheduled: int
    total_executed: int
    execution_rate_pct: float           # ejecutadas / programadas * 100
    open_count: int
    closed_count: int

class FindingSummary(BaseModel):
    total: int
    by_severity: dict[str, int]         # {critical: 3, high: 5, ...}
    by_status: dict[str, int]           # {open: 4, resolved: 2, ...}
    critical_open: int                  # hallazgos críticos sin cerrar

class TicketSummaryDash(BaseModel):
    total: int
    open_count: int
    closed_count: int
    avg_resolution_hours: float | None
    overdue_count: int                  # tickets abiertos con opened_at > X días

class InventorySummary(BaseModel):
    total_devices: int
    by_status: dict[str, int]
    active_consoles: int
    expired_licenses: int               # integraciones con license_expires_at < hoy

class DashboardSummary(BaseModel):
    reviews: ReviewSummary
    findings: FindingSummary
    tickets: TicketSummaryDash
    inventory: InventorySummary
    generated_at: datetime
```

> **Regla 20 (doc 30):** `reviews` solo cuenta revisiones en estado `closed`. `tickets` solo cuenta tickets en estado final (`resolved`, `closed`) para SLA.

---

## BLOQUE 7 — Backend: Reporte consolidado por cliente (Flujo 6, doc 28)

### Nuevo endpoint en módulo `reports`

```
GET /reports/consolidated-xlsx?client_id=&date_from=&date_to=
Auth: admin / super_admin
Response: StreamingResponse (.xlsx)
```

**Contenido del workbook (4 hojas):**

| Hoja | Contenido |
|---|---|
| `Resumen` | Datos del cliente, período, indicadores clave (% revisiones, hallazgos críticos, tickets abiertos) |
| `Revisiones` | Todas las revisiones del cliente en el período |
| `Hallazgos` | Todos los hallazgos con severidad y estado |
| `Tickets` | Todos los tickets con SLA (días abierto) |
| `Inventario` | Todos los activos del cliente |

**Audit:** `"report.consolidated_export"`.

---

## BLOQUE 8 — Backend: Alertas internas (RF-19)

### 8.1 Endpoint de alertas activas

```
GET /alerts/active?client_id=
Auth: admin / super_admin / collaborator
Response: list[AlertItem]
```

```python
class AlertItem(BaseModel):
    type: str           # "license_expired" | "critical_finding_open" | "ticket_overdue"
    severity: str       # "critical" | "warning" | "info"
    entity_type: str    # "integration" | "review_finding" | "support_ticket"
    entity_id: int
    message: str
    created_at: datetime
```

**Lógica de alertas:**
- `license_expired`: `Integration.license_expires_at < date.today()`
- `critical_finding_open`: `ReviewFinding.severity in (critical, high) AND status = open` AND sin ticket ni recomendación asociada
- `ticket_overdue`: `SupportTicket.status in (open, in_progress) AND opened_at < (today - 7 días)`

### 8.2 Job de alertas (opcional fase posterior)

Endpoint manual que actualiza estados en batch:

```
POST /alerts/refresh
Auth: super_admin
```

- Marca integraciones con licencia vencida: `status = "risk"`
- (Regla 19) Marca dispositivos sin revisión en >30 días: `Device.status = "pending_review"`

---

## BLOQUE 9 — Backend: Paginación (RNF-06)

Todos los listados deben aceptar:

```
?page=1&page_size=50
```

Respuesta paginada usando schema común:

```python
class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int
```

**Endpoints a paginar (por prioridad):**
1. `GET /support-tickets/`
2. `GET /security-reviews/`
3. `GET /devices/`
4. `GET /audit/`

---

## BLOQUE 10 — Backend: Índices de base de datos (RNF-05)

Añadir en la migración Alembic o en los modelos ORM con `Index`:

```python
# En support_ticket.py
from sqlalchemy import Index
Index("ix_support_tickets_client_status", "client_id", "status")
Index("ix_support_tickets_org_opened", "organization_id", "opened_at")

# En security_review.py
Index("ix_security_reviews_client_status", "client_id", "status")
Index("ix_review_findings_review_severity", "review_id", "severity")

# En client_site.py
Index("ix_client_sites_client_id", "client_id")

# En client_contact.py
Index("ix_client_contacts_client_id", "client_id")
```

---

## BLOQUE 11 — Reglas de negocio pendientes

| Regla (doc 30) | Estado | Implementación |
|---|---|---|
| R2: `client_id` obligatorio en consola | ❌ | Validar en `POST /integrations` |
| R6: Hallazgo crítico/alto → ticket o rec. obligatorio | ❌ | En `POST /review-findings`: si severity=critical/high, verificar que existe ticket o rec., si no advertir con 422 + `action_required: true` |
| R10: Soft delete en Device | ❌ | `DELETE /devices/{id}` → `status = "retired"` |
| R18: Licencia vencida → status risk | ❌ | Campo calculado en `IntegrationRead` + job `/alerts/refresh` |
| R19: Activo sin revisión → pending_review | ❌ | Job `/alerts/refresh` |

---

## BLOQUE 12 — Frontend Admin (Fase 5)

### Estructura de rutas

```
frontend/src/app/(admin)/
├── dashboard/          → indicadores (DashboardSummary)
├── clients/
│   └── [id]/           → detalle con tabs
├── integrations/
│   ├── page.tsx         → listado de consolas
│   └── [id]/           → detalle consola
├── devices/            → inventario con filtros
├── security-reviews/
│   ├── page.tsx         → agenda
│   └── [id]/           → detalle con tabs
├── support-tickets/    → bandeja de tickets
└── reports/            → generación y export
```

### Página: `/admin/clients/[id]`

**Tabs:**
- `Info` — datos de empresa, estado comercial, sector
- `Sedes` — tabla de `client_sites` con CRUD inline
- `Contactos` — tabla de `client_contacts` con CRUD inline
- `Servicios` — tabla de `client_services` con fechas contratadas
- `Acceso` — usuarios portal vinculados (`ClientProfile`)
- `Consolas` — listado de `Integration` del cliente
- `Inventario` — resumen de dispositivos
- `Tickets` — tickets abiertos del cliente

**Datos:**
```
GET /clients/{id}
GET /client-sites?client_id={id}
GET /client-contacts?client_id={id}
GET /client-services?client_id={id}
GET /integrations?client_id={id}
GET /support-tickets?client_id={id}&ticket_status=open
```

---

### Página: `/admin/integrations/[id]` — Detalle consola

**Componentes:**
- Badge `LICENCIA VENCIDA` si `is_license_expired = true` (color rojo)
- Badge `RIESGO` si `effective_status = "risk"`
- Campo `license_expires_at` con picker de fecha
- Campo `environment` con select (prod/dev/lab)
- Sección "Activos asociados" → `GET /devices?integration_id={id}`
- Sección "Revisiones" → `GET /security-reviews?integration_id={id}`

---

### Página: `/admin/devices` — Inventario

**Filtros:** `client_id`, `integration_id`, `site_id`, `device_type`, `status`

**Columnas tabla:**
- Hostname, Tipo, Vendor, IP, Asset Tag, Sede, Consola, Estado, Última vista

**Acciones:**
- Crear activo (modal)
- Editar inline o modal
- Soft-delete (marcar como retired)
- Botón `Exportar XLSX`

---

### Página: `/admin/security-reviews/[id]` — Detalle revisión

**Tabs:**
- `Info` — datos generales, estado, revisor
- `Checklist` — items con resultado ok/fail/na
- `Hallazgos` — tabla con severidad (badge coloreado), estado, descripción, evidencia
  - Botón "Crear ticket desde hallazgo" por cada hallazgo crítico/alto
- `Recomendaciones` — tabla con responsable y fecha límite
- `Evidencias` — lista de attachments con URLs
- `Tickets derivados` — tickets vinculados a esta revisión

**Flujo de cierre:**
- Botón "Cerrar revisión" → requiere `reviewer_user_id` asignado → `PATCH /security-reviews/{id}` con `status = "closed"`

---

### Página: `/admin/support-tickets` — Bandeja de tickets

**Filtros:** `client_id`, `ticket_status`, `priority`, `date_from`, `date_to`

**Vista por tabs de estado:** Abiertos | En progreso | Pendientes | Resueltos | Cerrados

**Columnas:** ID, Cliente, Título, Prioridad (badge), Estado (badge), Asignado, Fecha apertura, SLA (días transcurridos)

**Acciones:**
- Crear ticket (modal)
- Clic → drawer lateral con detalle + historial de eventos
- Botón `Importar XLSX` (upload modal)
- Botón `Exportar XLSX`

**Drawer de detalle:**
- Datos del ticket
- Timeline de eventos (`GET /support-tickets/{id}`)
- Formulario para añadir evento manual
- Acción: cambiar estado / asignar / resolver / cerrar

---

### Página: `/admin/reports` — Reportes

**Sección 1: Reporte consolidado por cliente**
- Seleccionar cliente + rango de fechas
- Botón `Generar y descargar Excel` → `GET /reports/consolidated-xlsx?...`

**Sección 2: Exportaciones individuales**
- Tickets XLSX → `GET /support-tickets/export-xlsx?...`
- Inventario XLSX → `GET /devices/export-xlsx?...`
- Revisiones XLSX → `GET /security-reviews/export-xlsx?...`

---

### Página: `/admin/dashboard`

**Widgets:**
- Tarjeta: % revisiones ejecutadas vs programadas (barra de progreso)
- Tarjeta: Hallazgos críticos abiertos (número grande en rojo si > 0)
- Tarjeta: Tickets abiertos / SLA promedio
- Tarjeta: Activos totales / licencias vencidas
- Lista: Alertas activas (`GET /alerts/active`)
- Selector de cliente para filtrar todo

---

## BLOQUE 13 — Frontend Portal (Fase 6)

```
frontend/src/app/(portal)/
├── inventory/     → solo activos del propio cliente
├── tickets/       → tickets abiertos/cerrados del cliente
└── reviews/       → revisiones e informes autorizados (solo lectura)
```

**Regla 12 (doc 30):** Todos los endpoints del portal deben filtrar automáticamente por `client_id` del `ClientProfile` del usuario autenticado. El backend ya hace este filtro para `RoleCode.CLIENT`, solo hay que asegurarse en cada nuevo endpoint.

### `/portal/inventory`

- `GET /devices` (rol CLIENT → filtra por client_id automáticamente)
- Filtros: tipo, estado
- No hay CRUD, solo lectura

### `/portal/tickets`

- `GET /support-tickets` (rol CLIENT → filtra por client_id)
- Tabs: Abiertos | Cerrados
- Detalle en drawer: descripción, eventos, resolución

### `/portal/reviews`

- `GET /security-reviews` (rol CLIENT → filtra por client_id)
- Solo revisiones en estado `closed`
- Detalle: hallazgos + recomendaciones (sin checklist interno)
- Botón descargar informe si hay attachment vinculado

---

## Orden de implementación recomendado

### Sesión A — Backend core updates (2-3h)
1. `integrations`: update schemas + `PATCH` endpoint + `client_id` obligatorio + `effective_status`
2. `devices`: update schemas + `POST` / `PATCH` / soft-delete + filtro `client_id`
3. `client_services`: módulo completo (pequeño)

### Sesión B — Backend exports y flujos (2h)
4. `devices/export-xlsx`
5. `security-reviews/export-xlsx`
6. `support-tickets/from-finding/{finding_id}`

### Sesión C — Backend dashboard y alertas (2h)
7. Módulo `dashboard`: endpoint `/dashboard/summary`
8. `/reports/consolidated-xlsx`
9. Endpoint `/alerts/active`
10. Job `/alerts/refresh`

### Sesión D — Backend infraestructura (1h)
11. Índices Alembic
12. Paginación en listados principales
13. Reglas de negocio pendientes (R2, R6, R10, R18)

### Sesión E — Frontend Admin (3-4h)
14. Dashboard
15. Clients/[id] con tabs
16. Integrations lista + detalle
17. Devices con inventario

### Sesión F — Frontend Admin II (3-4h)
18. Security Reviews agenda + detalle
19. Support Tickets bandeja + drawer
20. Reports + exports

### Sesión G — Frontend Portal (2h)
21. Portal: Inventory
22. Portal: Tickets
23. Portal: Reviews

---

## Checklist de validación final (criterios de salida, doc 27)

- [ ] Cliente puede ver su inventario, tickets y revisiones autorizadas (portal)
- [ ] Analista puede registrar revisión y hallazgos con severidad
- [ ] Hallazgo crítico/alto genera advertencia si no hay ticket o recomendación
- [ ] Analista de soporte puede registrar, actualizar y cerrar tickets (con resolución)
- [ ] Ticket sin resolución → HTTP 422 al intentar cerrar
- [ ] Revisión sin reviewer → HTTP 422 al intentar cerrar
- [ ] Consola con licencia vencida muestra `effective_status = "risk"`
- [ ] Supervisor puede generar reporte consolidado Excel por cliente y período
- [ ] Export Excel tiene plantilla corporativa (colores slate, headers bold, freeze)
- [ ] Import Excel valida filas y devuelve errores por fila
- [ ] Dashboard muestra indicadores con datos validados (solo revisiones cerradas)
- [ ] Audit log registrado en todas las acciones críticas
- [ ] Filtros por fecha aceptan `date_from >= 2026-01-01`
