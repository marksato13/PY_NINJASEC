"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Monitor, Network, Router, Server } from "lucide-react";

import { DeviceItem, getDevices } from "@/lib/api";
import { getStatusBadgeClass } from "@/lib/role-utils";

// ── Config ───────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  active:         "var(--success)",
  pending_review: "var(--warning)",
  retired:        "var(--muted)",
  unknown:        "var(--muted)",
};

const STATUS_LABEL: Record<string, string> = {
  active:         "Activo",
  pending_review: "Pendiente revisión",
  retired:        "Retirado",
  unknown:        "Desconocido",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  firewall: <Router  size={16} />,
  server:   <Server  size={16} />,
  switch:   <Network size={16} />,
  endpoint: <Monitor size={16} />,
};

function typeIcon(deviceType?: string | null) {
  const key = (deviceType ?? "").toLowerCase();
  for (const [prefix, icon] of Object.entries(TYPE_ICON)) {
    if (key.includes(prefix)) return icon;
  }
  return <Server size={16} />;
}

function typeKey(deviceType?: string | null): string {
  const lower = (deviceType ?? "").toLowerCase();
  if (lower.includes("firewall")) return "Firewall";
  if (lower.includes("server"))   return "Servidor";
  if (lower.includes("switch"))   return "Switch";
  if (lower.includes("endpoint") || lower.includes("pc") || lower.includes("laptop")) return "Endpoint";
  if (lower.includes("printer"))  return "Impresora";
  return deviceType || "Otro";
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PortalInventoryPage() {
  const [filterType,   setFilterType]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: allDevices = [], isLoading, error } = useQuery<DeviceItem[]>({
    queryKey: ["portal-inventory"],
    queryFn:  () => getDevices({}),
  });

  // ── All computed from one pass ────────────────────────────────────────────
  const { kpis, byType, typeOptions } = useMemo(() => {
    let active = 0, pending = 0, retired = 0;
    const typeMap: Record<string, number> = {};

    for (const d of allDevices) {
      if (d.status === "active")         active++;
      if (d.status === "pending_review") pending++;
      if (d.status === "retired")        retired++;
      const t = typeKey(d.device_type);
      typeMap[t] = (typeMap[t] ?? 0) + 1;
    }

    return {
      kpis:        { total: allDevices.length, active, pending, retired },
      byType:      typeMap,
      typeOptions:  Object.keys(typeMap).sort(),
    };
  }, [allDevices]);

  const devices = useMemo(() =>
    allDevices.filter((d) => {
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterType   && typeKey(d.device_type) !== filterType) return false;
      return true;
    }),
  [allDevices, filterStatus, filterType]);

  const hasPending = kpis.pending > 0;

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div><p className="eyebrow">Portal</p><h2>Inventario de activos</h2></div>
        <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{kpis.total} dispositivo{kpis.total !== 1 ? "s" : ""}</span>
      </div>

      {/* Warning banner */}
      {hasPending && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 12,
          background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)",
          color: "var(--warning)", fontSize: "0.88rem", fontWeight: 600,
        }}>
          <AlertTriangle size={16} />
          {kpis.pending} activo{kpis.pending > 1 ? "s" : ""} pendiente{kpis.pending > 1 ? "s" : ""} de revisión — contacta a tu ejecutivo NinjaSec
        </div>
      )}

      {/* KPI cards */}
      <div className="metrics-grid">
        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => { setFilterStatus(""); setFilterType(""); }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Server size={16} style={{ color: "var(--primary)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Total activos</span>
          </div>
          <strong style={{ fontSize: "2rem" }}>{kpis.total}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{typeOptions.length} tipo{typeOptions.length !== 1 ? "s" : ""}</span>
        </article>

        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => setFilterStatus("active")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.9rem", color: "var(--success)" }}>●</span>
            <span className="eyebrow" style={{ margin: 0 }}>Online</span>
          </div>
          <strong style={{ fontSize: "2rem", color: "var(--success)" }}>{kpis.active}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            {kpis.total > 0 ? `${Math.round((kpis.active / kpis.total) * 100)}% del total` : "—"}
          </span>
        </article>

        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => setFilterStatus("pending_review")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} style={{ color: "var(--warning)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Pendientes</span>
          </div>
          <strong style={{ fontSize: "2rem", color: kpis.pending > 0 ? "var(--warning)" : "var(--success)" }}>
            {kpis.pending}
          </strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>requieren revisión</span>
        </article>

        <article className="metric-card panel" style={{ cursor: "pointer" }} onClick={() => setFilterStatus("retired")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>●</span>
            <span className="eyebrow" style={{ margin: 0 }}>Retirados</span>
          </div>
          <strong style={{ fontSize: "2rem", color: "var(--muted)" }}>{kpis.retired}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>fuera de servicio</span>
        </article>
      </div>

      {/* Type breakdown strip */}
      {Object.keys(byType).length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(filterType === type ? "" : type)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 10,
                background: filterType === type ? "var(--primary)" : "var(--panel)",
                border: `1px solid ${filterType === type ? "var(--primary)" : "var(--line)"}`,
                color: filterType === type ? "#fff" : "var(--fg)",
                cursor: "pointer", fontSize: "0.82rem", fontWeight: 500,
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ opacity: 0.8 }}>{typeIcon(type)}</span>
              {type}
              <span style={{
                background: filterType === type ? "rgba(255,255,255,0.25)" : "var(--row)",
                borderRadius: 20, padding: "0 7px",
                fontSize: "0.72rem", fontWeight: 700,
              }}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <article className="panel filters-panel">
        <div className="filters-grid">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="active">● Activo</option>
            <option value="pending_review">● Pendiente revisión</option>
            <option value="retired">● Retirado</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todos los tipos</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filterStatus || filterType) && (
            <button className="button button-ghost" type="button" onClick={() => { setFilterStatus(""); setFilterType(""); }}>
              Limpiar
            </button>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
          Mostrando {devices.length} de {kpis.total} activos
        </span>
      </article>

      {/* Table */}
      <article className="panel">
        {error ? (
          <div className="empty-state state-error">No se pudo cargar el inventario.</div>
        ) : isLoading ? (
          <div className="empty-state">Cargando inventario...</div>
        ) : devices.length === 0 ? (
          <div className="empty-state">Sin activos para los filtros seleccionados.</div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head" style={{ gridTemplateColumns: "24px 1fr 130px 160px 120px" }}>
              <span></span>
              <span>Hostname</span>
              <span>Tipo</span>
              <span>Vendor / Modelo</span>
              <span>Estado</span>
            </div>
            {devices.map((device) => {
              const color = STATUS_COLOR[device.status] ?? "var(--muted)";
              return (
                <div
                  className="table-row"
                  key={device.id}
                  style={{ gridTemplateColumns: "24px 1fr 130px 160px 120px", borderLeft: `3px solid ${color}` }}
                >
                  <span style={{ color, display: "flex", alignItems: "center" }}>
                    {typeIcon(device.device_type)}
                  </span>
                  <span>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{device.hostname}</div>
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {typeIcon(device.device_type)}
                      {typeKey(device.device_type)}
                    </span>
                  </span>
                  <span style={{ fontSize: "0.82rem" }}>
                    {device.vendor && <div>{device.vendor}</div>}
                    {device.model  && <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{device.model}</div>}
                    {!device.vendor && !device.model && <span style={{ color: "var(--muted)" }}>—</span>}
                  </span>
                  <span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: "0.75rem", fontWeight: 600, color,
                    }}>
                      ● {STATUS_LABEL[device.status] ?? device.status}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
