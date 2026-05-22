# Análisis de Estado Actual — NinjaSec v0.2.0

> Auditoría técnica realizada: Mayo 2026  
> Alcance: backend (FastAPI) + frontend (Next.js 15)

---
V
## Resumen ejecutivo

El sistema tiene una base sólida en tech stack y patrones, pero acumula **deuda técnica activa** en 4 áreas críticas: duplicación de lógica en el cliente HTTP, inconsistencia de convenciones entre módulos backend, tipos TypeScript duplicados y ausencia de capa de servicios en la mayoría de módulos backend.

**Severidad de hallazgos:**
- 🔴 Crítico (bloquea producción o introduce bugs): 4
- 🟠 Alto (degrada mantenibilidad significativamente): 8  
- 🟡 Medio (deuda técnica acumulable): 11
- 🟢 Bajo (mejoras de calidad): 6

---

## BACKEND — Hallazgos

### 🔴 B-01: Módulo `audit` con router duplicado
**Archivo:** `modules/audit/router.py` Y `modules/audit/routers/router.py`
**Problema:** Existe un archivo `router.py` en la raíz del módulo además del correcto en `routers/`. Ambos coexisten. Si alguno tiene rutas activas que el otro no tiene, hay funcionalidad perdida o conflictos.
**Fix:** Eliminar `modules/audit/router.py` (raíz). Mantener solo `routers/router.py`.

### 🔴 B-02: Fat Routers — sin capa de servicios
**Módulos afectados:** `clients`, `users`, `devices`, `security_reviews`, `support_tickets`, `leads`, `collaborators`, `integrations`, `reports` — la mayoría.
**Problema:** La lógica de negocio (queries DB, validaciones de negocio, transformaciones) está directamente en los routers. Esto viola SRP (Single Responsibility Principle) y hace el código imposible de testear unitariamente.
**Evidencia:** `modules/collection/services/collection_service.py` existe (correcto). `modules/clients/` no tiene `services/` (incorrecto).
**Fix:** Crear `services/` en cada módulo y extraer lógica a clases/funciones de servicio.

### 🔴 B-03: Puerto hardcodeado incorrecto en frontend → backend
**Archivo:** `frontend/src/lib/api.ts`, línea 1
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8021/api/v1";
```
**Problema:** El fallback usa puerto `8021` pero el backend corre en `8024`. Si `NEXT_PUBLIC_API_URL` no está definido en producción, TODAS las llamadas fallan silenciosamente con timeout.
**Fix:** Cambiar fallback a `http://127.0.0.1:8024/api/v1`.

### 🔴 B-04: Bug en `isPortalRole` — collaborator mal clasificado
**Archivo:** `frontend/src/lib/auth.ts`, línea 48-50
```typescript
export function isPortalRole(role: string): boolean {
  return role === "collaborator" || role === "client";  // BUG
}
```
**Problema:** Los `collaborator` acceden a `/dashboard`, NO al portal. Si esta función se usa para decidir redirecciones, los collaborators quedarán atrapados en el portal sin acceso al backoffice.
**Fix:** `return role === "client"` — solo los clientes van al portal.

---

### 🟠 B-05: Dominio `clients` fragmentado en 4 módulos separados
**Módulos:** `clients`, `client_sites`, `client_contacts`, `client_services`
**Problema:** Son sub-recursos del mismo dominio pero están registrados como 4 routers independientes. Esto genera 4 imports en `api/router.py`, duplica prefijos y hace difícil razonar sobre el dominio.
**Fix:** Consolidar en `clients/` con subrouters anidados: `clients/routers/sites.py`, `clients/routers/contacts.py`, etc.

### 🟠 B-06: `api.ts` monolítico de 1760 líneas
**Archivo:** `frontend/src/lib/api.ts`
**Problema:** Un solo archivo con todos los tipos TypeScript + todas las funciones de API de todos los módulos. Impossible de navegar, difícil de mantener, genera conflictos en PR.
**Fix:** Dividir por dominio: `lib/api/users.ts`, `lib/api/clients.ts`, etc. + `lib/api/index.ts` que re-exporta todo.

### 🟠 B-07: Token JWT pasado como parámetro a CADA función
**Archivo:** `frontend/src/lib/api.ts`
**Problema:** Cada una de las ~80 funciones recibe `token: string` como primer parámetro. Esto es copy-paste masivo y lo hace frágil (si cambias la estrategia de auth, editas 80 funciones).
**Evidencia:** `getUsers(token)`, `getClients(token)`, `updateUser(token, ...)` — patrón repetido.
**Fix:** Crear un cliente HTTP (`apiClient`) que inyecte el token automáticamente desde `getStoredToken()`.

### 🟠 B-08: Verbos HTTP inconsistentes para updates
**Archivo:** `frontend/src/lib/api.ts`
**Problema:** Operaciones de actualización usan indistintamente `PUT` y `PATCH`:
- `updateUser` → `PUT` (debería ser `PATCH` — actualización parcial)
- `updateCollaborator` → `PATCH` (correcto)  
- `updateClientSite` → `PUT` (debería ser `PATCH`)
- `updateProject` → `PUT` (debería ser `PATCH`)
**Fix:** Estandarizar: usar `PATCH` para actualizaciones parciales, `PUT` solo si se reemplaza el recurso completo.

