# Estándares Frontend — NinjaSec Next.js 15

> Toda nueva página y componente debe seguir estos estándares.  
> Estos estándares son verificables — existe un checklist en `04-CHECKLIST-VERIFICACION.md`.

---

## Estructura de archivos

```
frontend/src/
├── app/
│   ├── (admin)/dashboard/[modulo]/
│   │   └── page.tsx               ← Una página por módulo
│   └── (portal)/portal/[seccion]/
│       └── page.tsx
├── lib/
│   ├── api/                       ← DIVIDIDO por dominio (ver abajo)
│   │   ├── index.ts               ← Re-exporta todo
│   │   ├── client.ts              ← apiClient + request() base
│   │   ├── users.ts
│   │   ├── clients.ts
│   │   └── ...
│   ├── auth.ts                    ← Auth helpers (token, sesión)
│   ├── query-keys.ts              ← TanStack Query key constants
│   ├── role-utils.ts              ← Formateo de roles y badges
│   ├── alerts.ts                  ← SweetAlert2 helpers
│   ├── constants.ts               ← Constantes de app (JOB_TITLES, etc.)
│   └── validation.ts              ← Schemas Zod
└── components/
    ├── ui/                        ← Componentes reutilizables (Modal, etc.)
    ├── forms/                     ← Formularios complejos
    └── dashboard/                 ← Shell, sidebar, topbar
```

---

## Cliente HTTP — patrón estándar

### `lib/api/client.ts`
```typescript
import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8024/api/v1";

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const isFormData = options?.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const err = await response.json();
      message = err.message ?? err.detail ?? message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
```

### Funciones de API — sin token como parámetro
```typescript
// ✅ CORRECTO — el token se inyecta internamente
export async function getUsers(): Promise<DashboardUser[]> {
  return request<DashboardUser[]>("/users/");
}

// ❌ INCORRECTO — token como parámetro manual
export async function getUsers(token: string): Promise<DashboardUser[]> {
  return request<DashboardUser[]>("/users/", {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

---

## TanStack Query — patrón estándar

### Query keys constantes (`lib/query-keys.ts`)
```typescript
export const QK = {
  users:          () => ["users"]              as const,
  user:           (id: number) => ["users", id] as const,
  clients:        () => ["clients"]            as const,
  client:         (id: number) => ["clients", id] as const,
  tickets:        (filters?: object) => ["tickets", filters] as const,
  // ... etc
} as const;
```

### `useQuery` estándar
```typescript
// ✅ CORRECTO
const { data: users = [], isLoading } = useQuery({
  queryKey: QK.users(),
  queryFn: getUsers,
});

// ❌ INCORRECTO — string literal, token manual
const { data } = useQuery({
  queryKey: ["users"],
  queryFn: async () => {
    const token = getStoredToken();
    if (!token) throw new Error("Sin sesión");
    return getUsers(token);
  },
});
```

### `useMutation` estándar
```typescript
const updateMutation = useMutation({
  mutationFn: (payload: UserUpdate) => updateUser(userId, payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: QK.users() });
    notifySuccess("Usuario actualizado");
  },
  onError: (err) => notifyError("No se pudo actualizar", err.message),
});
```

---

## Estado local vs estado de servidor

| Tipo de estado | Herramienta |
|---------------|-------------|
| Datos del servidor (listas, detalles) | `useQuery` |
| Mutaciones (crear, editar, eliminar) | `useMutation` |
| UI local (modal abierto, tab activo) | `useState` |
| Formularios | `useForm` de React Hook Form + Zod |

**Regla:** No usar `useEffect` + `useState` para fetchear datos. Siempre `useQuery`.

```typescript
// ✅ CORRECTO
const { data: tickets = [] } = useQuery({ queryKey: QK.tickets(), queryFn: getTickets });

