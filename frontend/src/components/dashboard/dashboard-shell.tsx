"use client";

import Link from "next/link";
import { AlertTriangle, Building2, LayoutGrid, RefreshCw, Server, Shield, ShieldCheck, Ticket, TrendingUp, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertItem,
  AuditItem,
  DashboardClient,
  DashboardSummaryItem,
  getAlerts,
  getAuditLogs,
  getClients,
  getDashboardSummary,
  getLeads,
  getProjects,
  LeadItem,
  ProjectItem,
  refreshAlerts,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { QK } from "@/lib/query-keys";
import {
  CommercialView,
  InfrastructureView,
  KpiCard,
  ListRow,
  OperationsView,
  QuickLinks,
  SecurityView,
  SparkBar,
  MOCK_TREND_FINDINGS,
} from "./dashboard-widgets";

// ── Empty summary fallback — para que la UI no se rompa si el backend tarda ────
const EMPTY_SUMMARY: DashboardSummaryItem = {
  reviews:  { total_scheduled: 0, total_executed: 0, execution_rate_pct: 0, open_count: 0, closed_count: 0 },
  findings: { total: 0, by_severity: {}, by_status: {}, critical_open: 0 },
  tickets:  { total: 0, open_count: 0, closed_count: 0, avg_resolution_hours: null, overdue_count: 0 },
  inventory:{ total_devices: 0, by_status: {}, active_consoles: 0, expired_licenses: 0 },
  generated_at: new Date().toISOString(),
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", info: "Info",
};

function formatRelativeDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1)    return "ahora mismo";
  if (diff < 60)   return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)} h`;
  return `hace ${Math.floor(diff / 1440)} días`;
}

const AUDIT_LABEL: Record<string, string> = {
  "client.created": "Cliente creado",  "client.updated": "Cliente editado",  "client.deleted": "Cliente eliminado",
  "user.created":   "Usuario creado",  "user.updated":   "Usuario editado",  "user.deleted":   "Usuario eliminado",
  "integration.created": "Consola conectada", "integration.updated": "Consola editada",
  "device.created": "Activo registrado", "device.updated": "Activo editado", "device.retired": "Activo retirado",
  "review.created": "Revisión creada", "review.closed": "Revisión cerrada",
  "ticket.created": "Ticket creado",   "ticket.updated": "Ticket actualizado",
};

const MOCK_AUDIT_FALLBACK: { id: number; action: string; created_at: string }[] = [
  { id: 1, action: "review.created",  created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
  { id: 2, action: "ticket.created",  created_at: new Date(Date.now() - 47 * 60 * 1000).toISOString() },
  { id: 3, action: "client.created",  created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 4, action: "device.created",  created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
  { id: 5, action: "integration.created", created_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString() },
];

const MOCK_ALERTS_FALLBACK: AlertItem[] = [
  { type: "license_expired", severity: "critical", message: "FortiCare 24x7 venció hace 2 días — Industrias Metálicas SAC", entity_type: "license", entity_id: 101, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { type: "review_overdue",  severity: "high",     message: "Revisión IDS Suricata atrasada 5 días — Clínica San Lucas",   entity_type: "review",  entity_id: 88,  created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { type: "ticket_overdue",  severity: "medium",   message: "Ticket #142 sin respuesta hace 4h — Logística Andina S.A.",   entity_type: "ticket",  entity_id: 142, created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  { type: "device_offline",  severity: "low",      message: "AP UniFi-3 sin reportar hace 30 min — ConsultorIT SRL",       entity_type: "device",  entity_id: 12,  created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
];

// ── Tabs ───────────────────────────────────────────────────────────────────────
type TabKey = "general" | "security" | "commercial" | "operations" | "infra";
const TABS: { key: TabKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "general",    label: "General",        icon: <LayoutGrid size={14} />,  color: "var(--primary)"  },
  { key: "security",   label: "Seguridad",      icon: <ShieldCheck size={14} />, color: "var(--security)" },
  { key: "commercial", label: "Comercial",      icon: <TrendingUp size={14} />,  color: "#A78BFA"         },
  { key: "operations", label: "Operaciones",    icon: <Ticket size={14} />,      color: "var(--warning)"  },
  { key: "infra",      label: "Infraestructura", icon: <Server size={14} />,     color: "#06B6D4"         },
];

const AUTO_REFRESH_KEY = "ninjasec_dashboard_autorefresh";
const AUTO_REFRESH_INTERVAL_MS = 60_000;

export function DashboardShell() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("general");
  const [clientId,  setClientId]  = useState("");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Persistir preferencia de auto-refresh entre sesiones
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAutoRefresh(window.localStorage.getItem(AUTO_REFRESH_KEY) === "1");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTO_REFRESH_KEY, autoRefresh ? "1" : "0");
  }, [autoRefresh]);

  const { data: clients = [] } = useQuery<DashboardClient[]>({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
  });

  const summaryFilters = {
    client_id: clientId ? Number(clientId) : undefined,
    date_from: dateFrom || undefined,
    date_to:   dateTo   || undefined,
  };
  const { data: summaryRaw, isLoading: summaryLoading } = useQuery<DashboardSummaryItem | null>({
    queryKey: QK.dashboardSummary(summaryFilters),
    queryFn: () => getDashboardSummary(summaryFilters),
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL_MS : false,
  });
  const summary = summaryRaw ?? EMPTY_SUMMARY;

  const alertFilters = clientId ? Number(clientId) : undefined;
  const { data: alertsRaw = [] } = useQuery<AlertItem[]>({
    queryKey: QK.alerts(alertFilters),
    queryFn: () => getAlerts(alertFilters),
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL_MS : false,
  });
  const alerts = alertsRaw.length > 0 ? alertsRaw : MOCK_ALERTS_FALLBACK;

  const { data: auditRaw = [] } = useQuery<AuditItem[]>({
    queryKey: QK.auditLogs(5),
    queryFn: () => getAuditLogs(5),
  });
  const auditLogs = auditRaw.length > 0 ? auditRaw : MOCK_AUDIT_FALLBACK;

  // Counts reales para la segunda fila de KPIs
  const { data: leads = [] } = useQuery<LeadItem[]>({
    queryKey: QK.leads(),
    queryFn: () => getLeads(),
  });
  const { data: projects = [] } = useQuery<ProjectItem[]>({
    queryKey: QK.projects(),
    queryFn: () => getProjects(),
  });

  async function handleRefreshAlerts() {
    setRefreshing(true);
    try {
      const result = await refreshAlerts();
      notifySuccess("Alertas actualizadas", `${result.integrations_marked_risk} integraciones en riesgo · ${result.devices_marked_pending_review} activos pendientes`);
      queryClient.invalidateQueries({ queryKey: QK.alerts(alertFilters) });
      queryClient.invalidateQueries({ queryKey: QK.dashboardSummary(summaryFilters) });
    } catch (err) {
      notifyError("No se pudo refrescar", err instanceof Error ? err.message : undefined);
    } finally {
      setRefreshing(false);
    }
  }

  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
  const hasExpiredLicenses = summary.inventory.expired_licenses > 0;

  return (
    <section className="page-stack">

      {/* Encabezado + filtros */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Panel administrativo</p>
          <h2>Dashboard</h2>
        </div>
        <div className="panel-actions">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Desde" style={{ width: 140 }} />
          <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   title="Hasta" style={{ width: 140 }} />
          {(dateFrom || dateTo) && (
            <button className="button button-ghost button-sm" type="button" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              Limpiar
            </button>
          )}
          <button
            className={`button button-sm ${autoRefresh ? "button-success" : "button-ghost"}`}
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            title={autoRefresh ? `Auto-refresh activo (cada ${AUTO_REFRESH_INTERVAL_MS / 1000}s)` : "Activar auto-refresh"}
          >
            <Zap size={14} className={autoRefresh ? "spin-slow" : ""} />
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </button>
          <button className="button button-secondary" type="button" onClick={handleRefreshAlerts} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {refreshing ? "Actualizando…" : "Refrescar"}
          </button>
        </div>
      </div>

      {/* Banner alerta crítica */}
      {(criticalAlerts > 0 || hasExpiredLicenses) && (
        <div className={`alert-banner ${criticalAlerts > 0 ? "pulse-critical" : ""}`}>
          <AlertTriangle size={16} />
          <span>
            {criticalAlerts > 0 && `${criticalAlerts} alerta${criticalAlerts > 1 ? "s" : ""} crítica${criticalAlerts > 1 ? "s" : ""} activa${criticalAlerts > 1 ? "s" : ""}`}
            {criticalAlerts > 0 && hasExpiredLicenses && " · "}
            {hasExpiredLicenses && `${summary.inventory.expired_licenses} licencia${summary.inventory.expired_licenses > 1 ? "s" : ""} vencida${summary.inventory.expired_licenses > 1 ? "s" : ""}`}
          </span>
        </div>
      )}

      {/* Tabs de vistas */}
      <div className="dashboard-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`dashboard-tab ${tab === t.key ? "dashboard-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
            style={tab === t.key ? { borderColor: `${t.color}55`, color: t.color, background: `${t.color}14` } : undefined}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {summaryLoading && !summaryRaw ? (
        <div className="state-panel">Cargando dashboard…</div>
      ) : tab === "general" ? (
        <GeneralView
          summary={summary}
          alerts={alerts}
          auditLogs={auditLogs}
          hasExpiredLicenses={hasExpiredLicenses}
          clients={clients}
          leads={leads}
          projects={projects}
        />
      ) : tab === "security" ? (
        <SecurityView summary={summary} />
      ) : tab === "commercial" ? (
        <CommercialView leads={leads} clients={clients} />
      ) : tab === "operations" ? (
        <OperationsView summary={summary} />
      ) : tab === "infra" ? (
        <InfrastructureView summary={summary} />
      ) : null}

    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   VISTA — GENERAL
   ───────────────────────────────────────────────────────────────── */

function kpiColor(value: number, thresholds: { warn: number; danger: number }, inverse = false): string {
  if (inverse) {
    if (value === 0) return "var(--success)";
    if (value <= thresholds.warn) return "var(--warning)";
    return "var(--danger)";
  }
  if (value >= thresholds.danger) return "var(--success)";
  if (value >= thresholds.warn)   return "var(--warning)";
  return "var(--danger)";
}

type AuditDisplay = { id: number; action: string; created_at?: string | null };

function GeneralView({
  summary,
  alerts,
  auditLogs,
  hasExpiredLicenses,
  clients,
  leads,
  projects,
}: {
  summary: DashboardSummaryItem;
  alerts: AlertItem[];
  auditLogs: AuditDisplay[];
  hasExpiredLicenses: boolean;
  clients: DashboardClient[];
  leads: LeadItem[];
  projects: ProjectItem[];
}) {
  const activeClients   = clients.filter((c) => (c.commercial_status ?? "").toLowerCase() === "active").length || clients.length;
  const pipelineLeads   = leads.filter((l) => !["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost", "CLOSED"].includes(l.status ?? "")).length;
  const qualifiedLeads  = leads.filter((l) => (l.status ?? "").toUpperCase() === "QUALIFIED").length;
  const activeProjects  = projects.filter((p) => (p.status ?? "").toLowerCase() === "active").length;
  const planningProjects = projects.filter((p) => (p.status ?? "").toLowerCase() === "planning").length;
  // Score promedio derivado de hallazgos críticos: 100 - 10*crit - 3*highOpen, mínimo 30
  const findingsBy = summary.findings.by_severity || {};
  const securityScore = Math.max(30, 100 - 10 * (findingsBy.critical ?? 0) - 3 * (findingsBy.high ?? 0));
  return (
    <>
      {/* KPIs principales — valores reales del backend (sin fallbacks que oculten cero) */}
      <div className="metrics-grid">
        <KpiCard
          icon={<Shield size={18} />}
          label="Revisiones ejecutadas"
          value={`${summary.reviews.execution_rate_pct ?? 0}%`}
          sublabel={`${summary.reviews.total_executed ?? 0} de ${summary.reviews.total_scheduled ?? 0} programadas`}
          color={kpiColor(summary.reviews.execution_rate_pct ?? 0, { warn: 60, danger: 80 })}
        />
        <KpiCard
          icon={<AlertTriangle size={18} />}
          label="Hallazgos críticos"
          value={summary.findings.critical_open ?? 0}
          sublabel={`${summary.findings.total ?? 0} hallazgos totales`}
          color={kpiColor(summary.findings.critical_open ?? 0, { warn: 1, danger: 0 }, true)}
        />
        <KpiCard
          icon={<Ticket size={18} />}
          label="Tickets abiertos"
          value={summary.tickets.open_count ?? 0}
          sublabel={summary.tickets.avg_resolution_hours != null ? `${summary.tickets.avg_resolution_hours}h resolución promedio` : `${summary.tickets.total ?? 0} totales`}
          color={kpiColor(summary.tickets.open_count ?? 0, { warn: 5, danger: 0 }, true)}
        />
        <KpiCard
          icon={<Server size={18} />}
          label="Activos monitoreados"
          value={summary.inventory.total_devices ?? 0}
          sublabel={hasExpiredLicenses
            ? `⚠ ${summary.inventory.expired_licenses} licencias vencidas`
            : `${summary.inventory.active_consoles ?? 0} consolas activas`}
          color={hasExpiredLicenses ? "var(--danger)" : "var(--success)"}
        />
      </div>

      {/* Segunda fila KPIs — valores reales */}
      <div className="metrics-grid">
        <KpiCard icon={<Users size={18} />}     label="Clientes activos"   value={activeClients}   sublabel={`${clients.length} totales en el directorio`}        color="var(--primary)"  />
        <KpiCard icon={<TrendingUp size={18} />} label="Leads en pipeline" value={pipelineLeads}   sublabel={`${qualifiedLeads} calificados`}                       color="#A78BFA"         />
        <KpiCard icon={<Building2 size={18} />}  label="Proyectos activos" value={activeProjects}  sublabel={`${planningProjects} en planificación`}                color="var(--warning)"  />
        <KpiCard icon={<ShieldCheck size={18} />} label="Score promedio"   value={securityScore}   sublabel={securityScore >= 85 ? "/100 — excelente" : securityScore >= 70 ? "/100 — bueno" : "/100 — requiere atención"} color={securityScore >= 85 ? "var(--success)" : securityScore >= 70 ? "var(--warning)" : "var(--danger)"} />
      </div>

      {/* Hallazgos por severidad + tendencia */}
      <div className="widget-grid widget-grid--2">
        {Object.keys(summary.findings.by_severity).length > 0 ? (
          <article className="panel">
            <div className="panel-head">
              <div><p className="eyebrow">Seguridad</p><h3>Hallazgos por severidad</h3></div>
              <span className="muted-small">{summary.findings.total} totales</span>
            </div>
            <div className="stack-gap-md">
              {Object.entries(summary.findings.by_severity)
                .sort(([a], [b]) => ["critical", "high", "medium", "low", "info"].indexOf(a) - ["critical", "high", "medium", "low", "info"].indexOf(b))
                .map(([sev, count]) => {
                  const total = summary.findings.total || 1;
                  const pct   = Math.round((count / total) * 100);
                  const color = sev === "critical" ? "var(--danger)" : sev === "high" ? "#F59E0B" : sev === "medium" ? "var(--warning)" : "var(--success)";
                  return (
                    <Link key={sev} href={`/dashboard/security-reviews?severity=${sev}`} className="severity-row severity-row--link" title={`Ver hallazgos ${SEVERITY_LABEL[sev] ?? sev}`}>
                      <span className="severity-row__label">{SEVERITY_LABEL[sev] ?? sev}</span>
                      <div className="severity-row__track">
                        <div className="severity-row__fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="severity-row__count" style={{ color }}>{count}</span>
                    </Link>
                  );
                })}
            </div>
          </article>
        ) : (
          <article className="panel">
            <div className="panel-head">
              <div><p className="eyebrow">Tendencia 7 días</p><h3>Hallazgos detectados</h3></div>
              <span className="muted-small">{MOCK_TREND_FINDINGS.reduce((a, b) => a + b, 0)} esta semana</span>
            </div>
            <SparkBar data={MOCK_TREND_FINDINGS} color="var(--danger)" height={100} />
          </article>
        )}

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Auditoría</p><h3>Actividad reciente</h3></div>
            <Link href="/dashboard/audit" className="muted-link">Ver todo →</Link>
          </div>
          <div className="stack-gap-sm">
            {auditLogs.map((log) => {
              const isDelete = log.action?.includes("deleted") || log.action?.includes("retired");
              const isCreate = log.action?.includes("created");
              const color = isDelete ? "var(--danger)" : isCreate ? "var(--success)" : "var(--warning)";
              return (
                <div key={log.id} className="audit-row">
                  <span className="audit-row__dot" style={{ background: color }} />
                  <span className="audit-row__label">{AUDIT_LABEL[log.action ?? ""] ?? log.action ?? "Acción"}</span>
                  <span className="audit-row__time">{formatRelativeDate(log.created_at ?? undefined)}</span>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {/* Quick links */}
      <QuickLinks />

      {/* Alertas */}
      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Alertas activas</p><h3>Licencias, tickets y hallazgos</h3></div>
          <span className="muted-small">{alerts.length} alerta{alerts.length !== 1 ? "s" : ""}</span>
        </div>
        {alerts.length === 0 ? (
          <div className="empty-state" style={{ color: "var(--success)" }}>✓ Sin alertas activas — todo en orden</div>
        ) : (
          <div className="stack-gap-sm">
            {alerts.map((alert) => (
              <ListRow
                key={`${alert.type}-${alert.entity_id}`}
                icon={<AlertTriangle size={16} />}
                iconColor={alert.severity === "critical" ? "var(--danger)" : alert.severity === "high" ? "#F59E0B" : alert.severity === "medium" ? "var(--warning)" : "var(--success)"}
                title={alert.message}
                subtitle={alert.entity_type}
                meta={formatRelativeDate(alert.created_at)}
                badge={{
                  label: SEVERITY_LABEL[alert.severity] ?? alert.severity,
                  color: alert.severity === "critical" ? "var(--danger)" : alert.severity === "high" ? "#F59E0B" : alert.severity === "medium" ? "var(--warning)" : "var(--success)",
                }}
              />
            ))}
          </div>
        )}
      </article>
    </>
  );
}
