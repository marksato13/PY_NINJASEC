# 🔧 FASE 2.3 — Provisionar VM `ninjasec-db` (PostgreSQL 16)

> **Pre-requisito:** haber aplicado [CHECKLIST-FIREWALL-PRE-FASE-2.3.md](./CHECKLIST-FIREWALL-PRE-FASE-2.3.md) y validado las 8 pruebas end-to-end.
>
> **SSH desde Admin:** `ssh ninja@192.168.30.100`
> **Tiempo estimado:** ~30 min
> **Fecha de revisión:** 2026-05-27

---

## Topología asumida

| Componente            | IP                  | Rol                              |
| --------------------- | ------------------- | -------------------------------- |
| Admin LAN             | `192.168.1.0/24`    | Tu laptop / red de gestión       |
| Web (DMZ)             | `192.168.20.100`    | VM `ninjasec-web` (FASE 2.2)     |
| **DB (Datacenter)**   | **`192.168.30.100`**| **VM `ninjasec-db` (esta fase)** |
| Gateway pfSense (DC)  | `192.168.30.1`      | DNS + ruteo                      |

---

## 2.3.1 Sistema base + UFW

```bash
# Actualizar
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ufw fail2ban unattended-upgrades htop vim

# Auto-updates de seguridad
sudo dpkg-reconfigure --priority=low unattended-upgrades

# UFW: segunda capa defensiva (pfSense ya filtra antes)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24  to any port 22   comment "SSH desde Admin"
sudo ufw allow from 192.168.1.0/24  to any port 5432 comment "psql desde Admin"
sudo ufw allow from 192.168.20.100  to any port 5432 comment "Postgres desde web DMZ"
sudo ufw enable

# Fail2ban (jail sshd por defecto)
sudo systemctl enable --now fail2ban
sudo systemctl status fail2ban --no-pager
```

### ✅ Checkpoint
- `sudo ufw status numbered` muestra 3 reglas Allow + default deny.
- `sudo systemctl is-active fail2ban` → `active`.

---

## 2.3.1b SSH hardening

> **Antes de ejecutar:** subí tu clave pública a `~ninja/.ssh/authorized_keys` y probá que el login por clave funciona (`ssh ninja@192.168.30.100`). Si no, te quedás afuera.

```bash
sudo tee /etc/ssh/sshd_config.d/99-ninjasec.conf > /dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
AllowUsers ninja
EOF

sudo sshd -t && sudo systemctl restart ssh
```

### ✅ Checkpoint
- `sudo sshd -t` no devuelve nada (config válida).
- Abrí **otra terminal** y probá `ssh ninja@192.168.30.100` antes de cerrar la actual.

---

## 2.3.2 Instalar PostgreSQL 16 desde repo oficial PGDG

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

### ✅ Checkpoint
- `psql --version` → `psql (PostgreSQL) 16.x`
- `sudo systemctl is-active postgresql` → `active`.

---

## 2.3.3 Configurar acceso desde DMZ y Admin

### Editar `postgresql.conf`

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Buscar y reemplazar:

```conf
# ANTES:
#listen_addresses = 'localhost'

# DESPUÉS:
listen_addresses = 'localhost, 192.168.30.100'
```

> Manteniendo `localhost` para que backups locales y `psql` desde la propia VM sigan funcionando.

### Editar `pg_hba.conf`

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Agregar al final del archivo:

```conf
# === NinjaSec ===
# Backend web desde DMZ
host  ninjasec  ninjasec_app  192.168.20.100/32  scram-sha-256
# Admin para gestión (psql / pgAdmin / DBeaver desde LAN)
host  ninjasec  ninjasec_app  192.168.1.0/24     scram-sha-256
```

> No reiniciar todavía: el restart se hace tras crear el usuario en 2.3.4.

---

## 2.3.4 Crear usuario + DB con password seguro

```bash
# Password fuerte. NO se imprime en pantalla ni queda en history.
PG_PASS=$(openssl rand -base64 24 | tr -d '\n=+/' | head -c 24)

# Persistir en archivo protegido para copiarlo al password manager
printf '%s\n' "$PG_PASS" | sudo tee /root/.ninjasec-db-pass > /dev/null
sudo chmod 600 /root/.ninjasec-db-pass

echo "⚠️  Password guardada en /root/.ninjasec-db-pass"
echo "    Copiala a tu password manager AHORA y luego borrá el archivo:"
echo "    sudo shred -u /root/.ninjasec-db-pass"

# Crear usuario + DB
sudo -u postgres psql <<EOF
CREATE USER ninjasec_app WITH PASSWORD '${PG_PASS}';
CREATE DATABASE ninjasec OWNER ninjasec_app;
EOF

# Limpiar variable del shell actual
unset PG_PASS

# Aplicar cambios de postgresql.conf + pg_hba.conf
sudo systemctl restart postgresql
sudo systemctl status postgresql --no-pager
```

### ✅ Checkpoint
- `sudo systemctl is-active postgresql` → `active` tras restart.
- `sudo -u postgres psql -c "\du"` lista `ninjasec_app`.
- `sudo -u postgres psql -c "\l"` lista `ninjasec` con owner `ninjasec_app`.

---

## 2.3.5 Test de conectividad (3 rutas)

