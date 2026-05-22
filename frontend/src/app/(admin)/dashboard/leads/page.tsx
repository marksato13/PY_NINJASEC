"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Mail, Phone, Plus, TrendingUp, Users } from "lucide-react";

import { createClient, createLead, deleteLead, getLeads, getMe, LeadItem, updateLead, updateLeadStatus } from "@/lib/api";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { Modal } from "@/components/ui/modal";
import { QK } from "@/lib/query-keys";

// ── Pipeline config ──────────────────────────────────────────────────────────
const COLUMNS: { key: string; label: string; color: string; bg: string }[] = [
  { key: "NEW",         label: "Nuevos",      color: "#3B82F6", bg: "rgba(59,130,246,0.08)"  },
  { key: "CONTACTED",   label: "Contactados",  color: "#8B5CF6", bg: "rgba(139,92,246,0.08)"  },
  { key: "QUALIFIED",   label: "Calificados",  color: "#F59E0B", bg: "rgba(245,158,11,0.08)"  },
  { key: "PROPOSAL",    label: "Propuesta",    color: "#06B6D4", bg: "rgba(6,182,212,0.08)"   },
  { key: "CLOSED_WON",  label: "Ganados ✓",   color: "#10B981", bg: "rgba(16,185,129,0.08)"  },
  { key: "CLOSED_LOST", label: "Perdidos",     color: "#EF4444", bg: "rgba(239,68,68,0.08)"  },
];

// statuses reachable from each status (forward only + back one step)
const TRANSITIONS: Record<string, string[]> = {
  NEW:         ["CONTACTED"],
  CONTACTED:   ["NEW", "QUALIFIED"],
  QUALIFIED:   ["CONTACTED", "PROPOSAL"],
  PROPOSAL:    ["QUALIFIED", "CLOSED_WON", "CLOSED_LOST"],
  CLOSED_WON:  [],
  CLOSED_LOST: [],
};

function ageBadge(createdAt?: string | null) {
  if (!createdAt) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days < 7)  return { label: `${days}d`, color: "var(--success)" };
  if (days < 30) return { label: `${days}d`, color: "var(--warning)" };
  return { label: `${days}d`, color: "var(--danger)" };
}

const INTEREST_ICONS: Record<string, string> = {
  "seguridad": "🛡️", "infraestructura": "🏗️", "red": "🌐",
  "firewall": "🔥", "monitoreo": "📡", "consultoría": "💼",
};

