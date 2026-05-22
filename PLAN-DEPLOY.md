# 🚀 PLAN-DEPLOY — NinjaSec en VMware ESXi + GitHub Actions + DuckDNS

> Plan completo de despliegue paso a paso. Imprimir antes de arrancar.
> Versión: 2026-05-22 · Autor: Rubén Mark Salazar

---

## 📋 Resumen ejecutivo

| Decisión | Valor elegido |
|---|---|
| Hipervisor | **VMware ESXi / vSphere** |
| Estrategia CI/CD | **GitHub Actions + SSH deploy** |
| DNS público | **DuckDNS** (`ninjasec.duckdns.org`) |
| HTTPS | **Let's Encrypt via Caddy** |
| OS de las VMs | **Ubuntu Server 22.04 LTS** |
| DB | **PostgreSQL 16** en VM separada (VLAN30 DC) |
| Repo | **https://github.com/marksato13/PY_NINJASEC** |

**Tiempo estimado total:** ~3 horas (se puede partir en 2 sesiones)

---

## 🎯 Resultado esperado al terminar

1. App pública en `https://ninjasec.duckdns.org` con HTTPS válido
2. PostgreSQL aislado en VLAN30 DC, accesible solo desde la VM Web
3. CI/CD: cada `git push origin main` → deploy automático en ~2 min
4. Backups diarios automáticos de la DB
5. Snapshots semanales de las VMs en ESXi

---

## 🗺️ Diagrama final del escenario

```
                     Internet (ISP1 Claro / ISP2 Movistar)
                                    │
                          ┌─────────┴─────────┐
                          │ pfSense MASTER+BACKUP │
                          │   CARP VIP 192.168.1.1│
                          └─────────┬─────────┘
                                    │
                              TRUNK 802.1Q
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
        VLAN10 Admin           VLAN20 DMZ            VLAN30 DC
       192.168.1.0/24        192.168.10.0/24        172.16.30.0/24
              │                     │                     │
              │           ┌─────────┴────────┐  ┌─────────┴────────┐
              │           │ HIPERVISOR ESXi  │  │ HIPERVISOR ESXi  │
              │           │ ────────────────│  │ ────────────────│
              │           │ VM ninjasec-web │  │ VM ninjasec-db  │
              │           │ 192.168.10.4    │  │ 172.16.30.5     │
              │           │ Ubuntu 22.04    │  │ Ubuntu 22.04    │
              │           │ Caddy+Docker    │  │ PostgreSQL 16   │
              │           │ +NinjaSec stack │  │ +backups        │
              │           └──────────────────┘  └──────────────────┘
              │
       PC Admin + Kali
       (acceso SSH por VLAN10)

                                ┌───────────────────────┐
                                │ DuckDNS                │
                                │ ninjasec.duckdns.org   │
                                │   ↓ updates cada 5min  │
                                │   IP pública del WAN   │
                                └───────────────────────┘

                                ┌───────────────────────┐
                                │ GitHub Actions          │
                                │ deploy.yml en push     │
                                │   ↓ SSH 22 (port-fwd)  │
                                │ → 192.168.10.4         │
                                │   git pull + rebuild   │
                                └───────────────────────┘
```

---

# 📦 FASE 2.1 — Configurar vSwitches y Port Groups en ESXi

> **Donde:** vSphere Client del ESXi
> **Tiempo:** 15 min
> **Pre-requisito:** acceso admin al ESXi, conocer el uplink físico que recibe el TRUNK 802.1Q

## 2.1.1 Crear/verificar vSwitch con uplink trunking

Si ya tenés un vSwitch con TRUNK 802.1Q hacia el switch físico, salteá esto.

1. **vSphere Client → ESXi host → Configure → Virtual switches**
2. **Add Standard Switch** o usar el vSwitch existente
3. Asegurate que el uplink físico (vmnic0 o similar) esté conectado al puerto trunk del switch administrable
4. **Security:** Promiscuous Mode = `Reject`, MAC Address Changes = `Reject`, Forged Transmits = `Reject`

## 2.1.2 Crear Port Group para VLAN 20 DMZ

