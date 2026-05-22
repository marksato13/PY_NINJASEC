# Cómo Cuidar el Contexto en Claude Code

## ¿Qué es el contexto?

El contexto de Claude Code contiene toda la conversación activa: cada mensaje, cada archivo que Claude lee, y cada output de comandos. Se llena rápido — una sola sesión de debugging puede consumir decenas de miles de tokens.

**Consecuencias de un contexto lleno:**
- Claude empieza a "olvidar" instrucciones anteriores
- Respuestas menos precisas o contradictorias
- Olvida decisiones tomadas juntos
- Degradación general del rendimiento

---

## Ver cuánto contexto tienes usado

Dentro de Claude Code:

```
/context
```

Muestra exactamente cuántos tokens consume cada componente. Ejemplo real:

```
System prompt:  2.6k tokens
System tools:  17.6k tokens
MCP tools:      0.9k tokens
Messages:      30.5k tokens
Free space:   114.0k (57%)
```

---

## Señales de alerta

| Señal | Acción recomendada |
|---|---|
| Status bar al 70% | Usar `/compact` |
| Status bar al 80% | Salir y reiniciar sesión |
| Claude ignora instrucciones previas | `/compact` o nueva sesión |
| Respuestas contradictorias | Nueva sesión con contexto fresco |
| Olvida el stack o arquitectura del proyecto | CLAUDE.md ya lo resuelve en la próxima sesión |

---

## Comandos clave

### `/compact` — Comprimir sin perder sesión
```
/compact
```
Resume y comprime el historial. Claude mantiene una memoria de sesión en segundo plano, así que es rápido: carga ese resumen en un contexto fresco en lugar de re-resumir desde cero. Úsalo antes del 80%.

### `/clear` — Limpiar todo
```
/clear
```
Borra toda la conversación. Ideal para cambiar de tarea completamente o cuando el contexto está muy contaminado.

### `/rewind` — Volver a un checkpoint anterior
```
/rewind
```
Cada acción de Claude crea un checkpoint automático. Puedes restaurar la conversación, el código, o ambos a cualquier punto anterior.

---

## Límites según plan

| Plan | Contexto |
|---|---|
| Free | 200k tokens |
| Pro | 200k (activar 1M con `/extra-usage`) |
| Max / Team / Enterprise | 1M tokens automático |

---

## Mejores prácticas

### 1. Una tarea = Una sesión

```
# Correcto — sesiones separadas
Sesión 1: "Crea el módulo de auth"
Sesión 2: "Crea el módulo de reportes"

# Incorrecto — todo en una sesión
"Crea auth, reportes, dashboard, y migra la BD"
```

### 2. Sé específico en los prompts

```
# Correcto
"Arregla el bug de autenticación en backend/app/modules/auth/services/auth_service.py"

# Incorrecto
"Arregla mi app"
```

### 3. Guarda decisiones en CLAUDE.md durante la sesión

Cuando establezcas nuevos patrones o decisiones arquitectónicas en medio de una sesión:

```
"Documenta este patrón en CLAUDE.md para mantener consistencia: [describe el patrón]"
```

### 4. Usa subagentes para exploración

Los subagentes investigan sin llenar tu conversación principal:

```
"Usa un subagente para investigar cómo funciona el sistema de auth de NinjaSec"
```

El subagente lee archivos y reporta de vuelta sin contaminar el contexto principal.

---

## Flujo por tipo de tarea en NinjaSec

### Crear un nuevo módulo backend

| Sesión | Objetivo | Cuándo compactar/cerrar |
|---|---|---|
| 1 | Planificación: Sequential Thinking + Context7 + revisar módulos similares | Al terminar el plan |
| 2 | Crear archivos del módulo (models, schemas, services, router) | Al pasar el 70% |
| 3 | Registrar en `api/router.py` + crear migración Alembic | Al finalizar |
| 4 | Verificar en Swagger con Playwright | Sesión corta, cerrar al terminar |

### Implementar una página frontend

| Sesión | Objetivo | Cuándo compactar/cerrar |
|---|---|---|
| 1 | Context7 → docs de Next.js 15 / React 19 / TanStack Query | Al tener el plan claro |
| 2 | Crear componentes y página | Al pasar el 70% |
| 3 | Playwright → verificar en `localhost:3018` | Sesión corta |
| 4 | GitHub → crear PR | Sesión corta |

### Debuggear un bug

| Sesión | Objetivo | Cuándo compactar/cerrar |
|---|---|---|
| 1 | Brave Search → investigar error + `postgres-ninjasec` → verificar datos | Al identificar la causa raíz |
| 2 | Aplicar el fix con archivos específicos | Al verificar que funciona |
| 3 | Playwright → confirmar fix en browser | Sesión corta, cerrar al terminar |

### Diseñar arquitectura / refactoring grande

| Sesión | Objetivo | Cuándo compactar/cerrar |
|---|---|---|
| 1 | Sequential Thinking → planificar + documentar en CLAUDE.md | Al tener el plan aprobado |
| 2-N | Implementar por fases, una por sesión | Una fase por sesión |
| Final | Testing integral + PR | Sesión separada |

---

## El truco del 80%

Cuando llegues al 80% de uso en trabajo complejo multi-archivo, sal y reinicia:

```powershell
exit
claude
```

CLAUDE.md ya está configurado para que Claude recuerde el proyecto desde cero en cada sesión nueva. No perderás el contexto del proyecto — solo el historial de conversación de esa sesión.

---

## Plantilla para iniciar una sesión nueva en NinjaSec

Copia esto al iniciar una sesión después de un `/clear` o reinicio:

```
Estoy trabajando en NinjaSec (ver CLAUDE.md).
Tarea de esta sesión: [DESCRIBE AQUÍ LA TAREA ESPECÍFICA]
Archivos relevantes: [LISTA ARCHIVOS SI LOS CONOCES]
```

Esto orienta a Claude sin tener que re-explicar todo el proyecto.
