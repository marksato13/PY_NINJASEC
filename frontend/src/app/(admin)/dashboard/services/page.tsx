"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, Zap } from "lucide-react";

import {
  createService,
  createServiceRequest,
  deleteService,
  getServiceRequests,
  getServices,
  ServiceItem,
  ServiceRequestItem,
  updateServiceRequestStatus,
} from "@/lib/api";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { QK } from "@/lib/query-keys";
import { Modal } from "@/components/ui/modal";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; next: string[] }> = {
  NEW:    { label: "Nuevo",       cls: "badge-pending",  next: ["REVIEW", "CLOSED"] },
  REVIEW: { label: "En revisión", cls: "badge-draft",    next: ["CLOSED"]           },
  CLOSED: { label: "Cerrado",     cls: "badge-archived", next: []                   },
};

// category → icon
function serviceIcon(category?: string | null) {
  const lower = (category ?? "").toLowerCase();
  if (lower.includes("security") || lower.includes("segur") || lower.includes("soc"))
    return <ShieldCheck size={20} />;
  if (lower.includes("network") || lower.includes("red") || lower.includes("compliance"))
    return <Zap size={20} />;
  return <Shield size={20} />;
}

function relDate(iso?: string | null) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff < 30)  return `hace ${diff}d`;
  return `hace ${Math.floor(diff / 30)}m`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardServicesPage() {
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin      = currentUser?.role === "admin" || isSuperAdmin;
  const queryClient  = useQueryClient();

  const [requestService, setRequestService] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [createOpen, setCreateOpen]   = useState(false);
  const [createForm, setCreateForm]   = useState({ title: "", category: "", summary: "", description: "", price_label: "", is_public: true, active: true });
  const [createSaving, setCreateSaving] = useState(false);

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: QK.services(),
    queryFn: () => getServices(),
  });

  const { data: requests = [] } = useQuery<ServiceRequestItem[]>({
    queryKey: QK.serviceRequests(),
    queryFn: () => getServiceRequests(),
    enabled: isAdmin,
  });

  const serviceMap = useMemo(() => {
    const m: Record<number, string> = {};
    services.forEach((s) => { m[s.id] = s.title; });
    return m;
  }, [services]);

  const filteredRequests = useMemo(() =>
    requests.filter((r) => !filterStatus || r.status === filterStatus),
  [requests, filterStatus]);

  // KPIs
  const newCount    = requests.filter((r) => r.status === "NEW").length;
  const reviewCount = requests.filter((r) => r.status === "REVIEW").length;

  async function handleRequest() {
    if (!requestService || !form.name || !form.email) return;
    setSending(true);
    try {
      const created = await createServiceRequest({
        service_id:      requestService.id,
        requester_name:  form.name,
        requester_email: form.email,
        message:         form.message || null,
        request_type:    requestService.category || null,
      });
      queryClient.setQueryData<ServiceRequestItem[]>(QK.serviceRequests(), (prev = []) => [created, ...prev]);
      notifySuccess("Solicitud enviada", `Nos pondremos en contacto a ${form.email}`);
      setRequestService(null);
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      notifyError("No se pudo enviar", err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateService() {
    if (!createForm.title || !currentUser) return;
    setCreateSaving(true);
    const slug = createForm.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    try {
      const created = await createService({
        organization_id: currentUser.organization_id ?? 1,
        title:       createForm.title,
        slug,
        category:    createForm.category || null,
        summary:     createForm.summary || null,
        description: createForm.description || null,
        price_label: createForm.price_label || null,
        is_public:   createForm.is_public,
        active:      createForm.active,
      });
      queryClient.setQueryData<ServiceItem[]>(QK.services(), (prev = []) => [...prev, created]);
      notifySuccess("Servicio creado");
      setCreateOpen(false);
      setCreateForm({ title: "", category: "", summary: "", description: "", price_label: "", is_public: true, active: true });
    } catch (err) {
      notifyError("No se pudo crear", err instanceof Error ? err.message : undefined);
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleDeleteService(service: ServiceItem) {
    const confirmed = await confirmDelete({ title: `¿Eliminar "${service.title}"?`, text: "Se eliminará del catálogo." });
    if (!confirmed) return;
    try {
      await deleteService(service.id);
      queryClient.setQueryData<ServiceItem[]>(QK.services(), (prev = []) => prev.filter((s) => s.id !== service.id));
      notifySuccess("Servicio eliminado");
    } catch (err) {
      notifyError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleStatusChange(req: ServiceRequestItem, newStatus: string) {
    try {
      const updated = await updateServiceRequestStatus(req.id, newStatus);
      queryClient.setQueryData<ServiceRequestItem[]>(QK.serviceRequests(), (prev = []) =>
        prev.map((r) => r.id === req.id ? updated : r)
      );
      notifySuccess("Estado actualizado");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div><p className="eyebrow">Admin</p><h2>Servicios</h2></div>
        {isAdmin && (
          <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
            Nuevo servicio
          </button>
        )}
      </div>

      {/* ── CATALOG ── */}
      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Catálogo</p><h3>Servicios disponibles</h3></div>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{services.filter((s) => s.active).length} activos</span>
        </div>

        {services.length === 0 ? (
          <div className="empty-state">No hay servicios registrados.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {services.filter((s) => s.active).map((service) => (
              <article key={service.id} style={{
                borderLeft: "3px solid var(--security)",
                background: "var(--panel)",
                borderRadius: 14,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transition: "box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: "rgba(16,185,129,0.12)", color: "var(--security)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {serviceIcon(service.category)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{service.title}</div>
                    {service.category && (
                      <div style={{ color: "var(--security)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
                        {service.category}
                      </div>
                    )}
                  </div>
                </div>

                {service.summary && (
                  <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0, lineHeight: 1.5 }}>
                    {service.summary}
                  </p>
                )}

                {service.description && (
                  <p style={{ fontSize: "0.8rem", margin: 0, lineHeight: 1.5, color: "var(--fg)" }}>
                    {service.description}
                  </p>
                )}

                {service.price_label && (
                  <div style={{
                    padding: "8px 12px", borderRadius: 8,
                    background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                    fontSize: "0.78rem", fontWeight: 600, color: "var(--primary)",
                    display: "inline-flex", alignSelf: "flex-start", gap: 6,
                  }}>
                    💰 {service.price_label}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => setRequestService(service)}
                    style={{ flex: 1, gap: 6 }}
                  >
                    <Shield size={13} /> Solicitar
                  </button>
                  {isSuperAdmin && (
                    <button
                      className="button button-danger button-sm"
                      type="button"
                      onClick={() => handleDeleteService(service)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </article>

      {/* ── REQUESTS (admin only) ── */}
      {isAdmin && (
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Gestión</p><h3>Solicitudes recibidas</h3></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {newCount > 0 && <span className="badge badge-pending">{newCount} nuevas</span>}
              {reviewCount > 0 && <span className="badge badge-draft">{reviewCount} en revisión</span>}
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ fontSize: "0.82rem" }}>
                <option value="">Todos</option>
                <option value="NEW">Nuevo</option>
                <option value="REVIEW">En revisión</option>
                <option value="CLOSED">Cerrado</option>
              </select>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="empty-state">
              {filterStatus ? `Sin solicitudes con estado "${STATUS_CFG[filterStatus]?.label ?? filterStatus}".` : "No hay solicitudes recibidas aún."}
            </div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head" style={{ gridTemplateColumns: "1fr 160px 1fr auto 100px auto" }}>
                <span>Solicitante</span>
                <span>Servicio</span>
                <span>Mensaje</span>
                <span>Estado</span>
                <span>Fecha</span>
                <span>Acción</span>
              </div>
              {filteredRequests.map((req) => {
                const cfg  = STATUS_CFG[req.status] ?? { label: req.status, cls: "badge-draft", next: [] };
                return (
                  <div className="table-row" key={req.id} style={{ gridTemplateColumns: "1fr 160px 1fr auto 100px auto", alignItems: "center" }}>
                    <span>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{req.requester_name}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.73rem" }}>{req.requester_email}</div>
                    </span>
                    <span style={{ fontSize: "0.82rem" }}>{serviceMap[req.service_id] ?? `#${req.service_id}`}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                      {req.message ? req.message.slice(0, 60) + (req.message.length > 60 ? "…" : "") : "—"}
                    </span>
                    <span><span className={`badge ${cfg.cls}`}>{cfg.label}</span></span>
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{relDate(req.created_at)}</span>
                    <span style={{ display: "flex", gap: 4 }}>
                      {cfg.next.map((ns) => (
                        <button key={ns} type="button"
                          className={`button button-sm ${ns === "CLOSED" ? "button-ghost" : "button-secondary"}`}
                          onClick={() => handleStatusChange(req, ns)}
                        >
                          {STATUS_CFG[ns]?.label ?? ns}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      )}

      {/* ── CREATE SERVICE MODAL ── */}
      <Modal isOpen={createOpen} title="Nuevo servicio" onClose={() => setCreateOpen(false)}>
        <div className="entity-form">
          <input
            value={createForm.title}
            onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Nombre del servicio *"
          />
          <input
            value={createForm.category}
            onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Categoría (ej: Seguridad, Networking, Compliance)"
          />
          <input
            value={createForm.summary}
            onChange={(e) => setCreateForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder="Resumen breve (máx 255 chars)"
          />
          <textarea
            value={createForm.description}
            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descripción completa del servicio"
            rows={4}
          />
          <input
            value={createForm.price_label}
            onChange={(e) => setCreateForm((f) => ({ ...f, price_label: e.target.value }))}
            placeholder="Precio referencial (ej: Desde S/ 800/mes, Cotización a medida)"
          />
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "4px 0" }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={createForm.active}
                onChange={(e) => setCreateForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span style={{ fontSize: "0.85rem", color: createForm.active ? "var(--success)" : "var(--muted)" }}>
                {createForm.active ? "Activo" : "Inactivo"}
              </span>
            </label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={createForm.is_public}
                onChange={(e) => setCreateForm((f) => ({ ...f, is_public: e.target.checked }))}
              />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span style={{ fontSize: "0.85rem", color: createForm.is_public ? "var(--primary)" : "var(--muted)" }}>
                {createForm.is_public ? "Público en /servicios" : "Solo interno"}
              </span>
            </label>
          </div>
          <button
            className="button button-primary"
            type="button"
            disabled={createSaving || !createForm.title}
            onClick={handleCreateService}
          >
            {createSaving ? "Creando..." : "Crear servicio"}
          </button>
        </div>
      </Modal>

      {/* ── REQUEST MODAL ── */}
      <Modal isOpen={!!requestService} title={`Solicitar: ${requestService?.title ?? ""}`} onClose={() => setRequestService(null)}>
        <div className="entity-form">
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "0.82rem", color: "var(--muted)", marginBottom: 4 }}>
            <strong style={{ color: "var(--security)" }}>
              {serviceIcon(requestService?.category)} {requestService?.category}
            </strong>
            <p style={{ margin: "4px 0 0" }}>{requestService?.summary}</p>
          </div>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre completo *"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email de contacto *"
            required
          />
          <textarea
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Cuéntanos sobre tu necesidad, empresa y contexto..."
            rows={4}
          />
          <button
            className="button button-primary"
            type="button"
            onClick={handleRequest}
            disabled={sending || !form.name || !form.email}
            style={{ gap: 6 }}
          >
            <Shield size={14} />
            {sending ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