Validan que **pfSense + UFW + pg_hba** están alineados.

### 1️⃣ Desde la propia DB (sanity local)

```bash
sudo -u postgres psql -d ninjasec -c "SELECT version();"
```

### 2️⃣ Desde Admin (tu laptop, 192.168.1.x)

```bash
psql "host=192.168.30.100 port=5432 dbname=ninjasec user=ninjasec_app sslmode=prefer" \
  -c "SELECT version();"
# Pide password → pegá el de /root/.ninjasec-db-pass
```

### 3️⃣ Desde la VM Web (192.168.20.100) — cuando esté lista

```bash
psql "host=192.168.30.100 port=5432 dbname=ninjasec user=ninjasec_app sslmode=prefer" \
  -c "SELECT version();"
```

### ✅ Checkpoint
Los 3 comandos deben devolver la versión de PostgreSQL. Si alguno falla:

| Error                                            | Mirar primero                                          |
| ------------------------------------------------ | ------------------------------------------------------ |
| `Connection timed out`                           | pfSense: `Status → System Logs → Firewall` (filtrar)   |
| `Connection refused`                             | UFW (`sudo ufw status numbered`) o `listen_addresses`  |
| `no pg_hba.conf entry for host …`                | Línea correspondiente en `pg_hba.conf`                 |
| `password authentication failed`                 | El password (¿lo copiaste mal del archivo?)            |

---

## 2.3.6 Backups automáticos diarios

```bash
sudo mkdir -p /var/backups/ninjasec
sudo chown postgres:postgres /var/backups/ninjasec
sudo chmod 750 /var/backups/ninjasec

sudo tee /etc/cron.d/ninjasec-backup > /dev/null <<'EOF'
# Backup diario PostgreSQL ninjasec a las 03:15
15 3 * * * postgres pg_dump -Fc ninjasec > /var/backups/ninjasec/ninjasec_$(date +\%Y\%m\%d).dump
# Rotar: borrar dumps > 14 días
30 3 * * * postgres find /var/backups/ninjasec -name "*.dump" -mtime +14 -delete
EOF
```

### Validar a mano (no esperes hasta mañana)

```bash
sudo -u postgres pg_dump -Fc ninjasec > /tmp/test.dump
ls -lh /tmp/test.dump
# Debe pesar al menos unos KB
rm /tmp/test.dump
```

### ✅ Checkpoint
- `cat /etc/cron.d/ninjasec-backup` muestra las 2 líneas.
- El `pg_dump` manual genera el archivo sin errores.
- (Mañana) verificar que apareció `ninjasec_<fecha>.dump` en `/var/backups/ninjasec/`.

---

## 2.3.7 Snapshot vSphere

**Solo después** de que los 3 tests del 2.3.5 hayan pasado y el `pg_dump` manual haya funcionado.

```
vSphere → ninjasec-db → Take Snapshot
Nombre:      pg16-configured
Descripción: PostgreSQL 16 instalado, ninjasec_app + DB ninjasec creados,
             pg_hba para DMZ + Admin, UFW activo, fail2ban activo,
             SSH password-auth OFF, backups cron OK
Memory:      no necesario
Quiesce:     sí (si las VMware Tools están instaladas)
```

---

## 2.3.8 Borrar el password en claro

Una vez que copiaste el password al password manager y confirmaste que conectás bien desde admin/web:

```bash
sudo shred -u /root/.ninjasec-db-pass
ls /root/.ninjasec-db-pass 2>&1  # debe decir "No such file or directory"
```

---

## Checklist final FASE 2.3

- [ ] `apt upgrade` aplicado y `unattended-upgrades` configurado
- [ ] UFW activo con 3 reglas Allow
- [ ] `fail2ban` activo
- [ ] SSH: password-auth OFF, root-login OFF, sólo usuario `ninja`
- [ ] PostgreSQL 16 instalado desde repo PGDG, `systemctl active`
- [ ] `listen_addresses = 'localhost, 192.168.30.100'`
- [ ] `pg_hba.conf` con líneas para DMZ web (`192.168.20.100/32`) y Admin (`192.168.1.0/24`)
- [ ] Usuario `ninjasec_app` y DB `ninjasec` creados
- [ ] 3 tests de `SELECT version()` OK (local + admin + web)
- [ ] `pg_dump` manual exitoso
- [ ] Cron de backup + rotación configurado
- [ ] Snapshot `pg16-configured` tomado
- [ ] Password en password manager y `/root/.ninjasec-db-pass` borrado

---

## Notas para hardening posterior (NO FASE 2.3)

> Estos puntos NO bloquean avanzar, pero anotalos para una iteración siguiente:

- **fail2ban jail para PostgreSQL** (`/var/log/postgresql/postgresql-16-main.log` + filtro auth-failure).
- **TLS para Postgres** (`ssl = on`, certificado propio o letsencrypt interno) y forzar `sslmode=require` en clientes.
- **Backups off-site** (rsync a un NAS o S3-compatible externo, no sólo en el mismo disco).
- **Monitoring**: exporter de Postgres + Prometheus/Grafana cuando exista la VM de observabilidad.
- **Restore drill mensual**: validar que un dump del cron realmente se puede restaurar en una VM limpia.
