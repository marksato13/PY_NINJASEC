# Estándares Backend — NinjaSec FastAPI

> Toda nueva funcionalidad backend debe seguir estos estándares.  
> Toda refactorización debe dejar el código más cerca de estos estándares.

---

## Estructura de módulo (obligatoria)

```
modules/[nombre_modulo]/
├── __init__.py                    ← OBLIGATORIO (paquete Python)
├── routers/
│   ├── __init__.py                ← OBLIGATORIO
│   └── router.py                  ← Router principal
├── schemas/
│   ├── __init__.py                ← OBLIGATORIO con re-exports
│   └── [nombre].py                ← Schemas Pydantic
└── services/
    ├── __init__.py                ← OBLIGATORIO
    └── [nombre]_service.py        ← Lógica de negocio
```

### Regla: si el módulo tiene lógica, tiene services/

Los routers NO contienen lógica de negocio. Solo:
1. Parsean/validan la request (Pydantic ya hace esto)
2. Llaman al servicio correspondiente
3. Devuelven la response

```python
# ✅ CORRECTO
@router.post("/", response_model=ClientRead)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "super_admin"])),
):
    return ClientService.create(db, payload, created_by=current_user.id)

# ❌ INCORRECTO — lógica de negocio en el router
@router.post("/")
def create_client(payload: ClientCreate, db: Session = Depends(get_db)):
    existing = db.query(Client).filter(Client.email == payload.email).first()
    if existing:
        raise AppError("Cliente ya existe", 409)
    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client
```

---

## Convenciones de naming

### Módulos
- Nombres en `snake_case` singular: `client`, `user`, `device`
- Sub-recursos como subrouters del módulo padre: `clients/routers/sites.py`

### Schemas Pydantic
```python
ClientCreate    # Input para POST
ClientUpdate    # Input para PATCH (todos los campos Optional)
ClientRead      # Output en responses
ClientDetail    # Output extendido (con relaciones)
```

### Endpoints REST
```
GET    /clients/           → list
POST   /clients/           → create
GET    /clients/{id}       → read one
PATCH  /clients/{id}       → partial update  ← siempre PATCH, nunca PUT para parcial
DELETE /clients/{id}       → delete/deactivate
```

### HTTP verbs
- `POST` → crear recurso
- `GET` → leer (sin side effects)
- `PATCH` → actualización **parcial** (campos opcionales en schema)
- `PUT` → reemplazo **completo** (solo si se reemplaza todo el recurso)
- `DELETE` → eliminar o desactivar

---

## Schemas Pydantic — reglas

```python
# Schema base compartido
class ClientBase(BaseModel):
    company_name: str
    sector: str | None = None

# Create: hereda base, agrega campos requeridos de creación
class ClientCreate(ClientBase):
    organization_id: int

# Update: todos opcionales
class ClientUpdate(BaseModel):
    company_name: str | None = None
    sector: str | None = None
    commercial_status: str | None = None

# Read: incluye id y timestamps
class ClientRead(ClientBase):
    id: int
    commercial_status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

### `__init__.py` del schema exporta todo:
```python
from app.modules.clients.schemas.client import ClientCreate, ClientRead, ClientUpdate
__all__ = ["ClientCreate", "ClientRead", "ClientUpdate"]
```

---

## Manejo de errores

### Usar siempre `AppError`
```python
from app.core.exceptions import AppError

# ✅ Correcto
raise AppError("Cliente no encontrado", status_code=404)
raise AppError("Email ya registrado", status_code=409)

# ❌ Incorrecto
raise HTTPException(status_code=404, detail="not found")
```

### No hacer `try/except` genérico
```python
# ❌ Incorrecto — oculta errores reales
try:
    result = service.do_something()
except Exception:
    raise AppError("Error", 500)

# ✅ Solo capturar errores específicos que se pueden manejar
try:
    db.commit()
except IntegrityError:
    db.rollback()
    raise AppError("Registro duplicado", 409)
```

---

## Autenticación y autorización

### Dependencias disponibles
```python
from app.common.deps.auth import get_current_user, require_roles

# Solo autenticado (cualquier rol)
current_user: User = Depends(get_current_user)

# Roles específicos
current_user: User = Depends(require_roles(["admin", "super_admin"]))
current_user: User = Depends(require_roles(["admin", "super_admin", "collaborator"]))
```

### Regla: nunca omitir auth en endpoints sensibles
Todos los endpoints que acceden a datos de negocio deben tener `Depends(get_current_user)`.
Solo son públicos: `/auth/login`, `/services/` (catálogo público), `/health`.

---

## Base de datos

### Patrón de query
```python
# ✅ Correcto — siempre cerrar la sesión con Depends(get_db)
def get_clients(db: Session, organization_id: int) -> list[Client]:
    return db.query(Client).filter(
        Client.organization_id == organization_id,
        Client.is_active == True,
    ).all()

# ✅ Para consultas únicas, usar .first() y verificar
def get_client_or_404(db: Session, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise AppError("Cliente no encontrado", 404)
    return client
```

### Nunca hacer queries en loops
```python
# ❌ N+1 problem
for ticket in tickets:
    ticket.client_name = db.query(Client).get(ticket.client_id).company_name

# ✅ JOIN o carga eager
tickets = db.query(SupportTicket).options(
    joinedload(SupportTicket.client)
).all()
```

---

## Audit logging

Todo cambio de datos importante debe registrarse:
```python
from app.modules.audit.services.audit_service import log_action

log_action(db, action="client.created", entity_type="client", entity_id=str(client.id), user_id=current_user.id)
```

Acciones estándar: `{entity}.created`, `{entity}.updated`, `{entity}.deleted`, `{entity}.status_changed`

---

## Checklist de nuevo endpoint

Antes de hacer merge de un nuevo endpoint, verificar:
- [ ] Tiene schema `Create`/`Update`/`Read` en `schemas/`
- [ ] Tiene `__init__.py` en el módulo y en cada subcarpeta
- [ ] La lógica está en `services/`, no en el router
- [ ] Tiene `Depends(get_current_user)` o `Depends(require_roles(...))`
- [ ] Usa `PATCH` para actualizaciones parciales
- [ ] Usa `AppError` para errores, no `HTTPException`
- [ ] Registra audit log si modifica datos
- [ ] El schema `Read` tiene `model_config = ConfigDict(from_attributes=True)`
