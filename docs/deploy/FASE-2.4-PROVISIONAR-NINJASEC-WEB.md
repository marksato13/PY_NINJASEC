# 🌐 FASE 2.4 — Provisionar VM `ninjasec-web` (Docker + Caddy)

> **Pre-requisitos:**
> - [CHECKLIST-FIREWALL-PRE-FASE-2.3.md](./CHECKLIST-FIREWALL-PRE-FASE-2.3.md) aplicado (reglas pfSense activas).
> - [FASE-2.3-PROVISIONAR-NINJASEC-DB.md](./FASE-2.3-PROVISIONAR-NINJASEC-DB.md) ejecutado (PostgreSQL en `192.168.30.100` respondiendo).
>
> **SSH desde Admin:** `ssh ninja@192.168.20.100`
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

## 2.4.1b SSH hardening

> 🛑 **STOP. NO ejecutes el bloque de `sshd_config.d/99-ninjasec.conf` todavía.**
>
> El hardening cierra el login por password. Si tu clave SSH **NO** está cargada en
> `~ninja/.ssh/authorized_keys` antes del restart de sshd, te quedás afuera de la VM
> y vas a tener que recuperar acceso por la consola del hipervisor.
>
> Ejecutá primero los pasos (a) y (b) y validá (c) antes de pasar a (d).

### (a) En la VM admin (VLAN10) — clave SSH para gestión

Si todavía no tenés clave SSH en la VM admin, generala:

```bash
# En la VM admin
ls -la ~/.ssh/id_ed25519 2>/dev/null && echo "ya existe" || ssh-keygen -t ed25519 -C "ninja-admin@vlan10"
cat ~/.ssh/id_ed25519.pub
```

Copiá la línea de la pubkey al clipboard.

### (b) Cargar la pubkey en la VM web (vía password, mientras todavía se puede)

Desde la **VM admin**:

```bash
ssh-copy-id ninja@192.168.20.100
# Te pide el password de ninja UNA vez y carga la pubkey en authorized_keys
```

Alternativa manual si `ssh-copy-id` no está disponible:

```bash
cat ~/.ssh/id_ed25519.pub | ssh ninja@192.168.20.100 \
  'mkdir -p ~/.ssh && chmod 700 ~/.ssh && \
   cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

### (c) ✅ Validar que entrás con clave SIN password

```bash
ssh ninja@192.168.20.100 "whoami && hostname"
# Debe responder "ninja" + hostname, SIN pedir password.
# Si te pide password → NO sigas con (d). Revisá perms en ~/.ssh y authorized_keys.
```

### (d) Recién ahora aplicar el hardening (dentro de la VM web por SSH)

```bash
sudo tee /etc/ssh/sshd_config.d/99-ninjasec.conf > /dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
AllowUsers ninja ninjadeploy
EOF

sudo sshd -t && sudo systemctl restart ssh
```

> El `AllowUsers` incluye `ninjadeploy` desde ya porque lo vamos a crear en 2.4.4 y GitHub Actions necesita poder loguear.

### Si te quedaste afuera

Consola web del hipervisor → login local con `ninja` + password → cargar pubkey manualmente:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA... ninja-admin@vlan10' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

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
ssh ninja@192.168.20.100
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

**Paso A — en la laptop (donde generaste la clave), mostrar el contenido de la pubkey:**

```powershell
Get-Content $HOME\.ssh\ninjasec_deploy.pub
```

Bash/WSL equivalente:
```bash
cat ~/.ssh/ninjasec_deploy.pub
```

Salida esperada (una sola línea):
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...XXXX github-actions-ninjasec
```

Copiala **completa** al clipboard.

**Paso B — desde la VM admin (VLAN10), SSH a la web y agregarla:**

