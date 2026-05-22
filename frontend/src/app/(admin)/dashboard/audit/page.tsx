"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AuditItem, DashboardUser, getAuditLogs, getUsers } from "@/lib/api";
import { QK } from "@/lib/query-keys";

const ACTION_BADGE: Record<string, string> = {
  "client.created":       "badge-active",
  "client.updated":       "badge-pending",
  "client.deleted":       "badge-rejected",
  "user.created":         "badge-active",
  "user.updated":         "badge-pending",
  "user.deleted":         "badge-rejected",
  "integration.created":  "badge-active",
  "integration.updated":  "badge-pending",
  "device.created":       "badge-active",
  "device.updated":       "badge-pending",
  "device.retired":       "badge-archived",
  "review.created":       "badge-active",
  "review.updated":       "badge-pending",
  "review.closed":        "badge-approved",
  "ticket.created":       "badge-active",
  "ticket.updated":       "badge-pending",
  "ticket.resolved":      "badge-approved",
};

function actionColor(action: string): string {
  if (action.includes("deleted") || action.includes("retired")) return "var(--danger)";
  if (action.includes("created")) return "var(--success)";
  if (action.includes("updated") || action.includes("closed") || action.includes("resolved")) return "var(--warning)";
  return "var(--primary)";
}

function formatTs(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

export default function DashboardAuditPage() {
  return (
    <Suspense fallback={<div className="state-panel">Cargando auditoría...</div>}>
      <AuditPageInner />
    </Suspense>
  );
}

function AuditPageInner() {
  const searchParams = useSearchParams();
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterEntityId, setFilterEntityId] = useState("");

  // P-02: aceptar filtros via query string (?entity_type=users&entity_id=N)
  useEffect(() => {
    const et = searchParams.get("entity_type");
    const eid = searchParams.get("entity_id");
    if (et) setFilterEntity(et);
    if (eid) setFilterEntityId(eid);
  }, [searchParams]);

  const { data: items = [], error: itemsError } = useQuery<AuditItem[]>({
    queryKey: QK.auditLogs(),
    queryFn: () => getAuditLogs(),
  });

  const { data: users = [] } = useQuery<DashboardUser[]>({
    queryKey: QK.users(),
    queryFn: () => getUsers(),
  });

  const error = itemsError;

  function userName(userId?: number | null) {
    if (!userId) return "Sistema";
    return users.find((u) => u.id === userId)?.full_name || `Usuario #${userId}`;
  }

  const actionTypes = useMemo(() => [...new Set(items.map((i) => i.action))].sort(), [items]);
  const entityTypes = useMemo(() => [...new Set(items.map((i) => i.entity_type).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => items
    .filter((i) => !filterAction || i.action === filterAction)
    .filter((i) => !filterEntity || i.entity_type === filterEntity)
    .filter((i) => !filterEntityId || String(i.entity_id ?? "") === filterEntityId)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
  [items, filterAction, filterEntity, filterEntityId]);

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div><p className="eyebrow">Admin</p><h2>Auditoría</h2></div>
        <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{filtered.length} evento{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {error && <p className="form-error">{error instanceof Error ? error.message : "No se pudo cargar auditoría"}</p>}

      <article className="panel filters-panel">
        <div className="filters-grid">
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="">Todas las acciones</option>
            {actionTypes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
            <option value="">Todas las entidades</option>
            {entityTypes.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <input
            placeholder="ID específico"
            value={filterEntityId}
            onChange={(e) => setFilterEntityId(e.target.value.replace(/\D/g, ""))}
          />
          {(filterAction || filterEntity || filterEntityId) && (
            <button className="button button-ghost" type="button" onClick={() => { setFilterAction(""); setFilterEntity(""); setFilterEntityId(""); }}>
              Limpiar filtros
            </button>
          )}
        </div>
        {filterEntityId && (
          <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
            Filtrando por {filterEntity || "entidad"} #{filterEntityId}
          </p>
        )}
      </article>

      <article className="panel">
        {items.length === 0 ? (
          <div className="empty-state">No hay eventos registrados.</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">Sin eventos para los filtros seleccionados.</div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head" style={{ gridTemplateColumns: "140px auto 1fr auto auto" }}>
              <span>Fecha</span>
              <span>Acción</span>
              <span>Entidad</span>
              <span>ID</span>
              <span>Usuario</span>
            </div>
            {filtered.map((item) => (
              <div className="table-row" key={item.id} style={{ gridTemplateColumns: "140px auto 1fr auto auto" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                  {formatTs(item.created_at)}
                </span>
                <span>
                  <span
                    className={`badge ${ACTION_BADGE[item.action] ?? "badge-draft"}`}
                    style={{ fontSize: "0.68rem", borderLeft: `3px solid ${actionColor(item.action)}` }}
                  >
                    {item.action}
                  </span>
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{item.entity_type || "—"}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{item.entity_id || "—"}</span>
                <span style={{ fontSize: "0.82rem" }}>{userName(item.user_id)}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
