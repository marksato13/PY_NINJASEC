# 🌐 FASE 2.4 — Provisionar VM `ninjasec-web` (Docker + Caddy)

> **Pre-requisitos:**
> - [CHECKLIST-FIREWALL-PRE-FASE-2.3.md](./CHECKLIST-FIREWALL-PRE-FASE-2.3.md) aplicado (reglas pfSense activas).
> - [FASE-2.3-PROVISIONAR-NINJASEC-DB.md](./FASE-2.3-PROVISIONAR-NINJASEC-DB.md) ejecutado (PostgreSQL en `192.168.30.100` respondiendo).
>
> **SSH desde Admin:** `ssh m4rk@192.168.20.100`
> **Tiempo estimado:** ~30 min
> **Fecha de revisión:** 2026-05-27

---

## Topología asumida

| Componente            | IP                  | Rol                              |
| --------------------- | ------------------- | -------------------------------- |
| Admin LAN             | `192.168.1.0/24`    | Red de gestión (donde vive la VM admin) |
| **Web (DMZ)**         | **`192.168.20.100`**| **VM `ninjasec-web` (esta fase)**|
| DB (Datacenter)       | `192.168.30.100`    | VM `ninjasec-db` (FASE 2.3)      |
| Dominio (FASE 2.6)    | `ninjasec.duckdns.org` | Apunta a IP pública WAN       |

## Máquinas involucradas en este plan

> Importante leer antes de ejecutar: hay 3 "máquinas" distintas mencionadas a lo largo del documento. No son la misma.

| Etiqueta en el plan | Qué es realmente                              | Cómo se accede                              |
| ------------------- | --------------------------------------------- | ------------------------------------------- |
| **Laptop**          | Tu PC con PowerShell                          | Directamente, en tu red local de casa/oficina |
| **VM admin (VLAN10)** | VM dentro del hipervisor, en `192.168.1.0/24` | Por consola del hipervisor o un acceso intermedio (VPN/jumphost) — sólo desde acá hay ruta directa a VLAN20 y VLAN30 |
| **VM web (VLAN20)** | VM que estamos provisionando, `192.168.20.100`| SSH **desde la VM admin** (no desde la laptop) |

Regla general:
- Los pasos **dentro** de la VM web → SSH desde la VM admin.
- La generación del par SSH para GitHub Actions → puede hacerse en la laptop (es donde tenés tu password manager y tu browser para pegar el Secret en GitHub).
- La copia de la **pubkey** al server → vía la VM admin (paso B en 2.4.5).

## Convención de usuarios en la VM web

Dos usuarios conviven en `ninjasec-web`:

| Usuario       | Para qué                                       | Auth                                     |
| ------------- | ---------------------------------------------- | ---------------------------------------- |
| **`m4rk`**    | Admin interactivo (sudoer). SSH manual desde la VM admin. | Password (hasta el hardening final)      |
| **`ninjadeploy`** | Deploy automatizado (GitHub Actions). En grupo `docker`. | Sólo SSH key (`--disabled-password`)     |

> Si la VM fue creada con otro usuario default (ej. `ninja`, `ubuntu`), ajustá los comandos `ssh m4rk@…` y `sudo passwd …` por el que realmente exista. Verificalo con `id <user>` y `passwd -S <user>` antes de avanzar.

---

## 2.4.1 Sistema base + UFW

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ufw fail2ban git ca-certificates unattended-upgrades htop vim

# UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 comment "SSH desde Admin"
sudo ufw allow 80/tcp  comment "Caddy HTTP"
sudo ufw allow 443/tcp comment "Caddy HTTPS"
sudo ufw allow 443/udp comment "Caddy HTTP/3"
sudo ufw enable

# Fail2ban + unattended-upgrades
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### ✅ Checkpoint
- `sudo ufw status numbered` → 4 reglas Allow + default deny.
- `sudo systemctl is-active fail2ban` → `active`.

---

## 2.4.1b SSH hardening — ⏸️ POSTPUESTO

> **Estado:** pendiente, se aplicará después de que el stack completo esté funcionando y todas las claves SSH estén distribuidas.
>
> **Por qué se posterga:** cerrar `PasswordAuthentication` requiere que todas las claves involucradas (admin → web, GitHub Actions `ninjasec_deploy` → ninjadeploy) ya estén cargadas y validadas. Más rápido iterar con password-auth ON, y endurecer al cierre del deploy de punta a punta.

### Para deshacer el hardening si ya lo aplicaste

Por consola del hipervisor (login local `m4rk` + password):

```bash
sudo rm /etc/ssh/sshd_config.d/99-ninjasec.conf
sudo systemctl restart ssh
```

### Pendientes para retomar el hardening (al cierre del deploy)

