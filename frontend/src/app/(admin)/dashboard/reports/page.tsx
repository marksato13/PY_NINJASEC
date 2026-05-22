"use client";

import { useState } from "react";
import { FileBarChart2, RefreshCw, Server, Shield, Target, Ticket } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DashboardClient,
  DashboardSummaryItem,
  exportConsolidatedReportPdf,
  exportConsolidatedReportXlsx,
  exportDevicesXlsx,
  exportLeadsXlsx,
  exportSecurityReviewPdf,
  getSecurityReviews,
  SecurityReviewItem,
  exportSecurityReviewsXlsx,
  exportSupportTicketsXlsx,
  getClients,
  getDashboardSummary,
  getLeads,
  getLastExports,
  getReportRuns,
  LeadItem,
  ReportRunItem,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { QK } from "@/lib/query-keys";

function relativeDate(iso?: string | null) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)    return "hace un momento";
  if (diff < 60)   return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)} h`;
  const days = Math.floor(diff / 1440);
  return `hace ${days} día${days !== 1 ? "s" : ""}`;
}

// ── Report card ──────────────────────────────────────────────────────────────
interface ReportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  gradientFrom: string;
  meta: { label: string; value: string | number }[];
  lastRun?: ReportRunItem | null;
  onPdf?: () => Promise<void>;
  onXlsx?: () => Promise<void>;
  pdfDisabled?: boolean;
}

function ReportCard({ icon, title, description, accentColor, gradientFrom, meta, lastRun, onPdf, onXlsx, pdfDisabled }: ReportCardProps) {
  const [loadingPdf,  setLoadingPdf]  = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  async function run(action: () => Promise<void>, setLoading: (v: boolean) => void, label: string) {
    setLoading(true);
    try {
      await action();
      notifySuccess(`${label} descargado`);
    } catch (err) {
      notifyError("No se pudo exportar", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  const lastTs = lastRun?.finished_at ?? lastRun?.started_at;

  return (
    <article style={{
      background: `linear-gradient(135deg, ${gradientFrom} 0%, var(--panel) 60%)`,
      border: `1px solid ${accentColor}33`,
      borderTop: `3px solid ${accentColor}`,
      borderRadius: 16,
      padding: "24px 24px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${accentColor}18`,
          border: `1px solid ${accentColor}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          color: accentColor,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{title}</h3>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.4 }}>{description}</p>
        </div>
      </div>

      {/* Metadata preview */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {meta.map((m) => (
          <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 700, color: accentColor, lineHeight: 1 }}>{m.value}</span>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* Last run */}
      {lastTs && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
          Último: {relativeDate(lastTs)}
          {lastRun?.status === "success" && <span style={{ color: "var(--success)", marginLeft: 6 }}>✓</span>}
          {lastRun?.status === "failed"  && <span style={{ color: "var(--danger)",  marginLeft: 6 }}>✗ fallido</span>}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        {onPdf && (
          <button
            className="button button-primary"
            type="button"
            disabled={loadingPdf || !!pdfDisabled}
            onClick={() => run(onPdf, setLoadingPdf, "PDF")}
            style={{ flex: 1, gap: 6, justifyContent: "center" }}
          >
            {loadingPdf ? <RefreshCw size={14} className="spin" /> : <FileBarChart2 size={14} />}
            PDF
          </button>
        )}
        {onXlsx && (
          <button
            className="button button-secondary"
            type="button"
            disabled={loadingXlsx}
            onClick={() => run(onXlsx, setLoadingXlsx, "Excel")}
            style={{ flex: 1, gap: 6, justifyContent: "center" }}
          >
            {loadingXlsx ? <RefreshCw size={14} className="spin" /> : <span style={{ fontSize: "0.9rem" }}>⬇</span>}
            Excel
          </button>
        )}
      </div>
    </article>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardReportsPage() {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<string>("");
  const [loadingReviewPdf, setLoadingReviewPdf] = useState(false);

  const { data: clients = [] } = useQuery<DashboardClient[]>({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
  });

  const { data: runs = [] } = useQuery<ReportRunItem[]>({
    queryKey: QK.reportRuns(),
    queryFn: () => getReportRuns(),
  });

  const { data: lastExports = {} } = useQuery<Record<string, string | null>>({
    queryKey: ["last-exports"],
    queryFn: () => getLastExports(),
  });

  const { data: leads = [] } = useQuery<LeadItem[]>({
    queryKey: QK.leads(),
    queryFn: () => getLeads(),
  });

  const reviewFilters = clientId ? { client_id: Number(clientId) } : undefined;
  const { data: reviewsList = [] } = useQuery<SecurityReviewItem[]>({
    queryKey: QK.reviews(reviewFilters ?? {}),
    queryFn: () => getSecurityReviews(reviewFilters),
  });

  const summaryFilters = { client_id: clientId ? Number(clientId) : undefined };
  const { data: summary = null } = useQuery<DashboardSummaryItem | null>({
    queryKey: QK.dashboardSummary(summaryFilters),
    queryFn: () => getDashboardSummary(summaryFilters),
  });

  // Last run per report type (keyed by first word of type)
  const lastConsolidated = runs.find((r) => r.report_id === 1) ?? null;

  function trackExport(type: string) {
    const now = new Date().toISOString();
    queryClient.setQueryData<Record<string, string | null>>(["last-exports"], (prev = {}) => ({
      ...prev,
      [type]: now,
    }));
  }
  const lastExportFor = (type: string): ReportRunItem | null => {
    const ts = lastExports[type];
    return ts ? { id: 0, report_id: 0, status: "success", finished_at: ts } : null;
  };

  const filters = {
    client_id: clientId ? Number(clientId) : undefined,
    date_from: dateFrom || undefined,
    date_to:   dateTo   || undefined,
  };

  return (
    <section className="page-stack">

      {/* Header */}
      <div className="section-heading">
        <div><p className="eyebrow">Admin</p><h2>Centro de reportes</h2></div>
      </div>

      {/* Global filters panel */}
      <article className="panel" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 200px" }}>
            <label style={{ color: "var(--muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>Cliente</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Todos los clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 140 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: 140 }} />
          </div>
          {(clientId || dateFrom || dateTo) && (
            <button className="button button-ghost" type="button" onClick={() => { setClientId(""); setDateFrom(""); setDateTo(""); }}>
              Limpiar
            </button>
          )}
        </div>
        {clientId && (
          <p style={{ margin: "10px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
            Filtrando por: <strong style={{ color: "var(--primary)" }}>{clients.find((c) => String(c.id) === clientId)?.company_name}</strong>
            {dateFrom && ` · desde ${dateFrom}`}{dateTo && ` · hasta ${dateTo}`}
          </p>
        )}
      </article>

      {/* Requirement: client needed for consolidated */}
      {!clientId && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 10,
          background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)",
          fontSize: "0.82rem", color: "var(--primary)",
        }}>
          <FileBarChart2 size={14} />
          Selecciona un cliente para habilitar el reporte consolidado PDF
        </div>
      )}

      {/* Report cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>

        <ReportCard
          icon={<FileBarChart2 size={22} />}
          title="Reporte Consolidado"
          description="Resumen ejecutivo por cliente: revisiones, hallazgos, tickets y activos en un solo documento."
          accentColor="#3B82F6"
          gradientFrom="rgba(59,130,246,0.04)"
          meta={[
            { label: "Tickets",  value: summary?.tickets.total     ?? "—" },
            { label: "Activos",  value: summary?.inventory.total_devices ?? "—" },
            { label: "Revisiones", value: summary?.reviews.total_executed ?? "—" },
          ]}
          lastRun={lastConsolidated ?? lastExportFor("consolidated")}
          pdfDisabled={!clientId}
          onPdf={clientId ? async () => { await exportConsolidatedReportPdf({ ...filters, client_id: Number(clientId) }); trackExport("consolidated"); } : undefined}
          onXlsx={clientId ? async () => { await exportConsolidatedReportXlsx({ ...filters, client_id: Number(clientId) }); trackExport("consolidated"); } : undefined}
        />

        <ReportCard
          icon={<Server size={22} />}
          title="Inventario de Activos"
          description="Lista completa de dispositivos monitoreados: estado, tipo, consola asignada y sede."
          accentColor="#10B981"
          gradientFrom="rgba(16,185,129,0.04)"
          meta={[
            { label: "Total",     value: summary?.inventory.total_devices  ?? "—" },
            { label: "Activos",   value: summary?.inventory.by_status?.["active"] ?? "—" },
            { label: "Consolas",  value: summary?.inventory.active_consoles ?? "—" },
          ]}
          lastRun={lastExportFor("devices")}
          onXlsx={async () => { await exportDevicesXlsx({ client_id: filters.client_id }); trackExport("devices"); }}
        />

        <ReportCard
          icon={<Ticket size={22} />}
          title="Tickets de Soporte"
          description="Historial de tickets por estado, prioridad y cliente. Incluye SLA y tiempos de resolución."
          accentColor="#F59E0B"
          gradientFrom="rgba(245,158,11,0.04)"
          meta={[
            { label: "Total",     value: summary?.tickets.total       ?? "—" },
            { label: "Abiertos",  value: summary?.tickets.open_count  ?? "—" },
            { label: "Cerrados",  value: summary?.tickets.closed_count ?? "—" },
          ]}
          lastRun={lastExportFor("tickets")}
          onXlsx={async () => { await exportSupportTicketsXlsx(filters); trackExport("tickets"); }}
        />

        <ReportCard
          icon={<Shield size={22} />}
          title="Revisiones de Seguridad"
          description="Agenda de revisiones ejecutadas, tasa de cumplimiento, hallazgos por severidad y recomendaciones."
          accentColor="#8B5CF6"
          gradientFrom="rgba(139,92,246,0.04)"
          meta={[
            { label: "Programadas", value: summary?.reviews.total_scheduled  ?? "—" },
            { label: "Ejecutadas",  value: summary?.reviews.total_executed   ?? "—" },
            { label: "Tasa",        value: summary ? `${summary.reviews.execution_rate_pct}%` : "—" },
          ]}
          lastRun={lastExportFor("reviews")}
          onXlsx={async () => { await exportSecurityReviewsXlsx(filters); trackExport("reviews"); }}
        />

        {/* P-01: Reporte de Seguridad PDF (revisión individual) */}
        <article style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.04) 0%, var(--panel) 60%)",
          border: "1px solid rgba(168,85,247,0.33)",
          borderTop: "3px solid #A855F7",
          borderRadius: 16,
          padding: "24px 24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "rgba(168,85,247,0.18)",
              border: "1px solid rgba(168,85,247,0.33)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              color: "#A855F7",
            }}>
              <Shield size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Reporte de Seguridad (PDF)</h3>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.4 }}>
                Informe individual con resumen ejecutivo, checklist y hallazgos en detalle de una revisión específica.
              </p>
            </div>
          </div>

          <label style={{ display: "grid", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            Revisión
            <select value={selectedReviewId} onChange={(e) => setSelectedReviewId(e.target.value)}>
              <option value="">— Selecciona una revisión —</option>
              {reviewsList.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {clients.find((c) => c.id === r.client_id)?.company_name || `Cliente ${r.client_id}`}{r.findings_count != null ? ` · ${r.findings_count} hallazgo${r.findings_count !== 1 ? "s" : ""}` : ""}
                </option>
              ))}
            </select>
          </label>

          {lastExports["review-pdf"] && (
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
              Último: {relativeDate(lastExports["review-pdf"])}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
            <button
              className="button button-primary"
              type="button"
              disabled={!selectedReviewId || loadingReviewPdf}
              onClick={async () => {
                if (!selectedReviewId) return;
                setLoadingReviewPdf(true);
                try {
                  await exportSecurityReviewPdf(Number(selectedReviewId));
                  trackExport("review-pdf");
                  notifySuccess("PDF descargado");
                } catch (err) {
                  notifyError("No se pudo exportar PDF", err instanceof Error ? err.message : undefined);
                } finally {
                  setLoadingReviewPdf(false);
                }
              }}
              style={{ flex: 1, gap: 6, justifyContent: "center" }}
            >
              {loadingReviewPdf ? <RefreshCw size={14} className="spin" /> : <FileBarChart2 size={14} />}
              Descargar PDF
            </button>
          </div>
        </article>

        <ReportCard
          icon={<Target size={22} />}
          title="Pipeline Comercial"
          description="Estado actual del CRM: leads por etapa, tasa de conversión y datos de contacto de prospectos."
          accentColor="#06B6D4"
          gradientFrom="rgba(6,182,212,0.04)"
          meta={[
            { label: "Total leads", value: leads.length },
            { label: "Ganados",     value: leads.filter((l) => l.status === "CLOSED_WON").length },
            { label: "En propuesta", value: leads.filter((l) => l.status === "PROPOSAL").length },
          ]}
          lastRun={lastExportFor("leads")}
          onXlsx={async () => { await exportLeadsXlsx({ date_from: dateFrom || undefined, date_to: dateTo || undefined }); trackExport("leads"); }}
        />

      </div>

      {/* Findings breakdown panel */}
      {summary && Object.keys(summary.findings.by_severity).length > 0 && (
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Vista previa</p><h3>Hallazgos que incluirá el reporte consolidado</h3></div>
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{summary.findings.total} total</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["critical", "high", "medium", "low", "info"] as const)
              .filter((sev) => summary.findings.by_severity[sev] !== undefined)
              .map((sev) => {
              const count = summary.findings.by_severity[sev] as number;
              const total = summary.findings.total || 1;
              const pct = Math.round((count / total) * 100);
              const color = sev === "critical" ? "var(--danger)" : sev === "high" ? "var(--warning)" : sev === "medium" ? "#F59E0B" : sev === "low" ? "var(--success)" : "#3B82F6";
              return (
                <div key={sev} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 60, fontSize: "0.78rem", color: "var(--muted)", textTransform: "capitalize" }}>{sev}</span>
                  <div style={{ flex: 1, background: "var(--line)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
                  </div>
                  <span style={{ width: 32, textAlign: "right", fontSize: "0.82rem", fontWeight: 600, color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </article>
      )}

    </section>
  );
}
