# 🚀 NinjaSec — Guía de Despliegue en Producción

Despliegue en arquitectura con pfSense HA (CARP), múltiples ISPs y VLANs segmentadas.

```
Internet (ISP1 Claro + ISP2 Movistar — failover)
    │
    ▼
CARP VIP 192.168.1.1 (pfSense-A MASTER + pfSense-B BACKUP)
    │
TRUNK 802.1Q
    │
    ├── VLAN10 Admin (192.168.1.0/24)   — PC Admin, Kali (NO NinjaSec)
    ├── VLAN20 DMZ   (192.168.10.0/24)  — WAF, Web, NinjaSec frontend+backend
    ├── VLAN30 DC    (172.16.30.0/24)   — File srv, Asterisk, PostgreSQL NinjaSec
    └── VLAN40 VoIP  (172.16.40.0/24)   — Phones
```

---

## 📋 Prerrequisitos

| Componente | Detalle |
|---|---|
| Server VLAN20 DMZ | IP estática `192.168.10.4` · Ubuntu 22.04+ · 4 vCPU · 8GB RAM · 80GB SSD |
| Server VLAN30 DC | IP estática `172.16.30.5` · Ubuntu 22.04+ · 2 vCPU · 4GB RAM · 60GB SSD (solo Postgres) |
| DNS | Subdominio gratis ([DuckDNS](https://www.duckdns.org)) o dominio comprado |
| Acceso pfSense | Web admin de pfSense-A MASTER (se replica a BACKUP) |

---

## 🅰️ Fase 1 — Servidor PostgreSQL en VLAN30 DC

Server: `172.16.30.5` · Solo recibe conexiones desde `192.168.10.4` (DMZ backend).

### 1.1 Sistema base

```bash
# Actualizaciones
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ufw fail2ban

# Firewall: solo SSH desde Admin (VLAN10) + Postgres desde DMZ
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22
sudo ufw allow from 192.168.10.4 to any port 5432
sudo ufw enable
```

### 1.2 PostgreSQL 16

```bash
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update && sudo apt install -y postgresql-16
```

### 1.3 Configurar acceso desde DMZ

Editar `/etc/postgresql/16/main/postgresql.conf`:
```
listen_addresses = '172.16.30.5'
```

Editar `/etc/postgresql/16/main/pg_hba.conf` (agregar al final):
```
# NinjaSec backend desde DMZ
hostssl  ninjasec  ninjasec_app  192.168.10.4/32  scram-sha-256
```

```bash
# Crear usuario y DB (password generado con: openssl rand -base64 24)
sudo -u postgres psql <<EOF
CREATE USER ninjasec_app WITH PASSWORD 'PEGAR_PASSWORD_AQUI';
CREATE DATABASE ninjasec OWNER ninjasec_app;
EOF

sudo systemctl restart postgresql
```

### 1.4 Backups automáticos (cron diario)

```bash
sudo mkdir -p /var/backups/ninjasec
sudo tee /etc/cron.daily/ninjasec-backup > /dev/null <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sudo -u postgres pg_dump -Fc ninjasec > /var/backups/ninjasec/ninjasec_${DATE}.dump
# Retener 7 días
find /var/backups/ninjasec -name "*.dump" -mtime +7 -delete
EOF
sudo chmod +x /etc/cron.daily/ninjasec-backup
```

---

## 🅱️ Fase 2 — Reglas pfSense

En pfSense-A MASTER (se sincroniza a BACKUP automáticamente vía XMLRPC).

### 2.1 NAT Port Forward

| Interface | Proto | Source | Dst Port | Redirect Target | Redirect Port | Descripción |
|---|---|---|---|---|---|---|
| WAN1 (Claro) | TCP | any | 443 | 192.168.10.4 | 443 | NinjaSec HTTPS |
| WAN1 (Claro) | TCP | any | 80 | 192.168.10.4 | 80 | NinjaSec HTTP (redirect a HTTPS) |
| WAN2 (Movistar) | TCP | any | 443 | 192.168.10.4 | 443 | Failover ISP2 |
| WAN2 (Movistar) | TCP | any | 80 | 192.168.10.4 | 80 | Failover ISP2 |

### 2.2 Firewall Rules

**VLAN20 DMZ tab:**

| Action | Source | Dest | Port | Descripción |
|---|---|---|---|---|
| PASS | 192.168.10.4 | 172.16.30.5 | 5432 | NinjaSec backend → Postgres DC |
| BLOCK | 192.168.10.0/24 | 192.168.1.0/24 | any | DMZ NO accede a Admin |
| BLOCK | 192.168.10.0/24 | 172.16.40.0/24 | any | DMZ NO accede a VoIP |
| PASS | any | any | * | Permitir salida a Internet |

**VLAN10 Admin tab (acceso al server desde admin):**

| Action | Source | Dest | Port |
|---|---|---|---|
| PASS | 192.168.1.0/24 | 192.168.10.4 | 22 |
| PASS | 192.168.1.0/24 | 172.16.30.5 | 22 |

---

## 🅲️ Fase 3 — Servidor NinjaSec en VLAN20 DMZ

Server: `192.168.10.4` · Ejecuta Caddy + Docker + Frontend + Backend.

### 3.1 Sistema base

```bash
# Actualizaciones
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ufw fail2ban git ca-certificates

# Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22  # SSH solo desde Admin
sudo ufw allow 80/tcp comment "Caddy HTTP (redirect)"
sudo ufw allow 443/tcp comment "Caddy HTTPS"
sudo ufw allow 443/udp comment "Caddy HTTP/3"
sudo ufw enable

# Fail2ban (anti brute-force SSH)
sudo systemctl enable --now fail2ban

# Actualizaciones automáticas de seguridad
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 3.2 Docker

```bash
# Docker Engine + Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# (relogin requerido para que tome el grupo)
```

### 3.3 DNS — DuckDNS (recomendado para empezar)

```bash
# 1. Registrar en https://www.duckdns.org (login con Google/GitHub)
# 2. Crear subdominio: "ninjasec" → te da "ninjasec.duckdns.org"
# 3. Apuntar a tu IP pública (Caddy actualizará después)

# 4. Auto-update IP cada 5 min (cron)
sudo tee /etc/cron.d/duckdns > /dev/null <<'EOF'
*/5 * * * * root curl -s "https://www.duckdns.org/update?domains=ninjasec&token=TU_TOKEN&ip=" > /dev/null
EOF
```

### 3.4 Desplegar NinjaSec

```bash
# 1. Clonar el repo
cd /opt
sudo git clone https://github.com/marksato13/PY_NINJASEC.git ninjasec
sudo chown -R $USER:$USER ninjasec
cd ninjasec/infra

# 2. Crear .env de producción
cp ../.env.example .env
nano .env
# Setear:
#   POSTGRES_HOST=172.16.30.5
#   POSTGRES_USER=ninjasec_app
#   POSTGRES_PASSWORD=<el del paso 1.3>
#   JWT_SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
#   ACCESS_TOKEN_EXPIRE_MINUTES=30
#   CORS_ORIGINS=https://ninjasec.duckdns.org
#   IS_PRODUCTION=true
#   SEED_ON_STARTUP=false
#   DOMAIN=ninjasec.duckdns.org
#   ACME_EMAIL=tu@email.com

# 3. Como Postgres está en VLAN30, COMENTAR el bloque `postgres:` en docker-compose.prod.yml
nano docker-compose.prod.yml
# Comentar las líneas del servicio postgres (líneas ~28-50 aprox)

# 4. Levantar
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# 5. Aplicar migraciones a la DB remota
docker exec ninjasec-backend bash -c "cd /app && PYTHONPATH=/app alembic upgrade head"

# 6. (Solo primera vez) Crear usuarios iniciales con seed
docker exec ninjasec-backend python -c "
from app.db.session import SessionLocal
from app.db.seed import seed_initial_data
with SessionLocal() as db:
    seed_initial_data(db)
"
```

### 3.5 Verificación

```bash
# Healthchecks
curl -k https://ninjasec.duckdns.org/health
# Esperado: "ok"

curl -k https://ninjasec.duckdns.org/api/v1/
# Esperado: JSON con módulos

# Logs en vivo
docker compose -f docker-compose.prod.yml logs -f
```

Abrir en navegador: `https://ninjasec.duckdns.org` → debería mostrar el landing con Kuro.

---

## 🛡️ Fase 4 — Hardening Post-Deploy

### 4.1 Cambiar passwords seed

Loguear con `admin@ninjasec.local` / `change-me`, ir a `/dashboard/users`, editar todos y rotar passwords. Después cambiar el del super_admin.

### 4.2 Deshabilitar Swagger en producción

`backend/app/main.py` — modificar:
```python
app = FastAPI(
    ...
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)
```

### 4.3 Habilitar log shipping a Suricata IDS

Si tenés Suricata en VLAN30 lo podés conectar para procesar logs de acceso de Caddy:
```bash
# En el server VLAN20
sudo tee -a /etc/rsyslog.conf > /dev/null <<'EOF'
*.* @@172.16.30.X:514  # Suricata syslog
EOF
sudo systemctl restart rsyslog
```

### 4.4 Monitoreo simple

```bash
# Instalar Netdata (dashboard de métricas)
bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait
# Acceder en https://192.168.10.4:19999 (solo desde VLAN10)
```

---

## 🆘 Troubleshooting

| Problema | Solución |
|---|---|
| Caddy no obtiene certificado Let's Encrypt | Verificar que 80/443 estén abiertos en pfSense y `DOMAIN` apunte a la IP correcta |
| Backend no conecta a Postgres | Verificar `pg_hba.conf` en VLAN30, regla pfSense DMZ→DC:5432, password correcto |
| 502 Bad Gateway desde Caddy | `docker logs ninjasec-frontend` y `ninjasec-backend` |
| Login funciona pero queda en "Cargando..." | Verificar que `CORS_ORIGINS` incluya el dominio exacto |

---

## 🔄 Updates posteriores

```bash
cd /opt/ninjasec
git pull
cd infra
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker exec ninjasec-backend bash -c "cd /app && PYTHONPATH=/app alembic upgrade head"
```

---

## 📞 Soporte

- Repo: https://github.com/marksato13/PY_NINJASEC
- Docs internas: `ARQUITECTURA/`, `docs/`
- Guía Claude Code: `CLAUDE.md`