- [ ] Clave SSH del admin (`~/.ssh/id_ed25519` de la VM admin VLAN10) cargada en `~m4rk/.ssh/authorized_keys` de la VM web
- [ ] Pubkey de GitHub Actions (`ninjasec_deploy.pub` de la laptop) cargada en `~ninjadeploy/.ssh/authorized_keys` de la VM web (paso 2.4.5) ✅ ya hecho
- [ ] Validado `ssh m4rk@192.168.20.100 "whoami"` desde la VM admin sin pedir password
- [ ] Validado `ssh -i ninjasec_deploy ninjadeploy@192.168.20.100 "whoami && docker ps"` desde la VM admin ✅ ya hecho (2.4.5)
- [ ] Aplicar:
  ```bash
  sudo tee /etc/ssh/sshd_config.d/99-ninjasec.conf > /dev/null <<'EOF'
  PasswordAuthentication no
  PermitRootLogin no
  AllowUsers m4rk ninjadeploy
  EOF
  sudo sshd -t && sudo systemctl restart ssh
  ```
- [ ] Re-validar ambos accesos post-hardening

---

## 2.4.2 Validar conectividad a la DB ANTES de Docker

Antes de levantar nada, confirmamos que **pfSense + UFW + pg_hba** dejan pasar este server hacia la DB. Sin esto, después es imposible diagnosticar si falla el compose.

```bash
# TCP al 5432 de la DB
sudo apt install -y netcat-openbsd postgresql-client
nc -vz 192.168.30.100 5432

# Auth Postgres (te va a pedir el password de ninjasec_app de FASE 2.3.4)
psql "host=192.168.30.100 port=5432 dbname=ninjasec user=ninjasec_app sslmode=prefer" \
  -c "SELECT version();"
```

### ✅ Checkpoint
- `nc -vz` → `Connection to 192.168.30.100 5432 port [tcp/postgresql] succeeded!`
- `psql … SELECT version()` → devuelve la versión.

Si falla, **no avanzar**: revisar primero pfSense (`Status → System Logs → Firewall`) y luego `pg_hba.conf` de la DB.

---

## 2.4.3 Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh

# Agregar tu usuario al grupo docker
sudo usermod -aG docker $USER

# Cerrar SSH y volver a entrar para que tome el grupo
exit
```

Volvé a entrar:

```bash
ssh m4rk@192.168.20.100
docker --version          # Docker version 27.x
docker compose version    # Docker Compose version v2.x
```

### ✅ Checkpoint
- Los dos `--version` responden sin errores.
- `docker run --rm hello-world` corre sin necesidad de `sudo`.

---

## 2.4.4 Crear usuario `ninjadeploy` (para GitHub Actions)

```bash
sudo adduser --disabled-password --gecos "" ninjadeploy
sudo usermod -aG docker ninjadeploy

# Preparar carpeta de despliegue
sudo mkdir -p /opt/ninjasec
sudo chown ninjadeploy:ninjadeploy /opt/ninjasec

# Preparar carpeta SSH (la clave la copiamos después desde tu PC)
sudo mkdir -p /home/ninjadeploy/.ssh
sudo chown ninjadeploy:ninjadeploy /home/ninjadeploy/.ssh
sudo chmod 700 /home/ninjadeploy/.ssh
sudo -u ninjadeploy touch /home/ninjadeploy/.ssh/authorized_keys
sudo chmod 600 /home/ninjadeploy/.ssh/authorized_keys
```

> ⚠️ El grupo `docker` es equivalente a root (puede hacer `docker run -v /:/host`). Aceptable para deploy automatizado, pero **bloqueá password-auth de ese usuario** (ya lo hace `--disabled-password`) y usá clave SSH dedicada y sin passphrase.

---

## 2.4.5 Generar SSH key para GitHub Actions

> ⚠️ **Importante sobre dónde se ejecuta cada bloque:**
>
> - La **generación** del par de claves puede hacerse en cualquier máquina (tu laptop con PowerShell, tu VM admin en VLAN10, una WSL, etc.). Lo importante es que la **privada** termine como Secret de GitHub y la **pública** en el server.
> - La **copia de la pubkey al server** (`192.168.20.100`) requiere una máquina con **ruta de red a la VLAN20**. Tu laptop directa no rutea a las VLANs del hipervisor — usá tu **VM admin en VLAN10** para esto.
> - La privada `ninjasec_deploy` la consume GitHub Actions; no necesita quedar copiada permanentemente en la VM admin.

### En PowerShell (Windows)

```powershell
ssh-keygen -t ed25519 -C "github-actions-ninjasec" -f $HOME\.ssh\ninjasec_deploy
```

Cuando pida `Enter passphrase` → presioná **Enter** dos veces (sin passphrase, GitHub Actions no puede interactuar).

> El flag `-N ""` que sí funciona en bash, en PowerShell falla con
> `option requires an argument -- N` porque el parser come las comillas vacías.
> Si insistís en flag explícito, usá: `ssh-keygen --% -t ed25519 -C "github-actions-ninjasec" -f C:\Users\<tu-user>\.ssh\ninjasec_deploy -N ""`
> (el `--%` es el stop-parsing token de PowerShell).

### En bash / WSL / Linux

```bash
ssh-keygen -t ed25519 -C "github-actions-ninjasec" -f ~/.ssh/ninjasec_deploy -N ""
```

### Verificar que quedaron los 2 archivos

PowerShell:
```powershell
ls $HOME\.ssh\ninjasec_deploy*
```

Bash:
```bash
ls -la ~/.ssh/ninjasec_deploy*
```

Esperás:
- `ninjasec_deploy`     — **privada** (va al Secret de GitHub `DEPLOY_SSH_KEY`)
- `ninjasec_deploy.pub` — **pública** (va al server)

### Copiar la pubkey al server (vía VM admin)

Como la laptop no rutea a la VLAN20 directamente, hacelo en 2 pasos:

**Paso A — en la laptop (donde generaste la clave), copiar la pubkey al clipboard:**

```powershell
Get-Content $HOME\.ssh\ninjasec_deploy.pub | Set-Clipboard
```

> Usar `| Set-Clipboard` evita que selecciones de más en el terminal (líneas siguientes del `.md`, prompt, etc.) terminen pegándose junto con la clave.

Bash/WSL equivalente:
```bash
cat ~/.ssh/ninjasec_deploy.pub
```

Salida esperada (una sola línea):
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...XXXX github-actions-ninjasec
```

