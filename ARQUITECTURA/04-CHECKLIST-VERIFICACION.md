# Checklist de Verificación — NinjaSec

> Usar este checklist antes de cada PR y como auditoría periódica.  
> Estado: ✅ Cumple | ❌ No cumple | ⚠️ Parcial | 🔲 No aplica

---

## A. Bugs Críticos (Fase 0)

| ID | Verificación | Estado | Notas |
|----|-------------|--------|-------|
| F0-01 | `api.ts` línea 1 usa puerto `8024` en fallback | ✅ | Corregido May-2026 |
| F0-02 | `isPortalRole()` solo retorna `true` para `client` | ✅ | Corregido May-2026 |
| F0-03 | `audit/router.py` en raíz del módulo eliminado | ✅ | Corregido May-2026 |
| F0-04 | Todos los módulos tienen `__init__.py` en raíz | ✅ | Corregido May-2026 |
| F0-05 | `services/` existentes tienen `__init__.py` | ✅ | Corregido May-2026 |

---

## B. Cliente HTTP Frontend

| ID | Verificación | Estado | Notas |
|----|-------------|--------|-------|
| B-01 | Existe `lib/api/client.ts` con `request()` centralizado | ❌ | Pendiente Fase 1 |
| B-02 | `request()` inyecta token automáticamente | ❌ | Pendiente |
| B-03 | `api.ts` dividido en archivos por dominio | ❌ | Monolítico 1760 líneas |
| B-04 | Ninguna función de API recibe `token` como parámetro | ❌ | ~80 funciones afectadas |
| B-05 | `downloadFile()` centralizado en `client.ts` | ❌ | Pendiente |

---

## C. TanStack Query

| ID | Verificación | Estado | Notas |
|----|-------------|--------|-------|
| C-01 | Existe `lib/query-keys.ts` con constantes `QK` | ❌ | Pendiente Fase 2 |
| C-02 | Ninguna página usa string literals como query key | ❌ | Todos los archivos |
| C-03 | Ninguna página usa `useEffect` para fetching de datos | ⚠️ | Algunas páginas sí |
| C-04 | Mutations destructivas usan `useMutation` | ⚠️ | Mixto |
| C-05 | `onError` en mutations llama a `notifyError()` | ⚠️ | Inconsistente |

---

## D. Tipos TypeScript

| ID | Verificación | Estado | Notas |
|----|-------------|--------|-------|
| D-01 | Solo existe `AuthUser` (no `SessionUser` duplicado) | ✅ | Unificado May-2026 |
| D-02 | `CollaboratorProfile` alineado con lo que devuelve el backend | ✅ | Campos fantasma eliminados May-2026 |
| D-03 | Updates parciales usan `PATCH`; `PUT` solo donde backend lo requiere | ✅ | Verificado: skills/certs/docs usan PUT por diseño del backend |
| D-04 | No hay tipos `any` en páginas del dashboard | ⚠️ | Verificar |
| D-05 | Todos los tipos de respuesta API tienen interfaces definidas | ✅ | Bien tipado |

---

## E. Estructura Backend — por módulo

### Verificar cada módulo: ✅ ❌

| Módulo | `__init__.py` raíz | `routers/__init__.py` | `schemas/__init__.py` | `services/` existe | `services/__init__.py` |
|--------|:-----------------:|:--------------------:|:--------------------:|:-----------------:|:---------------------:|
| auth | ❌ | ✅ | ✅ | ✅ | ❌ |
| users | ✅ | ✅ | ✅ | ❌ | 🔲 |
| clients | ✅ | ✅ | ✅ | ✅ | ✅ |
| client_sites | ✅ | ✅ | ✅ | ❌ | 🔲 |
| client_contacts | ✅ | ✅ | ✅ | ❌ | 🔲 |
| client_services | ✅ | ✅ | ✅ | ❌ | 🔲 |
| collaborators | ❌ | ✅ | ✅ | ❌ | 🔲 |
| devices | ❌ | ✅ | ✅ | ✅ | ✅ |
| integrations | ❌ | ✅ | ✅ | ✅ | ❌ |
| security_reviews | ✅ | ✅ | ✅ | ❌ | 🔲 |
| support_tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| leads | ❌ | ✅ | ✅ | ✅ | ✅ |
| projects | ❌ | ✅ | ✅ | ❌ | 🔲 |
| services | ❌ | ✅ | ✅ | ❌ | 🔲 |
| reports | ❌ | ✅ | ✅ | ❌ | 🔲 |
| recruitment | ❌ | ✅ | ✅ | ❌ | 🔲 |
| audit | ✅ | ✅ | ✅ | ✅ | ❌ |
| collection | ❌ | ✅ | ✅ | ✅ | ❌ |
| alerts | ✅ | ✅ | ✅ | ❌ | 🔲 |
| dashboard | ✅ | ✅ | ✅ | ❌ | 🔲 |
| catalogs | ✅ | ✅ | ✅ | ❌ | 🔲 |
| skills | ✅ | ✅ | ✅ | ❌ | 🔲 |
| certifications | ✅ | ✅ | ✅ | ❌ | 🔲 |
| docs | ✅ | ✅ | ✅ | ❌ | 🔲 |
| organizations | ❌ | ✅ | ✅ | ❌ | 🔲 |

