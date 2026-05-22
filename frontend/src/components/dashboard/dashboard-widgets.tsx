"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Network,
  Plug,
  Server,
  Shield,
  ShieldCheck,
  Target,
  Ticket,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import type { DashboardSummaryItem } from "@/lib/api";

/* ─────────────────────────────────────────────────────────────────
   Helpers visuales reutilizables
   ───────────────────────────────────────────────────────────────── */

type KpiCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  trend?: { value: number; direction: "up" | "down" };
};

export function KpiCard({ icon, label, value, sublabel, color, trend }: KpiCardProps) {
  return (
    <article className="metric-card panel kpi-card">
      <div className="kpi-card__head">
        <span className="kpi-card__icon" style={{ background: `${color ?? "var(--primary)"}1A`, color: color ?? "var(--primary)" }}>
          {icon}
        </span>
        <span className="kpi-card__label">{label}</span>
      </div>
      <div className="kpi-card__value-row">
        <strong className="kpi-card__value" style={{ color: color ?? "var(--text)" }}>{value}</strong>
        {trend ? (
          <span
            className="kpi-card__trend"
            style={{
              color: trend.direction === "up" ? "var(--success)" : "var(--danger)",
              background: trend.direction === "up" ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)",
            }}
          >
            {trend.direction === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend.value}%
          </span>
        ) : null}
      </div>
      {sublabel ? <span className="kpi-card__sublabel">{sublabel}</span> : null}
    </article>
  );
}

type SparkBarProps = {
  data: number[];
  color?: string;
  height?: number;
};

export function SparkBar({ data, color = "var(--primary)", height = 36 }: SparkBarProps) {
  const max = Math.max(...data, 1);
  return (
    <div className="sparkbar" style={{ height }}>
      {data.map((v, i) => (
        <span
          key={i}
          className="sparkbar__bar"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: color,
            opacity: 0.35 + 0.65 * (v / max),
          }}
        />
      ))}
    </div>
  );
}

type ProgressRowProps = {
  label: string;
  value: number;
  total: number;
  color?: string;
  href?: string;
};

export function ProgressRow({ label, value, total, color = "var(--primary)", href }: ProgressRowProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const Wrapper: React.ElementType = href ? Link : "div";
  const wrapperProps = href ? { href, className: "progress-row progress-row--link", title: `Ver ${label}` } : { className: "progress-row" };
  return (
    <Wrapper {...wrapperProps}>
      <div className="progress-row__head">
        <span className="progress-row__label">{label}</span>
        <span className="progress-row__count">{value}</span>
      </div>
      <div className="progress-row__track">
        <div className="progress-row__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </Wrapper>
  );
}

type ListRowProps = {
  icon: ReactNode;
  iconColor?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { label: string; color: string };
};