**Paso B — desde la VM admin (VLAN10), SSH a la web y agregarla:**

```bash
ssh m4rk@192.168.20.100
```

Una vez dentro de la VM web, pegá la línea entre las comillas simples del `echo`:

```bash
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...XXXX github-actions-ninjasec' | \
  sudo tee -a /home/ninjadeploy/.ssh/authorized_keys >/dev/null

sudo chown ninjadeploy:ninjadeploy /home/ninjadeploy/.ssh/authorized_keys
sudo chmod 600 /home/ninjadeploy/.ssh/authorized_keys

# Verificar que quedó la línea correcta
sudo cat /home/ninjadeploy/.ssh/authorized_keys
```

### ✅ Checkpoint — validar la clave funciona

Probá el login automatizado **desde la VM admin** (no desde la laptop, no rutea). Como la privada vive en la laptop y `scp` directo laptop→VM-admin puede no estar habilitado, usamos copy-paste vía clipboard.

**1. En la laptop (PowerShell): copiar la privada al clipboard**

```powershell
Get-Content $HOME\.ssh\ninjasec_deploy | Set-Clipboard
```

> Pegar con `cat > ~/file` y luego Ctrl+D **falla seguido** porque el terminal interpreta partes del paste (saltos de línea raros, fin de archivo no llega a tiempo, etc.) y la clave queda truncada. Por eso usamos `nano`, que trata el paste como texto puro.

**2. En la VM admin: pegar con `nano`**

```bash
nano ~/ninjasec_deploy_test
```

Dentro de nano:
- Click derecho → Paste (o Ctrl+Shift+V según terminal)
- `Ctrl+O` → Enter (guardar)
- `Ctrl+X` (salir)

**3. Verificar que el contenido quedó íntegro**

```bash
head -1 ~/ninjasec_deploy_test
tail -1 ~/ninjasec_deploy_test
wc -l  ~/ninjasec_deploy_test
```

Esperás:
- `head -1` → `-----BEGIN OPENSSH PRIVATE KEY-----`
- `tail -1` → `-----END OPENSSH PRIVATE KEY-----`
- `wc -l`  → 7 a 12 líneas (ed25519 son ~7)

Si la línea de END está corrupta o falta → repetir desde `nano` con un paste limpio.

**4. Test SSH**

```bash
chmod 600 ~/ninjasec_deploy_test
ssh -i ~/ninjasec_deploy_test -o StrictHostKeyChecking=accept-new ninjadeploy@192.168.20.100 "whoami && docker ps"
```

Esperás:
```
ninjadeploy
CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES
```

(Lista vacía está OK — todavía no hay containers.)

**5. Borrar la copia temporal**

```bash
shred -u ~/ninjasec_deploy_test
ls ~/ninjasec_deploy_test 2>&1   # "No such file or directory"
```

Diagnóstico si falla:

| Síntoma                            | Causa probable                                |
| ---------------------------------- | --------------------------------------------- |
| `Load key … invalid format`        | Paste corrupto en nano (rehacer)              |
| `Permission denied (publickey)`    | Pubkey mal pegada en `authorized_keys` (revisar) |
| Pide password                      | `authorized_keys` con perms o owner mal       |
| `permission denied` en `docker ps` | `ninjadeploy` no está en grupo docker         |

> **Por qué la privada no se queda en la VM admin:** la usa GitHub Actions (en `Settings → Secrets → DEPLOY_SSH_KEY`). La VM admin no necesita deployar manualmente.

---

## 2.4.6 Clonar el repo

```bash
# Desde tu sesión m4rk en la VM (o como root tras sudo -i)
sudo -u ninjadeploy git clone https://github.com/marksato13/PY_NINJASEC.git /opt/ninjasec
sudo -u ninjadeploy cp /opt/ninjasec/.env.example /opt/ninjasec/infra/.env
ls -la /opt/ninjasec/infra/.env
```