// ❌ INCORRECTO
const [tickets, setTickets] = useState([]);
useEffect(() => {
  getStoredToken() && getTickets(token).then(setTickets);
}, []);
```

---

## Tipos TypeScript — reglas

### Un tipo por entidad, exportado desde `lib/api/[domain].ts`
```typescript
// lib/api/users.ts
export type DashboardUser = {
  id: number;
  full_name: string;
  email: string;
  role_code: string;
  job_title?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
};
```

### El tipo `AuthUser` es la fuente de verdad para el usuario logueado
```typescript
// lib/auth.ts — único tipo para sesión
export type AuthUser = {
  id: number;
  name: string;
  role: string;
  email: string;
  job_title?: string;
};
```
No crear `SessionUser` ni variantes en otros archivos.

### Usar verbos HTTP correctos en los tipos de payload
```typescript
type UserCreate = { ... };        // POST — todos requeridos
type UserUpdate = Partial<...>;   // PATCH — todos opcionales
```

---

## Estructura de página estándar

```typescript
"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-keys";
import { getUsers, updateUser } from "@/lib/api/users";
import { getStoredUser } from "@/lib/auth";
import { confirmDelete, notifySuccess, notifyError } from "@/lib/alerts";
import { Modal } from "@/components/ui/modal";

export default function UsersPage() {
  const currentUser = getStoredUser();
  const [filters, setFilters] = useState({ query: "", role: "all" });
  const [editId, setEditId] = useState<number | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: QK.users(),
    queryFn: getUsers,
  });

  const filtered = useMemo(() => {
    // Un solo useMemo para todos los filtros — O(n) no O(n*filtros)
    return users.filter(u => {
      if (filters.role !== "all" && u.role_code !== filters.role) return false;
      if (filters.query && !u.full_name.toLowerCase().includes(filters.query)) return false;
      return true;
    });
  }, [users, filters]);

  // ... render
}
```

---

## Componentes — reglas

### No crear componentes para lógica de un solo uso
```typescript
// ❌ Innecesario — solo se usa una vez, en este archivo
function UserCardWrapper({ user }: { user: DashboardUser }) {
  return <div className="card">...</div>;
}

// ✅ Solo abstraer cuando se reutiliza en 2+ lugares
// O cuando el componente tiene >50 líneas propias de JSX
```

### Props bien tipadas, sin `any`
```typescript
// ✅ Correcto
type UserCardProps = {
  user: DashboardUser;
  onEdit: (id: number) => void;
  canDelete: boolean;
};

// ❌ Incorrecto
function UserCard({ user, onEdit, canDelete }: any) { ... }
```

---

## CSS y diseño — reglas

### Usar clases del design system, no inline styles
```tsx
// ✅ Correcto
<div className="card-grid">
  <article className="card">...</article>
</div>

// ❌ Evitar (excepto valores dinámicos)
<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
```

### Colores semáforo — usar variables CSS
```tsx
// ✅ Correcto
style={{ color: "var(--danger)" }}
style={{ borderLeft: "3px solid var(--success)" }}

// ❌ Incorrecto — hardcoded
style={{ color: "#EF4444" }}
```

### Valores dinámicos (colores por estado) — usar mapas de configuración
```typescript
const STATUS_CONFIG: Record<string, { label: string; cls: string; color: string }> = {
  active:   { label: "Activo",   cls: "badge-active",   color: "var(--success)" },
  inactive: { label: "Inactivo", cls: "badge-rejected",  color: "var(--muted)"   },
};

// Uso: STATUS_CONFIG[user.status].cls
```

---

## Checklist de nueva página

Antes de considerar una página completa:
- [ ] Usa `useQuery` (no `useEffect + useState`) para datos del servidor
- [ ] Usa `QK.*` para las query keys (no strings literales)
- [ ] No recibe ni pasa `token` como parámetro
- [ ] Un solo `useMemo` O(n) para filtros y KPIs combinados
- [ ] Maneja estado `isLoading` con mensaje/skeleton
- [ ] Errores manejados con `notifyError()` en `onError` de mutations
- [ ] Confirmaciones destructivas usan `confirmDelete()`
- [ ] No tiene `any` en tipos
- [ ] Usa CSS variables para colores, no hex hardcodeados
