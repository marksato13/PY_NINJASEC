# docs/diagrams

Diagramas de arquitectura, flujos y modelo de datos del sistema NinjaSec.

## Qué va aquí

### Arquitectura del sistema
- `arquitectura-general.drawio` — Vista general: frontend, backend, DB, integraciones externas
- `arquitectura-general.svg` — Exportado como imagen para incluir en docs
- `arquitectura-modulos.drawio` — Mapa de los 25+ módulos del monolito modular

### Modelo de datos
- `er-diagram.drawio` — Diagrama entidad-relación completo
- `er-diagram.svg` — Exportado
- `er-diagram-por-dominio.drawio` — ER separado por dominio (auth, clientes, dispositivos, etc.)

### Flujos de procesos
- `flujo-auth.drawio` — Flujo de login, JWT, refresh token
- `flujo-onboarding-cliente.drawio` — Alta de nuevo cliente hasta primer reporte
- `flujo-recoleccion-datos.drawio` — Cómo se conecta a pfSense/FortiGate y recolecta métricas
- `flujo-generacion-reporte.drawio` — Proceso de generación de PDF

### Infraestructura
- `infra-docker.drawio` — Contenedores, puertos, redes Docker
- `infra-produccion.drawio` — Arquitectura de despliegue en producción (cuando aplique)

### Secuencias / Interacciones
- `secuencia-login.md` — Diagrama de secuencia en Mermaid (render en GitHub)
- `secuencia-reporte.md` — Secuencia de generación de reporte

## Herramientas recomendadas
- **draw.io** (diagrams.net) — Para `.drawio`, gratuito y compatible con VS Code
- **Mermaid** — Para diagramas en Markdown (GitHub los renderiza directamente)
- **dbdiagram.io** — Para ER diagrams rápidos

## Convenciones
- Guardar siempre el archivo editable (`.drawio`) junto al exportado (`.svg` o `.png`).
- Actualizar el diagrama cada vez que cambie la arquitectura, no después.
- Nombrar con prefijo según tipo: `arquitectura-`, `flujo-`, `er-`, `infra-`, `secuencia-`.