```bash
ssh ninja@192.168.20.100
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

### ✅ Checkpoint
Probá el login automatizado **desde la VM admin** (no desde la laptop). Como la privada vive en la laptop, copiala temporalmente para el test:

En la laptop:
```powershell
scp $HOME\.ssh\ninjasec_deploy ninja@<ip-vm-admin>:~/ninjasec_deploy_test
```

En la VM admin:
```bash
chmod 600 ~/ninjasec_deploy_test
ssh -i ~/ninjasec_deploy_test ninjadeploy@192.168.20.100 "whoami && docker ps"
# debe responder: ninjadeploy + lista vacía de containers
shred -u ~/ninjasec_deploy_test     # borrar el test, no la necesitamos permanente acá
```

Si pide password → el `authorized_keys` quedó mal (revisar perms y owner).

> **Por qué la privada no se queda en la VM admin:** la usa GitHub Actions (en `Settings → Secrets → DEPLOY_SSH_KEY`). La VM admin no necesita deployar manualmente.

---

## 2.4.6 Clonar el repo

```bash
# Desde tu sesión ninja en la VM
sudo -u ninjadeploy git clone https://github.com/marksato13/PY_NINJASEC.git /opt/ninjasec
sudo -u ninjadeploy cp /opt/ninjasec/.env.example /opt/ninjasec/infra/.env
```

---

## 2.4.7 Configurar `.env` de producción

```bash
sudo -u ninjadeploy nano /opt/ninjasec/infra/.env
```

Reemplazá el contenido por:

```ini
# ─── PostgreSQL (apunta a la VM DC) ─────────────────────────────────
POSTGRES_DB=ninjasec
POSTGRES_USER=ninjasec_app
POSTGRES_PASSWORD=<EL_PASSWORD_DE_FASE_2.3.4>
POSTGRES_HOST=192.168.30.100
POSTGRES_PORT=5432

# ─── Backend ────────────────────────────────────────────────────────
APP_NAME=NinjaSec
APP_VERSION=0.2.0
API_PREFIX=/api/v1
# Generar con: python3 -c "import secrets; print(secrets.token_urlsafe(64))"
JWT_SECRET_KEY=<PEGAR_AQUI_EL_TOKEN_DE_64_BYTES>
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
DUCKDNS_TOKEN=<SE_LLENA_EN_FASE_2.6>
ACME_EMAIL=makosdfrs@gmail.com
```

Generación del JWT secret (correr una sola vez en tu PC o en el server):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
# Pegar el output como JWT_SECRET_KEY=...
```

Permisos finales del `.env`:

```bash
sudo chmod 600 /opt/ninjasec/infra/.env
sudo chown ninjadeploy:ninjadeploy /opt/ninjasec/infra/.env
```

---

## 2.4.8 Ajustar `docker-compose.prod.yml` (Postgres remoto)

Como PostgreSQL corre en `ninjasec-db` (192.168.30.100), hay que:
1. **Comentar** el servicio `postgres:` (líneas 38–61 del repo actual).
2. **Comentar** la dependencia `depends_on: postgres` del servicio `backend:` (líneas 70–72).
3. **Comentar** el volumen `postgres_data:` al final.

```bash
sudo -u ninjadeploy nano /opt/ninjasec/infra/docker-compose.prod.yml
```

### Cambios exactos

```diff
   # ─── PostgreSQL (opcional aquí; ideal en VLAN30 DC) ────────────────
-  # Comentar este bloque si Postgres corre en otro server.
-  postgres:
-    image: postgres:16-alpine
-    container_name: ninjasec-postgres
-    restart: unless-stopped
-    environment:
-      POSTGRES_DB:       ${POSTGRES_DB}
-      POSTGRES_USER:     ${POSTGRES_USER}
-      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
-    volumes:
-      - postgres_data:/var/lib/postgresql/data
-      - ./backups:/backups
-    healthcheck:
-      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
-      interval: 10s
-      timeout: 5s
-      retries: 10
-    networks:
-      - ninjasec-net
-    ports:
-      - "127.0.0.1:5432:5432"
+  # Postgres corre en 192.168.30.100 (VLAN30). Bloque deshabilitado.

   # ─── Backend FastAPI ───────────────────────────────────────────────
   backend:
     build:
       context: ../backend
       dockerfile: Dockerfile
     container_name: ninjasec-backend
     restart: unless-stopped
-    depends_on:
-      postgres:
-        condition: service_healthy
+    # depends_on postgres eliminado: la DB está en otra VM
     environment:
```

Y al final del archivo:

```diff
 volumes:
-  postgres_data:
   caddy_data:
   caddy_config:
```

### ✅ Checkpoint
```bash
docker compose -f /opt/ninjasec/infra/docker-compose.prod.yml --env-file /opt/ninjasec/infra/.env config
```
- No debe mostrar errores de variables faltantes.
- En el output **no** debe aparecer el servicio `postgres`.