Esperás:
```
-rw-r--r-- 1 ninjadeploy ninjadeploy ... /opt/ninjasec/infra/.env
```

---

## 2.4.7 Configurar `.env` de producción

> ⚠️ **MUY IMPORTANTE — leé antes de tocar el `.env`:**
>
> Los marcadores de tipo `REEMPLAZAR_PASSWORD_DB`, `REEMPLAZAR_JWT_SECRET`, etc.
> **NO son parte del valor**. Hay que reemplazar la **palabra completa** por el
> secreto real. Ejemplo correcto:
>
> ```
> POSTGRES_PASSWORD=rHmqYW443IySi7F9Ep2NxkZX     ✅
> POSTGRES_PASSWORD=<rHmqYW443IySi7F9Ep2NxkZX>   ❌ los <> se mandan literales al DATABASE_URL
> POSTGRES_PASSWORD=REEMPLAZAR_PASSWORD_DB       ❌ olvidaste reemplazar
> ```

```bash
sudo -u ninjadeploy nano /opt/ninjasec/infra/.env
```

Reemplazá el contenido por (las palabras `REEMPLAZAR_*` deben sustituirse por el valor real):

```ini
# ─── PostgreSQL (apunta a la VM DC) ─────────────────────────────────
POSTGRES_DB=ninjasec
POSTGRES_USER=ninjasec_app
POSTGRES_PASSWORD=REEMPLAZAR_PASSWORD_DB
POSTGRES_HOST=192.168.30.100
POSTGRES_PORT=5432

# ─── Backend ────────────────────────────────────────────────────────
APP_NAME=NinjaSec
APP_VERSION=0.2.0
API_PREFIX=/api/v1
# Generar con: python3 -c "import secrets; print(secrets.token_urlsafe(64))"
JWT_SECRET_KEY=REEMPLAZAR_JWT_SECRET
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=https://ninjasec.duckdns.org
SEED_ON_STARTUP=false
IS_PRODUCTION=true

# ─── Frontend ───────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=/api/v1
BACKEND_INTERNAL_URL=http://backend:8024

# ─── Producción (DuckDNS / Let's Encrypt) ───────────────────────────
DOMAIN=ninjasec.duckdns.org
DUCKDNS_TOKEN=
ACME_EMAIL=makosdfrs@gmail.com
```

> `DUCKDNS_TOKEN=` queda **vacío** hasta FASE 2.6. No poner placeholder ahí.

### Obtener los 2 secretos

**`REEMPLAZAR_PASSWORD_DB`** — el que guardaste en la DB en FASE 2.3.4:

```bash
# En la VM db
sudo cat /root/.ninjasec-db-pass
```

(Si ya lo borraste con `shred -u`, lo tenés que tener en el password manager.)

**`REEMPLAZAR_JWT_SECRET`** — generá uno nuevo:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

### Validar que NO quedaron placeholders

```bash
grep -E 'REEMPLAZAR|<.*>' /opt/ninjasec/infra/.env
```

**Debe no devolver nada**. Si aparece algo, todavía hay un placeholder sin reemplazar.

### Permisos finales del `.env`

```bash
sudo chmod 600 /opt/ninjasec/infra/.env
sudo chown ninjadeploy:ninjadeploy /opt/ninjasec/infra/.env
```

### Smoke-test del DATABASE_URL ya armado

```bash
sudo -u ninjadeploy docker compose -f /opt/ninjasec/infra/docker-compose.prod.yml \
  --env-file /opt/ninjasec/infra/.env config | grep DATABASE_URL
```

Esperás (con tu password real):

```
DATABASE_URL: postgresql+psycopg://ninjasec_app:rHmqYW443IySi7F9Ep2NxkZX@192.168.30.100:5432/ninjasec
```

Sin `<>`, sin `REEMPLAZAR_*`, sin espacios raros.

---

## 2.4.8 Ajustar `docker-compose.prod.yml` (Postgres remoto)

Como PostgreSQL corre en `ninjasec-db` (192.168.30.100), el `docker-compose.prod.yml` del repo trae 3 cosas que sobran:
1. Servicio `postgres:` completo.
2. `depends_on: postgres` dentro de `backend:`.
3. Volumen `postgres_data:` al final.

**Recomendación:** en vez de andar comentando línea por línea con `nano` (donde es facilísimo desindentar y romper el YAML), **reemplazá el archivo completo** con la versión limpia de abajo. Mucho menos error-prone.

### Backup del original (por si querés diff después)

```bash
sudo -u ninjadeploy cp /opt/ninjasec/infra/docker-compose.prod.yml \
                       /opt/ninjasec/infra/docker-compose.prod.yml.orig
```

### Si ya editaste a mano y quedó roto: restaurar del repo primero