1. Click derecho sobre el vSwitch → **Add Port Group**
2. Configurar:
   - **Network Label:** `PG-VLAN20-DMZ`
   - **VLAN ID:** `20`
   - **Security:** mismo que el switch
3. Save

## 2.1.3 Crear Port Group para VLAN 30 DC

1. Add Port Group:
   - **Network Label:** `PG-VLAN30-DC`
   - **VLAN ID:** `30`
2. Save

> 💡 **Tip:** si vas a tener más servicios en VLAN10 o 40, creá los Port Groups equivalentes ahora.

---

# 💻 FASE 2.2 — Crear las 2 VMs en ESXi

> **Tiempo:** 30 min cada VM con la instalación (mientras Ubuntu instala, podés trabajar en la otra)

## 2.2.1 VM `ninjasec-db` (la creamos primero porque el web depende de ella)

1. **vSphere Client → Create/Register VM → Create a new virtual machine**

| Parámetro | Valor |
|---|---|
| Name | `ninjasec-db` |
| Compatibility | ESXi 6.5+ (o tu versión) |
| Guest OS Family | Linux |
| Guest OS Version | Ubuntu Linux (64-bit) |
| Storage | Tu datastore SSD (mínimo 60GB libres) |
| CPU | 2 vCPUs · 1 core per socket |
| Memory | 4 GB · Reserve all guest memory ☑ |
| Hard disk | 60 GB · Thin Provision |
| **Network Adapter** | **`PG-VLAN30-DC`** ⚠️ crítico |
| CD/DVD | Datastore ISO file → subir `ubuntu-22.04-live-server-amd64.iso` |

2. Power on la VM y abrir consola

3. **Instalación Ubuntu Server 22.04:**
   - Network configuration: **Set IP manually**
     - Subnet: `172.16.30.0/24`
     - Address: `172.16.30.5`
     - Gateway: `172.16.30.1` (VIP de pfSense para VLAN30)
     - DNS: `1.1.1.1, 8.8.8.8`
   - Profile setup:
     - Server name: `ninjasec-db`
     - Username: `ninja` (NO usar root)
     - Password: (uno fuerte, guardarlo en password manager)
   - SSH Setup: **Install OpenSSH server** ☑
   - Featured Server Snaps: ninguno
4. Reboot

5. Verificar conectividad desde tu PC Admin (VLAN10):
   ```bash
   ssh ninja@172.16.30.5
   ```

## 2.2.2 VM `ninjasec-web`

Repetir el mismo proceso con estos parámetros:

| Parámetro | Valor |
|---|---|
| Name | `ninjasec-web` |
| CPU | 4 vCPUs |
| Memory | 8 GB |
| Hard disk | 80 GB Thin Provision |
| **Network Adapter** | **`PG-VLAN20-DMZ`** ⚠️ |

**Instalación Ubuntu:**
- IP: `192.168.10.4`
- Gateway: `192.168.10.1` (VIP pfSense VLAN20)
- DNS: `1.1.1.1, 8.8.8.8`
- Hostname: `ninjasec-web`
- Username: `ninja`
- SSH Server ☑

Verificar:
```bash
ssh ninja@192.168.10.4
```

## 2.2.3 Snapshot inicial limpio

En **ambas VMs** (después de instalar Ubuntu, antes de configurar nada):

1. vSphere → click derecho VM → **Snapshots → Take Snapshot**
2. Nombre: `clean-ubuntu-2204` · Description: `OS recién instalado, sin servicios`
3. Memory snapshot: OFF (ahorra espacio)

Esto te permite rollback completo si algo sale mal en provisioning.

---

# 🔧 FASE 2.3 — Provisionar VM `ninjasec-db` (PostgreSQL)

> SSH desde Admin: `ssh ninja@172.16.30.5`
> **Tiempo:** 25 min

## 2.3.1 Sistema base

```bash
# Actualizar
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ufw fail2ban unattended-upgrades htop vim

# Auto-updates de seguridad
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Firewall: solo SSH desde Admin + Postgres desde DMZ
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 comment "SSH desde VLAN10 Admin"
sudo ufw allow from 192.168.10.4 to any port 5432 comment "Postgres desde NinjaSec web"
sudo ufw enable

# Fail2ban
sudo systemctl enable --now fail2ban
sudo systemctl status fail2ban
```

