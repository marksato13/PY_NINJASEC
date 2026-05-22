"use client";

import { HelpCircle, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createSupportTicket,
  getMe,
  getSupportTicket,
  getSupportTickets,
  SupportTicketDetail,
  SupportTicketItem,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";

const ticketSchema = z.object({
  title:       z.string().min(5, "Título demasiado corto").max(200),
  description: z.string().min(10, "Describe el problema con más detalle").max(2000),
  priority:    z.enum(["critical", "high", "medium", "low"]),
  category:    z.string().optional(),
});
type TicketFormValues = z.infer<typeof ticketSchema>;

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high:     "Alta",
  medium:   "Media",
  low:      "Baja",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "badge-rejected",
  high:     "badge-pending",
  medium:   "badge-draft",
  low:      "badge-active",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PortalSupportPage() {
  const user        = getStoredUser();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn:  () => getMe(),
  });

  const [tab, setTab]           = useState<"open" | "closed">("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail]     = useState<SupportTicketDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ["portal-tickets", tab],
    queryFn:  () => getSupportTickets({
      ticket_status: tab === "open" ? "open" : "closed",
    }),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: "", description: "", priority: "medium", category: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: TicketFormValues) =>
      createSupportTicket({
        client_id:   me?.organization_id ?? 0,
        title:       values.title,
        description: values.description,
        priority:    values.priority,
        category:    values.category || null,
      }),
    onSuccess: () => {
      notifySuccess("Ticket creado", "Te contactaremos pronto.");
      reset();
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["portal-tickets"] });
    },
    onError: (err) => notifyError("Error al crear ticket", err instanceof Error ? err.message : undefined),
  });

  async function openDetail(id: number) {
    setLoadingDetail(true);
    setDetailOpen(true);
    try {
      const data = await getSupportTicket(id);
      setDetail(data);
    } catch {
      notifyError("No se pudo cargar el detalle del ticket");
      setDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <section className="page-stack">
      {/* Encabezado */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Portal</p>
          <h2>Soporte</h2>
        </div>
        <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Nuevo ticket
        </button>
      </div>

      {/* Info de SLA */}
      <article className="panel" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Email", value: "soporte@ninjasec.local" },
          { label: "Horario", value: "Lun–Vie 9am–6pm" },
          { label: "Respuesta inicial", value: "24 h hábiles" },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: "center", padding: "8px 0" }}>
            <p className="eyebrow">{item.label}</p>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>{item.value}</p>
          </div>
        ))}
      </article>

      {/* Tabs */}
      <div className="tab-list">
        <button className={`tab ${tab === "open" ? "tab-active" : ""}`} type="button" onClick={() => setTab("open")}>
          Abiertos
        </button>
        <button className={`tab ${tab === "closed" ? "tab-active" : ""}`} type="button" onClick={() => setTab("closed")}>
          Cerrados
        </button>
      </div>

      {/* Lista */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Tickets</p>
            <h3>{tab === "open" ? "Tickets abiertos" : "Tickets resueltos"}</h3>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{tickets.length} resultado{tickets.length !== 1 ? "s" : ""}</span>
        </div>

        {error && <p className="form-error">Error al cargar tickets</p>}

        {isLoading ? (
          <div className="empty-state">Cargando tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <HelpCircle size={28} style={{ opacity: 0.35, margin: "0 auto 8px", display: "block" }} />
            {tab === "open" ? "No tienes tickets abiertos." : "No hay tickets cerrados."}
          </div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
              <span>Título</span>
              <span>Prioridad</span>
              <span>Estado</span>
              <span>Fecha</span>
              <span></span>
            </div>
            {tickets.map((ticket) => (
              <div
                className="table-row"
                key={ticket.id}
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}
              >
                <span style={{ fontWeight: 500 }}>{ticket.title}</span>
                <span>
                  <span className={`badge ${PRIORITY_BADGE[ticket.priority] ?? "badge-draft"}`}>
                    {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                  </span>
                </span>
                <span>
                  <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>{ticket.status}</span>
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{formatDate(ticket.opened_at)}</span>
                <span>
                  <button className="button button-ghost button-sm" type="button" onClick={() => openDetail(ticket.id)}>
                    Ver
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* Modal crear ticket */}
      <Modal isOpen={createOpen} title="Nuevo ticket de soporte" onClose={() => { setCreateOpen(false); reset(); }}>
        <form className="entity-form" onSubmit={handleSubmit((v) => createMutation.mutate(v))}>
          <label>
            <span>Título <span style={{ color: "var(--danger)" }}>*</span></span>
            <input type="text" placeholder="Describe el problema brevemente" {...register("title")} />
            {errors.title && <p className="form-error">{errors.title.message}</p>}
          </label>

          <label>
            <span>Prioridad <span style={{ color: "var(--danger)" }}>*</span></span>
            <select {...register("priority")}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </label>

          <label>
            <span>Categoría</span>
            <input type="text" placeholder="Ej: Red, Acceso, Reportes…" {...register("category")} />
          </label>

          <label>
            <span>Descripción detallada <span style={{ color: "var(--danger)" }}>*</span></span>
            <textarea rows={5} placeholder="Explica el problema con detalle: qué pasó, cuándo ocurrió, pasos para reproducirlo…" {...register("description")} />
            {errors.description && <p className="form-error">{errors.description.message}</p>}
          </label>

          <div className="panel-actions" style={{ justifyContent: "flex-end" }}>
            <button className="button button-ghost" type="button" onClick={() => { setCreateOpen(false); reset(); }}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Crear ticket"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal detalle */}
      <Modal isOpen={detailOpen} title={detail ? `Ticket #${detail.id}` : "Cargando…"} onClose={() => { setDetailOpen(false); setDetail(null); }}>
        {loadingDetail ? (
          <div className="empty-state">Cargando detalle…</div>
        ) : detail ? (
          <div className="entity-form">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <p className="eyebrow">Estado</p>
                <span className={`badge ${getStatusBadgeClass(detail.status)}`}>{detail.status}</span>
              </div>
              <div>
                <p className="eyebrow">Prioridad</p>
                <span className={`badge ${PRIORITY_BADGE[detail.priority] ?? "badge-draft"}`}>
                  {PRIORITY_LABELS[detail.priority] ?? detail.priority}
                </span>
              </div>
              <div>
                <p className="eyebrow">Abierto</p>
                <p style={{ margin: 0 }}>{formatDate(detail.opened_at)}</p>
              </div>
              {detail.closed_at && (
                <div>
                  <p className="eyebrow">Cerrado</p>
                  <p style={{ margin: 0 }}>{formatDate(detail.closed_at)}</p>
                </div>
              )}
            </div>

            {detail.description && (
              <div>
                <p className="eyebrow">Descripción</p>
                <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>{detail.description}</p>
              </div>
            )}

            {detail.resolution && (
              <div>
                <p className="eyebrow">Resolución</p>
                <p style={{ margin: 0, color: "var(--success)", lineHeight: 1.6 }}>{detail.resolution}</p>
              </div>
            )}

            {detail.events?.length > 0 && (
              <div>
                <p className="eyebrow">Historial</p>
                <div style={{ display: "grid", gap: 6 }}>
                  {detail.events.map((ev) => (
                    <div key={ev.id} style={{ display: "flex", gap: 10, fontSize: "0.82rem", color: "var(--muted)" }}>
                      <span style={{ color: "var(--primary)", minWidth: 80 }}>{ev.event_type}</span>
                      <span>{ev.notes ?? "—"}</span>
                      <span style={{ marginLeft: "auto" }}>{formatDate(ev.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
