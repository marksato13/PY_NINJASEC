# HANDOFF — Claude Ops (Ubuntu Desktop) ↔ Claude Dev (Windows Laptop)

> **Propósito:** este documento define el escenario, división de responsabilidades y materiales que un segundo agente Claude (corriendo en una Ubuntu Desktop) debe leer para operar el lab NinjaSec por SSH y asistir con documentación.
>
> **Autor:** Rubén Mark Salazar — Junio 2026
> **Versión:** 1.0 · Estado: FASE 2.6 (lab Suricata + DVWA) en curso

---

## 1. Reparto de roles entre los dos Claudes

Hay **dos instancias de Claude Code** trabajando en paralelo sobre el mismo proyecto. Son complementarias, no redundantes.

| Aspecto | **Claude Dev (Windows)** | **Claude Ops (Ubuntu Desktop)** ← este handoff |
|---|---|---|
| Máquina | Laptop física del usuario, Windows 11 + PowerShell | Desktop Ubuntu (probable VM admin VLAN10 o equivalente) |
| Working dir | `C:\Users\markp\Desktop\PY-MEGATRON\PY - PERSONAL\EMPRESA NINJA-SEC\PY-MK` | `~/ninjasec-ops/` (sugerido) — solo docs + scripts, **no clona el repo de la app** |
| Acceso a VMs | **Ninguno directo** — la laptop NO tiene ruta a VLAN20/30 | **Tiene SSH** a `ninjasec-web` (192.168.20.100) y `ninjasec-db` (192.168.30.100) y futuros (`ninjasec-waf`, etc.) |
| Responsabilidades | Código de la app (backend FastAPI, frontend Next.js), commits, PRs, planes de deploy, memoria persistente | Ejecutar comandos en VMs vía SSH, validar despliegues, capturar evidencia, redactar informes operativos |
| **NO debe** | Tocar configs en las VMs (no tiene cómo) | Modificar el código del repo NinjaSec (eso es del otro Claude) |

**Regla de oro:** los cambios al **código** se piden a Claude Dev; los cambios al **estado de las VMs** se piden a Claude Ops.

---

## 2. Contexto del proyecto

**NinjaSec** es una plataforma full-stack (FastAPI + Next.js 15) de monitoreo de infraestructura + ciberseguridad para PYMEs peruanas. Stack:

- **Backend:** Python 3.12 / FastAPI / SQLAlchemy 2.0 / PyJWT
- **Frontend:** Next.js 15 App Router / React 19 / Tailwind 3 / TanStack Query 5
- **DB:** PostgreSQL 16
- **Reverse proxy:** Caddy 2 (TLS interno, HTTP/2)
- **Orquestación:** Docker Compose en `infra/docker-compose.prod.yml`

Estado MVP: 14 módulos cerrados, seed masivo con data peruana (17 clientes, 73 dispositivos, 28 revisiones, 86 audit logs). El despliegue **no es público** — todo corre en una red privada (LAN ISP del usuario + VLANs internas del hipervisor).

---

## 3. Topología del lab

```
            Internet (ISP1 Claro  /  ISP2 Movistar — failover)
                                │
                       ┌────────┴────────┐
                       │  pfSense MASTER  │
                       │  (HA pendiente)  │
                       └────────┬────────┘
                                │ Trunk 802.1Q
        ┌───────────────────────┼───────────────────────┬───────────────┐
        │                       │                       │               │
   VLAN10 LAN              VLAN20 DMZ              VLAN30 DC      VLAN40 VOZIP
 192.168.1.0/24         192.168.20.0/24         192.168.30.0/24   192.168.40.0/24
        │                       │                       │
   VM admin              ninjasec-web              ninjasec-db
 (Ubuntu Desktop)        192.168.20.100            192.168.30.100
 → Claude Ops vive       Docker stack:             PostgreSQL 16
   acá probablemente      caddy + backend +         (única DB)
                          frontend + dvwa(lab)
```

