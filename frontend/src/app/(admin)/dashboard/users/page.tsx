"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardUser, deleteUser, getUsers, updateUser } from "@/lib/api";
import { confirmDeleteStrict, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { QK } from "@/lib/query-keys";
import { UserForm } from "@/components/forms/user-form";
import { JOB_TITLE_OPTIONS } from "@/lib/constants";
import {
  formatRoleLabel,
  getAccessLabel,
  getAvatarHue,
  getInitials,
  getRoleBadgeClass,
  getStatusBadgeClass,
} from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";
import { userEditFormSchema, type UserEditFormValues } from "@/lib/validation";
import { LayoutGrid, List } from "lucide-react";

function lastLoginLabel(iso?: string | null) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 30)  return `Hace ${diff} días`;
  return `Hace ${Math.floor(diff / 30)} mes${Math.floor(diff / 30) > 1 ? "es" : ""}`;
}

const ROLE_OPTIONS = [
  { value: "super_admin",  label: "Super Admin"  },
  { value: "admin",        label: "Admin"         },
  { value: "collaborator", label: "Colaborador"   },
  { value: "client",       label: "Cliente"       },
];

const ROLE_ORDER = ["super_admin", "admin", "collaborator", "client"];
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admins",
  admin: "Administradores",
  collaborator: "Colaboradores",
  client: "Clientes",
};

