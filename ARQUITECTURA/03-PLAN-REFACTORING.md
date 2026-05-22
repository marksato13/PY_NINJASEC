# Plan de Refactoring — NinjaSec

> Roadmap priorizado de mejoras arquitectónicas.  
> Cada fase es independiente y entregable. Completar en orden.

---

## Fase 0 — Bugs críticos (1-2 horas) 🔴

Estos bugs afectan funcionalidad actual. Hacerlos ANTES de cualquier otra cosa.

### F0-01: Fix puerto hardcodeado en api.ts
**Archivo:** `frontend/src/lib/api.ts`, línea 1  
**Cambio:**
```typescript
// ANTES
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8021/api/v1";
// DESPUÉS  
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8024/api/v1";
```
**Tiempo:** 5 min | **Riesgo:** Ninguno

### F0-02: Fix isPortalRole — collaborator mal clasificado
**Archivo:** `frontend/src/lib/auth.ts`, línea 48  
**Cambio:**
```typescript
// ANTES
export function isPortalRole(role: string): boolean {
  return role === "collaborator" || role === "client";
}
// DESPUÉS
export function isPortalRole(role: string): boolean {
  return role === "client";
}
```
**Tiempo:** 5 min | **Riesgo:** Ninguno (verificar que ningún guard usa esta función para collaborators)

### F0-03: Eliminar router duplicado en módulo audit
**Archivo a eliminar:** `backend/app/modules/audit/router.py` (el de la raíz)  
**Mantener:** `backend/app/modules/audit/routers/router.py`  
**Tiempo:** 10 min | **Riesgo:** Bajo (verificar que `api/router.py` importa del correcto)

### F0-04: Agregar `__init__.py` faltantes en módulos backend
**Módulos sin `__init__.py`:** auth, leads, organizations, integrations, recruitment, collection, collaborators, devices, reports, security_reviews, support_tickets, client_contacts, client_services, client_sites, projects, services  
**Acción:** Crear archivo vacío en cada módulo raíz y en sus subcarpetas `services/`  
**Tiempo:** 30 min | **Riesgo:** Bajo

---

## Fase 1 — Estabilización del cliente HTTP (4-6 horas) 🟠

Elimina el patrón de pasar token a cada función y centraliza el cliente HTTP.

### F1-01: Crear `lib/api/client.ts` con request() centralizado
El nuevo `request()` inyecta el token automáticamente desde `getStoredToken()`.

### F1-02: Dividir `api.ts` en módulos por dominio
```
lib/api/
├── client.ts        ← request() + downloadFile()
├── auth.ts          ← login, getMe
├── users.ts         ← getUsers, createUser, updateUser, deleteUser
├── clients.ts       ← getClients, getClient, client-sites, client-contacts, client-services
├── collaborators.ts ← getCollaborators, updateCollaborator, createCollaborator
├── devices.ts       ← getDevices, createDevice, updateDevice, retireDevice, export
├── integrations.ts  ← getIntegrations, getIntegration, updateIntegration, collect
├── tickets.ts       ← getSupportTickets, createSupportTicket, updateSupportTicket, events, import/export
├── reviews.ts       ← getSecurityReviews, createSecurityReview, findings, checklist
├── leads.ts         ← getLeads, createLead, updateLeadStatus
├── projects.ts      ← getProjects, createProject, updateProject, members, requirements
├── services.ts      ← getServices, getServiceRequests, createServiceRequest, updateServiceRequest
├── reports.ts       ← getReports, exportConsolidatedPdf, exportConsolidatedXlsx
├── alerts.ts        ← getAlerts, refreshAlerts
├── audit.ts         ← getAuditLogs
├── skills.ts        ← getSkills, getUserSkills, userCertifications
├── recruitment.ts   ← getJobApplications, createReview, assign, etc.
├── dashboard.ts     ← getDashboardSummary
└── index.ts         ← re-exporta todo (backward compat)
```

### F1-03: Eliminar parámetro `token` de todas las funciones
Migración mecánica: quitar `token: string` y el header manual de Authorization de cada función.

**Impacto en páginas:** Cada `getUsers(token)` → `getUsers()` | `getClients(token)` → `getClients()`

---

## Fase 2 — TanStack Query estándar (3-4 horas) 🟠