**Reglas pfSense activas (resumen):**

- VLAN10 (admin) → SSH a web (22) y db (22, 5432). Resto a VLANs internas bloqueado.
- VLAN20 (web) → solo 5432 hacia db. Salida a Internet sí.
- VLAN30 (db) → ninguna VLAN. Solo salida a Internet para `apt`/NTP.
- WAN inline (Suricata IPS): drop activo.
- VLAN10 (Suricata IDS legacy): solo alerta.

Detalle completo de reglas: `CHECKLIST-FIREWALL-PRE-FASE-2.3.md`.

---

## 4. Estado actual del despliegue (snapshot 2026-06-02)

### FASES completadas

| Fase | Resultado | Commit |
|---|---|---|
| 2.0 — Snapshot inicial pfSense + checklist firewall | ✅ | `CHECKLIST-FIREWALL-PRE-FASE-2.3.md` |
| 2.2 — Preparación VM admin VLAN10 | ✅ | `CHECKLIST-OPERATIVO-PRE-FASE-2.2.md` |
| 2.3 — Provisionar `ninjasec-db` (Postgres 16 en VLAN30) | ✅ | `FASE-2.3-PROVISIONAR-NINJASEC-DB.md` |
| 2.4 — Provisionar `ninjasec-web` + stack Docker (caddy/backend/frontend) | ✅ healthy 3/3 | `FASE-2.4-PROVISIONAR-NINJASEC-WEB.md` (commit `8901003`) |

### FASE en curso: 2.6 — Lab Suricata

Objetivo: probar Suricata WAN inline (IPS — drops) y Suricata VLAN10 legacy (IDS — alertas) contra un blanco vulnerable (**DVWA** — `vulnerables/web-dvwa:latest`).

| Sub-tarea | Estado |
|---|---|
| 2.6.0 — Elegir target vulnerable (DVWA) | ✅ |
| 2.6.1 — Agregar DVWA al `docker-compose.prod.yml` en VM web | 🟡 YAML corregido, **pull falla por timeout de red en VLAN20 → Internet** |
| 2.6.2 — Caddy: no tocar (DVWA va directo en `:8080`) | ✅ |
| 2.6.3 — NAT pfSense WAN:8080 → 192.168.20.100:8080 | ⏳ |
| 2.6.4 — Suricata WAN inline + reglas ET Open + Snort GPLv2 + pass-list | ⏳ |
| 2.6.5 — Suricata VLAN10 legacy (alert-only) | ⏳ |
| 2.6.6 — Batería de ataques desde 2 orígenes (laptop WAN + VM admin VLAN10) | ⏳ |
| 2.6.7 — Captura de evidencia y tabla comparativa | ⏳ |
| 2.6.8 — Cleanup post-curso (eliminar DVWA, restaurar configs) | ⏳ |
| 2.6.9 — Snapshot vSphere `pre-fase-2.6-suricata` | ⏳ **pendiente y crítico** |
| 2.6.10 — Documentar FASE 2.6 en `.md` | ✅ (`FASE-2.6-LAB-SURICATA.md`, commits `08022fd` / `8fdc7b3`) |

### Bloqueador inmediato

```
$ docker compose -f docker-compose.prod.yml --env-file .env up -d dvwa
[+] up 6/9
 ⠙ Image vulnerables/web-dvwa:latest [⣿⣿⣿⣿⡀] 138.5MB / 175.6MB Pulling
failed to copy: read tcp 192.168.20.100:38700->3.166.160.32:443: read: connection timed out
```

Probable causa: MTU o packet loss intermitente del ISP de la VM web. Plan B propuesto: configurar mirror `mirror.gcr.io` en `/etc/docker/daemon.json` o bajar MTU temporal.

---

## 5. Acceso por SSH (Claude Ops)

Desde el Desktop Ubuntu en VLAN10:

