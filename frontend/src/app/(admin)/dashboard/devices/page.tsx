"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ClientSiteItem,
  createDevice,
  DashboardClient,
  DashboardUser,
  DeviceCriticality,
  DeviceDataClassification,
  DeviceItem,
  exportDevicesXlsx,
  getAllClientSites,
  getClients,
  getDevices,
  getIntegrations,
  getUsers,
  IntegrationItem,
  retireDevice,
  updateDevice,
} from "@/lib/api";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";
import { QK } from "@/lib/query-keys";

const DEVICE_TYPES = ["firewall", "switch", "server", "endpoint", "router", "ap", "camera", "other"];
const STATUS_OPTIONS = ["active", "maintenance", "pending_review", "offline", "decommissioned"];
const CRITICALITY_OPTIONS: DeviceCriticality[] = ["low", "medium", "high", "critical"];
const CLASSIFICATION_OPTIONS: DeviceDataClassification[] = ["public", "internal", "confidential", "restricted"];

const CRITICALITY_LABEL: Record<DeviceCriticality, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const CLASSIFICATION_LABEL: Record<DeviceDataClassification, string> = {
  public: "Pública",
  internal: "Interna",
  confidential: "Confidencial",
  restricted: "Restringida",
};

function criticalityStyle(level?: string | null) {
  switch (level) {
    case "critical": return { bg: "rgba(220,38,38,0.15)",  border: "rgba(220,38,38,0.45)",  color: "#FCA5A5" };
    case "high":     return { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.45)", color: "#FCD34D" };
    case "medium":   return { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.45)", color: "#93C5FD" };
    case "low":      return { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.45)", color: "#6EE7B7" };
    default:         return null;
  }
}

function classificationStyle(level?: string | null) {
  switch (level) {
    case "restricted":   return { bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.45)", color: "#D8B4FE" };
    case "confidential": return { bg: "rgba(236,72,153,0.15)", border: "rgba(236,72,153,0.45)", color: "#F9A8D4" };
    case "internal":     return { bg: "rgba(100,116,139,0.18)", border: "rgba(100,116,139,0.5)", color: "#CBD5E1" };
    case "public":       return { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)",  color: "#A7F3D0" };
    default:             return null;
  }
}