```bash
sudo -u ninjadeploy git -C /opt/ninjasec checkout -- infra/docker-compose.prod.yml
```

### Reemplazar con la versión final (heredoc, sin paste contamination)

```bash
sudo -u ninjadeploy tee /opt/ninjasec/infra/docker-compose.prod.yml > /dev/null <<'EOF'
# ════════════════════════════════════════════════════════════════════
# NinjaSec — Stack de PRODUCCIÓN (Postgres remoto en VLAN30)
# ════════════════════════════════════════════════════════════════════
# Postgres corre en 192.168.30.100. Acá NO se levanta como container.
# Caddy hace HTTPS automático con Let's Encrypt (requiere DOMAIN).
# Solo 80/443 expuestos al host.
# ════════════════════════════════════════════════════════════════════

services:
  # ─── Reverse proxy con HTTPS automático ────────────────────────────
  caddy:
    image: caddy:2-alpine
    container_name: ninjasec-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    environment:
      DOMAIN:     ${DOMAIN:?DOMAIN requerido}
      ACME_EMAIL: ${ACME_EMAIL:?ACME_EMAIL requerido}
    depends_on:
      frontend:
        condition: service_healthy
    networks:
      - ninjasec-net

  # ─── Backend FastAPI ───────────────────────────────────────────────
  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: ninjasec-backend
    restart: unless-stopped
    environment:
      APP_NAME:                    ${APP_NAME:-NinjaSec}
      APP_VERSION:                 ${APP_VERSION:-0.2.0}
      API_PREFIX:                  ${API_PREFIX:-/api/v1}
      DATABASE_URL:                postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}
      JWT_SECRET_KEY:              ${JWT_SECRET_KEY:?required}
      JWT_ALGORITHM:               ${JWT_ALGORITHM:-HS256}
      ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES:-30}
      CORS_ORIGINS:                ${CORS_ORIGINS}
      SEED_ON_STARTUP:             "false"
      IS_PRODUCTION:               "true"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8024/health')"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    networks:
      - ninjasec-net
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"

  # ─── Frontend Next.js ──────────────────────────────────────────────
  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-/api/v1}
    container_name: ninjasec-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    environment:
      NODE_ENV:             production
      BACKEND_INTERNAL_URL: http://backend:8024
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3018/login"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    networks:
      - ninjasec-net
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"

networks:
  ninjasec-net:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
EOF
```

> Notar el `'EOF'` con comillas simples — eso impide que bash expanda `${POSTGRES_USER}` y otras variables al escribir el archivo. **Sin las comillas, el archivo quedaría con valores vacíos.**

### Diferencias respecto al original

| Eliminado     | Por qué                                                |
| ------------- | ------------------------------------------------------ |
| `services.postgres` (servicio completo) | DB en otra VM (192.168.30.100) |
| `backend.depends_on.postgres`           | Ya no existe ese servicio en este compose |
| `volumes.postgres_data`                 | No hay servicio que lo monte |

### ✅ Checkpoint

```bash
sudo -u ninjadeploy docker compose -f /opt/ninjasec/infra/docker-compose.prod.yml --env-file /opt/ninjasec/infra/.env config | head -20
```

Esperás:
- Output del YAML compilado (sin errores).
- 3 services: `caddy`, `backend`, `frontend`.
- **NO** debe aparecer `postgres` como service.

Si falla con `service "X" depends on undefined service "Y"`: el heredoc se cortó o el `EOF` quedó indentado. Volvé a correrlo asegurándote que el `EOF` final esté al inicio de línea (sin espacios).

---

## 2.4.9 Caddyfile

> 🛑 **POR DEFAULT: NO TOQUES EL CADDYFILE.** El repo trae un Caddyfile de
> producción con headers OWASP, logging estructurado, health check, proxies
> con `X-Real-IP`, etc. Sobreescribirlo con un "ejemplo mínimo" te hace
> perder todo eso.

### Paso 1 — Confirmar que el Caddyfile del repo está OK

```bash
cat /opt/ninjasec/infra/Caddyfile
```

Si el output tiene:
- Bloque global `{ email {$ACME_EMAIL} ... }`
- `{$DOMAIN} { ... }` con `reverse_proxy backend:8024` y `reverse_proxy frontend:3018`
- Headers de seguridad (`Strict-Transport-Security`, `X-Content-Type-Options`, etc.)

→ **NO TOQUES NADA. Pasá al paso 3.**

### Paso 2 — SÓLO si `cat` no muestra nada (archivo vacío o falta)

```bash
sudo -u ninjadeploy tee /opt/ninjasec/infra/Caddyfile > /dev/null <<'EOF'
# NinjaSec — Caddy mínimo. Reemplazalo después por la versión del repo.
{
    email {$ACME_EMAIL}
}

{$DOMAIN} {
    encode zstd gzip

    handle /api/* {
        reverse_proxy backend:8024
    }

    handle {
        reverse_proxy frontend:3018
    }
}
EOF
```