## 2.3.2 Instalar PostgreSQL 16 (repo oficial)

```bash
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update && sudo apt install -y postgresql-16
sudo systemctl enable --now postgresql
```

## 2.3.3 Configurar acceso desde DMZ

**Editar `/etc/postgresql/16/main/postgresql.conf`:**

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
# Buscar y cambiar:
#   listen_addresses = 'localhost'
# Por:
#   listen_addresses = '172.16.30.5'
```

**Editar `/etc/postgresql/16/main/pg_hba.conf` (agregar AL FINAL):**

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Agregar al final:
# NinjaSec backend desde DMZ VM
host  ninjasec  ninjasec_app  192.168.10.4/32  scram-sha-256
```

## 2.3.4 Crear usuario + DB

```bash
# Generar password fuerte
PG_PASS=$(openssl rand -base64 24 | tr -d '\n=+/' | head -c 24)
echo "⚠️ GUARDAR ESTE PASSWORD: $PG_PASS"
# Pegalo en tu password manager AHORA. Lo vas a necesitar para .env en VM web.

sudo -u postgres psql <<EOF
CREATE USER ninjasec_app WITH PASSWORD '${PG_PASS}';
CREATE DATABASE ninjasec OWNER ninjasec_app;
EOF

sudo systemctl restart postgresql
```

## 2.3.5 Test desde la VM Web (cuando esté lista)

```bash
# Desde 192.168.10.4:
psql -h 172.16.30.5 -U ninjasec_app -d ninjasec -c "SELECT version();"
# Te pide password → si responde con la versión = todo OK
```

## 2.3.6 Backups automáticos

```bash
sudo mkdir -p /var/backups/ninjasec

sudo tee /etc/cron.d/ninjasec-backup > /dev/null <<'EOF'
# Backup diario PostgreSQL ninjasec a las 03:15
15 3 * * * postgres pg_dump -Fc ninjasec > /var/backups/ninjasec/ninjasec_$(date +\%Y\%m\%d).dump
# Rotar: borrar dumps > 14 días
30 3 * * * postgres find /var/backups/ninjasec -name "*.dump" -mtime +14 -delete
EOF

sudo chown postgres:postgres /var/backups/ninjasec
```

## 2.3.7 Snapshot post-configuración

vSphere → snapshot de `ninjasec-db` → nombre: `pg16-configured`

---

# 🌐 FASE 2.4 — Provisionar VM `ninjasec-web` (Docker + Caddy)

> SSH desde Admin: `ssh ninja@192.168.10.4`
> **Tiempo:** 30 min

## 2.4.1 Sistema base

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ufw fail2ban git ca-certificates unattended-upgrades htop vim

# Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 comment "SSH desde Admin"
sudo ufw allow 80/tcp comment "Caddy HTTP"
sudo ufw allow 443/tcp comment "Caddy HTTPS"
sudo ufw allow 443/udp comment "Caddy HTTP/3"
sudo ufw enable

sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## 2.4.2 Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Logout/login para que tome el grupo
exit  # ← cerrar SSH y volver a entrar
```

```bash
# Volver a SSH
ssh ninja@192.168.10.4
docker --version  # debería responder
docker compose version  # debería responder
```

## 2.4.3 Crear usuario `ninjadeploy` (lo usará GitHub Actions)

```bash
sudo adduser --disabled-password --gecos "" ninjadeploy
sudo usermod -aG docker ninjadeploy

