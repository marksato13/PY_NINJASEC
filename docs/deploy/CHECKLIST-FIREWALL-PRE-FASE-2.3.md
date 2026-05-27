# Checklist Firewall pfSense — Pre FASE 2.3 (ninjasec-db)

> **Objetivo:** dejar las reglas de pfSense correctas y endurecidas **antes** de provisionar la VM `ninjasec-db` (PostgreSQL en `192.168.30.100`), de modo que la primera prueba de conectividad valide la política definitiva.
>
> **Fecha de revisión:** 2026-05-27
> **Aplica a:** pfSense Community Edition — `192.168.1.2`

---

## 0. Principio clave de pfSense (no obvio)

En pfSense las reglas se evalúan al **tráfico que INGRESA por la interfaz**. Es decir, la pestaña de cada VLAN filtra paquetes cuyo **source** está en esa VLAN.

| Pestaña                | Filtra paquetes cuyo source es | NO sirve para filtrar    |
| ---------------------- | ------------------------------ | ------------------------ |
| `VLAN10_LAN`           | `192.168.1.0/24`               | Tráfico *hacia* LAN      |
| `VLAN20_DMZ`           | `192.168.20.0/24`              | Tráfico *hacia* DMZ      |
| `VLAN30_DATACENTER`    | `192.168.30.0/24`              | Tráfico *hacia* DC       |
| `VLAN40_VOZIP`         | `192.168.40.0/24`              | Tráfico *hacia* VoIP     |

> ⚠️ Cualquier regla cuyo source NO coincida con la red de la pestaña en la que está, es **decoración**: no permite ni bloquea nada.

---

## 1. Hallazgos en las reglas actuales

### 🔴 Errores críticos (reglas inefectivas)

| Pestaña               | Regla                          | Source            | Problema                                                                 |
| --------------------- | ------------------------------ | ----------------- | ------------------------------------------------------------------------ |
| `VLAN20_DMZ`          | `BLOCK_LAN_TO_DMZ`             | `VLAN10_LAN`      | Source ≠ DMZ → no se aplica. El bloqueo real ya está en `VLAN10_LAN`.    |
| `VLAN30_DATACENTER`   | `ALLOW_WEB_TO_DB_5432`         | `192.168.20.100`  | Source ≠ DC → no se aplica. El permiso real ya está en `VLAN20_DMZ`.     |
| `VLAN30_DATACENTER`   | `ALLOW_ADMN_TO_DB_SSH`         | `192.168.1.0/24`  | Source ≠ DC → no se aplica. El permiso real ya está en `VLAN10_LAN`.     |

### 🟡 Bloqueos faltantes (DB queda demasiado expuesta)

- En `VLAN30_DATACENTER` sólo existe `ALLOW_DC_TO_INTERNET` con destino `*`. Si la DB se compromete, puede iniciar conexiones a LAN/DMZ/VOIP/SYNC. Faltan `BLOCK_DC_TO_*` explícitos **antes** del ALLOW.
- En `VLAN20_DMZ` falta `BLOCK_DMZ_TO_DATACENTER` después del `ALLOW_DMZ_WEB_TO_DB_5432`: hoy el server web podría llegar a cualquier puerto de la DB, no sólo 5432.
- En `VLAN10_LAN` falta `BLOCK_LAN_TO_DATACENTER`: el `ALLOW_LAN_INTERNET` con destino `*` permite al admin llegar a **cualquier** puerto de la DB, no sólo 22/5432.
- Falta `BLOCK_LAN_TO_VOIP` para aislar VoIP del admin (ISO 27001 / NIST CSF).

---

## 2. Cambios a aplicar (en este orden seguro)

> ⚙️ Aplicar **en este orden** para no perder gestión: VLAN10_LAN → VLAN20_DMZ → VLAN30_DATACENTER.

### Paso 1 — `Firewall → Rules → VLAN10_LAN`

#### Agregar

| # | Action | Source         | Destination          | Port | Descripción                |
| - | ------ | -------------- | -------------------- | ---- | -------------------------- |
| 1 | Pass   | `192.168.1.0/24` | `192.168.30.100`    | 5432 | `ALLOW_ADMIN_TO_DB_5432`   |
| 2 | Block  | VLAN10_LAN subnets | VLAN30_DATACENTER subnets | * | `BLOCK_LAN_TO_DATACENTER`  |
| 3 | Block  | VLAN10_LAN subnets | VLAN40_VOZIP subnets      | * | `BLOCK_LAN_TO_VOIP`        |

#### Orden final esperado

```
1. Anti-Lockout (auto)
2. ALLOW_ADMIN_TO_WEB_SSH      (1.0/24 → 192.168.20.100:22)
3. ALLOW_ADMIN_TO_DB_SSH       (1.0/24 → 192.168.30.100:22)
4. ALLOW_ADMIN_TO_DB_5432      (1.0/24 → 192.168.30.100:5432)   ← nueva
5. BLOCK_LAN_TO_DATACENTER     ← nueva
6. BLOCK_LAN_TO_DMZ
7. BLOCK_LAN_TO_VOIP           ← nueva
8. BLOCK_LAN_TO_SYNC
9. ALLOW_LAN_INTERNET          (vía FAILOVER_ISP)
10. Default IPv6
```

Luego: **Apply Changes**. Confirmar que seguís pudiendo entrar a pfSense GUI desde tu host admin.