> Si **accidentalmente** sobreescribiste el Caddyfile bueno del repo, restauralo:
> ```bash
> sudo -u ninjadeploy git -C /opt/ninjasec checkout -- infra/Caddyfile
> ```

### Paso 3 — Validar con `caddy validate` (pasándole las env vars)

> ⚠️ El validate **necesita** que `DOMAIN` y `ACME_EMAIL` estén definidos. Si
> los omitís, Caddy lee `{$DOMAIN}` como string vacío y dispara
> `unrecognized global option: encode` (porque el bloque del site se confunde
> con el bloque global).

```bash
sudo -u ninjadeploy docker run --rm \
  -v /opt/ninjasec/infra/Caddyfile:/etc/caddy/Caddyfile:ro \
  -e DOMAIN=ninjasec.duckdns.org \
  -e ACME_EMAIL=makosdfrs@gmail.com \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Esperás:
```
Valid configuration
```

Si tira errores, te dice exactamente la línea.

---

## 2.4.10 Levantar el stack

### Pre-check: espacio en disco

El build pesa fácil 3–5 GB entre Python con deps, Node modules, layers, y build cache. Si la VM tiene < 10 GB libres, el build va a fallar a mitad con `no space left on device`. Validar primero:

```bash
df -h /
docker system df
```

Esperás ver al menos **5 GB libres** en `/` (o en la partición donde vive `/var/lib/docker`). Si está justo, ver el sub-paso "Recuperación por disco lleno" abajo antes de seguir.

### Build + up

```bash
cd /opt/ninjasec/infra
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env up -d --build
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml ps
```

### ✅ Checkpoint
- 3 containers en `Up`: `ninjasec-caddy`, `ninjasec-backend`, `ninjasec-frontend`.
- Backend y frontend en `(healthy)`. Caddy en `Up` (sin healthcheck propio).
- `docker logs ninjasec-backend --tail 50` muestra `Application startup complete.` y `GET /health HTTP/1.1" 200 OK`.
- `docker logs ninjasec-caddy --tail 50` muestra emisión de cert Let's Encrypt — **va a fallar con `SERVFAIL`** hasta FASE 2.6 (DuckDNS no resuelve todavía). Es esperado.

### 🩹 Recuperación si el build falló por `no space left on device`

Síntoma típico:
```
write /tmp/.tmp-compose-build-metadataFile-...: no space left on device
```

Y `docker compose ps` queda vacío aunque el build llegó hasta `naming to docker.io/library/infra-backend:latest`. Las imágenes **sí** se crearon, pero el orquestador abortó antes de crear los containers.

Pasos:

```bash
# 1. Diagnóstico
df -h
docker system df
docker images | grep -E 'infra-(backend|frontend)'   # confirmar que las imágenes existen

# 2. Limpieza segura — sólo build cache + dangling images
sudo -u ninjadeploy docker builder prune -af
sudo -u ninjadeploy docker image prune -f

# 3. Re-chequear disco
df -h /
docker system df
```