# Carpeta deploy
sudo mkdir -p /opt/ninjasec
sudo chown ninjadeploy:ninjadeploy /opt/ninjasec
```

## 2.4.4 Generar SSH key para GitHub Actions

**En tu PC local (NO en el server), generá una key dedicada:**

```bash
ssh-keygen -t ed25519 -C "github-actions-ninjasec" -f ~/.ssh/ninjasec_deploy
# NO ponerle passphrase (GitHub Actions no puede interactuar)
```

Esto crea 2 archivos:
- `~/.ssh/ninjasec_deploy` (privada — va en GitHub Secret)
- `~/.ssh/ninjasec_deploy.pub` (pública — va al server)

**Copiar la pubkey al server:**

```bash
ssh-copy-id -i ~/.ssh/ninjasec_deploy.pub ninjadeploy@192.168.10.4
# (Te pide password de ninjadeploy. Si no tiene password todavía, mejor hacer:)
# sudo cat ~/.ssh/ninjasec_deploy.pub | ssh ninja@192.168.10.4 "sudo tee -a /home/ninjadeploy/.ssh/authorized_keys"
```

**Hardening del usuario `ninjadeploy` (no permite shell, solo deploy):**

```bash
# Como ninja:
sudo mkdir -p /home/ninjadeploy/.ssh
sudo chown ninjadeploy:ninjadeploy /home/ninjadeploy/.ssh
sudo chmod 700 /home/ninjadeploy/.ssh
# Asegurarse que authorized_keys está bien
sudo chmod 600 /home/ninjadeploy/.ssh/authorized_keys
sudo chown ninjadeploy:ninjadeploy /home/ninjadeploy/.ssh/authorized_keys
```

## 2.4.5 Clonar el repo

```bash
sudo -u ninjadeploy git clone https://github.com/marksato13/PY_NINJASEC.git /opt/ninjasec
cd /opt/ninjasec/infra
sudo -u ninjadeploy cp ../.env.example .env
```

## 2.4.6 Configurar `.env` de producción

```bash
sudo -u ninjadeploy nano /opt/ninjasec/infra/.env
```

Pegar (reemplazando los valores marcados):

```bash
# PostgreSQL — apunta a la VM DC
POSTGRES_DB=ninjasec
POSTGRES_USER=ninjasec_app
POSTGRES_PASSWORD=<EL_PASSWORD_DE_FASE_2.3.4>
POSTGRES_HOST=172.16.30.5
POSTGRES_PORT=5432

# Backend
APP_NAME=NinjaSec
APP_VERSION=0.2.0
API_PREFIX=/api/v1
JWT_SECRET_KEY=<GENERAR_CON: openssl rand -base64 64 | tr -d '\n'>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=https://ninjasec.duckdns.org
SEED_ON_STARTUP=false
IS_PRODUCTION=true

# Frontend
NEXT_PUBLIC_API_URL=/api/v1
BACKEND_INTERNAL_URL=http://backend:8024

