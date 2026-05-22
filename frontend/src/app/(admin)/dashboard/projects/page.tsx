"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AreaItem,
  DashboardClient,
  deleteProject,
  getAllProjectMembers,
  getAreas,
  getClients,
  getProducts,
  getProjectTypes,
  getProjects,
  getServices,
  ProductItem,
  ProjectItem,
  ProjectMemberItem,
  ProjectTypeItem,
  ServiceItem,
  updateProject,
} from "@/lib/api";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { QK } from "@/lib/query-keys";
import { ProjectForm } from "@/components/forms/project-form";
import { Modal } from "@/components/ui/modal";
import { getStatusBadgeClass } from "@/lib/role-utils";

export default function DashboardProjectsPage() {
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewProject, setViewProject] = useState<ProjectItem | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin      = currentUser?.role === "admin" || isSuperAdmin;
  const queryClient = useQueryClient();
  const emptyClients = useMemo<DashboardClient[]>(() => [], []);
  const emptyAreas = useMemo<AreaItem[]>(() => [], []);
  const emptyTypes = useMemo<ProjectTypeItem[]>(() => [], []);
  const emptyServices = useMemo<ServiceItem[]>(() => [], []);
  const emptyProducts = useMemo<ProductItem[]>(() => [], []);
  const emptyProjects = useMemo<ProjectItem[]>(() => [], []);
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: QK.projects(),
    queryFn: async () => {
      const [projects, clients, areas, types, services, products] = await Promise.all([
        getProjects(),
        getClients(),
        getAreas(),
        getProjectTypes(),
        getServices(),
        getProducts(),
      ]);
      return { projects, clients, areas, types, services, products };
    },
  });

  const items = data?.projects ?? emptyProjects;

  // P-05: cargar miembros de proyectos
  const { data: allMembers = [] } = useQuery<ProjectMemberItem[]>({
    queryKey: ["project-members", "all"],
    queryFn: () => getAllProjectMembers(),
    enabled: isAdmin,
  });
  const membersByProject = useMemo(() => {
    const m: Record<number, ProjectMemberItem[]> = {};
    for (const mb of allMembers) {
      if (!m[mb.project_id]) m[mb.project_id] = [];
      m[mb.project_id].push(mb);
    }
    return m;
  }, [allMembers]);

  // P-02: cambiar estado inline
  async function handleStatusChange(projectId: number, status: string) {
    try {
      const updated = await updateProject(projectId, { status });
      queryClient.setQueryData(QK.projects(), (current?: {
        projects: ProjectItem[];
        clients: DashboardClient[];
        areas: AreaItem[];
        types: ProjectTypeItem[];
        services: ServiceItem[];
        products: ProductItem[];
      }) => current ? { ...current, projects: current.projects.map((p) => p.id === projectId ? updated : p) } : current);
      notifySuccess("Estado actualizado");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }
  const clients = data?.clients ?? emptyClients;
  const areas = data?.areas ?? emptyAreas;
  const projectTypes = data?.types ?? emptyTypes;
  const services = data?.services ?? emptyServices;
  const products = data?.products ?? emptyProducts;

  useEffect(() => {
    if (queryError) {
      setError(queryError instanceof Error ? queryError.message : "No se pudo cargar proyectos");
    }
  }, [queryError]);

  async function handleDelete(projectId: number) {
    const confirmed = await confirmDelete({
      title: "¿Eliminar este proyecto?",
      text: "Esta acción eliminará el proyecto de forma permanente.",
    });
    if (!confirmed) return;
    try {
      await deleteProject(projectId);
      queryClient.setQueryData(QK.projects(), (current?: {
        projects: ProjectItem[];
        clients: DashboardClient[];
        areas: AreaItem[];
        types: ProjectTypeItem[];
        services: ServiceItem[];
        products: ProductItem[];
      }) => {
        if (!current) return current;
        return { ...current, projects: current.projects.filter((item) => item.id !== projectId) };
      });
      notifySuccess("Proyecto eliminado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el proyecto";
      setError(message);
      notifyError("No se pudo eliminar el proyecto", message);
    }
  }

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item.company_name])), [clients]);
  const areaMap = useMemo(() => new Map(areas.map((item) => [item.id, item.name])), [areas]);
  const typeMap = useMemo(() => new Map(projectTypes.map((item) => [item.id, item.name])), [projectTypes]);
  const serviceMap = useMemo(() => new Map(services.map((item) => [item.id, item.title])), [services]);
  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);

  const STATUS_COLOR: Record<string, string> = {
    planning:  "#3B82F6",
    active:    "var(--success)",
    on_hold:   "var(--warning)",
    completed: "var(--muted)",
    cancelled: "var(--danger)",
  };

  function statusProgress(status: string) {
    const s = (status ?? "").toLowerCase();
    if (s === "completed") return 100;
    if (s === "active")    return 70;
    if (s === "on_hold")   return 45;
    if (s === "planning")  return 25;
    return 10;
  }

  const filteredItems = items.filter((item) => {
    const statusMatch = statusFilter === "all" ? true : item.status === statusFilter;
    const typeMatch = typeFilter === "all" ? true : String(item.project_type_id || "") === typeFilter;
    const clientMatch = clientFilter === "all" ? true : String(item.client_id || "") === clientFilter;
    const areaMatch = areaFilter === "all" ? true : String(item.area_id || "") === areaFilter;
    return statusMatch && typeMatch && clientMatch && areaMatch;
  });

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Admin</p>
        <h2>Proyectos</h2>
      </div>

      <div className="split-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Pipeline</p>
              <h3>Proyectos registrados</h3>
            </div>
            <div className="panel-actions">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos los estados</option>
                <option value="planning">Planificación</option>
                <option value="active">Activo</option>
                <option value="on_hold">En espera</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">Todos los tipos</option>
                {projectTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
                <option value="all">Todos los clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
              <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                <option value="all">Todas las areas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="Vista lista"
                  style={{ padding: "6px 10px", background: viewMode === "list" ? "var(--primary)" : "transparent", color: viewMode === "list" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer" }}
                >
                  <ListIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("kanban")}
                  title="Vista Kanban"
                  style={{ padding: "6px 10px", background: viewMode === "kanban" ? "var(--primary)" : "transparent", color: viewMode === "kanban" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer" }}
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
              {isAdmin && (
                <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
                  Nuevo proyecto
                </button>
              )}
            </div>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {(() => {
            const renderCard = (item: ProjectItem) => {
              const members = membersByProject[item.id] ?? [];
              return (
                <article className="card project-card" key={item.id}
                  style={{ borderLeft: `3px solid ${STATUS_COLOR[(item.status ?? "").toLowerCase()] ?? "var(--line)"}` }}>
                  <div className="card-header">
                    <div className="card-title">
                      <strong>{item.name}</strong>
                      <span className="card-subtitle">{clientMap.get(item.client_id || 0) || "Cliente sin asignar"}</span>
                    </div>
                    <div className="card-badges">
                      <span className={`badge ${getStatusBadgeClass(item.status)}`}>{item.status}</span>
                    </div>
                  </div>
                  {(item.start_date || item.end_date || item.budget_label) && (
                    <div style={{ display: "flex", gap: 12, fontSize: "0.78rem", color: "var(--muted)", flexWrap: "wrap" }}>
                      {item.start_date && <span>▶ {item.start_date.slice(0, 10)}</span>}
                      {item.end_date   && <span>⏹ {item.end_date.slice(0, 10)}</span>}
                      {item.budget_label && (
                        <span style={{ color: "var(--primary)", fontWeight: 600 }}>💰 {item.budget_label}</span>
                      )}
                    </div>
                  )}
                  <p className="card-subtitle">{item.description || "Sin descripcion"}</p>
                  <div className="card-tags">
                    {item.project_type_id ? <span className="tag">{typeMap.get(item.project_type_id) || `Tipo #${item.project_type_id}`}</span> : null}
                    {item.area_id ? <span className="tag">{areaMap.get(item.area_id) || `Area #${item.area_id}`}</span> : null}
                    {item.service_id ? <span className="tag">{serviceMap.get(item.service_id) || `Servicio #${item.service_id}`}</span> : null}
                    {item.product_id ? <span className="tag">{productMap.get(item.product_id) || `Producto #${item.product_id}`}</span> : null}
                  </div>
                  {members.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ display: "flex" }}>
                        {members.slice(0, 4).map((m, idx) => {
                          const initials = (m.user_name || `U${m.user_id}`).split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                          return (
                            <span key={m.id} title={m.user_name || ""} style={{
                              width: 26, height: 26, borderRadius: 999,
                              background: `hsl(${(m.user_id * 47) % 360} 70% 45%)`,
                              color: "#fff", fontSize: "0.65rem", fontWeight: 700,
                              display: "grid", placeItems: "center",
                              border: "2px solid var(--panel)",
                              marginLeft: idx === 0 ? 0 : -8,
                            }}>
                              {initials}
                            </span>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {members.length} miembro{members.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${statusProgress(item.status)}%` }} />
                  </div>
                  {isAdmin && (
                    <select
                      value={(item.status ?? "").toLowerCase()}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      style={{ fontSize: "0.78rem", padding: "5px 8px" }}
                    >
                      <option value="planning">Planificación</option>
                      <option value="active">Activo</option>
                      <option value="on_hold">En espera</option>
                      <option value="completed">Completado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  )}
                  <div className="card-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => { setViewProject(item); setViewOpen(true); }}
                    >
                      Ver
                    </button>
                    <Link className="button button-primary" href={`/dashboard/projects/${item.id}`}>
                      Ver detalle
                    </Link>
                    {isSuperAdmin && (
                      <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(item.id)}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </article>
              );
            };

            if (isLoading) {
              return <div className="empty-state">Cargando proyectos...</div>;
            }
            if (filteredItems.length === 0) {
              return <div className="empty-state">No hay proyectos registrados.</div>;
            }
            if (viewMode === "kanban") {
              const KANBAN_COLUMNS: { key: string; label: string }[] = [
                { key: "planning",  label: "Planificación" },
                { key: "active",    label: "Activos" },
                { key: "on_hold",   label: "En espera" },
                { key: "completed", label: "Completados" },
                { key: "cancelled", label: "Cancelados" },
              ];
              return (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(260px, 1fr))`, gap: 12, overflowX: "auto" }}>
                  {KANBAN_COLUMNS.map((col) => {
                    const colItems = filteredItems.filter((i) => (i.status ?? "").toLowerCase() === col.key);
                    const color = STATUS_COLOR[col.key] ?? "var(--line)";
                    return (
                      <div key={col.key} style={{
                        background: `${color}10`,
                        border: `1px solid ${color}33`,
                        borderTop: `3px solid ${color}`,
                        borderRadius: 12,
                        padding: "12px 10px",
                        minHeight: 200,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <span style={{ fontWeight: 700, fontSize: "0.82rem", color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {col.label}
                          </span>
                          <span style={{ background: color, color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
                            {colItems.length}
                          </span>
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {colItems.length === 0 ? (
                            <span style={{ color: "var(--muted)", fontSize: "0.78rem", textAlign: "center", opacity: 0.6, padding: "16px 0" }}>Sin proyectos</span>
                          ) : (
                            colItems.map((item) => renderCard(item))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return (
              <div className="card-grid">
                {filteredItems.map((item) => renderCard(item))}
              </div>
            );
          })()}
        </article>

        <Modal isOpen={createOpen} title="Nuevo proyecto" onClose={() => setCreateOpen(false)}>
          <ProjectForm
            onCreated={(project) => {
              queryClient.setQueryData(QK.projects(), (current?: {
                projects: ProjectItem[];
                clients: DashboardClient[];
                areas: AreaItem[];
                types: ProjectTypeItem[];
                services: ServiceItem[];
                products: ProductItem[];
              }) => {
                if (!current) {
                  return {
                    projects: [project],
                    clients,
                    areas,
                    types: projectTypes,
                    services,
                    products,
                  };
                }
                return { ...current, projects: [...current.projects, project] };
              });
              setCreateOpen(false);
            }}
          />
        </Modal>
        <Modal isOpen={viewOpen && !!viewProject} title="Detalle del proyecto" onClose={() => setViewOpen(false)}>
          {viewProject ? (
            <div className="card-meta">
              <div>
                <span className="card-label">Nombre</span>
                <span>{viewProject.name}</span>
              </div>
              <div>
                <span className="card-label">Estado</span>
                <span>{viewProject.status}</span>
              </div>
              <div>
                <span className="card-label">Cliente</span>
                <span>{clientMap.get(viewProject.client_id || 0) || "Sin cliente"}</span>
              </div>
              <div>
                <span className="card-label">Tipo</span>
                <span>{typeMap.get(viewProject.project_type_id || 0) || "Sin tipo"}</span>
              </div>
              <div>
                <span className="card-label">Area</span>
                <span>{areaMap.get(viewProject.area_id || 0) || "Sin area"}</span>
              </div>
              <div>
                <span className="card-label">Servicio</span>
                <span>{serviceMap.get(viewProject.service_id || 0) || "Sin servicio"}</span>
              </div>
              <div>
                <span className="card-label">Producto</span>
                <span>{productMap.get(viewProject.product_id || 0) || "Sin producto"}</span>
              </div>
              <div>
                <span className="card-label">Inicio</span>
                <span>{viewProject.start_date || "-"}</span>
              </div>
              <div>
                <span className="card-label">Fin</span>
                <span>{viewProject.end_date || "-"}</span>
              </div>
              <div>
                <span className="card-label">Descripcion</span>
                <span>{viewProject.description || "Sin descripcion"}</span>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </section>
  );
}