> ⚠️ **NO corras `docker system prune -a --volumes`** todavía — borraría el volumen `caddy_data` (certificados Let's Encrypt) si ya existiera. Limitate a `builder prune` + `image prune`.

Una vez liberado disco, **levantá sin rebuild** (las imágenes ya están):

```bash
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env up -d
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml ps
```

Si después de `builder prune` el disco sigue lleno, hay que **agrandar el VMDK** desde vSphere (mínimo 30 GB recomendado para una VM con Docker + builds de Next.js) y después adentro de la VM:

```bash
sudo growpart /dev/sda 2          # ajustar partición según `lsblk`
sudo resize2fs /dev/sda2          # o pvresize + lvextend si usás LVM
```

---

## 2.4.11 Validación end-to-end

Antes de snapshot, confirmar que el stack se habla bien internamente. La HTTPS pública con cert válido va a quedar pendiente hasta FASE 2.6 — eso es esperado.

### Por dentro de cada container

```bash
# Backend responde /health
sudo -u ninjadeploy docker exec ninjasec-backend python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8024/health').read())"
# → b'{"status":"ok","app":"NinjaSec"}'

# Frontend renderiza /login
sudo -u ninjadeploy docker exec ninjasec-frontend wget -qO- http://127.0.0.1:3018/login | head -3
# → HTML con <title>NinjaSec</title>

# Caddy alcanza al backend por la red Docker interna
sudo -u ninjadeploy docker exec ninjasec-caddy wget -qO- http://backend:8024/health
# → {"status":"ok","app":"NinjaSec"}
```

### Caddy desde el host

```bash
# Redirect 80 → 443 funciona
curl -sS -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://127.0.0.1
# → 308 -> https://127.0.0.1/

# HTTPS con Host del dominio — va a fallar con TLS alert
curl -k -H "Host: ninjasec.duckdns.org" -o /dev/null -w "%{http_code}\n" https://127.0.0.1/login
# → tlsv1 alert internal error (ESPERADO: sin cert válido todavía)
```

> Por qué falla el HTTPS público: Let's Encrypt no pudo emitir el cert porque `ninjasec.duckdns.org` no resuelve (DuckDNS pendiente de FASE 2.6). Sin cert válido para ese hostname, Caddy aborta el TLS handshake. Esto se resuelve solo cuando FASE 2.6 termine.

### Tests **NO** aplicables hasta FASE 2.6

| Test | Por qué falla ahora | Cuándo va a andar |
|---|---|---|
| `curl https://ninjasec.duckdns.org/` desde Internet  | DNS no resuelve + cert no válido | Después de DuckDNS + port forward + LE OK |
| Browser → `https://ninjasec.duckdns.org/login`       | Idem                             | Idem |
| Webhook de GitHub Actions sobre HTTPS                | Idem                             | Idem |

---

## 2.4.12 Snapshot vSphere

Tomar snapshot **después** de la validación end-to-end:

```
vSphere → ninjasec-web → Take Snapshot
Nombre:      docker-caddy-stack-up
Descripción: Stack producción levantado y validado end-to-end:
             - backend (healthy) → DB en 192.168.30.100:5432 (cross-VLAN OK)
             - frontend (healthy) → SSR /login correcto
             - caddy → proxy interno backend:8024 y frontend:3018 OK
             - 308 http→https desde host OK
             Fix backend.static aplicado (commit d6caad7).
             SSH hardening POSTPUESTO (2.4.1b).
             DuckDNS + LE pendientes (FASE 2.6) → TLS público falla hasta entonces.

Memory:  no necesario
Quiesce: sí (si VMware Tools instaladas)
```

---

## Errores comunes vistos durante el deploy

Tropezones reales que aparecieron en la primera pasada y cómo evitarlos:

| Síntoma                                                           | Causa                                                                  | Fix                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `passwd: user 'ninja' does not exist`                             | El plan asume `ninja`, pero la VM se creó con `m4rk` (u otro)         | Usar el user real (`m4rk`). Ver sección "Convención de usuarios"        |
| `Permission denied, please try again.` en SSH con password OK     | El user `ninja` no existe, no es un problema de password               | Idem arriba                                                             |
| `additional properties 'bu  ild' not allowed`                     | `nano` se comió/agregó un espacio al editar el YAML                    | Restaurar con `git checkout -- infra/docker-compose.prod.yml` y usar el heredoc de 2.4.8 |
| `service "backend" depends on undefined service "postgres"`       | Se comentó `services.postgres` pero no `backend.depends_on.postgres`   | Usar el heredoc de 2.4.8 (reemplaza el archivo completo)                |
| `DATABASE_URL: …:<password>@…` con `<>` literales                 | Se dejaron los corchetes del placeholder en el `.env`                  | Ver 2.4.7 — los `<>` no son parte del valor                             |
| `encode: command not found`, `tls: command not found`, etc.       | Se pegó el contenido del Caddyfile **en bash** en vez de en el archivo | Ver 2.4.9 — el contenido va con `tee > archivo <<'EOF' … EOF`           |
| `unrecognized global option: encode` al `caddy validate`          | Se corrió el validate sin pasar `DOMAIN` y `ACME_EMAIL` como env vars  | Ver 2.4.9 paso 3 — añadir `-e DOMAIN=... -e ACME_EMAIL=...` al `docker run` |
| Caddyfile mínimo reemplazó al bueno del repo (sin headers OWASP, sin logging, etc.) | Se corrió el paso 2 de 2.4.9 cuando el archivo ya existía | `git -C /opt/ninjasec checkout -- infra/Caddyfile` para restaurar |
| `write /tmp/.tmp-compose-build-metadataFile-...: no space left on device` y `docker compose ps` vacío tras un build largo | Disco lleno por build cache + node_modules + Python wheels acumulados | Ver 2.4.10 "Recuperación si el build falló por no space" — `docker builder prune -af` + `docker image prune -f`, después `up -d` sin `--build` |
| `RuntimeError: Directory '/app/app/static' does not exist` (backend en restart loop) | El dir `backend/app/static/` no se trackea en git (contiene uploads de usuario) y la imagen no lo crea | `git pull` + `docker compose up -d --build backend` — fix en código (`mkdir parents=True, exist_ok=True`) commiteado en `d6caad7` |
| `Load key … invalid format` al testear `ssh -i ninjasec_deploy`   | Paste corrupto al hacer `cat > file` en vez de `nano`                  | Ver 2.4.5 — usar `nano` y verificar con `head/tail/wc -l`               |
| `cat: …/99-ninjasec.conf: No such file or directory` (al deshacer) | El hardening nunca se aplicó realmente                                 | No hace falta deshacer — ver 2.4.1b                                     |

---

## Checklist final FASE 2.4

- [x] `apt upgrade` + `unattended-upgrades` configurado
- [x] UFW activo: 22 (admin), 80, 443/tcp, 443/udp
- [x] `fail2ban` activo
- [ ] ⏸️ SSH hardening POSTPUESTO (futuro: password-auth OFF, root-login OFF, `AllowUsers m4rk ninjadeploy`)
- [x] `nc -vz 192.168.30.100 5432` → succeeded
- [x] `psql … SELECT version()` desde esta VM funciona
- [x] Docker + Compose instalados, `docker run hello-world` sin sudo
- [x] Usuario `ninjadeploy` creado, en grupo `docker`, con clave SSH de Actions
- [x] Login `ssh -i ninjasec_deploy ninjadeploy@…` exitoso desde la VM admin
- [x] `/opt/ninjasec` clonado del repo
- [x] `.env` con `POSTGRES_HOST=192.168.30.100`, JWT secret real, `IS_PRODUCTION=true`, perms 600 (sin `<>` ni `REEMPLAZAR_*`)
- [x] `docker-compose.prod.yml` reemplazado con versión limpia (sin servicio postgres, sin depends_on postgres, sin volumen postgres_data)
- [x] `docker compose config` sin errores
- [x] Stack `up -d --build` → 3 containers healthy
- [x] Validación end-to-end interna OK (backend `/health`, frontend `/login`, caddy→backend)
- [ ] Snapshot `docker-caddy-stack-up` tomado

---

## 🔜 Pendientes y próximas fases

### Pendientes técnicos dentro de la VM web

- [ ] **Rotar password de PostgreSQL** + JWT secret (si alguno se filtró durante deploy/troubleshooting). Ver 2.3.4 (DB) + regenerar JWT_SECRET en el `.env` de la web y `docker compose up -d` para que el backend re-lea.
- [ ] **Borrar la copia temporal de la privada** en la VM admin (`shred -u ~/ninjasec_deploy_test`) si quedó.
- [ ] **Snapshot vSphere** `docker-caddy-stack-up`.

### Próximas fases del deploy

| Fase | Qué cubre                                          | Bloquea HTTPS público? | Bloquea CI/CD? |
| ---- | -------------------------------------------------- | ---------------------- | -------------- |
| **2.5** | GitHub Actions CI/CD: usar `DEPLOY_SSH_KEY` ya validado en 2.4.5 para deployar al server vía workflow. Crear `.github/workflows/deploy.yml` con SSH al `ninjadeploy@192.168.20.100` y `docker compose up -d --build`. | No                     | **Sí**         |
| **2.6** | **DuckDNS + port forward + Let's Encrypt**: cliente DuckDNS (cron o paquete pfSense), NAT 80/443 WAN→`192.168.20.100`, validar que Caddy emite el cert. Acá empieza a andar `https://ninjasec.duckdns.org/`. | **Sí**                 | No             |
| **2.7** | **Hardening final SSH** (lo POSTPUESTO en 2.4.1b y 2.3.1b): aplicar `PasswordAuthentication no`, `PermitRootLogin no`, `AllowUsers m4rk ninjadeploy` en ambas VMs. Sólo cuando 2.5 y 2.6 estén estables y todas las claves distribuidas. | No                     | No             |
| **2.8** | **Self-hosted runner opcional** o **Tailscale/Cloudflare Tunnel** para que GitHub Actions no necesite SSH público al server. Si querés cerrar 22 al WAN. | No                     | No             |
| **2.9** | **Backups off-site** (rsync/restic del `/opt/ninjasec` + dump de DB) hacia NAS o S3-compatible. | No                     | No             |

### Recomendación de orden

1. **2.6 primero** → te desbloquea HTTPS público real, podés ver la app en el browser, y al instante validás que toda la cadena WAN → pfSense → web → Caddy → backend ↔ DB anda.
2. **2.5 después** → CI/CD encima del stack que ya sabés que funciona.
3. **2.7 al cierre** → hardening cuando todo lo demás está estable y tenés cómo entrar por consola si algo se rompe.
4. **2.8 / 2.9** → mejoras de postura, no bloqueantes.

### Secrets pendientes (necesarios para FASE 2.5 — anotar en password manager)

| Secret             | Valor                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `DEPLOY_SSH_KEY`   | Contenido completo de `~/.ssh/ninjasec_deploy` (laptop)              |
| `DEPLOY_HOST`      | `192.168.20.100` (o FQDN público si exponés vía tunnel)              |
| `DEPLOY_USER`      | `ninjadeploy`                                                        |
| `DEPLOY_PATH`      | `/opt/ninjasec`                                                      |

### Mejoras anotadas para iteraciones futuras

- **Caddy Auto-HTTPS por DNS challenge** una vez que DuckDNS resuelve (evita exponer 80 a Internet, solo 443).
- **Cloudflare Tunnel / Tailscale** en vez de exponer 22 al runner de GitHub directamente.
- **Image scanning** en CI antes de deploy (`trivy image ninjasec-backend:latest`).
- **Log shipping** del backend/frontend a una futura VM de observabilidad (Loki + Grafana).
- **Migraciones Alembic formales** para columnas que se agregaron con `ALTER TABLE` directo en seed/dev.