# Producción
DOMAIN=ninjasec.duckdns.org
DUCKDNS_TOKEN=<DE FASE 2.6>
ACME_EMAIL=tu-email@gmail.com
```

## 2.4.7 Comentar bloque postgres en `docker-compose.prod.yml`

Como PostgreSQL corre en otra VM, hay que comentar el servicio del compose:

```bash
sudo -u ninjadeploy nano /opt/ninjasec/infra/docker-compose.prod.yml
```

Comentar las líneas del servicio `postgres:` (~líneas 28-50). Dejar solo `caddy:`, `backend:`, `frontend:`.

---

# 🔒 FASE 2.5 — Reglas en pfSense (MASTER se replica a BACKUP)

> **Donde:** webGUI pfSense-A (https://192.168.1.2)
> **Tiempo:** 20 min

## 2.5.1 NAT Port Forward (Firewall → NAT → Port Forward)

**Regla 1 — HTTPS:**
- Interface: `WAN1` (Claro)
- Protocol: `TCP`
- Destination: `WAN1 address`
- Destination port: `443`
- Redirect target IP: `192.168.10.4`
- Redirect target port: `443`
- Description: `NinjaSec HTTPS desde ISP1`

**Regla 2 — HTTP (Caddy lo redirige a HTTPS):**
- Igual que la 1 pero `port 80`

**Regla 3 y 4 — Failover ISP2:**
- Igual que 1 y 2 pero Interface = `WAN2` (Movistar)

> ⚠️ pfSense automáticamente crea reglas Firewall asociadas. Verificar que estén OK.

## 2.5.2 Firewall — VLAN20 DMZ (Firewall → Rules → VLAN20)

Orden importante. Top a bottom:

| # | Action | Source | Dest | Port | Descripción |
|---|---|---|---|---|---|
| 1 | PASS | 192.168.10.4 | 172.16.30.5 | TCP/5432 | NinjaSec → Postgres DC |
| 2 | PASS | 192.168.10.4 | any | TCP/443 | Let's Encrypt + Docker Hub + GitHub |
| 3 | PASS | 192.168.10.4 | any | UDP/53 | DNS |
| 4 | PASS | 192.168.10.4 | any | TCP/80 | Let's Encrypt challenge |
| 5 | PASS | 192.168.10.4 | any | TCP/22 | git pull desde GitHub |
| 6 | PASS | 192.168.10.4 | 1.1.1.1 | * | DNS Cloudflare |
| 7 | PASS | 192.168.10.4 | 8.8.8.8 | * | DNS Google |
| 8 | BLOCK | VLAN20 net | VLAN10 net | * | DMZ NO accede Admin |
| 9 | BLOCK | VLAN20 net | VLAN40 net | * | DMZ NO accede VoIP |
| 10 | BLOCK | VLAN20 net | VLAN30 net | * | DMZ NO accede DC excepto regla 1 |

## 2.5.3 Firewall — VLAN10 Admin

Asegurar que Admin puede SSH al server DMZ y DC:

| # | Action | Source | Dest | Port |
|---|---|---|---|---|
| 1 | PASS | VLAN10 net | 192.168.10.4 | TCP/22 |
| 2 | PASS | VLAN10 net | 172.16.30.5 | TCP/22 |

## 2.5.4 Verificar replicación a BACKUP

System → High Availability Sync → verificar que **pfSync** y **XMLRPC Sync** estén activos. Las reglas deben aparecer en pfSense-B automáticamente.

---

# 🦆 FASE 2.6 — Configurar DuckDNS

> **Tiempo:** 10 min

## 2.6.1 Registrar dominio

1. Ir a https://www.duckdns.org
2. Login con Google/GitHub
3. En "domains", escribir `ninjasec` → click **add domain**
4. Te queda: `ninjasec.duckdns.org`
5. **Copiar el TOKEN** (arriba a la izquierda) — lo vas a usar para auto-update

## 2.6.2 Auto-update de IP (cron en VM web)

```bash
ssh ninja@192.168.10.4

# Pegar el token + dominio
DUCK_TOKEN="<EL_TOKEN_DE_DUCKDNS>"

sudo tee /etc/cron.d/duckdns > /dev/null <<EOF
*/5 * * * * root curl -s "https://www.duckdns.org/update?domains=ninjasec&token=${DUCK_TOKEN}&ip=" > /var/log/duckdns.log 2>&1
EOF

# Test manual
curl "https://www.duckdns.org/update?domains=ninjasec&token=${DUCK_TOKEN}&ip="
# Esperado: OK
```

## 2.6.3 Verificar propagación

```bash
# Desde tu PC:
nslookup ninjasec.duckdns.org
# Debería resolver a tu IP pública de WAN1 o WAN2

dig ninjasec.duckdns.org +short
```

---

# 🚢 FASE 2.7 — Primer deploy MANUAL

> **Tiempo:** 20 min

## 2.7.1 Build + up

```bash
ssh ninjadeploy@192.168.10.4
cd /opt/ninjasec/infra

# Levantar el stack
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# Esperar 1-2 min para que Caddy obtenga el cert Let's Encrypt
docker compose -f docker-compose.prod.yml logs caddy --tail 30
# Buscar líneas tipo: "obtained certificate for ninjasec.duckdns.org"
```

## 2.7.2 Aplicar migraciones a Postgres remoto

```bash
docker exec ninjasec-backend bash -c "cd /app && PYTHONPATH=/app alembic upgrade head"
```

## 2.7.3 Cargar usuarios iniciales (SEED solo primera vez)

```bash
docker exec ninjasec-backend python -c "
from app.db.session import SessionLocal
from app.db.seed import seed_initial_data
with SessionLocal() as db:
    seed_initial_data(db)
