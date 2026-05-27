# 📝 Notas de revisión — Planes de deploy FASE 2.3 / 2.4

> Trazabilidad de las correcciones aplicadas a los borradores originales de
> [FASE 2.3](./FASE-2.3-PROVISIONAR-NINJASEC-DB.md) y [FASE 2.4](./FASE-2.4-PROVISIONAR-NINJASEC-WEB.md).
> Sirve para entender **qué se cambió** respecto al texto que se escribió primero, **por qué**, y qué patrones replicar en futuros planes (FASE 2.5+).
>
> **Fecha de revisión:** 2026-05-27

---

## 🎯 Motivación general

El borrador inicial de los planes traía dos problemas transversales que aparecían en ambas fases:

1. **Incoherencia de direccionamiento** con las reglas pfSense recién aplicadas.
   Las VMs aparecían en subredes distintas (`172.16.30.5`, `192.168.10.4`) que no coincidían con los aliases y reglas (`192.168.30.100`, `192.168.20.100`). Si se ejecutaba así, el tráfico se bloqueaba sin que el operador supiera por qué.

2. **Política de seguridad incompleta**: faltaba SSH hardening, manejo seguro de secretos y validaciones pre-ejecución que detectaran problemas antes de que se vuelvan invisibles.

A esto se sumaron ajustes técnicos puntuales propios de cada fase.

---

## 🔧 Correcciones a FASE 2.3 — `ninjasec-db`

| # | Cambio                                                                 | Por qué                                                                                  |
| - | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1 | DB pasa de `172.16.30.5` → `192.168.30.100`                            | Alinear con reglas pfSense (`ALLOW_DMZ_WEB_TO_DB_5432`, `ALLOW_ADMIN_TO_DB_SSH/5432`)    |
| 2 | Web pasa de `192.168.10.4` → `192.168.20.100`                          | Idem                                                                                     |
| 3 | UFW: agregada regla `5432` desde Admin `192.168.1.0/24`                | Coherencia con `ALLOW_ADMIN_TO_DB_5432` de pfSense (sin esto, pgAdmin del admin falla)   |
| 4 | `pg_hba.conf`: agregada línea para `192.168.1.0/24`                    | Sin esto, Postgres rechaza la conexión aunque firewall la deje pasar                     |
| 5 | `listen_addresses` mantiene `localhost, 192.168.30.100`                | Para backups locales y `psql` desde la propia VM                                         |
| 6 | Password ya **no** se imprime; va a `/root/.ninjasec-db-pass` con `chmod 600` | No filtrar en scrollback / history del SSH                                        |
| 7 | Nuevo paso 2.3.1b: **SSH hardening** (password-auth off, root login off) | Cerrar superficie antes de meter la DB en operación                                    |
| 8 | Test 2.3.5 con 3 rutas (local + admin + web)                           | Validar las 3 capas (pfSense + UFW + pg_hba) de forma independiente                      |
| 9 | Validación manual de `pg_dump` antes del cron                          | Detectar problemas de permisos / volumen antes de descubrirlos al día siguiente          |
| 10| Paso 2.3.8: `shred -u /root/.ninjasec-db-pass`                         | Cerrar el ciclo del secreto una vez copiado al password manager                          |

---

## 🔧 Correcciones a FASE 2.4 — `ninjasec-web`

