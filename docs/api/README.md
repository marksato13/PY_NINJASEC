# docs/api

Documentación y colecciones de la API REST de NinjaSec.

## Qué va aquí

### Colecciones de prueba
- `ninjasec.postman_collection.json` — Colección completa de Postman con todos los endpoints
- `ninjasec.postman_environment.json` — Variables de entorno (localhost, staging, producción)
- `ninjasec.bruno/` — Colección equivalente en Bruno (alternativa open-source a Postman)

### OpenAPI / Swagger exportado
- `openapi-v1.json` — Especificación OpenAPI 3.0 exportada desde FastAPI
- `openapi-v1.yaml` — Versión YAML (más legible para revisiones)

> Exportar con: `curl http://localhost:8024/openapi.json > openapi-v1.json`

### Documentación de endpoints por módulo
- `endpoints-auth.md` — Rutas de autenticación y manejo de tokens
- `endpoints-clients.md` — CRUD de clientes y contactos
- `endpoints-devices.md` — Gestión de dispositivos e inventario
- `endpoints-reports.md` — Generación y descarga de reportes PDF
- `endpoints-integrations.md` — Configuración de conexiones a pfSense/FortiGate

### Changelog de la API
- `api-changelog.md` — Registro de cambios de versión (breaking changes, nuevos endpoints, deprecados)

## Acceso a la documentación interactiva (desarrollo)
- Swagger UI: `http://localhost:8024/docs`
- ReDoc: `http://localhost:8024/redoc`
- OpenAPI JSON: `http://localhost:8024/openapi.json`

## Estructura de un endpoint documentado

```markdown
### POST /api/v1/auth/login

Autentica un usuario y retorna un JWT.

**Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| email | string | sí | Email registrado |
| password | string | sí | Contraseña |

**Respuesta exitosa (200):**
{ "access_token": "...", "token_type": "bearer" }

**Errores:**
- 401: Credenciales inválidas
- 422: Validación fallida
```

## Notas
- Actualizar `openapi-v1.json` en cada release.
- La colección de Postman debe incluir un request de login que guarde el token automáticamente en una variable de entorno.