print('Seed inicial OK')
"
```

(Opcional) Cargar data demo peruana realista:
```bash
docker cp /opt/ninjasec/backend/seed_demo.py ninjasec-backend:/app/seed_demo.py
docker exec ninjasec-backend python /app/seed_demo.py
```

## 2.7.4 Smoke tests

```bash
# Desde el server:
curl -k https://localhost/health
# Esperado: ok

# Desde tu PC (cualquier red con DNS público):
curl https://ninjasec.duckdns.org/health
# Esperado: ok (200 OK con cert válido)
```

**En el browser:** https://ninjasec.duckdns.org

- 🟢 Candado verde de HTTPS (Let's Encrypt funciona)
- 🦝 Landing con Kuro
- Login: `admin@ninjasec.local` / `change-me` (cambialo en `/dashboard/users`)

## 2.7.5 Snapshot post-deploy

vSphere → snapshot de `ninjasec-web` → nombre: `first-deploy-ok`

---

# 🤖 FASE 2.8 — Configurar CI/CD (GitHub Actions auto-deploy)

> **Tiempo:** 30 min

## 2.8.1 Agregar secrets en GitHub

Ir a **https://github.com/marksato13/PY_NINJASEC/settings/secrets/actions**

Crear estos secrets:

| Secret name | Valor |
|---|---|
| `DEPLOY_SSH_KEY` | Contenido de `~/.ssh/ninjasec_deploy` (la privada — todo, incluyendo `-----BEGIN...-----` y `-----END...-----`) |
| `DEPLOY_HOST` | IP pública de pfSense WAN1 (donde está NAT 22→192.168.10.4) o un dominio que apunte ahí |
| `DEPLOY_USER` | `ninjadeploy` |
| `DEPLOY_PORT` | `22` (o el que uses) |

> ⚠️ **Importante:** para que GitHub Actions pueda SSH al server, necesitás:
> - **Opción A (más fácil pero más expuesta):** NAT 22 público → 192.168.10.4:22 con regla pfSense que permita solo IPs de GitHub Actions
> - **Opción B (más segura, recomendada):** WireGuard o Tailscale entre GitHub runner y el server. Más config pero más seguro.
> - **Opción C (intermedia):** Self-hosted runner en una VM en VLAN20. GitHub Actions corre adentro de tu red, no hace falta abrir SSH al público.

## 2.8.2 Crear workflow `.github/workflows/deploy.yml`

(Lo creo yo en el repo en el siguiente paso — solo lo describo aquí)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:  # botón manual

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.DEPLOY_SSH_KEY }}

      - name: Add known hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -p ${{ secrets.DEPLOY_PORT }} ${{ secrets.DEPLOY_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy
        run: |
          ssh -p ${{ secrets.DEPLOY_PORT }} ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} <<'EOF'
            set -e
            cd /opt/ninjasec
            git fetch origin main
            git reset --hard origin/main
            cd infra
            docker compose -f docker-compose.prod.yml --env-file .env up -d --build
            docker exec ninjasec-backend bash -c "cd /app && PYTHONPATH=/app alembic upgrade head"
            docker image prune -f
          EOF
```

## 2.8.3 Probar el flujo

```bash
# En tu PC local, en el repo
echo "# Test deploy $(date)" >> README.md
git add README.md
git commit -m "test: trigger deploy"
git push origin main
```

Ir a https://github.com/marksato13/PY_NINJASEC/actions → ver el workflow corriendo.

Esperado:
- ✅ Checkout
- ✅ SSH setup
- ✅ Deploy
- ✅ Verificación en https://ninjasec.duckdns.org

---

# 📊 FASE 2.9 — Hardening y monitoreo final

## 2.9.1 Cambiar passwords seed

Loguear en https://ninjasec.duckdns.org con `admin@ninjasec.local`/`change-me`:
1. Ir a `/dashboard/users`
2. Editar cada usuario → cambiar password
3. Crear tu usuario admin real (sacar `admin@ninjasec.local` si querés)

## 2.9.2 Cerrar Swagger en producción