---

## 2.4.9 Caddyfile

Confirmar que `/opt/ninjasec/infra/Caddyfile` existe y apunta al frontend interno. Si no, ajustarlo así (ejemplo mínimo):

```caddy
{$DOMAIN} {
    encode zstd gzip
    tls {$ACME_EMAIL}

    # API proxy al backend
    @api path /api/*
    reverse_proxy @api backend:8024

    # Resto al frontend Next.js
    reverse_proxy frontend:3018
}
```

> El Caddyfile ya está versionado en el repo. Sólo modificalo si la config local difiere.

---

## 2.4.10 Levantar el stack

```bash
cd /opt/ninjasec/infra
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml --env-file .env up -d --build
sudo -u ninjadeploy docker compose -f docker-compose.prod.yml ps
```

### ✅ Checkpoint
- 3 containers en `Up`: `ninjasec-caddy`, `ninjasec-backend`, `ninjasec-frontend`.
- `docker logs ninjasec-backend --tail 50` muestra conexión OK a `192.168.30.100:5432`.
- `docker logs ninjasec-caddy --tail 50` muestra emisión de cert Let's Encrypt (esto puede fallar hasta FASE 2.6 — DuckDNS).

---

## 2.4.11 Snapshot vSphere

Tomar snapshot **después** de que los 3 containers estén `Up` y `healthy`:

```
vSphere → ninjasec-web → Take Snapshot
Nombre:      docker-caddy-stack-up
Descripción: Docker + Compose instalados, ninjadeploy con clave SSH de
             GitHub Actions, /opt/ninjasec clonado, .env producción
             (POSTGRES_HOST=192.168.30.100), stack levantado, UFW + fail2ban
             activos, SSH password-auth OFF
```

---

## Checklist final FASE 2.4

- [ ] `apt upgrade` + `unattended-upgrades` configurado
- [ ] UFW activo: 22 (admin), 80, 443/tcp, 443/udp
- [ ] `fail2ban` activo
- [ ] SSH: password-auth OFF, root-login OFF, `AllowUsers ninja ninjadeploy`
- [ ] `nc -vz 192.168.30.100 5432` → succeeded
- [ ] `psql … SELECT version()` desde esta VM funciona
- [ ] Docker + Compose instalados, `docker run hello-world` sin sudo
- [ ] Usuario `ninjadeploy` creado, en grupo `docker`, con clave SSH de Actions
- [ ] Login `ssh -i ninjasec_deploy ninjadeploy@…` exitoso desde PC admin
- [ ] `/opt/ninjasec` clonado del repo
- [ ] `.env` con `POSTGRES_HOST=192.168.30.100`, JWT secret real, `IS_PRODUCTION=true`, perms 600
- [ ] `docker-compose.prod.yml`: bloque `postgres:` y `depends_on: postgres` comentados, volumen `postgres_data` comentado
- [ ] `docker compose config` sin errores
- [ ] Stack `up -d --build` → 3 containers healthy
- [ ] Snapshot `docker-caddy-stack-up` tomado

---

## Secrets que quedan pendientes (para FASE 2.5 — CI/CD)

Anotar en password manager para configurar GitHub Secrets:

| Secret             | Valor                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `DEPLOY_SSH_KEY`   | Contenido de `~/.ssh/ninjasec_deploy` (privada, **completa**)        |
| `DEPLOY_HOST`      | `192.168.20.100` (o el FQDN público si lo expones tras Cloudflare)   |
| `DEPLOY_USER`      | `ninjadeploy`                                                        |
| `DEPLOY_PATH`      | `/opt/ninjasec`                                                      |

---

## Notas para hardening posterior (NO FASE 2.4)

- **Restringir SSH al puerto 22 desde admin LAN únicamente** vía pfSense (ya está) y eliminar `0.0.0.0` por completo cuando configuremos tunnel para GitHub Actions.
- **Cloudflare Tunnel / Tailscale** en vez de exponer 22 al runner directo (anota para FASE 2.5).
- **Caddy Auto-HTTPS por DNS challenge** una vez que DuckDNS resuelve (FASE 2.6) — evita exponer 80 a internet.
- **Image scanning** en CI antes de deploy (`trivy image ninjasec-backend:latest`).
- **Log shipping** del frontend/backend hacia la futura VM de observabilidad.