```bash
# Usuarios sugeridos (verificar con el operador humano):
ssh m4rk@192.168.20.100      # VM web (admin sudoer)
ssh ninjadeploy@192.168.20.100  # usuario sin sudo, dueño de /opt/ninjasec/
ssh m4rk@192.168.30.100      # VM db
```

**Paths críticos en `ninjasec-web` (192.168.20.100):**

- `/opt/ninjasec/infra/docker-compose.prod.yml` ← stack productivo
- `/opt/ninjasec/infra/.env` ← secretos (NO commitear, NO leer en chat)
- `/opt/ninjasec/infra/Caddyfile`
- `/var/log/ninjasec/`

**Comandos frecuentes (en VM web):**

```bash
cd /opt/ninjasec/infra
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env ps
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env logs -f backend
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env config  # validar YAML

docker ps --filter "name=ninjasec"
```

---

## 6. Convenciones obligatorias

- **Idioma:** documentación, mensajes UI, commits → **español**. Identificadores en código → **inglés**.
- **Respuestas concisas + acción concreta**, con resumen al final.
- **Antes de acciones destructivas** (apagar VM, borrar volumen, force-push, force-pull, `rm -rf`) → pedir confirmación al operador humano.
- **NUNCA** exponer secretos en el chat: passwords, JWT keys, tokens DuckDNS, claves SSH privadas.
- **NUNCA** modificar el código del repo NinjaSec desde Claude Ops — es responsabilidad de Claude Dev. Sí podés editar configs en `/opt/ninjasec/infra/` y archivos del lab.
- **Antes de cambios riesgosos en VMs** (modificar firewall, agregar contenedores nuevos, cambiar `.env`): tomar snapshot vSphere primero.
- **DVWA** es temporal — debe quedar removido al finalizar el lab (`2.6.8 — Cleanup post-curso`).
- **Suricata pass-list** NUNCA debe incluir la subred ISP de la WAN; eso anula el IPS.

---

## 7. Secretos / credenciales comprometidos (rotar antes de exposición pública)

Mencionados en chat previo, asumir comprometidos:

- `POSTGRES_PASSWORD` (en `.env` de VM web y VM db)
- `JWT_SECRET_KEY`
- `DuckDNS token 20111976-dd50-400f-b764-cd251cf7bd07` (solo si en algún momento se reactiva DuckDNS)

Si el plan vuelve a contemplar exposición pública (FASE 2.8/2.9 self-hosted), **rotar los 3 antes**.

---

## 8. Próximas acciones (en orden)

Para Claude Ops, una vez resuelto el bloqueador del pull DVWA:

1. **Snapshot vSphere** `pre-fase-2.6-suricata` de `ninjasec-web` y backup XML de pfSense.
2. Confirmar `docker ps` muestra `ninjasec-dvwa` Up y `curl -sI http://127.0.0.1:8080/login.php` responde 200/302.
3. Setup DVWA: navegador en VLAN10 → `http://192.168.20.100:8080/setup.php` → Create Database → Login `admin/password` → DVWA Security → **Low**.
4. **NAT pfSense:** Firewall → NAT → Port Forward → WAN interface → TCP/8080 → redirect a `192.168.20.100:8080`. Crear regla WAN asociada que permita el tráfico.
5. Habilitar Suricata WAN inline (IPS) con ET Open + Snort GPLv2 community.
6. Habilitar Suricata VLAN10 legacy (alert-only).
7. Ejecutar batería de ataques (script `lab-suricata-attacks.sh` definido en `FASE-2.6-LAB-SURICATA.md`).
8. Capturar evidencia, generar tabla comparativa WAN vs VLAN10.
9. Cleanup: `docker compose down dvwa`, eliminar bloque del YAML, deshabilitar NAT 8080, rollback Suricata si corresponde.

---

## 9. Archivos a copiar al contexto de Claude Ops (Ubuntu Desktop)

Crear `~/ninjasec-ops/docs/` en el Desktop Ubuntu y dejar ahí estos `.md`. Son todo lo que necesita para operar sin tener el repo completo.

### Imprescindibles (handoff + plan vivo)

