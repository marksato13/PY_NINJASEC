# .github/workflows

Pipelines de CI/CD para NinjaSec usando GitHub Actions.

## Qué va aquí

### Workflows recomendados

#### `ci.yml` — Integración continua (en cada push/PR)
Pasos:
1. Checkout del código
2. Levantar PostgreSQL de prueba
3. Instalar dependencias Python (`requirements.txt`)
4. Correr migraciones Alembic
5. Ejecutar tests del backend (`pytest`)
6. Instalar dependencias Node (`npm ci`)
7. Build del frontend (`npm run build`)
8. Lint del frontend (`npm run lint`)

#### `deploy-staging.yml` — Deploy a staging (en merge a `develop`)
Pasos:
1. Build de imágenes Docker
2. Push a registry (Docker Hub / GitHub Container Registry)
3. Deploy al servidor de staging vía SSH

#### `deploy-production.yml` — Deploy a producción (en tag `v*`)
Pasos:
1. Build y push de imágenes Docker con tag de versión
2. Deploy al servidor de producción
3. Notificación de deploy exitoso

#### `security-scan.yml` — Escaneo de seguridad (semanal)
- Bandit para vulnerabilidades en Python
- npm audit para dependencias frontend
- Trivy para vulnerabilidades en imágenes Docker

### Archivos de apoyo
- `docker-build.yml` — Workflow reutilizable para build de imágenes
- `notify-slack.yml` — Workflow reutilizable para notificaciones (cuando tengas Slack/Discord)

## Ejemplo de trigger

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

## Secrets necesarios en GitHub

| Secret | Descripción |
|--------|-------------|
| `DATABASE_URL` | URL de la DB de staging/producción |
| `JWT_SECRET_KEY` | Clave JWT para el entorno |
| `DOCKER_USERNAME` | Usuario de Docker Hub |
| `DOCKER_PASSWORD` | Token de Docker Hub |
| `SSH_PRIVATE_KEY` | Clave SSH para deploy al servidor |
| `SERVER_HOST` | IP o dominio del servidor |

## Notas
- Los workflows no deben hardcodear credenciales; usar siempre `${{ secrets.NOMBRE }}`.
- El workflow de CI debe pasar obligatoriamente antes de hacer merge a `main`.
- Documentar aquí cada cambio importante en los pipelines.