function interestIcon(area?: string | null) {
  if (!area) return "📋";
  const lower = area.toLowerCase();
  for (const [key, icon] of Object.entries(INTEREST_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "📋";
}

// ── Component ────────────────────────────────────────────────────────────────
export default function LeadsPipelinePage() {
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin      = currentUser?.role === "admin" || isSuperAdmin;
  const queryClient  = useQueryClient();
  const [createOpen, setCreateOpen]   = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [editForm, setEditForm]       = useState<Partial<LeadItem>>({});
  const [editSaving, setEditSaving]   = useState(false);
  const [form, setForm] = useState({ contact_name: "", email: "", company_name: "", phone: "", interest_area: "", message: "", source: "" });
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [dragLeadId, setDragLeadId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: QK.leads(),
    queryFn: () => getLeads(),
  });

  async function handleMove(lead: LeadItem, toStatus: string) {
    try {
      const updated = await updateLeadStatus(lead.id, toStatus);
      queryClient.setQueryData<LeadItem[]>(QK.leads(), (prev = []) =>
        prev.map((l) => l.id === lead.id ? updated : l)
      );
    } catch (err) {
      notifyError("No se pudo mover", err instanceof Error ? err.message : undefined);
    }
  }

  function findLeadById(id: number | null): LeadItem | null {
    if (!id) return null;
    return leads.find((lead) => lead.id === id) ?? null;
  }

  async function handleDropToColumn(toStatus: string) {
    const dragged = findLeadById(dragLeadId);
    setDragOverColumn(null);
    setDragLeadId(null);
    if (!dragged) return;
    if (dragged.status === toStatus) return;
    const allowed = TRANSITIONS[dragged.status] ?? [];
    if (!allowed.includes(toStatus)) return;
    await handleMove(dragged, toStatus);
  }

  function openDetail(lead: LeadItem) {
    setSelectedLead(lead);
    setEditForm({
      contact_name:  lead.contact_name,
      email:         lead.email,
      company_name:  lead.company_name ?? "",
      phone:         lead.phone ?? "",
      interest_area: lead.interest_area ?? "",
      source:        lead.source ?? "",
      message:       lead.message ?? "",
    });
  }

  async function handleSaveEdit() {
    if (!selectedLead) return;
    setEditSaving(true);
    try {
      const updated = await updateLead(selectedLead.id, editForm);
      queryClient.setQueryData<LeadItem[]>(QK.leads(), (prev = []) =>
        prev.map((l) => l.id === updated.id ? updated : l)
      );
      setSelectedLead(updated);
      notifySuccess("Lead actualizado");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConvert(lead: LeadItem) {
    setConverting(true);
    try {
      const me = await getMe();
      if (!me.organization_id) throw new Error("Organización no resuelta");
      const created = await createClient({
        organization_id: me.organization_id,
        company_name: lead.company_name || lead.contact_name,
        commercial_status: "active",
        notes: [
          lead.interest_area ? `Interés: ${lead.interest_area}` : null,
          lead.email ? `Contacto: ${lead.contact_name} <${lead.email}>` : null,
          lead.phone ? `Teléfono: ${lead.phone}` : null,
          lead.source ? `Origen: ${lead.source}` : null,
          lead.message || null,
        ].filter(Boolean).join("\n") || null,
      });
      notifySuccess("Cliente creado", `${created.company_name} se agregó al directorio`);
      queryClient.invalidateQueries({ queryKey: QK.clients() });
      setSelectedLead(null);
    } catch (err) {
      notifyError("No se pudo convertir", err instanceof Error ? err.message : undefined);
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete(lead: LeadItem) {
    const confirmed = await confirmDelete({
      title: `¿Eliminar lead "${lead.company_name || lead.contact_name}"?`,
      text: "Esta acción no se puede deshacer.",
    });
    if (!confirmed) return;
    try {
      await deleteLead(lead.id);
      queryClient.setQueryData<LeadItem[]>(QK.leads(), (prev = []) =>
        prev.filter((l) => l.id !== lead.id)
      );
      setSelectedLead(null);
      notifySuccess("Lead eliminado");
    } catch (err) {
      notifyError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleCreate() {
    if (!form.contact_name || !form.email) return;
    setSaving(true);
    try {
      const created = await createLead({
        contact_name: form.contact_name,
        email: form.email,
        company_name: form.company_name || null,
        phone: form.phone || null,
        interest_area: form.interest_area || null,
        message: form.message || null,
        source: form.source || null,
      });
      queryClient.setQueryData<LeadItem[]>(QK.leads(), (prev = []) => [created, ...prev]);
      notifySuccess("Lead agregado", form.company_name || form.contact_name);
      setCreateOpen(false);
      setForm({ contact_name: "", email: "", company_name: "", phone: "", interest_area: "", message: "", source: "" });
    } catch (err) {
      notifyError("No se pudo crear", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  // Group leads by status once — avoids O(6n) filter per column + O(4n) KPI filters every render
  const grouped = useMemo(() => {
    const map: Record<string, LeadItem[]> = {};
    for (const lead of leads) {
      const key = lead.status === "CLOSED" ? "NEW" : lead.status;
      if (!map[key]) map[key] = [];
      map[key].push(lead);
    }
    return map;
  }, [leads]);

  const total      = leads.length;
  const won        = (grouped["closed_won"] ?? []).length;
  const inProposal = (grouped["proposal"] ?? []).length;
  const convPct    = total > 0 ? Math.round((won / total) * 100) : 0;

  return (
    <section className="page-stack">
      {/* Header */}
      <div className="section-heading">
        <div><p className="eyebrow">CRM</p><h2>Pipeline de leads</h2></div>
        {isAdmin && (
          <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Nuevo lead
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="metrics-grid">
        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} style={{ color: "var(--primary)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Total leads</span>
          </div>
          <strong style={{ fontSize: "2rem" }}>{total}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{(grouped["new"] ?? []).length} en pipeline</span>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={16} style={{ color: "var(--success)", opacity: 0.7 }} />
            <span className="eyebrow" style={{ margin: 0 }}>Conversión</span>
          </div>
          <strong style={{ fontSize: "2rem", color: convPct >= 20 ? "var(--success)" : convPct >= 10 ? "var(--warning)" : "var(--danger)" }}>
            {convPct}%
          </strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{won} ganados de {total}</span>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1rem" }}>📄</span>
            <span className="eyebrow" style={{ margin: 0 }}>En propuesta</span>
          </div>
          <strong style={{ fontSize: "2rem", color: inProposal > 0 ? "var(--primary)" : "var(--muted)" }}>{inProposal}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>aguardando respuesta</span>
        </article>

        <article className="metric-card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1rem" }}>🎯</span>
            <span className="eyebrow" style={{ margin: 0 }}>Calificados</span>
          </div>
          <strong style={{ fontSize: "2rem", color: "var(--warning)" }}>
            {(grouped["qualified"] ?? []).length}
          </strong>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>listos para propuesta</span>
        </article>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="state-panel">Cargando pipeline...</div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(240px, 1fr))`,
          gap: 12,
          overflowX: "auto",
          paddingBottom: 8,
        }}>
          {COLUMNS.map((col) => {
            const colLeads = grouped[col.key] ?? [];
            return (
              <div key={col.key} style={{
                background: col.bg,
                border: `1px solid ${col.color}33`,
                borderTop: `3px solid ${col.color}`,
                borderRadius: 12,
                padding: "12px 10px",
                minHeight: 200,
                outline: dragOverColumn === col.key ? `2px dashed ${col.color}` : "none",
                outlineOffset: dragOverColumn === col.key ? "-2px" : undefined,
              }}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: col.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {col.label}
                  </span>
                  <span style={{
                    background: col.color,
                    color: "#fff",
                    borderRadius: 20,
                    padding: "1px 8px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}>
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== col.key) setDragOverColumn(col.key);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== col.key) setDragOverColumn(col.key);
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn === col.key) setDragOverColumn(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropToColumn(col.key);
                  }}
                >
                  {(grouped[col.key] ?? []).length === 0 && (
                    <div style={{ color: "var(--muted)", fontSize: "0.78rem", textAlign: "center", padding: "16px 0", opacity: 0.6 }}>
                      Sin leads
                    </div>
                  )}
                  {(grouped[col.key] ?? []).map((lead) => {
                    const age = ageBadge(lead.created_at);
                    const nexts = TRANSITIONS[lead.status] ?? [];
                    return (
                      <div key={lead.id} style={{
                        background: "var(--panel)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                        cursor: "pointer",
                        opacity: dragLeadId === lead.id ? 0.55 : 1,
                      }}
                        draggable={isAdmin}
                        onDragStart={(e) => {
                          if (!isAdmin) return;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(lead.id));
                          setDragLeadId(lead.id);
                        }}
                        onDragEnd={() => {
                          setDragLeadId(null);
                          setDragOverColumn(null);
                        }}
                        onClick={() => openDetail(lead)}>
                        {/* Card header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {interestIcon(lead.interest_area)} {lead.company_name || lead.contact_name}
                            </div>
                            {lead.company_name && (
                              <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 1 }}>{lead.contact_name}</div>
                            )}
                          </div>
                          {age && (
                            <span style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: age.color,
                              background: `${age.color}18`,
                              border: `1px solid ${age.color}44`,
                              borderRadius: 6,
                              padding: "1px 5px",
                              whiteSpace: "nowrap",
                              marginLeft: 6,
                            }}>
                              {age.label}
                            </span>
                          )}
                        </div>

                        {/* Contact info */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--muted)", fontSize: "0.73rem" }}>
                            <Mail size={10} /> {lead.email}
                          </div>
                          {lead.phone && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--muted)", fontSize: "0.73rem" }}>
                              <Phone size={10} /> {lead.phone}
                            </div>
                          )}
                          {lead.interest_area && (
                            <div style={{ color: "var(--muted)", fontSize: "0.73rem", marginTop: 2 }}>
                              <span style={{ color: col.color, fontWeight: 500 }}>{lead.interest_area}</span>
                            </div>
                          )}
                        </div>

                        {/* Move buttons */}
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {nexts.map((nextStatus) => {
                            const nextCol = COLUMNS.find((c) => c.key === nextStatus);
                            const isBack = COLUMNS.findIndex((c) => c.key === nextStatus) < COLUMNS.findIndex((c) => c.key === lead.status);
                            return (
                              <button
                                key={nextStatus}
                                type="button"
                                title={`Mover a ${nextCol?.label ?? nextStatus}`}
                                onClick={(e) => { e.stopPropagation(); handleMove(lead, nextStatus); }}
                                style={{
                                  background: isBack ? "var(--row)" : nextCol?.color ?? col.color,
                                  color: isBack ? "var(--muted)" : "#fff",
                                  border: `1px solid ${isBack ? "var(--line)" : (nextCol?.color ?? col.color)}`,
                                  borderRadius: 6,
                                  padding: "3px 7px",
                                  fontSize: "0.68rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                {isBack ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
                                {nextCol?.label ?? nextStatus}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail / edit modal */}
      <Modal isOpen={!!selectedLead} title={selectedLead ? (selectedLead.company_name || selectedLead.contact_name) : ""} onClose={() => setSelectedLead(null)}>
        {selectedLead ? (
          <div className="entity-form">
            <div className="card-meta" style={{ marginBottom: 12 }}>
              <div><span className="card-label">Estado</span><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{selectedLead.status}</span></div>
              <div><span className="card-label">Creado</span><span>{selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleDateString("es-PE") : "—"}</span></div>
            </div>
            <input value={editForm.contact_name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Nombre del contacto" />
            <input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" />
            <input value={editForm.company_name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Empresa" />
            <input value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Teléfono" />
            <input value={editForm.interest_area ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, interest_area: e.target.value }))} placeholder="Área de interés" />
            <select value={editForm.source ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}>
              <option value="">Fuente del lead — sin especificar</option>
              <option value="linkedin">LinkedIn</option>
              <option value="referral">Referido</option>
              <option value="website">Sitio web</option>
              <option value="event">Evento / Feria</option>
              <option value="google_ads">Google Ads</option>
              <option value="cold_outreach">Outreach en frío</option>
              <option value="other">Otro</option>
            </select>
            <textarea value={editForm.message ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, message: e.target.value }))} placeholder="Mensaje / notas" rows={3} />
            <div className="panel-actions">
              {isAdmin && (
                <button className="button button-primary" type="button" disabled={editSaving} onClick={handleSaveEdit}>
                  {editSaving ? "Guardando…" : "Guardar cambios"}
                </button>
              )}
              {isAdmin && (selectedLead.status ?? "").toUpperCase() === "CLOSED_WON" && (
                <button className="button button-success" type="button" disabled={converting} onClick={() => handleConvert(selectedLead)}>
                  {converting ? "Convirtiendo…" : "Convertir a cliente"}
                </button>
              )}
              {isSuperAdmin && (
                <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(selectedLead)}>
                  Eliminar
                </button>
              )}
              <button className="button button-ghost" type="button" onClick={() => setSelectedLead(null)}>Cerrar</button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create modal */}
      <Modal isOpen={createOpen} title="Nuevo lead" onClose={() => setCreateOpen(false)}>
        <div className="entity-form">
          <input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Nombre del contacto *" />
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email *" />
          <input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Empresa" />
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Teléfono" />
          <input value={form.interest_area} onChange={(e) => setForm((f) => ({ ...f, interest_area: e.target.value }))} placeholder="Área de interés (ej: Firewall, Seguridad)" />
          <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Mensaje o notas" rows={3} />
          <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
            <option value="">Fuente</option>
            <option value="website">Sitio web</option>
            <option value="referral">Referido</option>
            <option value="linkedin">LinkedIn</option>
            <option value="email">Email</option>
            <option value="evento">Evento</option>
            <option value="otro">Otro</option>
          </select>
          <button className="button button-primary" type="button" onClick={handleCreate} disabled={saving || !form.contact_name || !form.email}>
            {saving ? "Guardando..." : "Crear lead"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
