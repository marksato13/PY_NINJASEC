# Decisiones de Arquitectura (ADRs) — NinjaSec

> Architecture Decision Records: registro de decisiones técnicas importantes,  
> el contexto en que se tomaron y sus consecuencias.

---

## ADR-001: Monolito modular → preparado para microservicios

**Fecha:** Diseño inicial v0.1  
**Estado:** Activo

### Decisión
Implementar el backend como un **monolito modular** donde cada feature vive en `modules/[nombre]/` con routers, schemas y services propios. Los módulos no se importan entre sí directamente — se comunican a través de la DB o de servicios compartidos.

### Contexto
El equipo es pequeño (MVP). Microservicios prematuros añaden overhead de infraestructura sin beneficio real en esta etapa. Pero se quiere evitar el "big ball of mud".

### Consecuencias
- ✅ Deploy simple (un contenedor Docker)
- ✅ Desarrollo rápido, sin overhead de comunicación entre servicios  
- ✅ Migración futura a microservicios posible: cada módulo ya es autocontenido
- ⚠️ Requiere disciplina para no crear dependencias cruzadas entre módulos
- ❌ Escalado horizontal limitado (todo o nada)

---

## ADR-002: JWT en localStorage vs httpOnly cookies

**Fecha:** v0.1  
**Estado:** Activo (revisión planificada para v0.4)

### Decisión
Los tokens JWT se almacenan en `localStorage` en el cliente.

### Contexto
Implementación más simple. El equipo priorizó velocidad de desarrollo en MVP. Las httpOnly cookies requieren configuración de CORS más estricta y coordinación backend/frontend.

### Consecuencias
- ✅ Implementación simple y directa
- ✅ Funciona con la arquitectura SPA actual
- ❌ **Riesgo XSS**: cualquier script inyectado puede leer el token
- ❌ No funciona con SSR en Next.js sin workarounds

### Decisión de revisión
Migrar a httpOnly cookies en v0.4 cuando se implemente SSR. Por ahora, mitigar con CSP headers estrictos.

---

## ADR-003: TanStack Query para estado de servidor

**Fecha:** v0.2  
**Estado:** Activo

### Decisión
Usar **TanStack Query v5** para todo el estado que proviene del servidor. No usar Redux, Zustand u otros stores para datos de API.

### Contexto
El estado de servidor (datos de API) tiene ciclo de vida diferente al estado UI local. TanStack Query maneja cache, invalidación, refetch y loading states de forma declarativa.

### Consecuencias
- ✅ Cache automático y invalidación por query key
- ✅ Loading/error states out of the box
- ✅ Deduplicación de requests automática
- ⚠️ Requiere disciplina con las query keys (resuelto con `QK` constants)
- ❌ Mayor curva de aprendizaje vs useEffect simple

---

## ADR-004: PostgreSQL 16 como única base de datos

**Fecha:** v0.1  
**Estado:** Activo

### Decisión
Usar únicamente PostgreSQL. No añadir Redis, Elasticsearch ni otros stores en el MVP.

### Contexto
La complejidad de múltiples stores (cache, search, queue) no se justifica en MVP con pocos clientes. PostgreSQL puede manejar los volúmenes actuales con índices adecuados.

### Consecuencias
- ✅ Un solo sistema que operar y monitorear
- ✅ Transacciones ACID para toda la lógica de negocio
- ✅ JSONB para datos semi-estructurados (config_json, skills_json)
- ❌ Sin cache de sessión distribuido (se mitiga con JWT stateless)
- ❌ Sin full-text search avanzado (suficiente con `ILIKE` para el MVP)

---

## ADR-005: FastAPI + SQLAlchemy 2.0 + Pydantic v2

**Fecha:** v0.1  
**Estado:** Activo

### Decisión
Stack backend: FastAPI (routing + validación), SQLAlchemy 2.0 (ORM), Pydantic v2 (schemas).

### Contexto
FastAPI ofrece validación automática con Pydantic, documentación OpenAPI generada y soporte async nativo. SQLAlchemy 2.0 con `mapped_column()` es más type-safe que 1.x.

### Consecuencias
- ✅ Documentación Swagger generada automáticamente en `/docs`
- ✅ Validación de request/response con tipos Python
- ✅ ORM moderno con type hints nativos
- ⚠️ Pydantic v2 tiene breaking changes vs v1 (ya migrado)
- ⚠️ Async SQLAlchemy requiere cuidado con sesiones

---

## ADR-006: Next.js 15 App Router + componentes "use client"

**Fecha:** v0.2  
**Estado:** Activo

### Decisión
Usar Next.js 15 App Router. La mayoría de páginas del dashboard son `"use client"` por depender de localStorage para auth.

### Contexto
El auth actual usa `localStorage` (ADR-002) que no está disponible en SSR. Por eso las páginas del dashboard necesitan ser client components. Las páginas públicas (marketing) usan RSC.

### Consecuencias
- ✅ Next.js App Router para routing y estructura
- ✅ RSC para páginas públicas (SEO, velocidad)
- ⚠️ Dashboard no usa SSR → primeros renders con datos vacíos
- ❌ Si se migra auth a cookies (ADR-002 revisión), estas páginas pueden ser RSC

---

## ADR-007: CSS custom con design system propio (no Tailwind puro)

**Fecha:** v0.2  
**Estado:** Activo

### Decisión
Usar un sistema de diseño basado en **CSS variables** (`--primary`, `--bg`, `--panel`, etc.) con clases utilitarias propias (`.card`, `.badge`, `.button-primary`) en lugar de Tailwind utilities directamente en JSX.

### Contexto
Las páginas del dashboard tienen un diseño cohesivo con tema oscuro/claro. Un sistema de variables CSS permite cambiar el tema globalmente sin tocar el HTML. Tailwind genera clases en el JSX que dificultan la lectura.

### Consecuencias
- ✅ Tema oscuro/claro con un solo `data-theme="light"` en el root
- ✅ JSX más limpio (clases semánticas vs `bg-blue-500 text-white rounded-lg`)
- ✅ Design system documentado en `globals.css`
- ⚠️ No se aprovecha el purge automático de Tailwind tanto como podría
- ⚠️ Nuevos devs deben aprender las clases del sistema propio

---

## ADR-008: Docker Compose para desarrollo local

**Fecha:** v0.1  
**Estado:** Activo

### Decisión
Todo el desarrollo local corre en Docker Compose: PostgreSQL, FastAPI (backend), Next.js (frontend en producción build).

### Consecuencias
- ✅ Entorno reproducible para cualquier dev
- ✅ Sin instalación de Python/Node en el host
- ❌ El frontend corre en modo producción (no hot reload)
- ❌ Cada cambio de frontend requiere rebuild del container (~2-3 min)

### Mitigación
Para desarrollo activo de frontend, considerar correr `npm run dev` fuera de Docker mientras el backend y DB siguen en Docker.

---

## Registro de decisiones pendientes

| ID | Decisión pendiente | Fecha límite |
|----|-------------------|--------------|
| ADR-009 | ¿Migrar frontend dev a modo hot reload (volume mount)? | v0.3 |
| ADR-010 | ¿Agregar Redis para cache de sessión y queues? | v0.4 |
| ADR-011 | ¿Migrar JWT a httpOnly cookies? | v0.4 |
| ADR-012 | ¿Implementar tests unitarios (Pytest + pytest-asyncio)? | v0.3 |
