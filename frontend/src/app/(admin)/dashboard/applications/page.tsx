"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  DashboardUser,
  getJobApplications,
  getUsers,
  JobApplicationFilters,
  JobApplicationItem,
} from "@/lib/api";
import { getStoredUser, isAdminRole } from "@/lib/auth";
import { notifyError } from "@/lib/alerts";
import { getStatusBadgeClass } from "@/lib/role-utils";

type FilterState = {
  status: string;
  desiredRole: string;
  reviewerId: string;
  dateFrom: string;
  dateTo: string;
};

const defaultFilters: FilterState = {
  status: "",
  desiredRole: "",
  reviewerId: "",
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

export default function DashboardApplicationsPage() {
  const [items, setItems] = useState<JobApplicationItem[]>([]);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sessionUser = useMemo(() => getStoredUser(), []);
  const isAdmin = sessionUser ? isAdminRole(sessionUser.role) : false;
  const reviewerOptions = useMemo(
    () => users.filter((user) => user.role_code !== "client"),
    [users],
  );

  useEffect(() => {
    if (!isAdmin) return;
    getUsers()
      .then(setUsers)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "No se pudo cargar revisores";
        setError(message);
      });
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const query: JobApplicationFilters = {};
    if (appliedFilters.status) query.status = appliedFilters.status;
    if (appliedFilters.desiredRole) query.desired_role = appliedFilters.desiredRole.trim();
    if (appliedFilters.reviewerId) query.reviewer_id = Number(appliedFilters.reviewerId);
    if (appliedFilters.dateFrom) query.date_from = appliedFilters.dateFrom;
    if (appliedFilters.dateTo) query.date_to = appliedFilters.dateTo;
    getJobApplications(query)
      .then(setItems)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "No se pudieron cargar postulaciones";
        setError(message);
        notifyError("No se pudieron cargar", message);
      })
      .finally(() => setLoading(false));
  }, [appliedFilters]);

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
        <p className="eyebrow">Admin</p>
        <h2>Postulaciones</h2>
      </div>

      <article className="panel filters-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Filtros</p>
            <h3>Filtra por estado, rol o revisor</h3>
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
          {isAdmin ? (
            <select
              value={filters.reviewerId}
              onChange={(event) => setFilters((current) => ({ ...current, reviewerId: event.target.value }))}
            >
              <option value="">Todos los revisores</option>
              {reviewerOptions.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.full_name}
                </option>
              ))}
            </select>
          ) : (
            <div className="empty-state">Asignaciones solo visibles para admin.</div>
          )}
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

      {error ? <p className="form-error">{error}</p> : null}

      <article className="panel">
        {loading ? <div className="empty-state">Cargando postulaciones...</div> : null}
        {!loading && items.length === 0 ? (
          <div className="empty-state">No hay postulaciones registradas con los filtros actuales.</div>
        ) : null}
        {!loading && items.length > 0 ? (
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
                    <span className="card-label">Telefono</span>
                    <span>{item.phone || "-"}</span>
                  </div>
                  <div>
                    <span className="card-label">Origen</span>
                    <span>{item.source || "-"}</span>
                  </div>
                  <div>
                    <span className="card-label">Fecha</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>
                <div className="card-actions">
                  <Link className="button button-secondary" href={`/dashboard/applications/${item.id}`}>
                    Ver detalle
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