export function ListRow({ icon, iconColor, title, subtitle, meta, badge }: ListRowProps) {
  return (
    <div className="list-row">
      <span className="list-row__icon" style={{ background: `${iconColor ?? "var(--primary)"}1A`, color: iconColor ?? "var(--primary)" }}>
        {icon}
      </span>
      <div className="list-row__body">
        <div className="list-row__title">{title}</div>
        {subtitle ? <div className="list-row__subtitle">{subtitle}</div> : null}
      </div>
      <div className="list-row__right">
        {badge ? (
          <span className="list-row__badge" style={{ color: badge.color, background: `${badge.color}1A`, borderColor: `${badge.color}55` }}>
            {badge.label}
          </span>
        ) : null}
        {meta ? <span className="list-row__meta">{meta}</span> : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Datos mock — usados como fallback cuando el backend está vacío
   (deterministas, no se reshufflean entre renders)
   ───────────────────────────────────────────────────────────────── */

export const MOCK_TREND_FINDINGS = [12, 18, 14, 22, 19, 28, 24];
export const MOCK_TREND_TICKETS = [8, 6, 11, 7, 9, 5, 4];
export const MOCK_TREND_LEADS = [3, 5, 4, 7, 9, 8, 12];
export const MOCK_TREND_DEVICES = [42, 44, 45, 47, 48, 50, 52];

export const MOCK_TOP_VULN = [
  { name: "CVE-2025-3421 — pfSense RCE",          severity: "critical", count: 4, color: "var(--danger)" },
  { name: "FortiGate SSL VPN — buffer overflow",   severity: "critical", count: 2, color: "var(--danger)" },
  { name: "Suricata — out-of-date rules",          severity: "high",     count: 7, color: "#F59E0B" },
  { name: "Switch Cisco — firmware desactualizado", severity: "medium",   count: 9, color: "var(--warning)" },
  { name: "AP UniFi — credenciales por defecto",   severity: "low",      count: 3, color: "var(--success)" },
];

export const MOCK_LEAD_SOURCES = [
  { source: "LinkedIn",        leads: 24, color: "#0A66C2" },
  { source: "Referidos",       leads: 18, color: "var(--success)" },
  { source: "Sitio web",       leads: 14, color: "var(--primary)" },
  { source: "Eventos / Ferias", leads:  9, color: "var(--warning)" },
  { source: "Google Ads",      leads:  6, color: "#F59E0B" },
];

export const MOCK_NEW_CLIENTS = [
  { name: "Industrias Metálicas SAC",  sector: "Manufactura",     date: "hace 2 días",  status: "active" as const },
  { name: "ConsultorIT SRL",           sector: "Consultoría TI",   date: "hace 4 días",  status: "active" as const },
  { name: "Clínica San Lucas",         sector: "Salud",            date: "hace 1 semana", status: "prospect" as const },
  { name: "Logística Andina S.A.",     sector: "Transporte",       date: "hace 2 semanas", status: "active" as const },
];

export const MOCK_INTEGRATIONS_STATUS = [
  { name: "pfSense — HQ",          type: "Firewall",   health: "online" as const,  lastSync: "hace 3 min" },
  { name: "FortiGate — Sucursal",  type: "Firewall",   health: "online" as const,  lastSync: "hace 7 min" },
  { name: "Suricata IDS",          type: "IDS/IPS",    health: "warning" as const, lastSync: "hace 42 min" },
  { name: "Cisco Catalyst Core",   type: "Switch L3",  health: "online" as const,  lastSync: "hace 5 min" },
  { name: "UniFi Controller",      type: "Wi-Fi",      health: "offline" as const, lastSync: "hace 4 h" },
];

export const MOCK_DEVICES_BY_TYPE = [
  { type: "Firewall",     count: 12, color: "var(--danger)" },
  { type: "Switch",       count: 28, color: "var(--primary)" },
  { type: "Router",       count:  9, color: "var(--warning)" },
  { type: "Access Point", count: 34, color: "var(--success)" },
  { type: "Server",       count: 16, color: "#A78BFA" },
];

export const MOCK_TOP_COLLABORATORS = [
  { name: "Ana Quispe",    role: "Security Analyst",  tickets: 18, hue: 320 },
  { name: "Carlos Vargas", role: "Network Engineer",  tickets: 14, hue: 200 },
  { name: "Lucía Mendoza", role: "Pentester Senior",  tickets: 11, hue: 280 },
  { name: "Diego Salas",   role: "DevOps / Cloud",    tickets:  9, hue: 140 },
];

export const MOCK_UPCOMING_REVIEWS = [
  { client: "Industrias Metálicas SAC",  type: "Auditoría pfSense",        date: "Mañana, 09:00",  scope: "Firewall + VPN" },
  { client: "ConsultorIT SRL",           type: "Revisión IDS / Suricata",  date: "Jueves, 14:00",  scope: "Reglas + tuning" },
  { client: "Clínica San Lucas",         type: "Penetration Test",         date: "Lun 26 May",     scope: "Red interna" },
  { client: "Logística Andina S.A.",     type: "Hardening FortiGate",      date: "Mié 28 May",     scope: "Políticas + IPS" },
];

export const MOCK_TICKETS_BY_CATEGORY = [
  { category: "Soporte",       count: 12, color: "var(--primary)" },
  { category: "Incidente",     count:  5, color: "var(--danger)"  },
  { category: "Solicitud",     count:  9, color: "var(--warning)" },
  { category: "Mantenimiento", count:  7, color: "var(--success)" },
];

export const MOCK_LICENSES_EXPIRING = [
  { product: "FortiGate FortiCare 24x7",    client: "Industrias Metálicas SAC", daysLeft:  8, color: "var(--danger)" },
  { product: "pfSense Plus — Subscription", client: "ConsultorIT SRL",          daysLeft: 22, color: "var(--warning)" },
  { product: "Suricata Pro Rules",          client: "Clínica San Lucas",        daysLeft: 41, color: "var(--success)" },
  { product: "UniFi UISP Hosting",          client: "Logística Andina S.A.",    daysLeft: 67, color: "var(--success)" },
];

export const MOCK_SECURITY_SCORE_BY_CLIENT = [
  { client: "Industrias Metálicas SAC", score: 82 },
  { client: "ConsultorIT SRL",          score: 91 },
  { client: "Clínica San Lucas",        score: 64 },
  { client: "Logística Andina S.A.",    score: 76 },
  { client: "Distribuidora Norte",      score: 88 },
];

/* ─────────────────────────────────────────────────────────────────
   VISTA — SEGURIDAD
   ───────────────────────────────────────────────────────────────── */

export function SecurityView({ summary }: { summary: DashboardSummaryItem }) {
  const criticalOpen = summary.findings.critical_open ?? 0;
  const reviewsRate  = summary.reviews.execution_rate_pct ?? 0;
  const totalFindings = summary.findings.total ?? 0;
  const openReviews = summary.reviews.open_count ?? 0;

  return (
    <>
      <div className="metrics-grid">
        <KpiCard
          icon={<AlertTriangle size={18} />}
          label="Hallazgos críticos"
          value={criticalOpen || 6}
          sublabel="Requieren atención inmediata"
          color="var(--danger)"
          trend={{ value: 12, direction: "down" }}
        />
        <KpiCard
          icon={<ShieldCheck size={18} />}
          label="Revisiones ejecutadas"
          value={`${reviewsRate || 78}%`}
          sublabel={`${openReviews || 4} programadas esta semana`}
          color="var(--success)"
          trend={{ value: 8, direction: "up" }}
        />
        <KpiCard
          icon={<Shield size={18} />}
          label="Score promedio"
          value="82"
          sublabel="/100 — buen nivel"
          color="var(--primary)"
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Tiempo medio MTTR"
          value="3.4h"
          sublabel="Mejora vs. 4.1h del mes pasado"
          color="var(--warning)"
          trend={{ value: 17, direction: "up" }}
        />
      </div>

      <div className="widget-grid widget-grid--2">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Tendencia 7 días</p><h3>Hallazgos detectados</h3></div>
            <span className="muted-small">{MOCK_TREND_FINDINGS.reduce((a, b) => a + b, 0)} esta semana</span>
          </div>
          <SparkBar data={MOCK_TREND_FINDINGS} color="var(--danger)" height={80} />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Severidad</p><h3>Hallazgos por nivel</h3></div>
            <span className="muted-small">{totalFindings || 23} totales</span>
          </div>
          <div className="stack-gap-sm">
            <ProgressRow label="Críticos" value={criticalOpen || 6}  total={23} color="var(--danger)"  href="/dashboard/security-reviews?severity=critical" />
            <ProgressRow label="Altos"    value={summary.findings.by_severity?.high   ?? 7} total={23} color="#F59E0B"        href="/dashboard/security-reviews?severity=high" />
            <ProgressRow label="Medios"   value={summary.findings.by_severity?.medium ?? 6} total={23} color="var(--warning)" href="/dashboard/security-reviews?severity=medium" />
            <ProgressRow label="Bajos"    value={summary.findings.by_severity?.low    ?? 4} total={23} color="var(--success)" href="/dashboard/security-reviews?severity=low" />
          </div>
        </article>
      </div>

      <div className="widget-grid widget-grid--2">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Top vulnerabilidades</p><h3>Hallazgos repetidos</h3></div>
            <Link href="/dashboard/reports" className="muted-link">Ver todo →</Link>
          </div>
          <div className="stack-gap-sm">
            {MOCK_TOP_VULN.map((v) => (
              <ListRow
                key={v.name}
                icon={<AlertTriangle size={16} />}
                iconColor={v.color}
                title={v.name}
                subtitle={`Severidad ${v.severity}`}
                badge={{ label: `${v.count} casos`, color: v.color }}
              />
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Score</p><h3>Postura de seguridad por cliente</h3></div>
          </div>
          <div className="stack-gap-md">
            {MOCK_SECURITY_SCORE_BY_CLIENT.map((c) => {
              const color = c.score >= 85 ? "var(--success)" : c.score >= 70 ? "var(--warning)" : "var(--danger)";
              return (
                <div key={c.client} className="score-row">
                  <span className="score-row__label">{c.client}</span>
                  <div className="score-row__track">
                    <div className="score-row__fill" style={{ width: `${c.score}%`, background: color }} />
                  </div>
                  <strong className="score-row__value" style={{ color }}>{c.score}</strong>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Agenda</p><h3>Próximas revisiones</h3></div>
          <Link href="/dashboard/security-reviews" className="muted-link">Calendario →</Link>
        </div>
        <div className="stack-gap-sm">
          {MOCK_UPCOMING_REVIEWS.map((r) => (
            <ListRow
              key={r.client + r.date}
              icon={<ShieldCheck size={16} />}
              iconColor="var(--security)"
              title={r.type}
              subtitle={`${r.client} · ${r.scope}`}
              meta={r.date}
            />
          ))}
        </div>
      </article>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   VISTA — COMERCIAL
   ───────────────────────────────────────────────────────────────── */

type LeadShape = { id: number; status: string; source?: string | null; created_at?: string | null };
type ClientShape = { id: number; company_name: string; sector?: string | null; commercial_status: string; city?: string | null; country?: string | null };

export function CommercialView({ leads = [], clients = [] }: { leads?: LeadShape[]; clients?: ClientShape[] }) {
  // Cuentas reales por etapa (case-insensitive)
  const byStage = (k: string) => leads.filter((l) => (l.status ?? "").toUpperCase() === k).length;
  const funnel = [
    { stage: "Nuevos",      count: byStage("NEW"),         color: "var(--primary)" },
    { stage: "Contactados", count: byStage("CONTACTED"),    color: "#8B5CF6" },
    { stage: "Calificados", count: byStage("QUALIFIED"),    color: "var(--warning)" },
    { stage: "Propuesta",   count: byStage("PROPOSAL"),     color: "#06B6D4" },
    { stage: "Ganados",     count: byStage("CLOSED_WON"),   color: "var(--success)" },
  ];
  const totalLeads = leads.length;
  const wonCount   = funnel[4].count;
  const conversion = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  // Fuentes reales
  const sourceMap: Record<string, number> = {};
  for (const l of leads) {
    const s = (l.source ?? "sin_definir").trim() || "sin_definir";
    sourceMap[s] = (sourceMap[s] ?? 0) + 1;
  }
  const sourcesReal = Object.entries(sourceMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([source, count], i) => ({
      source: source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, " "),
      leads: count,
      color: ["#0A66C2", "var(--success)", "var(--primary)", "var(--warning)", "#F59E0B", "#A78BFA"][i] ?? "var(--muted)",
    }));
  const leadSources = sourcesReal.length > 0 ? sourcesReal : MOCK_LEAD_SOURCES;

  // Clientes nuevos: usar los reales si hay
  const newClientsReal = clients.slice(0, 4).map((c) => ({
    name: c.company_name,
    sector: c.sector || "—",
    date: c.city ? `${c.city}${c.country ? ", " + c.country : ""}` : "—",
    status: ((c.commercial_status ?? "").toLowerCase() === "active" ? "active" : "prospect") as "active" | "prospect",
  }));
  const newClients = newClientsReal.length > 0 ? newClientsReal : MOCK_NEW_CLIENTS;

  return (
    <>
      <div className="metrics-grid">
        <KpiCard
          icon={<Target size={18} />}
          label="Leads totales"
          value={totalLeads}
          sublabel={`${funnel[3].count} en propuesta`}
          color="var(--primary)"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Conversión"
          value={`${conversion}%`}
          sublabel={`${wonCount} ganados`}
          color="var(--success)"
        />
        <KpiCard
          icon={<Briefcase size={18} />}
          label="Activos en pipeline"
          value={totalLeads - wonCount - byStage("CLOSED_LOST")}
          sublabel="Oportunidades vigentes"
          color="var(--warning)"
        />
        <KpiCard
          icon={<Building2 size={18} />}
          label="Clientes activos"
          value={clients.filter((c) => (c.commercial_status ?? "").toLowerCase() === "active").length || clients.length}
          sublabel={`${clients.length} en directorio`}
          color="#A78BFA"
        />
      </div>

      <div className="widget-grid widget-grid--2">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Embudo</p><h3>Pipeline de conversión</h3></div>
            <Link href="/dashboard/leads" className="muted-link">Ver pipeline →</Link>
          </div>
          <div className="funnel">
            {funnel.map((s, i) => {
              const width = 100 - i * 14;
              return (
                <div key={s.stage} className="funnel__row">
                  <div
                    className="funnel__bar"
                    style={{ width: `${width}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}99)` }}
                  >
                    <span className="funnel__stage">{s.stage}</span>
                    <strong className="funnel__count">{s.count}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Origen</p><h3>Top fuentes de leads</h3></div>
          </div>
          <div className="stack-gap-md">
            {leadSources.map((s) => (
              <ProgressRow key={s.source} label={s.source} value={s.leads} total={leadSources[0]?.leads ?? 1} color={s.color} />
            ))}
          </div>
        </article>
      </div>

      <div className="widget-grid widget-grid--2">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Crecimiento</p><h3>Leads por día (7d)</h3></div>
            <span className="muted-small">{MOCK_TREND_LEADS.reduce((a, b) => a + b, 0)} esta semana</span>
          </div>
          <SparkBar data={MOCK_TREND_LEADS} color="var(--success)" height={80} />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Recientes</p><h3>Clientes nuevos</h3></div>
            <Link href="/dashboard/clients" className="muted-link">Ver clientes →</Link>
          </div>
          <div className="stack-gap-sm">
            {newClients.map((c) => (
              <ListRow
                key={c.name}
                icon={<Building2 size={16} />}
                iconColor={c.status === "active" ? "var(--success)" : "var(--warning)"}
                title={c.name}
                subtitle={c.sector}
                meta={c.date}
                badge={c.status === "active"
                  ? { label: "Activo",   color: "var(--success)" }
                  : { label: "Prospecto", color: "var(--warning)" }}
              />
            ))}
          </div>
        </article>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   VISTA — OPERACIONES
   ───────────────────────────────────────────────────────────────── */

export function OperationsView({ summary }: { summary: DashboardSummaryItem }) {
  const openTickets = summary.tickets.open_count ?? 0;
  const totalTickets = MOCK_TICKETS_BY_CATEGORY.reduce((a, c) => a + c.count, 0);

  return (
    <>
      <div className="metrics-grid">
        <KpiCard
          icon={<Ticket size={18} />}
          label="Tickets abiertos"
          value={openTickets || 18}
          sublabel={`${MOCK_TICKETS_BY_CATEGORY[1].count} incidentes`}
          color="var(--warning)"
          trend={{ value: 9, direction: "down" }}
        />
        <KpiCard
          icon={<CheckCircle2 size={18} />}
          label="SLA cumplido"
          value="94%"
          sublabel="Objetivo: 90%"
          color="var(--success)"
          trend={{ value: 3, direction: "up" }}
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Tiempo medio"
          value="2.1h"
          sublabel="Primera respuesta"
          color="var(--primary)"
        />
        <KpiCard
          icon={<UserCheck size={18} />}
          label="Colaboradores"
          value={MOCK_TOP_COLLABORATORS.length}
          sublabel="Activos esta semana"
          color="#A78BFA"
        />
      </div>

      <div className="widget-grid widget-grid--2">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Categorías</p><h3>Tickets activos por tipo</h3></div>
            <span className="muted-small">{totalTickets} totales</span>
          </div>
          <div className="stack-gap-md">
            {MOCK_TICKETS_BY_CATEGORY.map((t) => (
              <ProgressRow key={t.category} label={t.category} value={t.count} total={totalTickets} color={t.color} />
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Tendencia 7 días</p><h3>Tickets cerrados</h3></div>
            <span className="muted-small">{MOCK_TREND_TICKETS.reduce((a, b) => a + b, 0)} cerrados</span>
          </div>
          <SparkBar data={MOCK_TREND_TICKETS} color="var(--success)" height={80} />
        </article>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Performance</p><h3>Top colaboradores del mes</h3></div>
          <Link href="/dashboard/collaborators" className="muted-link">Ver todos →</Link>
        </div>
        <div className="widget-grid widget-grid--collab">
          {MOCK_TOP_COLLABORATORS.map((c) => (
            <div key={c.name} className="collab-card">
              <div className="collab-card__avatar" style={{ ["--avatar-hue" as string]: c.hue } as React.CSSProperties}>
                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="collab-card__body">
                <strong>{c.name}</strong>
                <span className="muted-small">{c.role}</span>
              </div>
              <div className="collab-card__stat">
                <strong>{c.tickets}</strong>
                <span className="muted-small">tickets</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   VISTA — INFRAESTRUCTURA
   ───────────────────────────────────────────────────────────────── */

export function InfrastructureView({ summary }: { summary: DashboardSummaryItem }) {
  const totalDevices = summary.inventory.total_devices || MOCK_DEVICES_BY_TYPE.reduce((a, d) => a + d.count, 0);
  const expiredLicenses = summary.inventory.expired_licenses ?? 0;

  return (
    <>
      <div className="metrics-grid">
        <KpiCard
          icon={<Server size={18} />}
          label="Activos monitoreados"
          value={totalDevices}
          sublabel={`${summary.inventory.active_consoles || MOCK_INTEGRATIONS_STATUS.filter(i => i.health === "online").length} consolas activas`}
          color="var(--primary)"
          trend={{ value: 5, direction: "up" }}
        />
        <KpiCard
          icon={<Plug size={18} />}
          label="Integraciones"
          value={MOCK_INTEGRATIONS_STATUS.length}
          sublabel={`${MOCK_INTEGRATIONS_STATUS.filter(i => i.health === "online").length} online`}
          color="var(--success)"
        />
        <KpiCard
          icon={<Zap size={18} />}
          label="Licencias activas"
          value="42"
          sublabel={`${expiredLicenses || 1} vencidas`}
          color={expiredLicenses > 0 ? "var(--danger)" : "var(--success)"}
        />
        <KpiCard
          icon={<Network size={18} />}
          label="Uptime promedio"
          value="99.8%"
          sublabel="Últimos 30 días"
          color="var(--success)"
          trend={{ value: 0.2, direction: "up" }}
        />
      </div>

      <div className="widget-grid widget-grid--2">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Estado</p><h3>Health de integraciones</h3></div>
            <Link href="/dashboard/integrations" className="muted-link">Ver consolas →</Link>
          </div>
          <div className="stack-gap-sm">
            {MOCK_INTEGRATIONS_STATUS.map((i) => {
              const badge =
                i.health === "online"  ? { label: "● Online",  color: "var(--success)" } :
                i.health === "warning" ? { label: "● Warning", color: "var(--warning)" } :
                                          { label: "● Offline", color: "var(--danger)"  };
              return (
                <ListRow
                  key={i.name}
                  icon={<Plug size={16} />}
                  iconColor={i.health === "online" ? "var(--success)" : i.health === "warning" ? "var(--warning)" : "var(--danger)"}
                  title={i.name}
                  subtitle={i.type}
                  meta={i.lastSync}
                  badge={badge}
                />
              );
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Inventario</p><h3>Dispositivos por tipo</h3></div>
            <span className="muted-small">{totalDevices} totales</span>
          </div>
          <div className="stack-gap-md">
            {MOCK_DEVICES_BY_TYPE.map((d) => (
              <ProgressRow key={d.type} label={d.type} value={d.count} total={MOCK_DEVICES_BY_TYPE[3].count} color={d.color} />
            ))}
          </div>
        </article>
      </div>

      <div className="widget-grid widget-grid--2">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Tendencia</p><h3>Crecimiento de activos</h3></div>
            <span className="muted-small">+24% último mes</span>
          </div>
          <SparkBar data={MOCK_TREND_DEVICES} color="var(--primary)" height={80} />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Renovaciones</p><h3>Licencias por vencer</h3></div>
            <Link href="/dashboard/integrations" className="muted-link">Gestionar →</Link>
          </div>
          <div className="stack-gap-sm">
            {MOCK_LICENSES_EXPIRING.map((l) => (
              <ListRow
                key={l.product}
                icon={<Award size={16} />}
                iconColor={l.color}
                title={l.product}
                subtitle={l.client}
                badge={{ label: `${l.daysLeft}d`, color: l.color }}
              />
            ))}
          </div>
        </article>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Quick links (compartido — fila inferior del tab General)
   ───────────────────────────────────────────────────────────────── */

const QUICK_LINKS = [
  { href: "/dashboard/security-reviews", icon: <ShieldCheck size={20} />, label: "Revisiones",   color: "var(--security)" },
  { href: "/dashboard/support-tickets",  icon: <Ticket size={20} />,       label: "Tickets",      color: "var(--warning)"  },
  { href: "/dashboard/clients",          icon: <Users size={20} />,         label: "Clientes",     color: "var(--primary)"  },
  { href: "/dashboard/devices",          icon: <Server size={20} />,        label: "Inventario",   color: "var(--success)"  },
  { href: "/dashboard/leads",            icon: <Target size={20} />,        label: "Leads",        color: "#A78BFA"         },
  { href: "/dashboard/integrations",     icon: <Plug size={20} />,          label: "Integraciones", color: "#06B6D4"         },
  { href: "/dashboard/reports",          icon: <FileText size={20} />,      label: "Reportes",     color: "#F472B6"         },
  { href: "/dashboard/audit",            icon: <Activity size={20} />,      label: "Auditoría",    color: "var(--muted)"    },
];

export function QuickLinks() {
  return (
    <article className="panel">
      <div className="panel-head">
        <div><p className="eyebrow">Navegación</p><h3>Accesos rápidos</h3></div>
      </div>
      <div className="quick-links">
        {QUICK_LINKS.map(({ href, icon, label, color }) => (
          <Link key={href} href={href} className="quick-link">
            <span className="quick-link__icon" style={{ color, background: `${color}1A`, borderColor: `${color}33` }}>{icon}</span>
            <span className="quick-link__label">{label}</span>
            <ChevronRight size={14} className="quick-link__chev" />
          </Link>
        ))}
      </div>
    </article>
  );
}
