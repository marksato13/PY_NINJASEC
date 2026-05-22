"use client";

import { FolderKanban } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getProjects, getProjectMembers, ProjectItem } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { getStatusBadgeClass } from "@/lib/role-utils";

const STATUS_LABEL: Record<string, string> = {
  planning:  "Planificación",
  active:    "Activo",
  paused:    "Pausado",
  completed: "Completado",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PortalTasksPage() {
  const user       = getStoredUser();
  const [statusFilter, setStatusFilter] = useState("");

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ["portal-my-projects"],
    queryFn:  () => getProjects(),
  });

  const filtered = projects.filter((p) =>
    statusFilter ? p.status === statusFilter : true
  );

  const activeCount    = projects.filter((p) => p.status === "active").length;
  const planningCount  = projects.filter((p) => p.status === "planning").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;

  return (
    <section className="page-stack">
      {/* Encabezado */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Portal</p>
          <h2>Mis proyectos</h2>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          {projects.length} asignación{projects.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* KPIs */}
      <div className="metrics-grid">
        {[
          { label: "Activos",       value: activeCount,    badge: "badge-active" },
          { label: "Planificación", value: planningCount,  badge: "badge-draft" },
          { label: "Completados",   value: completedCount, badge: "badge-archived" },
          { label: "Total",         value: projects.length, badge: "" },
        ].map((kpi) => (
          <article className="metric-card panel" key={kpi.label}>
            <p className="eyebrow">{kpi.label}</p>
            <strong>{kpi.value}</strong>
          </article>
        ))}
      </div>

      {/* Filtro */}
      <div className="panel-actions">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="planning">En planificación</option>
          <option value="paused">Pausados</option>
          <option value="completed">Completados</option>
        </select>
      </div>

      {/* Lista */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Asignaciones</p>
            <h3>Proyectos en los que participas</h3>
          </div>
        </div>

        {error && <p className="form-error">Error al cargar proyectos</p>}

        {isLoading ? (
          <div className="empty-state">Cargando proyectos…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FolderKanban size={28} style={{ opacity: 0.35, margin: "0 auto 8px", display: "block" }} />
            No tienes proyectos asignados{statusFilter ? " con ese estado" : ""}.
          </div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
              <span>Proyecto</span>
              <span>Estado</span>
              <span>Inicio</span>
              <span>Fin estimado</span>
              <span>Descripción</span>
            </div>
            {filtered.map((project) => (
              <div
                className="table-row"
                key={project.id}
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}
              >
                <span style={{ fontWeight: 600 }}>{project.name}</span>
                <span>
                  <span className={`badge ${getStatusBadgeClass(project.status)}`}>
                    {STATUS_LABEL[project.status] ?? project.status}
                  </span>
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                  {formatDate(project.start_date)}
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                  {formatDate(project.end_date)}
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                  {project.description?.slice(0, 60) ?? "—"}
                  {(project.description?.length ?? 0) > 60 ? "…" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