function formatLastSeen(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)    return "ahora";
  if (diff < 60)   return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)}d`;
}

export default function DashboardDevicesPage() {
  const currentUser    = getStoredUser();
  const isSuperAdmin   = currentUser?.role === "super_admin";
  const isAdmin        = currentUser?.role === "admin" || isSuperAdmin;
  const isStaff        = isAdmin || currentUser?.role === "collaborator";
  const queryClient    = useQueryClient();

  const [clientFilter, setClientFilter]          = useState("");
  const [integFilter, setIntegFilter]            = useState("");
  const [typeFilter, setTypeFilter]              = useState("");
  const [statusFilter, setStatusFilter]          = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [createOpen, setCreateOpen]              = useState(false);
  const [editItem, setEditItem]                  = useState<DeviceItem | null>(null);
  const [form, setForm]                          = useState({
    integration_id: "", hostname: "", vendor: "", model: "",
    ip_address: "", device_type: "", status: "active", asset_tag: "",
    criticality: "", data_classification: "", responsible_user_id: "",
  });

  const { data: clients = [] } = useQuery<DashboardClient[]>({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
  });

  const { data: integrations = [] } = useQuery<IntegrationItem[]>({
    queryKey: QK.integrations(),
    queryFn: () => getIntegrations(),
  });

  const { data: sites = [] } = useQuery<ClientSiteItem[]>({
    queryKey: ["client-sites", "all"],
    queryFn: () => getAllClientSites(),
  });
  const siteName = (id?: number | null) =>
    id ? sites.find((s) => s.id === id)?.name ?? `Sede #${id}` : null;

  const { data: allUsers = [] } = useQuery<DashboardUser[]>({
    queryKey: QK.users(),
    queryFn: () => getUsers(),
    enabled: isAdmin,
  });
  const ownerCandidates = allUsers.filter(
    (u) => u.is_active && (u.role_code === "super_admin" || u.role_code === "admin" || u.role_code === "collaborator")
  );
  const userName = (id?: number | null) =>
    id ? allUsers.find((u) => u.id === id)?.full_name ?? `Usuario #${id}` : null;

  const deviceFilters = {
    client_id:      clientFilter      ? Number(clientFilter) : undefined,
    integration_id: integFilter       ? Number(integFilter)  : undefined,
  };

  const { data: rawDevices = [] } = useQuery<DeviceItem[]>({
    queryKey: QK.devices(deviceFilters),
    queryFn:  () => getDevices(deviceFilters),
  });

  const devices = rawDevices.filter((d) => {
    if (typeFilter        && (d.device_type || "other") !== typeFilter) return false;
    if (statusFilter      && d.status !== statusFilter) return false;
    if (criticalityFilter && (d.criticality || "") !== criticalityFilter) return false;
    return true;
  });

  const pendingCount = rawDevices.filter((d) => d.status === "pending_review").length;

  // Lookup helpers
  function integrationName(id?: number | null) {
    if (!id) return "Sin integración";
    return integrations.find((i) => i.id === id)?.name ?? `Consola ${id}`;
  }
  function clientName(integId?: number | null) {
    if (!integId) return "—";
    const integ = integrations.find((i) => i.id === integId);
    return clients.find((c) => c.id === integ?.client_id)?.company_name ?? "—";
  }

  // Group devices by type, preserving DEVICE_TYPES order
  const grouped = DEVICE_TYPES.reduce<Record<string, DeviceItem[]>>((acc, t) => {
    const group = devices.filter((d) => (d.device_type || "other") === t);
    if (group.length > 0) acc[t] = group;
    return acc;
  }, {});
  // Catch any unexpected types
  devices.forEach((d) => {
    const t = d.device_type || "other";
    if (!grouped[t]) grouped[t] = [];
    if (!grouped[t].includes(d)) grouped[t].push(d);
  });

  function loadDevices() {
    queryClient.invalidateQueries({ queryKey: QK.devices(deviceFilters) });
  }

  async function saveCreate() {
    if (!form.hostname) return;
    try {
      await createDevice({
        integration_id: form.integration_id ? Number(form.integration_id) : null,
        hostname:    form.hostname,
        vendor:      form.vendor || null,
        model:       form.model  || null,
        ip_address:  form.ip_address || null,
        device_type: form.device_type || null,
        status:      form.status,
        asset_tag:   form.asset_tag || null,
        site_id:     null,
        serial_number: null,
        device_owner:  null,
        criticality:         (form.criticality as DeviceCriticality) || null,
        data_classification: (form.data_classification as DeviceDataClassification) || null,
        responsible_user_id: form.responsible_user_id ? Number(form.responsible_user_id) : null,
      });
      notifySuccess("Activo creado");
      setCreateOpen(false);
      setForm({
        integration_id: "", hostname: "", vendor: "", model: "",
        ip_address: "", device_type: "", status: "active", asset_tag: "",
        criticality: "", data_classification: "", responsible_user_id: "",
      });
      loadDevices();
    } catch (err) {
      notifyError("No se pudo crear", err instanceof Error ? err.message : undefined);
    }
  }

  async function saveEdit() {
    if (!editItem) return;
    try {
      await updateDevice(editItem.id, editItem);
      notifySuccess("Activo actualizado");
      setEditItem(null);
      loadDevices();
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleRetire(device: DeviceItem) {
    const confirmed = await confirmDelete({
      title: `¿Retirar "${device.hostname}"?`,
      text: "El activo pasará a estado retirado (no se elimina físicamente).",
    });
    if (!confirmed) return;
    try {
      await retireDevice(device.id);
      notifySuccess("Activo retirado");
      loadDevices();
    } catch (err) {
      notifyError("No se pudo retirar", err instanceof Error ? err.message : undefined);
    }
  }

  const visibleIntegrations = integrations.filter(
    (i) => !clientFilter || i.client_id === Number(clientFilter)
  );

  return (
    <section className="page-stack">
      {/* Heading */}
      <div className="section-heading">
        <div><p className="eyebrow">Inventario</p><h2>Dispositivos</h2></div>
        <div className="panel-actions">
          {isAdmin && (
            <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
              Agregar activo
            </button>
          )}
          <button
            className="button button-ghost"
            type="button"
            onClick={() =>
              exportDevicesXlsx({
                client_id:      clientFilter ? Number(clientFilter) : undefined,
                integration_id: integFilter  ? Number(integFilter)  : undefined,
              }).catch((err) => notifyError("No se pudo exportar", err instanceof Error ? err.message : undefined))
            }
          >
            Exportar XLSX
          </button>
        </div>
      </div>

      <div className="state-panel">
        Puedes crear equipos en inventario <strong>sin integración</strong>. Luego, cuando corresponda, los asocias a una consola firewall.
      </div>

      {/* Banner pending_review */}
      {pendingCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 12,
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)",
          color: "var(--warning)", fontSize: "0.88rem", fontWeight: 600,
        }}>
          <AlertTriangle size={16} />
          {pendingCount} activo{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""} de revisión
        </div>
      )}

      {/* Filtros */}
      <article className="panel filters-panel">
        <div className="filters-grid">
          <select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); setIntegFilter(""); }}>
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={integFilter} onChange={(e) => setIntegFilter(e.target.value)}>
            <option value="">Todas las consolas</option>
            {visibleIntegrations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
          </select>
        </div>
        {/* Pills de tipo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8 }}>
          <button
            type="button"
            className={`badge ${!typeFilter ? "badge-active" : "badge-draft"}`}
            style={{ cursor: "pointer", padding: "5px 14px" }}
            onClick={() => setTypeFilter("")}
          >
            Todos ({rawDevices.length})
          </button>
          {DEVICE_TYPES.map((t) => {
            const count = rawDevices.filter((d) => (d.device_type || "other") === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                type="button"
                className={`badge ${typeFilter === t ? "badge-active" : "badge-draft"}`}
                style={{ cursor: "pointer", padding: "5px 14px", textTransform: "capitalize" }}
                onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
        {/* Pills de criticidad — ISO 27001 A.8.1.2 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 4 }}>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Criticidad
          </span>
          <button
            type="button"
            className={`badge ${!criticalityFilter ? "badge-active" : "badge-draft"}`}
            style={{ cursor: "pointer", padding: "4px 12px", fontSize: "0.72rem" }}
            onClick={() => setCriticalityFilter("")}
          >
            Todas
          </button>
          {CRITICALITY_OPTIONS.map((c) => {
            const count = rawDevices.filter((d) => d.criticality === c).length;
            const s = criticalityStyle(c)!;
            const isActive = criticalityFilter === c;
            return (
              <button
                key={c}
                type="button"
                style={{
                  cursor: "pointer", padding: "4px 12px", fontSize: "0.72rem",
                  borderRadius: 999, fontWeight: 600,
                  background: isActive ? s.bg : "transparent",
                  border: `1px solid ${s.border}`,
                  color: s.color,
                }}
                onClick={() => setCriticalityFilter(isActive ? "" : c)}
              >
                {CRITICALITY_LABEL[c]} ({count})
              </button>
            );
          })}
          {(() => {
            const sinCount = rawDevices.filter((d) => !d.criticality).length;
            if (sinCount === 0) return null;
            return (
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontStyle: "italic" }}>
                · {sinCount} sin clasificar
              </span>
            );
          })()}
        </div>
      </article>

      {/* Cards agrupadas por tipo */}
      {devices.length === 0 ? (
        <div className="empty-state">No hay dispositivos con los filtros seleccionados.</div>
      ) : (
        Object.entries(grouped).map(([type, group]) => (
          <div key={type} className="category-block">
            <div className="category-head">
              <div className="category-title">
                <span className="badge badge-draft" style={{ textTransform: "capitalize", fontSize: "0.78rem", padding: "4px 12px" }}>
                  {type}
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  {group.length} activo{group.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {group.map((device) => (
                <article
                  className="card"
                  key={device.id}
                  style={{
                    borderLeft: `3px solid ${
                      device.status === "active"         ? "var(--success)"
                      : device.status === "pending_review" ? "var(--warning)"
                      : device.status === "maintenance"    ? "#F59E0B"
                      : device.status === "offline"        ? "var(--danger)"
                      : "var(--muted)"
                    }`,
                  }}
                >
                  <div className="card-header">
                    <div className="card-title">
                      <strong style={{ fontSize: "0.9rem" }}>{device.hostname}</strong>
                      <span className="card-subtitle">{device.ip_address || "Sin IP"}</span>
                    </div>
                    <span className={`badge ${getStatusBadgeClass(device.status)}`}>{device.status}</span>
                  </div>
                  {(device.criticality || device.data_classification) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {device.criticality && (() => {
                        const s = criticalityStyle(device.criticality)!;
                        return (
                          <span style={{
                            fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em",
                            padding: "2px 8px", borderRadius: 999,
                            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                            textTransform: "uppercase",
                          }}>
                            ◉ {CRITICALITY_LABEL[device.criticality as DeviceCriticality]}
                          </span>
                        );
                      })()}
                      {device.data_classification && (() => {
                        const s = classificationStyle(device.data_classification)!;
                        return (
                          <span style={{
                            fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.03em",
                            padding: "2px 8px", borderRadius: 999,
                            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                            textTransform: "uppercase",
                          }}>
                            🔒 {CLASSIFICATION_LABEL[device.data_classification as DeviceDataClassification]}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  <div className="card-meta" style={{ fontSize: "0.8rem" }}>
                    <div><span className="card-label">Cliente</span><span>{clientName(device.integration_id)}</span></div>
                    <div><span className="card-label">Consola</span><span>{integrationName(device.integration_id)}</span></div>
                    {siteName(device.site_id) && <div><span className="card-label">Sede</span><span>{siteName(device.site_id)}</span></div>}
                    {device.vendor && <div><span className="card-label">Fabricante</span><span>{device.vendor}{device.model ? ` · ${device.model}` : ""}</span></div>}
                    {userName(device.responsible_user_id) && (
                      <div><span className="card-label">Responsable</span><span>{userName(device.responsible_user_id)}</span></div>
                    )}
                    {device.last_seen_at && <div><span className="card-label">Última vista</span><span>{formatLastSeen(device.last_seen_at)}</span></div>}
                  </div>
                  <div className="card-actions">
                    {isStaff && (
                      <button className="button button-secondary button-sm" type="button" onClick={() => setEditItem(device)}>
                        Editar
                      </button>
                    )}
                    {isSuperAdmin && device.status !== "decommissioned" && (
                      <button className="button button-danger button-sm" type="button" onClick={() => handleRetire(device)}>
                        Retirar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal: crear */}
      <Modal isOpen={createOpen} title="Agregar activo" onClose={() => setCreateOpen(false)}>
        <div className="entity-form">
          <select value={form.integration_id} onChange={(e) => setForm((f) => ({ ...f, integration_id: e.target.value }))}>
            <option value="">Sin integración (inventario base)</option>
            {integrations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input value={form.hostname} onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))} placeholder="Hostname *" />
          <select value={form.device_type} onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}>
            <option value="">Tipo de dispositivo</option>
            {DEVICE_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t}</option>)}
          </select>
          <input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Fabricante" />
          <input value={form.model}  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}  placeholder="Modelo" />
          <input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} placeholder="Dirección IP" />
          <input value={form.asset_tag}  onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))}  placeholder="Asset Tag" />
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
          </select>
          <div style={{ gridColumn: "1 / -1", padding: "6px 0 2px", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Gestión de activos (ISO 27001 A.8)
          </div>
          <select value={form.criticality} onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}>
            <option value="">Criticidad</option>
            {CRITICALITY_OPTIONS.map((c) => <option key={c} value={c}>{CRITICALITY_LABEL[c]}</option>)}
          </select>
          <select value={form.data_classification} onChange={(e) => setForm((f) => ({ ...f, data_classification: e.target.value }))}>
            <option value="">Clasificación de datos</option>
            {CLASSIFICATION_OPTIONS.map((c) => <option key={c} value={c}>{CLASSIFICATION_LABEL[c]}</option>)}
          </select>
          <select value={form.responsible_user_id} onChange={(e) => setForm((f) => ({ ...f, responsible_user_id: e.target.value }))}>
            <option value="">Responsable del activo</option>
            {ownerCandidates.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <button className="button button-primary" type="button" onClick={saveCreate}>Guardar</button>
        </div>
      </Modal>

      {/* Modal: editar */}
      <Modal isOpen={!!editItem} title={editItem ? `Editar: ${editItem.hostname}` : ""} onClose={() => setEditItem(null)}>
        {editItem ? (
          <div className="entity-form">
            <input value={editItem.hostname} onChange={(e) => setEditItem({ ...editItem, hostname: e.target.value })} placeholder="Hostname" />
            <select value={editItem.device_type || ""} onChange={(e) => setEditItem({ ...editItem, device_type: e.target.value })}>
              <option value="">Tipo</option>
              {DEVICE_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t}</option>)}
            </select>
            <input value={editItem.vendor || ""} onChange={(e) => setEditItem({ ...editItem, vendor: e.target.value })} placeholder="Fabricante" />
            <input value={editItem.model  || ""} onChange={(e) => setEditItem({ ...editItem, model: e.target.value })}  placeholder="Modelo" />
            <input value={editItem.ip_address || ""} onChange={(e) => setEditItem({ ...editItem, ip_address: e.target.value })} placeholder="IP" />
            <input value={editItem.asset_tag  || ""} onChange={(e) => setEditItem({ ...editItem, asset_tag: e.target.value })}  placeholder="Asset Tag" />
            <select value={editItem.status} onChange={(e) => setEditItem({ ...editItem, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
            </select>
            <div style={{ gridColumn: "1 / -1", padding: "6px 0 2px", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Gestión de activos (ISO 27001 A.8)
            </div>
            <select
              value={editItem.criticality || ""}
              onChange={(e) => setEditItem({ ...editItem, criticality: (e.target.value || null) as DeviceCriticality | null })}
            >
              <option value="">Criticidad</option>
              {CRITICALITY_OPTIONS.map((c) => <option key={c} value={c}>{CRITICALITY_LABEL[c]}</option>)}
            </select>
            <select
              value={editItem.data_classification || ""}
              onChange={(e) => setEditItem({ ...editItem, data_classification: (e.target.value || null) as DeviceDataClassification | null })}
            >
              <option value="">Clasificación de datos</option>
              {CLASSIFICATION_OPTIONS.map((c) => <option key={c} value={c}>{CLASSIFICATION_LABEL[c]}</option>)}
            </select>
            <select
              value={editItem.responsible_user_id ?? ""}
              onChange={(e) => setEditItem({ ...editItem, responsible_user_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Responsable del activo</option>
              {ownerCandidates.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <button className="button button-primary" type="button" onClick={saveEdit}>Guardar cambios</button>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