| # | Cambio                                                                 | Por qué                                                                                  |
| - | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1 | Web pasa de `192.168.10.4` → `192.168.20.100`                          | Coherencia con reglas pfSense y `ALLOW_DMZ_WEB_TO_DB_5432`                               |
| 2 | `POSTGRES_HOST` pasa de `172.16.30.5` → `192.168.30.100`               | Idem                                                                                     |
| 3 | Nuevo paso 2.4.1b: **SSH hardening** (`AllowUsers ninja ninjadeploy`)  | Cerrar password-auth antes de exponer el server                                          |
| 4 | Nuevo paso 2.4.2: validar DB con `nc -vz` + `psql` **antes** de Docker | Si las 3 capas (pfSense/UFW/pg_hba) no están alineadas, descubrirlo antes de meter Compose |
| 5 | `ssh-keygen -N ""` explícito (passphrase vacía)                        | El original decía "no ponerle passphrase" pero no lo forzaba                             |
| 6 | Receta para copiar pubkey **sin** `ssh-copy-id`                         | `ninjadeploy` tiene `--disabled-password`, `ssh-copy-id` no puede autenticarse           |
| 7 | Orden corregido: crear `.ssh/` + `authorized_keys` **antes** de copiar la clave | El original lo hacía después                                                     |
| 8 | `chmod 600 .env` + ownership `ninjadeploy`                             | El `.env` tiene password de DB y JWT secret                                              |
| 9 | `JWT_SECRET_KEY` con `python3 -c "secrets.token_urlsafe(64)"`          | Coincide con la guía del `.env.example` real del repo                                    |
| 10| **Diff exacto** del `docker-compose.prod.yml`                          | Además de `postgres:`, hay que comentar `depends_on: postgres` y el volumen `postgres_data` |
| 11| `docker compose config` como validación pre-up                         | Detecta variables faltantes antes de buildar                                             |
| 12| Sección de **GitHub Secrets pendientes** para FASE 2.5                 | Anotar `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, etc. para no olvidarlos                          |
| 13| Snapshot al final, **no antes** de los 3 containers healthy            | Misma lógica que en FASE 2.3.7                                                           |

---

## 🧭 Patrones a replicar en futuros planes (FASE 2.5+)

Estos principios surgieron de las dos revisiones y conviene aplicarlos sistemáticamente:

1. **Topología explícita al inicio** del documento (tabla IPs ↔ rol). Si las IPs no calzan con pfSense, se ve a simple vista.
2. **Pre-checks antes de cambios destructivos**: `nc -vz`, `psql … SELECT version()`, `docker compose config`. Validan que las capas previas funcionan antes de seguir.
3. **SSH hardening como sub-sección dedicada** (no como bullet escondido). Siempre antes del paso "exponer servicio".
4. **Secretos jamás en `echo`** ni en variables de shell que queden en history. Pattern: `printf ... | sudo tee /root/.<name>-pass`, `chmod 600`, instrucción explícita de `shred -u` al final.
5. **Permisos del `.env`**: siempre `chmod 600` + `chown <deploy_user>:`.
6. **Diff exactos** cuando se modifica un archivo existente (no "comentar las líneas 28-50" sin contexto).
7. **Checklist final marcable** al cierre del documento (`- [ ]` por cada paso).
8. **Snapshot vSphere al final**, no antes de validar healthchecks.
9. **Sección "hardening posterior"** para anotar lo que se sale del scope de la fase pero no debe perderse (TLS, restore drills, log shipping, etc.).
10. **3 capas siempre tienen que estar de acuerdo**: pfSense ↔ UFW ↔ servicio (pg_hba, Caddy, etc.). Test cada capa por separado y juntas.

---

## 📋 Referencias

- [CHECKLIST-FIREWALL-PRE-FASE-2.3.md](./CHECKLIST-FIREWALL-PRE-FASE-2.3.md) — reglas pfSense base
- [FASE-2.3-PROVISIONAR-NINJASEC-DB.md](./FASE-2.3-PROVISIONAR-NINJASEC-DB.md) — plan DB (corregido)
- [FASE-2.4-PROVISIONAR-NINJASEC-WEB.md](./FASE-2.4-PROVISIONAR-NINJASEC-WEB.md) — plan web (corregido)
- Commits en `marksato13/PY_NINJASEC`:
  - `dc04e8e` — checklist firewall
  - `d6fb696` — plan FASE 2.3
  - `a5bf69c` — plan FASE 2.4