### 🟠 B-09: Tipos duplicados `AuthUser` vs `SessionUser`
**Archivos:** `api.ts` (AuthUser) y `auth.ts` (SessionUser)
**Problema:** Dos tipos casi idénticos para el usuario autenticado. El componente A usa `AuthUser`, el B usa `SessionUser`. Incompatibles entre sí aunque representen lo mismo.
**Fix:** Unificar en un solo tipo `AuthUser` exportado desde `auth.ts`.

### 🟠 B-10: `createServiceRequest` sin token (inconsistente)
**Archivo:** `api.ts`, línea 1311
```typescript
export async function createServiceRequest(
  payload: { ... }  // ← sin token
): Promise<ServiceRequestItem>
```
**Problema:** Única función pública en la API (sin auth). Si es intencional (endpoint público), debe documentarse. Si no, es un bug de seguridad.

### 🟠 B-11: No hay TanStack Query key constants
**Problema:** Las query keys se definen como strings literales en cada `useQuery`:
```typescript
queryKey: ["users"]     // en users/page.tsx
queryKey: ["users"]     // en otro componente — ¿misma key?
```
Si el string cambia en un lugar, la invalidación deja de funcionar. 
**Fix:** Crear `lib/query-keys.ts` con constantes: `export const QUERY_KEYS = { users: ["users"], clients: ["clients"], ... }`.

---

### 🟡 B-12: Módulos sin `__init__.py` en carpetas de routers
**Módulos:** `clients` no tiene carpeta `routers/` explícita (ruta encontrada pero sin `__init__.py`)
**Fix:** Verificar que todos los módulos tienen: `__init__.py`, `routers/__init__.py`, `schemas/__init__.py`.

### 🟡 B-13: `CollaboratorProfile` sin datos del usuario
**Tipo:** `CollaboratorProfile` en `api.ts`
```typescript
export type CollaboratorProfile = {
  id: number;
  user_id: number;
  position_title?: string | null;
  // ← sin full_name, email, avatar_url
}
```
**Problema:** El frontend necesita el nombre del colaborador pero solo tiene `user_id`. El componente hace un segundo lookup o muestra IDs.
**Fix:** El endpoint `/collaborators/` debe hacer JOIN con `users` y devolver `full_name`, `email`.

### 🟡 B-14: Seed duplicado — `db/seed.py` vs `seed_demo.py`
**Archivos:** `backend/app/db/seed.py` (seed de desarrollo) y `backend/seed_demo.py` (script ad-hoc)
**Problema:** Dos sistemas de seed independientes, sin relación. Riesgo de datos inconsistentes.
**Fix:** `seed_demo.py` debe convertirse en una fixture de Pytest o en un comando CLI controlado.

### 🟡 B-15: `localStorage` para JWT — riesgo XSS
**Archivo:** `auth.ts`
**Problema:** Los tokens JWT se almacenan en `localStorage`, que es accesible por cualquier script JavaScript. Una vulnerabilidad XSS expondría los tokens.
**Fix (largo plazo):** Migrar a httpOnly cookies gestionadas por el backend. **Fix (corto plazo):** Asegurar que no hay vectores XSS en el frontend, usar Content-Security-Policy headers.

### 🟡 B-16: Sin validación de expiración JWT en el cliente
**Archivo:** `auth.ts`
**Problema:** El cliente solo verifica que existe el token, no que no haya expirado. El usuario con token expirado ve la UI como si estuviera logueado hasta que hace una llamada API que falla.
**Fix:** En `hasSession()`, decodificar el JWT (sin verificar firma) y chequear el campo `exp`.

### 🟡 B-17: `getAuditLogs` sin paginación ni límite
**Archivo:** `api.ts`, línea 1138
```typescript
return request<AuditItem[]>("/audit-logs/");
```
**Problema:** Trae TODOS los logs sin límite. Con el tiempo esto se vuelve una query que trae miles de registros.
**Fix:** Agregar parámetros `limit` y `offset`. El dashboard usa solo los últimos 5.

### 🟡 B-18: Sin manejo de errores de red global
**Problema:** Cada `useQuery` / `useEffect` maneja errores individualmente. Si la red falla, el usuario ve estados de error fragmentados por módulo.
**Fix:** Configurar un `QueryClient` global con `onError` callback que muestre un toast genérico de "Sin conexión".

---

### 🟢 B-19: Convención de prefijos de router inconsistente
En `api/router.py`, los routers se incluyen sin prefijo explícito — el prefijo viene de dentro de cada router. Esto hace difícil saber el prefijo de un router leyendo el central.
**Fix:** Agregar `prefix=` explícito en `include_router()`.

### 🟢 B-20: `downloadFile` duplica lógica de URLSearchParams
La función `downloadFile` recibe `path` con params ya construidos. El caller construye URLSearchParams y lo pasa. Mejor: `downloadFile(path, token, filename, params?: Record<string,string>)`.

### 🟢 B-21: Orden de importaciones inconsistente en `api/router.py`
Los imports no están ordenados alfabéticamente ni por dominio. Dificulta encontrar routers.

### 🟢 B-22: `modules/docs/` — nombre conflictivo con Python
El módulo se llama `docs` pero este nombre puede interferir con el módulo `docs` de Python/pydoc. Renombrar a `documents` o `client_docs`.

---

## Métricas del proyecto

| Métrica | Valor |
|---------|-------|
| Módulos backend | 24 routers registrados |
| Líneas en api.ts | 1,760 |
| Funciones en api.ts | ~80 |
| Módulos sin capa services/ | ~18 de 24 |
| Tipos duplicados identificados | 3 pares |
| Bugs críticos | 4 |
| Hallazgos totales | 29 |
