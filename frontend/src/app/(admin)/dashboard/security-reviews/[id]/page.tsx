"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle, Minus, Plus, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  createChecklistItem,
  createReviewAttachment,
  createReviewFinding,
  createReviewRecommendation,
  createTicketFromFinding,
  DashboardUser,
  deleteSecurityReview,
  exportSecurityReviewPdf,
  getSecurityReview,
  getSupportTickets,
  getUsers,
  patchReviewFinding,
  ReviewChecklistItem,
  ReviewFindingItem,
  ReviewRecommendationItem,
  SecurityReviewDetail,
  SupportTicketItem,
  updateSecurityReview,
} from "@/lib/api";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { getStoredUser } from "@/lib/auth";
import { QK } from "@/lib/query-keys";

type TabKey = "info" | "checklist" | "findings" | "recommendations" | "attachments" | "tickets";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "badge-rejected",
  high:     "badge-pending",
  medium:   "badge-draft",
  low:      "badge-active",
  info:     "badge-info",
};

const RESULT_OPTIONS = ["", "pass", "fail", "n/a", "partial"];
const FINDING_STATUS = ["open", "in_progress", "resolved", "accepted_risk"];
const REC_STATUS = ["open", "in_progress", "completed"];

export default function SecurityReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reviewId = Number(params?.id);
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const [reviewOverride, setReviewOverride] = useState<SecurityReviewDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [savingInfo, setSavingInfo] = useState(false);
  // New finding form
  const [newFinding, setNewFinding] = useState({ severity: "medium", title: "", description: "", evidence_url: "" });
  const [addingFinding, setAddingFinding] = useState(false);
  // New attachment form
  const [newAttach, setNewAttach] = useState({ file_url: "", filename: "" });
  const [addingAttach, setAddingAttach] = useState(false);
  // New recommendation form
  const [newRec, setNewRec] = useState({ recommendation: "", owner_user_id: "", due_date: "" });
  const [addingRec, setAddingRec] = useState(false);

  const { data: reviewData, isLoading: reviewLoading } = useQuery<SecurityReviewDetail>({
    queryKey: QK.review(reviewId),
    queryFn: () => getSecurityReview(reviewId),
    enabled: !!reviewId,
  });

  const { data: users = [] } = useQuery<DashboardUser[]>({
    queryKey: QK.users(),
    queryFn: () => getUsers(),
    enabled: !!reviewId,
  });

  const { data: allTickets = [] } = useQuery<SupportTicketItem[]>({
    queryKey: QK.tickets({}),
    queryFn: () => getSupportTickets({}),
    enabled: !!reviewId,
  });

  const loading = reviewLoading;
  const activeReview = reviewOverride ?? reviewData ?? null;
  const [localTickets, setLocalTickets] = useState<SupportTicketItem[]>([]);
  const tickets = [...allTickets.filter((t) => t.review_id === activeReview?.id), ...localTickets];

  function userName(userId?: number | null) {
    return users.find((u) => u.id === userId)?.full_name || "-";
  }

  async function saveInfo() {
    if (!review) return;
    setSavingInfo(true);
    try {
      const updated = await updateSecurityReview(review.id, {
        status: review.status,
        reviewer_user_id: review.reviewer_user_id,
        scheduled_at: review.scheduled_at,
        executed_at: review.executed_at,
        notes: review.notes,
      });
      setReviewOverride({ ...review, ...updated });
      notifySuccess("Revisión actualizada");
    } catch (err) {
      notifyError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSavingInfo(false);
    }
  }

  async function updateChecklist(item: ReviewChecklistItem) {
    try {
      await createChecklistItem(reviewId, { criteria: item.criteria, result: item.result, notes: item.notes });
      notifySuccess("Guardado");
    } catch (err) {
      notifyError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    }
  }

  async function addFinding() {
    if (!newFinding.title) return;
    setAddingFinding(true);
    try {
      const created = await createReviewFinding(reviewId, {
        severity: newFinding.severity,
        title: newFinding.title,
        description: newFinding.description || null,
        evidence_url: newFinding.evidence_url || null,
      });
      setReviewOverride((r) => r ? { ...r, findings: [...r.findings, created] } : r);
      setNewFinding({ severity: "medium", title: "", description: "", evidence_url: "" });
      notifySuccess("Hallazgo agregado");
    } catch (err) {
      notifyError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    } finally {
      setAddingFinding(false);
    }
  }

  async function patchFinding(finding: ReviewFindingItem) {
    try {
      const updated = await patchReviewFinding(finding.id, { status: finding.status });
      setReviewOverride((r) => r ? { ...r, findings: r.findings.map((f) => f.id === finding.id ? { ...f, ...updated } : f) } : r);
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }

  async function addRecommendation() {
    if (!newRec.recommendation) return;
    setAddingRec(true);
    try {
      const created = await createReviewRecommendation(reviewId, {
        recommendation: newRec.recommendation,
        owner_user_id: newRec.owner_user_id ? Number(newRec.owner_user_id) : null,
        due_date: newRec.due_date || null,
      });
      setReviewOverride((r) => r ? { ...r, recommendations: [...r.recommendations, created] } : r);
      setNewRec({ recommendation: "", owner_user_id: "", due_date: "" });
      notifySuccess("Recomendación agregada");
    } catch (err) {
      notifyError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    } finally {
      setAddingRec(false);
    }
  }

  async function addAttachment() {
    if (!newAttach.file_url || !newAttach.filename) return;
    setAddingAttach(true);
    try {
      const created = await createReviewAttachment(reviewId, { file_url: newAttach.file_url, filename: newAttach.filename });
      setReviewOverride((r) => r ? { ...r, attachments: [...r.attachments, created] } : r);
      setNewAttach({ file_url: "", filename: "" });
      notifySuccess("Evidencia agregada");
    } catch (err) {
      notifyError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    } finally {
      setAddingAttach(false);
    }
  }

  async function createTicket(finding: ReviewFindingItem) {
    try {
      const ticket = await createTicketFromFinding(finding.id, { priority: finding.severity === "critical" ? "critical" : "high", category: "security" });
      setLocalTickets((current) => [...current, ticket]);
      notifySuccess("Ticket creado", `#${ticket.id} — ${ticket.title}`);
    } catch (err) {
      notifyError("No se pudo crear ticket", err instanceof Error ? err.message : undefined);
    }
  }

  if (loading) return <div className="state-panel">Cargando revisión...</div>;
  if (!activeReview) return <div className="state-panel state-error">Revisión no encontrada</div>;

  // Use local state override if available (for inline edits), otherwise use query data
  const review = activeReview;

  const criticalCount = review.findings.filter((f) => f.severity === "critical" && f.status !== "resolved").length;
  const openFindings = review.findings.filter((f) => f.status === "open" || f.status === "in_progress").length;
  const checklistDone = review.checklist_items.filter((c) => c.result === "pass" || c.result === "n/a").length;

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Revisión de seguridad</p>
          <h2>Revisión #{review.id}</h2>
        </div>
        <div className="panel-actions">
          <Link className="button button-ghost" href="/dashboard/security-reviews">Volver</Link>
          <button
            className="button button-secondary"
            type="button"
            onClick={async () => {
              try { await exportSecurityReviewPdf(review.id); notifySuccess("PDF descargado"); }
              catch (err) { notifyError("No se pudo exportar PDF", err instanceof Error ? err.message : undefined); }
            }}
          >
            Exportar PDF
          </button>
          <span className={`badge ${getStatusBadgeClass(review.status)}`}>{review.status}</span>
          {review.status !== "closed" && (
            <button className="button button-primary" type="button" onClick={async () => {
              const updated = await updateSecurityReview(review.id, { status: "closed", reviewer_user_id: review.reviewer_user_id });
              setReviewOverride({ ...review, ...updated });
              notifySuccess("Revisión cerrada");
            }}>Cerrar revisión</button>
          )}
          {isSuperAdmin && (
            <button className="button button-danger button-sm" type="button" onClick={async () => {
              const confirmed = await confirmDelete({ title: `¿Eliminar Revisión #${review.id}?`, text: "Se eliminarán todos los hallazgos, checklist y adjuntos." });
              if (!confirmed) return;
              try {
                await deleteSecurityReview(review.id);
                notifySuccess("Revisión eliminada");
                router.push("/dashboard/security-reviews");
              } catch (err) {
                notifyError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
              }
            }}>Eliminar</button>
          )}
        </div>
      </div>

      {/* Mini KPIs */}
      {review.findings.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: criticalCount > 0 ? "rgba(239,68,68,0.10)" : "var(--row)", border: "1px solid var(--line)", fontSize: "0.82rem" }}>
            <AlertTriangle size={14} style={{ color: criticalCount > 0 ? "var(--danger)" : "var(--muted)" }} />
            <span style={{ color: criticalCount > 0 ? "var(--danger)" : "var(--muted)", fontWeight: criticalCount > 0 ? 600 : 400 }}>{criticalCount} críticos abiertos</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "var(--row)", border: "1px solid var(--line)", fontSize: "0.82rem" }}>
            <XCircle size={14} style={{ color: "var(--warning)" }} />
            <span style={{ color: "var(--muted)" }}>{openFindings} hallazgos abiertos</span>
          </div>
          {review.checklist_items.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "var(--row)", border: "1px solid var(--line)", fontSize: "0.82rem" }}>
              <CheckCircle size={14} style={{ color: "var(--success)" }} />
              <span style={{ color: "var(--muted)" }}>{checklistDone}/{review.checklist_items.length} checklist</span>
            </div>
          )}
        </div>
      )}

      <div className="tab-list">
        {(["info","checklist","findings","recommendations","attachments","tickets"] as TabKey[]).map((tab) => (
          <button key={tab} className={`tab ${activeTab === tab ? "tab-active" : ""}`} onClick={() => setActiveTab(tab)} type="button">
            {tab}
            {tab === "findings" && review.findings.length > 0 && <span className="pill" style={{ marginLeft: 6 }}>{review.findings.length}</span>}
            {tab === "tickets" && tickets.length > 0 && <span className="pill" style={{ marginLeft: 6 }}>{tickets.length}</span>}
          </button>
        ))}
      </div>

      {/* INFO TAB */}
      {activeTab === "info" && (
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">Detalles</p><h3>Información general</h3></div></div>
          <div className="entity-form">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Estado</label>
              <select value={review.status} onChange={(e) => setReviewOverride({ ...review, status: e.target.value })}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Revisor</label>
              <select value={review.reviewer_user_id || ""} onChange={(e) => setReviewOverride({ ...review, reviewer_user_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Sin asignar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Fecha programada</label>
              <input type="datetime-local" value={review.scheduled_at?.slice(0, 16) || ""} onChange={(e) => setReviewOverride({ ...review, scheduled_at: e.target.value || null })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Fecha ejecutada</label>
              <input type="datetime-local" value={review.executed_at?.slice(0, 16) || ""} onChange={(e) => setReviewOverride({ ...review, executed_at: e.target.value || null })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Notas</label>
              <textarea value={review.notes || ""} onChange={(e) => setReviewOverride({ ...review, notes: e.target.value })} rows={3} placeholder="Observaciones generales de la revisión..." />
            </div>
            <button className="button button-primary" type="button" onClick={saveInfo} disabled={savingInfo}>
              {savingInfo ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </article>
      )}

      {/* CHECKLIST TAB */}
      {activeTab === "checklist" && (
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Control</p><h3>Checklist de revisión</h3></div>
            <button className="button button-secondary" type="button" onClick={async () => {
              const item = await createChecklistItem(reviewId, { criteria: "Nuevo criterio" });
              setReviewOverride((r) => r ? { ...r, checklist_items: [...r.checklist_items, item] } : r);
            }}>
              <Plus size={14} /> Agregar item
            </button>
          </div>
          {review.checklist_items.length === 0 ? (
            <div className="empty-state">Sin items en el checklist. Agrega criterios de evaluación.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head" style={{ gridTemplateColumns: "1fr auto 1fr auto" }}>
                <span>Criterio</span><span>Resultado</span><span>Notas</span><span>Acción</span>
              </div>
              {review.checklist_items.map((item) => (
                <div className="table-row" key={item.id} style={{ gridTemplateColumns: "1fr auto 1fr auto", alignItems: "center" }}>
                  <input value={item.criteria} onChange={(e) => setReviewOverride((r) => r ? { ...r, checklist_items: r.checklist_items.map((c) => c.id === item.id ? { ...c, criteria: e.target.value } : c) } : r)} />
                  <select value={item.result || ""} onChange={(e) => setReviewOverride((r) => r ? { ...r, checklist_items: r.checklist_items.map((c) => c.id === item.id ? { ...c, result: e.target.value || null } : c) } : r)} style={{ minWidth: 100 }}>
                    {RESULT_OPTIONS.map((o) => <option key={o} value={o}>{o || "— selecciona —"}</option>)}
                  </select>
                  <input value={item.notes || ""} onChange={(e) => setReviewOverride((r) => r ? { ...r, checklist_items: r.checklist_items.map((c) => c.id === item.id ? { ...c, notes: e.target.value } : c) } : r)} placeholder="Observaciones..." />
                  <button className="button button-secondary button-sm" type="button" onClick={() => updateChecklist(item)}>Guardar</button>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {/* FINDINGS TAB */}
      {activeTab === "findings" && (
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Hallazgos</p><h3>Vulnerabilidades y observaciones</h3></div>
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{review.findings.length} total</span>
          </div>

          {/* Add finding form */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 0", borderBottom: "1px solid var(--line)", marginBottom: 12 }}>
            <select value={newFinding.severity} onChange={(e) => setNewFinding((f) => ({ ...f, severity: e.target.value }))} style={{ minWidth: 110 }}>
              {["critical","high","medium","low"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={newFinding.title} onChange={(e) => setNewFinding((f) => ({ ...f, title: e.target.value }))} placeholder="Título del hallazgo" style={{ flex: 1, minWidth: 200 }} />
            <input value={newFinding.evidence_url} onChange={(e) => setNewFinding((f) => ({ ...f, evidence_url: e.target.value }))} placeholder="URL evidencia (opcional)" style={{ minWidth: 160 }} />
            <button className="button button-primary button-sm" type="button" onClick={addFinding} disabled={addingFinding || !newFinding.title}>
              <Plus size={14} /> Agregar
            </button>
          </div>

          {review.findings.length === 0 ? (
            <div className="empty-state">Sin hallazgos registrados.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head" style={{ gridTemplateColumns: "auto 1fr auto auto auto" }}>
                <span>Severidad</span><span>Título</span><span>Estado</span><span>Ticket</span><span>Acción</span>
              </div>
              {review.findings.map((finding) => (
                <div key={finding.id} style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
                  <div className="table-row" style={{ gridTemplateColumns: "auto 1fr auto auto auto" }}>
                    <span><span className={`badge ${SEVERITY_BADGE[finding.severity] ?? "badge-draft"}`}>{finding.severity}</span></span>
                    <span style={{ fontWeight: 500, fontSize: "0.88rem" }}>{finding.title}</span>
                    <span>
                      <select value={finding.status} onChange={(e) => {
                        const updated = { ...finding, status: e.target.value };
                        setReviewOverride((r) => r ? { ...r, findings: r.findings.map((f) => f.id === finding.id ? updated : f) } : r);
                        patchFinding(updated);
                      }} style={{ fontSize: "0.78rem", padding: "2px 6px" }}>
                        {FINDING_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </span>
                    <span>
                      {tickets.some((t) => t.finding_id === finding.id)
                        ? <span className="badge badge-active" style={{ fontSize: "0.7rem" }}>Ticket creado</span>
                        : (finding.severity === "critical" || finding.severity === "high") && (
                          <button className="button button-secondary button-sm" type="button" onClick={() => createTicket(finding)}>Crear ticket</button>
                        )
                      }
                    </span>
                    <span>
                      {finding.evidence_url && <a className="button button-ghost button-sm" href={finding.evidence_url} target="_blank" rel="noreferrer">Evidencia</a>}
                    </span>
                  </div>
                  {finding.description && (
                    <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "4px 0 0 0", paddingLeft: 8 }}>{finding.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {/* RECOMMENDATIONS TAB */}
      {activeTab === "recommendations" && (
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">Remediación</p><h3>Recomendaciones</h3></div></div>

          {/* Add recommendation form */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 0", borderBottom: "1px solid var(--line)", marginBottom: 12 }}>
            <input value={newRec.recommendation} onChange={(e) => setNewRec((r) => ({ ...r, recommendation: e.target.value }))} placeholder="Descripción de la recomendación" style={{ flex: 1, minWidth: 240 }} />
            <select value={newRec.owner_user_id} onChange={(e) => setNewRec((r) => ({ ...r, owner_user_id: e.target.value }))}>
              <option value="">Responsable</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <input type="date" value={newRec.due_date} onChange={(e) => setNewRec((r) => ({ ...r, due_date: e.target.value }))} />
            <button className="button button-primary button-sm" type="button" onClick={addRecommendation} disabled={addingRec || !newRec.recommendation}>
              <Plus size={14} /> Agregar
            </button>
          </div>

          {review.recommendations.length === 0 ? (
            <div className="empty-state">Sin recomendaciones. Agrega acciones de remediación.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head table-row-wide">
                <span>Recomendación</span><span>Responsable</span><span>Fecha límite</span><span>Estado</span>
              </div>
              {review.recommendations.map((item) => (
                <div className="table-row table-row-wide" key={item.id}>
                  <span style={{ fontSize: "0.85rem" }}>{item.recommendation}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{userName(item.owner_user_id)}</span>
                  <span style={{ color: item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed" ? "var(--danger)" : "var(--muted)", fontSize: "0.82rem" }}>
                    {item.due_date || "—"}
                  </span>
                  <span><span className={`badge ${getStatusBadgeClass(item.status)}`}>{item.status}</span></span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {/* ATTACHMENTS TAB */}
      {activeTab === "attachments" && (
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">Evidencia</p><h3>Archivos adjuntos</h3></div></div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 0", borderBottom: "1px solid var(--line)", marginBottom: 12 }}>
            <input value={newAttach.filename} onChange={(e) => setNewAttach((a) => ({ ...a, filename: e.target.value }))} placeholder="Nombre del archivo" style={{ minWidth: 180 }} />
            <input value={newAttach.file_url} onChange={(e) => setNewAttach((a) => ({ ...a, file_url: e.target.value }))} placeholder="URL (https://...)" style={{ flex: 1, minWidth: 240 }} />
            <button className="button button-primary button-sm" type="button" onClick={addAttachment} disabled={addingAttach || !newAttach.file_url || !newAttach.filename}>
              <Plus size={14} /> Agregar
            </button>
          </div>

          {review.attachments.length === 0 ? (
            <div className="empty-state">Sin evidencia adjunta. Agrega URLs de archivos o capturas.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head table-row-wide"><span>Archivo</span><span>URL</span><span>Fecha</span><span>Acción</span></div>
              {review.attachments.map((item) => (
                <div className="table-row table-row-wide" key={item.id}>
                  <span style={{ fontWeight: 500 }}>{item.filename}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem", wordBreak: "break-all" }}>{item.file_url}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{item.uploaded_at?.slice(0, 10)}</span>
                  <span><a className="button button-ghost button-sm" href={item.file_url} target="_blank" rel="noreferrer">Abrir</a></span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {/* TICKETS TAB */}
      {activeTab === "tickets" && (
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">Soporte</p><h3>Tickets generados</h3></div><span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{tickets.length} tickets</span></div>
          {tickets.length === 0 ? (
            <div className="empty-state">Sin tickets. Los tickets se generan desde hallazgos críticos/altos.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head table-row-wide"><span>ID</span><span>Título</span><span>Prioridad</span><span>Estado</span></div>
              {tickets.map((ticket) => (
                <div className="table-row table-row-wide" key={ticket.id}>
                  <span>#{ticket.id}</span>
                  <span style={{ fontSize: "0.88rem" }}>{ticket.title}</span>
                  <span><span className={`badge ${getStatusBadgeClass(ticket.priority)}`}>{ticket.priority}</span></span>
                  <span><span className={`badge ${getStatusBadgeClass(ticket.status)}`}>{ticket.status}</span></span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
