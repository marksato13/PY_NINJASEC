"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock, Server, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  DeviceItem,
  getDevices,
  getIntegration,
  getSecurityReviews,
  getUsers,
  IntegrationItem,
  SecurityReviewItem,
  updateIntegration,
  DashboardUser,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { QK } from "@/lib/query-keys";

const environments = ["prod", "dev", "lab"];

function formatRelativeDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff < 0) return `en ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? "s" : ""}`;
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff < 30) return `hace ${diff} días`;
  if (diff < 365) return `hace ${Math.floor(diff / 30)} mes${Math.floor(diff / 30) !== 1 ? "es" : ""}`;
  return `hace ${Math.floor(diff / 365)} año${Math.floor(diff / 365) !== 1 ? "s" : ""}`;
}

function HealthIndicator({ status, isExpired }: { status: string; isExpired?: boolean }) {
  const effective = isExpired ? "expired" : status;

  if (effective === "active") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.28)" }}>
        <CheckCircle size={18} style={{ color: "var(--success)" }} />
        <span style={{ color: "var(--success)", fontWeight: 600, fontSize: "0.9rem" }}>Consola operativa</span>
      </div>
    );
  }
  if (effective === "risk") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.28)" }}>
        <AlertTriangle size={18} style={{ color: "var(--danger)" }} />
        <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: "0.9rem" }}>Consola en riesgo — revisión requerida</span>
      </div>
    );
  }
  if (effective === "expired") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.28)" }}>
        <XCircle size={18} style={{ color: "var(--danger)" }} />
        <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: "0.9rem" }}>Licencia vencida</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)" }}>
      <Activity size={18} style={{ color: "var(--warning)" }} />
      <span style={{ color: "var(--warning)", fontWeight: 600, fontSize: "0.9rem" }}>Consola inactiva</span>
    </div>
  );
}