---

### Paso 2 — `Firewall → Rules → VLAN20_DMZ`

#### Eliminar

- `BLOCK_LAN_TO_DMZ` (source `VLAN10_LAN`) — inútil en esta pestaña.

#### Agregar

| Action | Source              | Destination                   | Descripción              |
| ------ | ------------------- | ----------------------------- | ------------------------ |
| Block  | VLAN20_DMZ subnets  | VLAN30_DATACENTER subnets     | `BLOCK_DMZ_TO_DATACENTER`|

#### Orden final esperado

```
1. BLOCK_DMZ_TO_LAN
2. BLOCK_DMZ_TO_SYNC
3. BLOCK_DMZ_TO_VOIP
4. ALLOW_DMZ_WEB_TO_DB_5432    (192.168.20.100 → 192.168.30.100:5432)
5. BLOCK_DMZ_TO_DATACENTER     ← nueva
6. ALLOW_DMZ_TO_INTERNET
```

Luego: **Apply Changes**.

---

### Paso 3 — `Firewall → Rules → VLAN30_DATACENTER`

#### Eliminar

- `ALLOW_WEB_TO_DB_5432` (source `192.168.20.100`)
- `ALLOW_ADMN_TO_DB_SSH` (source `192.168.1.0/24`)

#### Agregar (todas con source `VLAN30_DATACENTER subnets`)

| Action | Destination                | Descripción         |
| ------ | -------------------------- | ------------------- |
| Block  | VLAN10_LAN subnets         | `BLOCK_DC_TO_LAN`   |
| Block  | VLAN20_DMZ subnets         | `BLOCK_DC_TO_DMZ`   |
| Block  | VLAN40_VOZIP subnets       | `BLOCK_DC_TO_VOIP`  |
| Block  | SYNC subnets               | `BLOCK_DC_TO_SYNC`  |

#### Orden final esperado

```
1. BLOCK_DC_TO_LAN             ← nueva
2. BLOCK_DC_TO_DMZ             ← nueva
3. BLOCK_DC_TO_VOIP            ← nueva
4. BLOCK_DC_TO_SYNC            ← nueva
5. ALLOW_DC_TO_INTERNET
```

Luego: **Apply Changes**.

---

## 3. Configuración asociada a validar (antes de FASE 2.3)

| Sección                                  | Qué confirmar                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `Firewall → NAT → Outbound`              | Si está en **Automatic**, queda cubierto. Si está en **Hybrid/Manual**, debe existir una entrada que NATee `VLAN30_DATACENTER` hacia WAN1/WAN2 (sino, sin `apt update`). |
| `Services → DNS Resolver` → Network Interfaces | La interfaz `VLAN30_DATACENTER` debe estar tildada para que la VM DB resuelva nombres. |
| `Firewall → Rules → Floating`            | Que no exista un `match`/`pass` amplio que invalide los BLOCK por interfaz.   |
| `Firewall → Rules → VLAN40_VOZIP`        | Aislada: sin acceso a DC, DMZ ni SYNC.                                        |
| `Firewall → Rules → SYNC`                | Sólo CARP entre los dos pfSense; nada de tráfico de datos.                    |

---

## 4. Verificación end-to-end (post-FASE 2.3)

Una vez levantada la VM `ninjasec-db` en `192.168.30.100`, ejecutar los 8 checks. **Todos deben dar el resultado esperado.**

| # | Desde                 | Comando                                       | Esperado |
| - | --------------------- | --------------------------------------------- | -------- |
| 1 | 192.168.1.x (admin)   | `ssh user@192.168.30.100`                     | ✅ pasa  |
| 2 | 192.168.1.x (admin)   | `nc -vz 192.168.30.100 5432`                  | ✅ pasa  |
| 3 | 192.168.1.x (admin)   | `nc -vz 192.168.30.100 80`                    | ❌ block (`BLOCK_LAN_TO_DATACENTER`) |
| 4 | 192.168.20.100 (web)  | `nc -vz 192.168.30.100 5432`                  | ✅ pasa  |
| 5 | 192.168.20.100 (web)  | `ssh user@192.168.30.100`                     | ❌ block (`BLOCK_DMZ_TO_DATACENTER`) |
| 6 | 192.168.30.100 (db)   | `apt update`                                  | ✅ pasa  |
| 7 | 192.168.30.100 (db)   | `ping 192.168.1.1`                            | ❌ block (`BLOCK_DC_TO_LAN`) |
| 8 | 192.168.30.100 (db)   | `nc -vz 192.168.20.100 80`                    | ❌ block (`BLOCK_DC_TO_DMZ`) |

Para diagnosticar drops legítimos: `Status → System Logs → Firewall`, filtrar por interfaz.

---

## 5. Resumen ejecutivo de la política resultante

- **Admin (LAN)** → DB: sólo `22/tcp` (SSH) y `5432/tcp` (psql). Todo lo demás hacia DC: bloqueado.
- **Web (DMZ)** → DB: sólo `5432/tcp`. Todo lo demás hacia DC: bloqueado.
- **DB (DC)** → Internet: permitido (apt, NTP, DNS público). Hacia el resto de VLANs internas: bloqueado.
- **VoIP, SYNC**: aisladas del flujo plataforma.

Política alineada con principios de **segmentación de red** (ISO 27001 A.13.1.3, NIST CSF PR.AC-5).