### F2-01: Crear `lib/query-keys.ts`
```typescript
export const QK = {
  users:         () => ["users"]              as const,
  user:          (id: number) => ["users", id] as const,
  clients:       () => ["clients"]            as const,
  tickets:       (f?: object) => ["tickets", f] as const,
  reviews:       (f?: object) => ["reviews", f] as const,
  devices:       (f?: object) => ["devices", f] as const,
  integrations:  (f?: object) => ["integrations", f] as const,
  leads:         () => ["leads"]              as const,
  collaborators: () => ["collaborators"]      as const,
  projects:      () => ["projects"]           as const,
  alerts:        (c?: number) => ["alerts", c] as const,
} as const;
```

### F2-02: Migrar páginas de `useEffect+useState` → `useQuery`
Páginas a migrar (priorizadas por uso):
1. `dashboard/clients/page.tsx`
2. `dashboard/integrations/page.tsx`
3. `dashboard/security-reviews/page.tsx`
4. `dashboard/support-tickets/page.tsx`
5. `dashboard/collaborators/page.tsx`

### F2-03: Migrar mutations a `useMutation`
Reemplazar `async onClick` handlers con `useMutation` para tener loading states y error handling centralizados.

---

## Fase 3 — Unificación de tipos (2-3 horas) 🟡

### F3-01: Unificar `AuthUser` / `SessionUser`
- Definir `AuthUser` en `lib/auth.ts` como tipo canónico
- Eliminar `AuthUser` de `api.ts`
- Actualizar todos los usos

### F3-02: Enriquecer `CollaboratorProfile` con datos de usuario
- Backend: el endpoint `/collaborators/` hace JOIN con `users`
- Devuelve: `full_name`, `email`, `avatar_url`
- Frontend: actualizar tipo `CollaboratorProfile`

### F3-03: Estandarizar verbos HTTP
- `updateUser` → cambiar de `PUT` a `PATCH`
- `updateClientSite` → cambiar de `PUT` a `PATCH`  
- `updateProject` → cambiar de `PUT` a `PATCH`
- (Verificar que el backend también acepta `PATCH` en esos endpoints)

---

## Fase 4 — Capa de servicios backend (por módulo, 2h c/u) 🟡

Para cada módulo sin services/:

**Template de servicio:**
```python
# modules/clients/services/client_service.py
from sqlalchemy.orm import Session
from app.db.models.clients import Client
from app.modules.clients.schemas import ClientCreate, ClientUpdate
from app.core.exceptions import AppError

class ClientService:
    @staticmethod
    def list(db: Session, organization_id: int) -> list[Client]:
        return db.query(Client).filter(
            Client.organization_id == organization_id
        ).all()

    @staticmethod
    def get_or_404(db: Session, client_id: int) -> Client:
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise AppError("Cliente no encontrado", 404)
        return client

    @staticmethod
    def create(db: Session, payload: ClientCreate) -> Client:
        client = Client(**payload.model_dump())
        db.add(client)
        db.commit()
        db.refresh(client)
        return client

    @staticmethod
    def update(db: Session, client_id: int, payload: ClientUpdate) -> Client:
        client = ClientService.get_or_404(db, client_id)
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(client, field, value)
        db.commit()
        db.refresh(client)
        return client
```

**Orden de prioridad de módulos:**
1. `clients` (más complejo, más usado)
2. `support_tickets` 
3. `security_reviews`
4. `devices`
5. `users`
6. `leads`
7. `integrations`
8. `collaborators`
9. `projects`
10. `reports`

---

## Fase 5 — Consolidación del dominio clients (4-6 horas) 🟢

Unificar `client_sites`, `client_contacts`, `client_services` dentro de `clients/`:

```
modules/clients/
├── routers/
│   ├── router.py         ← CRUD principal de clientes
│   ├── sites.py          ← /clients/{id}/sites
│   ├── contacts.py       ← /clients/{id}/contacts
│   └── services.py       ← /clients/{id}/services
└── services/
    ├── client_service.py
    ├── site_service.py
    └── contact_service.py
```

---

## Métricas de éxito

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| Líneas en api.ts | 1,760 | 0 (dividido) |
| Funciones con `token` como param | ~80 | 0 |
| Módulos con services/ | 6/24 | 24/24 |
| Módulos con __init__.py | 8/24 | 24/24 |
| Bugs críticos abiertos | 4 | 0 |
| String literals como query keys | ~15 páginas | 0 |
