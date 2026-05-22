"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, CheckCircle, Clock, Plus, ShieldAlert } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSecurityReview,
  DashboardClient,
  DashboardUser,
  deleteSecurityReview,
  exportSecurityReviewPdf,
  exportSecurityReviewsXlsx,
  getClients,
  getIntegrations,
  getSecurityReviews,
  getUsers,
  IntegrationItem,
  SecurityReviewItem,
} from "@/lib/api";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";
import { QK } from "@/lib/query-keys";

export default function SecurityReviewsPage() {
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin      = currentUser?.role === "admin" || isSuperAdmin;
  const queryClient  = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", integration_id: "", scheduled_at: "", reviewer_user_id: "" });
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery<DashboardClient[]>({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
  });

  const { data: integrations = [] } = useQuery<IntegrationItem[]>({
    queryKey: QK.integrations(),
    queryFn: () => getIntegrations(),
  });

  const { data: users = [] } = useQuery<DashboardUser[]>({
    queryKey: QK.users(),
    queryFn: () => getUsers(),
  });

  const reviewFilters = { client_id: clientId ? Number(clientId) : undefined, status: status || undefined };
  const { data: reviews = [], isLoading: loading } = useQuery<SecurityReviewItem[]>({
    queryKey: QK.reviews(reviewFilters),
    queryFn: () => getSecurityReviews(reviewFilters),
  });

  function load() {
    queryClient.invalidateQueries({ queryKey: QK.reviews(reviewFilters) });
  }

  function clientName(id: number) {
    return clients.find((c) => c.id === id)?.company_name || `Cliente #${id}`;
  }

  async function handleCreate() {
    if (!form.client_id || !form.integration_id) return;
    setSaving(true);
    try {
      await createSecurityReview({
        client_id: Number(form.client_id),
        integration_id: Number(form.integration_id),
        scheduled_at: form.scheduled_at || null,
        reviewer_user_id: form.reviewer_user_id ? Number(form.reviewer_user_id) : null,
      });
      notifySuccess("Revisión creada");
      setCreateOpen(false);
      setForm({ client_id: "", integration_id: "", scheduled_at: "", reviewer_user_id: "" });
      load();
    } catch (err) {
      notifyError("No se pudo crear", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(review: SecurityReviewItem) {
    const confirmed = await confirmDelete({
      title: `¿Eliminar Revisión #${review.id}?`,
      text: "Se eliminarán todos los hallazgos, checklist y adjuntos.",
    });
    if (!confirmed) return;
    try {
      await deleteSecurityReview(review.id);
      queryClient.setQueryData(QK.reviews(reviewFilters), (prev?: SecurityReviewItem[]) =>
        prev ? prev.filter((r) => r.id !== review.id) : []
      );
      notifySuccess("Revisión eliminada");
    } catch (err) {
      notifyError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  }

  const scheduled   = reviews.filter((r) => r.status === "scheduled").length;
  const inProgress  = reviews.filter((r) => r.status === "in_progress").length;
  const closed      = reviews.filter((r) => r.status === "closed").length;

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div><p className="eyebrow">Admin</p><h2>Agenda de revisiones</h2></div>
        <div className="panel-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() =>
              exportSecurityReviewsXlsx({
                client_id: clientId ? Number(clientId) : undefined,
                review_status: status || undefined,
              }).catch((err) => notifyError("No se pudo exportar", err instanceof Error ? err.message : undefined))
            }
          >
            Exportar XLSX
          </button>
          {isAdmin && (
            <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Nueva revisión
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="metrics-grid">
        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => setStatus("scheduled")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} style={{ color: "var(--warning)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Programadas</span>
          </div>
          <strong style={{ fontSize: "2rem", color: scheduled > 0 ? "var(--warning)" : "var(--muted)" }}>{scheduled}</strong>
        </article>
        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => setStatus("in_progress")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={16} style={{ color: "var(--primary)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>En progreso</span>
          </div>
          <strong style={{ fontSize: "2rem", color: inProgress > 0 ? "var(--primary)" : "var(--muted)" }}>{inProgress}</strong>
        </article>
        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => setStatus("closed")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={16} style={{ color: "var(--success)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Cerradas</span>
          </div>
          <strong style={{ fontSize: "2rem", color: "var(--success)" }}>{closed}</strong>
        </article>
        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => setStatus("")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarCheck size={16} style={{ color: "var(--security)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Total</span>
          </div>
          <strong style={{ fontSize: "2rem" }}>{reviews.length}</strong>
        </article>
      </div>

      {/* Filters */}
      <article className="panel filters-panel">
        <div className="filters-grid">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </article>

      {/* Reviews list */}
      <article className="panel">
        {loading ? (
          <div className="empty-state">Cargando revisiones...</div>
        ) : reviews.length === 0 ? (
          <div className="empty-state">No hay revisiones{status ? ` con estado "${status}"` : ""}.</div>
        ) : (
          <div className="card-grid">
            {reviews.map((review) => (
              <article className="card" key={review.id}>
                <div className="card-header">
                  <div className="card-title">
                    <strong>Revisión #{review.id}</strong>
                    <span className="card-subtitle">{clientName(review.client_id)}</span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge ${getStatusBadgeClass(review.status)}`}>{review.status}</span>
                  </div>
                </div>
                <div className="card-meta">
                  <div>
                    <span className="card-label">Programada</span>
                    <span>{review.scheduled_at?.slice(0, 10) || "—"}</span>
                  </div>
                  <div>
                    <span className="card-label">Revisor</span>
                    <span>{users.find((u) => u.id === review.reviewer_user_id)?.full_name || "Sin asignar"}</span>
                  </div>
                  {review.executed_at && (
                    <div>
                      <span className="card-label">Ejecutada</span>
                      <span>{review.executed_at.slice(0, 10)}</span>
                    </div>
                  )}
                </div>
                <div className="card-actions">
                  <Link className="button button-secondary" href={`/dashboard/security-reviews/${review.id}`}>Ver detalle</Link>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() =>
                      exportSecurityReviewPdf(review.id).catch((err) =>
                        notifyError("No se pudo exportar PDF", err instanceof Error ? err.message : undefined)
                      )
                    }
                  >
                    PDF
                  </button>
                  {isSuperAdmin && (
                    <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(review)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </article>

      <Modal isOpen={createOpen} title="Nueva revisión de seguridad" onClose={() => setCreateOpen(false)}>
        <div className="entity-form">
          <select value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value, integration_id: "" }))}>
            <option value="">Selecciona cliente *</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={form.integration_id} onChange={(e) => setForm((f) => ({ ...f, integration_id: e.target.value }))}>
            <option value="">Selecciona consola *</option>
            {integrations.filter((i) => !form.client_id || i.client_id === Number(form.client_id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Fecha programada</label>
            <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
          </div>
          <select value={form.reviewer_user_id} onChange={(e) => setForm((f) => ({ ...f, reviewer_user_id: e.target.value }))}>
            <option value="">Asignar revisor</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <button className="button button-primary" type="button" onClick={handleCreate} disabled={saving || !form.client_id || !form.integration_id}>
            {saving ? "Creando..." : "Crear revisión"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