export default function IntegrationDetailPage() {
  const params = useParams();
  const integrationId = Number(params?.id);
  const [saving, setSaving] = useState(false);

  const { data: integration, isLoading: intLoading, error: intError, refetch: refetchIntegration } = useQuery<IntegrationItem>({
    queryKey: QK.integration(integrationId),
    queryFn: () => getIntegration(integrationId),
    enabled: !!integrationId,
  });

  const { data: devices = [] } = useQuery<DeviceItem[]>({
    queryKey: QK.devices({ integration_id: integrationId }),
    queryFn: () => getDevices({ integration_id: integrationId }),
    enabled: !!integrationId,
  });

  const { data: reviews = [] } = useQuery<SecurityReviewItem[]>({
    queryKey: QK.reviews({ integration_id: integrationId }),
    queryFn: () => getSecurityReviews({ integration_id: integrationId }),
    enabled: !!integrationId,
  });

  const { data: users = [] } = useQuery<DashboardUser[]>({
    queryKey: QK.users(),
    queryFn: () => getUsers(),
    enabled: !!integrationId,
  });

  const [localIntegration, setLocalIntegration] = useState<IntegrationItem | null>(null);
  const currentIntegration = localIntegration ?? integration ?? null;

  const loading = intLoading;
  const error = intError ? (intError instanceof Error ? intError.message : "No se pudo cargar la consola") : "";

  async function save() {
    if (!currentIntegration) return;
    setSaving(true);
    try {
      const updated = await updateIntegration(currentIntegration.id, {
        name: currentIntegration.name,
        base_url: currentIntegration.base_url,
        status: currentIntegration.status,
        environment: currentIntegration.environment,
        license_type: currentIntegration.license_type,
        license_expires_at: currentIntegration.license_expires_at,
        responsible_user_id: currentIntegration.responsible_user_id,
      });
      setLocalIntegration(updated);
      notifySuccess("Consola actualizada");
    } catch (err) {
      notifyError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  function userName(userId?: number | null) {
    return users.find((item) => item.id === userId)?.full_name || "Sin responsable";
  }

  if (loading) return <div className="state-panel">Cargando consola...</div>;
  if (error || !currentIntegration) return <div className="state-panel state-error">{error || "Consola no encontrada"}</div>;

  const effectiveStatus = currentIntegration.effective_status || currentIntegration.status;
  const activeDevices = devices.filter((d) => d.status === "active").length;
  const pendingDevices = devices.filter((d) => d.status === "pending_review").length;
  const retiredDevices = devices.filter((d) => d.status === "retired").length;
  const licenseRelative = formatRelativeDate(currentIntegration.license_expires_at);
  const isExpired = currentIntegration.is_license_expired ?? false;
  const lastReview = reviews.length > 0
    ? reviews.reduce((a, b) => (a.executed_at ?? "") > (b.executed_at ?? "") ? a : b)
    : null;
  const daysSinceReview = lastReview?.executed_at
    ? Math.floor((Date.now() - new Date(lastReview.executed_at).getTime()) / 86400000)
    : null;

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Consola · {currentIntegration.connector_type}</p>
          <h2>{currentIntegration.name}</h2>
        </div>
        <div className="panel-actions">
          <Link className="button button-ghost" href="/dashboard/integrations">Volver</Link>
          <span className={`badge ${getStatusBadgeClass(effectiveStatus)}`}>{effectiveStatus}</span>
        </div>
      </div>

      {/* Traffic light health banner */}
      <HealthIndicator status={effectiveStatus} isExpired={isExpired} />

      {/* Alerta explícita — sin revisión en > 90 días */}
      {daysSinceReview !== null && daysSinceReview > 90 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderRadius: 12, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.32)", flexWrap: "wrap" }}>
          <AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />
          <span style={{ color: "var(--warning)", fontWeight: 600, fontSize: "0.88rem", flex: 1, minWidth: 200 }}>
            Esta consola lleva {daysSinceReview} días sin revisión de seguridad. Programa una auditoría para mantener compliance.
          </span>
          <Link
            href={`/dashboard/security-reviews?integration_id=${integrationId}`}
            className="button button-warning button-sm"
          >
            Programar revisión
          </Link>
        </div>
      ) : daysSinceReview === null && reviews.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderRadius: 12, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.32)", flexWrap: "wrap" }}>
          <AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />
          <span style={{ color: "var(--warning)", fontWeight: 600, fontSize: "0.88rem", flex: 1, minWidth: 200 }}>
            Esta consola aún no tiene revisiones de seguridad ejecutadas.
          </span>
          <Link
            href={`/dashboard/security-reviews?integration_id=${integrationId}`}
            className="button button-warning button-sm"
          >
            Programar primera revisión
          </Link>
        </div>
      ) : null}

      {/* KPI strip */}
      <div className="metrics-grid">
        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Server size={16} style={{ color: "var(--primary)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Activos activos</span>
          </div>
          <strong style={{ fontSize: "2rem", color: activeDevices > 0 ? "var(--success)" : "var(--muted)" }}>{activeDevices}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{devices.length} total</span>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} style={{ color: "var(--warning)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Pendientes revisión</span>
          </div>
          <strong style={{ fontSize: "2rem", color: pendingDevices > 0 ? "var(--warning)" : "var(--success)" }}>{pendingDevices}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{retiredDevices} retirados</span>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} style={{ color: isExpired ? "var(--danger)" : "var(--primary)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Licencia</span>
          </div>
          <strong style={{ fontSize: "1.3rem", color: isExpired ? "var(--danger)" : "var(--success)" }}>
            {currentIntegration.license_type || "—"}
          </strong>
          <span style={{ color: isExpired ? "var(--danger)" : "var(--muted)", fontSize: "0.8rem", fontWeight: isExpired ? 600 : 400 }}>
            {currentIntegration.license_expires_at
              ? `Vence ${licenseRelative}`
              : "Sin fecha de vencimiento"}
          </span>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={16} style={{ color: "var(--security)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Revisiones</span>
          </div>
          <strong style={{ fontSize: "2rem", color: reviews.length > 0 ? "var(--success)" : "var(--muted)" }}>{reviews.length}</strong>
          <span style={{ color: daysSinceReview !== null && daysSinceReview > 90 ? "var(--warning)" : "var(--muted)", fontSize: "0.8rem" }}>
            {daysSinceReview !== null
              ? `Último review hace ${daysSinceReview} día${daysSinceReview !== 1 ? "s" : ""}`
              : "Sin reviews ejecutados"}
          </span>
        </article>
      </div>

      {/* Edit form */}
      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Configuración</p><h3>Editar consola</h3></div>
        </div>
        <div className="entity-form">
          <input value={currentIntegration.name} onChange={(e) => setLocalIntegration({ ...currentIntegration, name: e.target.value })} placeholder="Nombre" />
          <input value={currentIntegration.base_url} onChange={(e) => setLocalIntegration({ ...currentIntegration, base_url: e.target.value })} placeholder="Base URL" />
          <select value={currentIntegration.environment || ""} onChange={(e) => setLocalIntegration({ ...currentIntegration, environment: e.target.value })}>
            <option value="">Entorno</option>
            {environments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={currentIntegration.license_type || ""} onChange={(e) => setLocalIntegration({ ...currentIntegration, license_type: e.target.value })} placeholder="Tipo de licencia" />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Vencimiento de licencia</label>
            <input type="date" value={currentIntegration.license_expires_at || ""} onChange={(e) => setLocalIntegration({ ...currentIntegration, license_expires_at: e.target.value })} />
          </div>
          <select value={currentIntegration.responsible_user_id || ""} onChange={(e) => setLocalIntegration({ ...currentIntegration, responsible_user_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Responsable</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
          </select>
          <button className="button button-primary" type="button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </article>

      {/* Devices table */}
      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Inventario</p><h3>Activos asociados</h3></div>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{devices.length} activos</span>
        </div>
        {devices.length === 0 ? (
          <div className="empty-state">No hay activos registrados para esta consola.</div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head table-row-wide"><span>Hostname</span><span>Tipo</span><span>IP</span><span>Asset Tag</span><span>Estado</span></div>
            {devices.map((device) => (
              <div className="table-row table-row-wide" key={device.id}>
                <span>{device.hostname}</span>
                <span>{device.device_type || "-"}</span>
                <span>{device.ip_address || "-"}</span>
                <span>{device.asset_tag || "-"}</span>
                <span><span className={`badge ${getStatusBadgeClass(device.status)}`}>{device.status}</span></span>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* Reviews table */}
      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Seguridad</p><h3>Revisiones</h3></div>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{reviews.length} revisiones</span>
        </div>
        {reviews.length === 0 ? (
          <div className="empty-state">No hay revisiones asociadas.</div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head table-row-wide"><span>ID</span><span>Estado</span><span>Revisor</span><span>Programada</span><span>Acción</span></div>
            {reviews.map((review) => (
              <div className="table-row table-row-wide" key={review.id}>
                <span>#{review.id}</span>
                <span><span className={`badge ${getStatusBadgeClass(review.status)}`}>{review.status}</span></span>
                <span>{userName(review.reviewer_user_id)}</span>
                <span>{review.scheduled_at || "-"}</span>
                <span><Link className="button button-ghost button-sm" href={`/dashboard/security-reviews/${review.id}`}>Ver</Link></span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