| Archivo | Por qué lo necesita |
|---|---|
| **`HANDOFF-CLAUDE-OPS-UBUNTU.md`** (este archivo) | Contexto global, división de roles, próximos pasos |
| **`FASE-2.6-LAB-SURICATA.md`** | Plan detallado del lab en curso — DVWA, NAT, Suricata, ataques, evidencia, cleanup |
| **`FASE-2.4-PROVISIONAR-NINJASEC-WEB.md`** | Cómo está armada la VM web (paths, usuarios, stack Docker, Caddy) |
| **`FASE-2.3-PROVISIONAR-NINJASEC-DB.md`** | Cómo está armada la VM db (Postgres, backups, hardening) |
| **`CHECKLIST-FIREWALL-PRE-FASE-2.3.md`** | Reglas pfSense vigentes — referencia obligatoria para no anular el ASA |

### Referenciales (consulta puntual, no leer entero)

| Archivo | Cuándo abrirlo |
|---|---|
| **`CHECKLIST-OPERATIVO-PRE-FASE-2.2.md`** | Si necesita re-provisionar la VM admin o entender supuestos iniciales |
| **`NOTAS-REVISION-PLANES-DEPLOY.md`** | Histórico de revisiones de los planes (decisiones descartadas) |
| **`PLAN-DEPLOY-FASE-2.8-2.9-SELF-HOSTED.md`** | Solo si se reactiva el plan de exposición pública con runner self-hosted |
| **`PLAN-DEPLOY.md`** (raíz del repo) | Visión macro original — ya parcialmente obsoleta (DuckDNS descartado) |
| **`CLAUDE.md`** (raíz del repo) | Solo si necesita entender el stack de la app o credenciales seed locales |

### NO copiar (irrelevantes u obsoletos para Ops)

- `README.md`, `DEPLOY.md` raíz — versiones tempranas, ya superadas por los `FASE-2.X-*.md`.
- `docs/claude-code/*` — guía interna para Claude Dev, no aplica a Ops.
- `docs/api/`, `docs/diagrams/` — del producto, no del despliegue.
- Cualquier archivo en `backend/` o `frontend/` — código de la app, fuera del scope de Ops.

### Memoria del Claude Dev (opcional, pero muy útil)

Si querés que Claude Ops también herede el contexto cross-sesión, copiá estos 3 archivos de memoria desde la laptop Windows:

```
C:\Users\markp\.claude\projects\C--Users-markp\memory\project_ninjasec.md
C:\Users\markp\.claude\projects\C--Users-markp\memory\project_ninjasec_lab_topology.md
C:\Users\markp\.claude\projects\C--Users-markp\memory\ninjasec_decisiones_tecnicas.md
```

→ pegarlos en `~/.claude/projects/<id>/memory/` del Ubuntu (o el path equivalente que use Claude Code en Linux) **renombrándolos sin cambios de contenido**. Después agregarlos al `MEMORY.md` índice de esa instancia.

---

## 10. Cómo iniciar la sesión Ops

Primer prompt sugerido para el Claude Ops una vez tenga los `.md` en `~/ninjasec-ops/docs/`:

```
Soy Claude Ops del lab NinjaSec. Mi rol está definido en
~/ninjasec-ops/docs/HANDOFF-CLAUDE-OPS-UBUNTU.md.

Por favor leé:
1. HANDOFF-CLAUDE-OPS-UBUNTU.md (rol + estado + próximos pasos)
2. FASE-2.6-LAB-SURICATA.md (tarea en curso)
3. CHECKLIST-FIREWALL-PRE-FASE-2.3.md (firewall vigente)

Después confirmá que entendiste:
- Qué fase estamos
- Cuál es el bloqueador actual
- Qué NO podés hacer (no tocar repo de la app)

Y esperá instrucciones para el siguiente paso.
```

---

**Última actualización:** 2026-06-02 · próxima revisión: al cerrar FASE 2.6.8 (cleanup).