export default function UsersPage() {
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [editingUser, setEditingUser] = useState<DashboardUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState<DashboardUser | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: editErrors, isSubmitting: editSubmitting },
  } = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditFormSchema),
    defaultValues: {
      fullName: "",
      jobTitle: "",
      customJobTitle: "",
      isActive: true,
    },
  });
  const editJobTitleValue = watchEdit("jobTitle");
  const editActiveValue = watchEdit("isActive");
  const firstEditError = useMemo(() => Object.values(editErrors)[0]?.message, [editErrors]);

  const queryClient = useQueryClient();
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: QK.users(),
    queryFn: () => getUsers(),
  });

  const users = data ?? [];

  useEffect(() => {
    if (queryError) {
      setError(queryError instanceof Error ? queryError.message : "No se pudo cargar usuarios");
    }
  }, [queryError]);


  function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-PE");
  }

  function matchesDateRange(dateValue: string | null | undefined, from: string, to: string) {
    if (!from && !to) return true;
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && date < fromDate) return false;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  }

  const filteredUsers = users.filter((user) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = q
      ? [user.full_name, user.email, user.job_title, user.role_code]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(q))
      : true;
    const matchesRole = roleFilter === "all" ? true : user.role_code === roleFilter;
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? user.is_active
          : !user.is_active;
    const matchesCreated = matchesDateRange(user.created_at ?? null, createdFrom, createdTo);
    const matchesUpdated = matchesDateRange(user.updated_at ?? null, updatedFrom, updatedTo);
    return matchesQuery && matchesRole && matchesStatus && matchesCreated && matchesUpdated;
  });

  const activeCount   = users.filter((u) => u.is_active).length;
  const filteredCount = filteredUsers.length;
  const roleCounts    = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of users) {
      const key = (u.role_code ?? "").toLowerCase();
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [users]);

  function startEdit(user: DashboardUser) {
    setEditingUser(user);
    setEditRole(user.role_code?.toLowerCase() ?? "");
    const jobTitleValue = user.job_title && JOB_TITLE_OPTIONS.includes(user.job_title) ? user.job_title : user.job_title ? "Otro" : "";
    const customValue = user.job_title && !JOB_TITLE_OPTIONS.includes(user.job_title) ? user.job_title : "";
    resetEdit({
      fullName: user.full_name,
      jobTitle: jobTitleValue,
      customJobTitle: customValue,
      isActive: user.is_active,
    });
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditingUser(null);
  }

  function openView(user: DashboardUser) {
    setViewUser(user);
    setViewOpen(true);
  }

  function closeView() {
    setViewUser(null);
    setViewOpen(false);
  }

  async function handleSaveEdit(values: UserEditFormValues) {
    if (!editingUser) return;
    setError("");
    const resolvedJobTitle = values.jobTitle === "Otro" ? values.customJobTitle : values.jobTitle;
    const normalizedJobTitle = resolvedJobTitle?.trim() || null;
    try {
      const updated = await updateUser(editingUser.id, {
        full_name: values.fullName,
        job_title: normalizedJobTitle,
        is_active: values.isActive,
        ...(isSuperAdmin && editRole ? { role_code: editRole } : {}),
      });
      queryClient.setQueryData(QK.users(), (current?: DashboardUser[]) =>
        current ? current.map((item) => (item.id === updated.id ? updated : item)) : [updated]
      );
      notifySuccess("Usuario actualizado");
      closeEdit();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el usuario";
      setError(message);
      notifyError("No se pudo actualizar el usuario", message);
    }
  }

  async function handleDelete(userId: number) {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const confirmed = await confirmDeleteStrict({
      title: "¿Eliminar este usuario?",
      text: "Esta acción eliminará la cuenta de forma permanente y no se puede deshacer.",
      expected: target.email,
      inputLabel: "Escribe el email del usuario para confirmar:",
    });
    if (!confirmed) return;
    try {
      await deleteUser(userId);
      queryClient.setQueryData(QK.users(), (current?: DashboardUser[]) =>
        current ? current.filter((item) => item.id !== userId) : []
      );
      if (editingUser?.id === userId) closeEdit();
      notifySuccess("Usuario eliminado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el usuario";
      setError(message);
      notifyError("No se pudo eliminar el usuario", message);
    }
  }

  function resetFilters() {
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div><p className="eyebrow">Admin</p><h2>Gestión de usuarios</h2></div>
        <div className="panel-actions">
          <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
            <button type="button" onClick={() => setViewMode("cards")} title="Vista cards"
              style={{ padding: "6px 10px", background: viewMode === "cards" ? "var(--primary)" : "transparent", color: viewMode === "cards" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer" }}>
              <LayoutGrid size={15} />
            </button>
            <button type="button" onClick={() => setViewMode("table")} title="Vista tabla"
              style={{ padding: "6px 10px", background: viewMode === "table" ? "var(--primary)" : "transparent", color: viewMode === "table" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer" }}>
              <List size={15} />
            </button>
          </div>
          <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>Nuevo usuario</button>
        </div>
      </div>

      {/* KPI strip by role */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {ROLE_OPTIONS.map(({ value, label }) => {
          const count = roleCounts[value] ?? 0;
          return (
            <button key={value} type="button"
              onClick={() => setRoleFilter(roleFilter === value ? "all" : value)}
              className={`badge badge-role ${getRoleBadgeClass(value)}`}
              style={{ cursor: "pointer", fontSize: "0.78rem", padding: "5px 12px", border: `1px solid ${roleFilter === value ? "var(--primary)" : "transparent"}` }}
            >
              {label} <strong style={{ marginLeft: 4 }}>{count}</strong>
            </button>
          );
        })}
        <span style={{ color: "var(--muted)", fontSize: "0.78rem", alignSelf: "center" }}>
          {activeCount} activos · {users.length - activeCount} inactivos
        </span>
      </div>

      <div className="split-grid">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Listado</p><h3>Usuarios registrados</h3></div>
            <div className="table-actions">
              <span className="pill">{filteredCount} visibles</span>
              <button className="button button-ghost" type="button" onClick={resetFilters}>Limpiar</button>
            </div>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="panel filters-panel">
            <div className="filters-grid">
              <input
                className="filters-search"
                placeholder="Buscar por nombre, email o rol"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">Todos los roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="collaborator">Collaborator</option>
                <option value="client">Client</option>
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
            <div className="filters-dates">
              <label>
                <span>Creado desde</span>
                <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
              </label>
              <label>
                <span>Creado hasta</span>
                <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
              </label>
              <label>
                <span>Actualizado desde</span>
                <input type="date" value={updatedFrom} onChange={(event) => setUpdatedFrom(event.target.value)} />
              </label>
              <label>
                <span>Actualizado hasta</span>
                <input type="date" value={updatedTo} onChange={(event) => setUpdatedTo(event.target.value)} />
              </label>
            </div>
          </div>

          {isLoading ? (
            <div className="empty-state">Cargando usuarios...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">No hay usuarios que coincidan con los filtros.</div>
          ) : viewMode === "cards" ? (
            <div className="category-grid">
              {ROLE_ORDER.map((role) => {
                const group = filteredUsers.filter((u) => (u.role_code ?? "").toLowerCase() === role);
                if (group.length === 0) return null;
                return (
                  <div key={role} className="category-block">
                    <div className="category-head">
                      <div className="category-title">
                        <span className={`badge badge-role ${getRoleBadgeClass(role)}`} style={{ fontSize: "0.75rem", padding: "5px 12px" }}>
                          {ROLE_LABELS[role]}
                        </span>
                        <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                          {group.length} usuario{group.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
                      {group.map((user) => (
                        <article className="card user-card" key={user.id}
                          style={{ borderLeft: `3px solid ${user.is_active ? "var(--success)" : "var(--muted)"}` }}>
                          <div className="card-header">
                            <div className="avatar" style={{ "--avatar-hue": getAvatarHue(user.full_name || user.email) } as CSSProperties}>
                              {getInitials(user.full_name || user.email)}
                            </div>
                            <div className="card-title">
                              <strong>{user.full_name}</strong>
                              <span className="card-subtitle">{user.email}</span>
                            </div>
                            <div className="card-badges">
                              <span className={`badge ${getStatusBadgeClass(user.is_active ? "active" : "inactive")}`}>{user.is_active ? "Activo" : "Inactivo"}</span>
                            </div>
                          </div>
                          <div className="card-meta">
                            <div><span className="card-label">Cargo</span><span>{user.job_title || "Sin cargo"}</span></div>
                            <div><span className="card-label">Acceso</span><span>{getAccessLabel(user.role_code)}</span></div>
                            <div><span className="card-label">Último acceso</span>
                              <span style={{ color: user.last_login_at ? "var(--fg)" : "var(--muted)" }}>
                                {lastLoginLabel(user.last_login_at) ?? "Nunca"}
                              </span>
                            </div>
                            <div><span className="card-label">Creado</span><span>{formatDate(user.created_at)}</span></div>
                          </div>
                          <div className="card-actions">
                            <button className="button button-secondary" type="button" onClick={() => openView(user)}>Ver</button>
                            <button className="button button-ghost" type="button" onClick={() => startEdit(user)}>Editar</button>
                            {isSuperAdmin && <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(user.id)}>Eliminar</button>}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table view */
            <div className="table-like">
              <div className="table-row table-head" style={{ gridTemplateColumns: "32px 1fr 160px 120px 90px 130px auto" }}>
                <span></span><span>Usuario</span><span>Cargo</span><span>Rol</span><span>Estado</span><span>Último acceso</span><span>Acciones</span>
              </div>
              {filteredUsers.map((user) => (
                <div className="table-row" key={user.id} style={{ gridTemplateColumns: "32px 1fr 160px 120px 90px 130px auto", alignItems: "center" }}>
                  <div className="avatar" style={{ "--avatar-hue": getAvatarHue(user.full_name || user.email), width: 28, height: 28, fontSize: "0.6rem" } as CSSProperties}>
                    {getInitials(user.full_name || user.email)}
                  </div>
                  <span>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{user.full_name}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.73rem" }}>{user.email}</div>
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{user.job_title || "—"}</span>
                  <span><span className={`badge badge-role ${getRoleBadgeClass(user.role_code)}`}>{formatRoleLabel(user.role_code)}</span></span>
                  <span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: user.is_active ? "var(--success)" : "var(--muted)" }}>
                      ● {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{lastLoginLabel(user.last_login_at) ?? "Nunca"}</span>
                  <span className="panel-actions">
                    <button className="button button-ghost button-sm" type="button" onClick={() => startEdit(user)}>Editar</button>
                    {isSuperAdmin && <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(user.id)}>Eliminar</button>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <Modal isOpen={createOpen} title="Nuevo usuario" onClose={() => setCreateOpen(false)}>
          <UserForm
            onCreated={(user) => {
              queryClient.setQueryData(QK.users(), (current?: DashboardUser[]) =>
                current ? [...current, user] : [user]
              );
              setCreateOpen(false);
            }}
          />
        </Modal>
        <Modal isOpen={editOpen && !!editingUser} title="Editar usuario" onClose={closeEdit}>
          {editingUser ? (
            <form className="entity-form" onSubmit={handleSubmitEdit(handleSaveEdit)}>
              <input placeholder="Nombre completo" {...registerEdit("fullName")} required />
              <select {...registerEdit("jobTitle")}>
                <option value="">Selecciona un cargo</option>
                {JOB_TITLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {editJobTitleValue === "Otro" ? <input placeholder="Especifica el cargo" {...registerEdit("customJobTitle")} /> : null}
              {isSuperAdmin && (
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="">— Cambiar rol —</option>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={!!editActiveValue}
                  onChange={(e) => setEditValue("isActive", e.target.checked, { shouldDirty: true })}
                />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span style={{ fontSize: "0.85rem", color: editActiveValue ? "var(--success)" : "var(--muted)" }}>
                  {editActiveValue ? "Usuario activo" : "Usuario inactivo"}
                </span>
              </label>
              {firstEditError ? <p className="form-error">{firstEditError}</p> : null}
              <div className="panel-actions">
                <button className="button button-primary" type="submit" disabled={editSubmitting}>
                  {editSubmitting ? "Guardando..." : "Guardar cambios"}
                </button>
                <a className="button button-ghost button-sm" href={`/dashboard/audit?entity_type=users&entity_id=${editingUser.id}`} target="_blank" rel="noreferrer" title="Ver historial de auditoría">
                  Ver auditoría →
                </a>
                <button className="button button-ghost" type="button" onClick={closeEdit}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}
        </Modal>
        <Modal isOpen={viewOpen && !!viewUser} title="Detalle de usuario" onClose={closeView}>
          {viewUser ? (
            <div className="card-meta">
              <div>
                <span className="card-label">Nombre</span>
                <span>{viewUser.full_name}</span>
              </div>
              <div>
                <span className="card-label">Email</span>
                <span>{viewUser.email}</span>
              </div>
              <div>
                <span className="card-label">Rol</span>
                <span>{formatRoleLabel(viewUser.role_code)}</span>
              </div>
              <div>
                <span className="card-label">Acceso</span>
                <span>{getAccessLabel(viewUser.role_code)}</span>
              </div>
              <div>
                <span className="card-label">Cargo</span>
                <span>{viewUser.job_title || "Sin cargo"}</span>
              </div>
              <div>
                <span className="card-label">Estado</span>
                <span>{viewUser.is_active ? "Activo" : "Inactivo"}</span>
              </div>
              <div>
                <span className="card-label">Creado</span>
                <span>{formatDate(viewUser.created_at)}</span>
              </div>
              <div>
                <span className="card-label">Actualizado</span>
                <span>{formatDate(viewUser.updated_at)}</span>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </section>
  );
}
