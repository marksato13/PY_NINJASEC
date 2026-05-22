"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getJobApplications, JobApplicationFilters, JobApplicationItem } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { QK } from "@/lib/query-keys";

type FilterState = {
  status: string;
  desiredRole: string;
  dateFrom: string;
  dateTo: string;
};

const defaultFilters: FilterState = {
  status: "",
  desiredRole: "",
  dateFrom: "",
  dateTo: "",
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "new", label: "Nuevo" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Entrevista" },
  { value: "offer", label: "Oferta" },
  { value: "hired", label: "Contratado" },
  { value: "rejected", label: "Rechazado" },
  { value: "withdrawn", label: "Retirado" },
  { value: "on_hold", label: "En espera" },
];

const statusLabelMap = new Map(statusOptions.map((option) => [option.value, option.label]));

function formatStatus(value?: string | null) {
  if (!value) return "Sin estado";
  return statusLabelMap.get(value) || value.replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function PortalApplicationsPage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);

  const sessionUser = useMemo(() => getStoredUser(), []);
  const isCollaborator = sessionUser?.role === "collaborator";

  const queryFilters: JobApplicationFilters = {};
  if (appliedFilters.status) queryFilters.status = appliedFilters.status;
  if (appliedFilters.desiredRole) queryFilters.desired_role = appliedFilters.desiredRole.trim();
  if (appliedFilters.dateFrom) queryFilters.date_from = appliedFilters.dateFrom;
  if (appliedFilters.dateTo) queryFilters.date_to = appliedFilters.dateTo;

  const { data: items = [], isLoading, error } = useQuery<JobApplicationItem[]>({
    queryKey: QK.jobApplications(queryFilters),
    queryFn: () => getJobApplications(queryFilters),
    enabled: isCollaborator,
  });

  function handleApplyFilters() {
    setAppliedFilters(filters);
  }

  function handleClearFilters() {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Portal</p>
        <h2>Mis revisiones</h2>
      </div>

      <article className="panel filters-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Filtros</p>
            <h3>Encuentra postulaciones asignadas</h3>
          </div>
          <div className="panel-actions">
            <button className="button button-secondary" type="button" onClick={handleApplyFilters}>
              Aplicar
            </button>
            <button className="button button-ghost" type="button" onClick={handleClearFilters}>
              Limpiar
            </button>
          </div>
        </div>
        <div className="filters-grid">
          <input
            placeholder="Rol deseado"
            value={filters.desiredRole}
            onChange={(event) => setFilters((current) => ({ ...current, desiredRole: event.target.value }))}
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="empty-state">Asignadas a ti</div>
        </div>
        <div className="filters-dates">
          <label>
            Desde
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
            />
          </label>
        </div>
      </article>

      {!isCollaborator ? <p className="form-error">Solo disponible para colaboradores.</p> : null}
      {error ? <p className="form-error">{error instanceof Error ? error.message : "No se pudieron cargar postulaciones"}</p> : null}

      <article className="panel">
        {isLoading ? <div className="empty-state">Cargando postulaciones...</div> : null}
        {!isLoading && items.length === 0 ? (
          <div className="empty-state">No hay postulaciones asignadas con los filtros actuales.</div>
        ) : null}
        {!isLoading && items.length > 0 ? (
          <div className="card-grid">
            {items.map((item) => (
              <article className="card" key={item.id}>
                <div className="card-header">
                  <div className="card-title">
                    <strong>{item.full_name}</strong>
                    <span className="card-subtitle">{item.email}</span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                      {formatStatus(item.status)}
                    </span>
                  </div>
                </div>
                <div className="card-meta">
                  <div>
                    <span className="card-label">Rol deseado</span>
                    <span>{item.desired_role || "Sin rol"}</span>
                  </div>
                  <div>
                    <span className="card-label">Fecha</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>
                <div className="card-actions">
                  <Link className="button button-secondary" href={`/portal/applications/${item.id}`}>
                    Revisar
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