En el `.env` de la VM web ya está `IS_PRODUCTION=true`. Verificar que `/docs` retorne 404:
```bash
curl https://ninjasec.duckdns.org/docs
# Esperado: 404 (en producción Swagger está deshabilitado)
```

## 2.9.3 Instalar Netdata (monitoreo simple)

```bash
# En ambas VMs
bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait
# Dashboard en https://192.168.10.4:19999 (solo accesible desde VLAN10)
```

## 2.9.4 Configurar log shipping a Suricata (opcional)

Si tu Suricata IDS está en VLAN30 escuchando syslog:
```bash
# En ambas VMs
sudo nano /etc/rsyslog.conf
# Agregar al final:
# *.* @@172.16.30.X:514

sudo systemctl restart rsyslog
```

---

# 📅 Snapshots VMware ESXi automatizados

vSphere → VM → Schedule Tasks → **Create Snapshot**

| VM | Frecuencia | Retención |
|---|---|---|
| `ninjasec-web` | Semanal (domingos 04:00) | 4 snapshots |
| `ninjasec-db` | Diario (04:00) | 7 snapshots |

> 💡 Snapshots consumen disk del datastore. Monitorear espacio.

---

# 🆘 Troubleshooting común

| Síntoma | Causa probable | Solución |
|---|---|---|
| Caddy no obtiene cert Let's Encrypt | NAT 80/443 mal, DuckDNS no apunta a IP correcta | `dig ninjasec.duckdns.org`, ver `docker logs ninjasec-caddy` |
| Backend no conecta a Postgres | pg_hba.conf, firewall pfSense, password en .env | `psql -h 172.16.30.5 -U ninjasec_app -d ninjasec` desde la web VM |
| 502 Bad Gateway | Container backend/frontend caído | `docker compose -f docker-compose.prod.yml ps` |
| GitHub Actions falla "Connection refused" | NAT 22 no abierto, IP cambió | Revisar pfSense NAT, hacer `ssh manual` para diagnosticar |
| Disco VM lleno por logs/snapshots | Snapshots viejos no rotados | `df -h`, vSphere snapshot manager |

---

# 📞 Comandos útiles post-deploy

```bash
# Logs en vivo
ssh ninjadeploy@<IP> "docker compose -f /opt/ninjasec/infra/docker-compose.prod.yml logs -f"

# Restart de un servicio
ssh ninjadeploy@<IP> "docker compose -f /opt/ninjasec/infra/docker-compose.prod.yml restart backend"

# Forzar redeploy ahora
gh workflow run deploy.yml --repo marksato13/PY_NINJASEC

# Ver estado containers
ssh ninjadeploy@<IP> "docker compose -f /opt/ninjasec/infra/docker-compose.prod.yml ps"

# Backup manual ad-hoc
ssh ninja@172.16.30.5 "sudo -u postgres pg_dump -Fc ninjasec > /tmp/manual_$(date +%Y%m%d_%H%M).dump"
```

---

# ✅ Checklist final pre-go-live

- [ ] VMs creadas con VLAN tags correctos en ESXi
- [ ] PostgreSQL en VLAN30 escuchando solo en 172.16.30.5
- [ ] Firewall ufw activo en ambas VMs
- [ ] pg_hba.conf solo acepta `192.168.10.4/32`
- [ ] Caddy obtuvo cert válido Let's Encrypt
- [ ] DuckDNS auto-updating IP cada 5 min
- [ ] pfSense NAT 80/443 funcional, firewall DMZ→DC:5432 ALLOW
- [ ] Passwords seed cambiados después del primer login
- [ ] `IS_PRODUCTION=true` y `/docs` retorna 404
- [ ] GitHub Actions workflow funciona (push → deploy automático)
- [ ] Backups Postgres diarios ejecutándose (`/var/backups/ninjasec/`)
- [ ] Snapshots ESXi configurados
- [ ] Netdata corriendo en ambas VMs (opcional pero útil)
- [ ] fail2ban activo en ambas VMs

---

## 🎉 Cuando todos los checks estén verdes, estás en producción.

**Para preguntas o issues:** repo GitHub Issues o ver `CLAUDE.md`.