---

## F. Convenciones de Endpoints Backend

| ID | Verificación | Estado |
|----|-------------|--------|
| F-01 | Actualizaciones parciales usan `PATCH` (no `PUT`) | ⚠️ Mixto |
| F-02 | Routers usan `AppError`, no `HTTPException` directamente | ⚠️ Mixto |
| F-03 | Todos los endpoints protegidos tienen `Depends(get_current_user)` | ✅ |
| F-04 | Schemas `Read` tienen `model_config = ConfigDict(from_attributes=True)` | ⚠️ Verificar |
| F-05 | Cambios de datos registran audit log | ⚠️ Parcial |
| F-06 | No hay queries en loops (N+1) | ⚠️ No verificado |

---

## G. Páginas Frontend — por módulo

### Dashboard Admin

| Módulo | `useQuery` | `QK.*` | Sin token param | `useMutation` | `notifyError` |
|--------|:---------:|:------:|:---------------:|:-------------:|:-------------:|
| Dashboard | ✅ | ❌ | ❌ | ❌ | ✅ |
| Clientes | ⚠️ | ❌ | ❌ | ❌ | ✅ |
| Integraciones | ✅ | ❌ | ❌ | ❌ | ✅ |
| Dispositivos | ✅ | ❌ | ❌ | ⚠️ | ✅ |
| Revisiones | ⚠️ | ❌ | ❌ | ❌ | ✅ |
| Tickets | ❌ | ❌ | ❌ | ❌ | ✅ |
| Leads | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reportes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Colaboradores | ❌ | ❌ | ❌ | ❌ | ✅ |
| Servicios | ❌ | ❌ | ❌ | ❌ | ✅ |
| Usuarios | ✅ | ❌ | ❌ | ❌ | ✅ |
| Proyectos | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## H. Seguridad

| ID | Verificación | Estado | Prioridad |
|----|-------------|--------|-----------|
| H-01 | JWT_SECRET_KEY no es el default en producción | ✅ dev | Alta |
| H-02 | CORS_ORIGINS es lista explícita en producción | ✅ dev | Alta |
| H-03 | Tokens no se loguean en ningún stdout/log | ✅ | Alta |
| H-04 | No hay endpoints que devuelvan passwords | ✅ | Alta |
| H-05 | `isPortalRole()` usada correctamente para redirects | ❌ | Alta |
| H-06 | Cliente valida expiración JWT antes de llamar API | ❌ | Media |
| H-07 | `localStorage` para JWT (riesgo XSS) documentado | ❌ | Media |
| H-08 | Hash backward compat (sha256 legacy) eliminado | ❌ | Baja |

---

## Cómo usar este checklist

1. **Antes de un PR:** Revisar sección G para el módulo que cambiaste
2. **Auditoría mensual:** Revisar todo el documento y actualizar estados
3. **Al completar una fase:** Marcar los ítems correspondientes como ✅
4. **Al encontrar un bug nuevo:** Agregar fila con ❌ en la sección correspondiente

### Actualizar estados
Cambiar el estado de una fila cuando se completa:
- `❌` → `✅` cuando está completamente resuelto
- `❌` → `⚠️` cuando está parcialmente resuelto
- Agregar nota en la columna "Notas" con fecha y detalle
