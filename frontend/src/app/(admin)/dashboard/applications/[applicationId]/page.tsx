"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ApplicationAssignmentItem,
  ApplicationAttachmentItem,
  ApplicationEventItem,
  ApplicationNoteItem,
  ApplicationReviewItem,
  assignJobApplicationReviewer,
  createJobApplicationAttachment,
  createJobApplicationNote,
  createJobApplicationReview,
  DashboardUser,
  getJobApplicationAssignments,
  getJobApplicationAttachments,
  getJobApplication,
  getJobApplicationNotes,
  getJobApplicationReviews,
  getJobApplicationTimeline,
  getUsers,
  JobApplicationItem,
  updateJobApplicationStatus,
} from "@/lib/api";
import { confirmAction, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser, isAdminRole } from "@/lib/auth";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";

type TabKey = "summary" | "reviews" | "notes" | "attachments" | "timeline";

const tabs: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Resumen" },
  { key: "reviews", label: "Revisiones" },
  { key: "notes", label: "Notas" },
  { key: "attachments", label: "Adjuntos" },
  { key: "timeline", label: "Timeline" },
];

const statusOptions = [
  { value: "new", label: "Nuevo" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Entrevista" },
  { value: "offer", label: "Oferta" },
  { value: "hired", label: "Contratado" },
  { value: "rejected", label: "Rechazado" },
  { value: "withdrawn", label: "Retirado" },
  { value: "on_hold", label: "En espera" },
];

const statusLabelMap = new Map(statusOptions.map((option) => [option.value, option.label]));

const recommendationOptions = [
  { value: "approve", label: "Aprobar" },
  { value: "reject", label: "Rechazar" },
  { value: "hold", label: "En espera" },
];

const recommendationLabelMap = new Map(
  recommendationOptions.map((option) => [option.value, option.label]),
);

function formatStatus(value?: string | null) {
  if (!value) return "Sin estado";
  return statusLabelMap.get(value) || value.replaceAll("_", " ");
}

function formatRecommendation(value?: string | null) {
  if (!value) return "Sin recomendacion";
  return recommendationLabelMap.get(value) || value.replaceAll("_", " ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleString("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parsePayload(payload?: string | null): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = Number(params?.applicationId);

  const [application, setApplication] = useState<JobApplicationItem | null>(null);
  const [timeline, setTimeline] = useState<ApplicationEventItem[]>([]);
  const [assignments, setAssignments] = useState<ApplicationAssignmentItem[]>([]);
  const [reviews, setReviews] = useState<ApplicationReviewItem[]>([]);
  const [notes, setNotes] = useState<ApplicationNoteItem[]>([]);
  const [attachments, setAttachments] = useState<ApplicationAttachmentItem[]>([]);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignReviewerId, setAssignReviewerId] = useState("");
  const [assignRole, setAssignRole] = useState("reviewer");
  const [assignSaving, setAssignSaving] = useState(false);

  const [statusValue, setStatusValue] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const [reviewScore, setReviewScore] = useState("3");
  const [reviewRecommendation, setReviewRecommendation] = useState("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("internal");
  const [noteSaving, setNoteSaving] = useState(false);

  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState("");
  const [attachmentSaving, setAttachmentSaving] = useState(false);

  const sessionUser = useMemo(() => getStoredUser(), []);
  const isAdmin = sessionUser ? isAdminRole(sessionUser.role) : false;

  const reviewerOptions = useMemo(
    () => users.filter((user) => user.role_code !== "client"),
    [users],
  );
  const userMap = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((user) => map.set(user.id, user.full_name || user.email));
    return map;
  }, [users]);

  useEffect(() => {
    if (!applicationId || Number.isNaN(applicationId)) {
      setLoading(false);
      setError("Postulacion no encontrada");
      return;
    }
    setLoading(true);
    Promise.all([
      getJobApplication(applicationId),
      getJobApplicationTimeline(applicationId),
      getJobApplicationAssignments(applicationId),
      getJobApplicationReviews(applicationId),
      getJobApplicationNotes(applicationId),
      getJobApplicationAttachments(applicationId),
      isAdmin ? getUsers() : Promise.resolve<DashboardUser[]>([]),
    ])
      .then(
        ([
          applicationData,
          timelineData,
          assignmentData,
          reviewData,
          noteData,
          attachmentData,
          usersData,
        ]) => {
        setApplication(applicationData);
        setTimeline(timelineData);
        setAssignments(assignmentData);
        setReviews(reviewData);
        setNotes(noteData);
        setAttachments(attachmentData);
        setUsers(usersData);
        setStatusValue(applicationData.status || "new");
        setError("");
        },
      )
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar la postulacion");
      })
      .finally(() => setLoading(false));
  }, [applicationId, isAdmin]);

  async function refreshTimeline() {
    if (!applicationId) return;
    const updated = await getJobApplicationTimeline(applicationId);
    setTimeline(updated);
  }

  async function refreshAssignments() {
    if (!applicationId) return;
    const updated = await getJobApplicationAssignments(applicationId);
    setAssignments(updated);
  }

  async function refreshReviews() {
    if (!applicationId) return;
    const updated = await getJobApplicationReviews(applicationId);
    setReviews(updated);
  }

  async function refreshNotes() {
    if (!applicationId) return;
    const updated = await getJobApplicationNotes(applicationId);
    setNotes(updated);
  }

  async function refreshAttachments() {
    if (!applicationId) return;
    const updated = await getJobApplicationAttachments(applicationId);
    setAttachments(updated);
  }

  function resolveUserName(raw: unknown) {
    const parsed = typeof raw === "number" ? raw : Number(raw);
    if (!parsed || Number.isNaN(parsed)) return null;
    return userMap.get(parsed) || `Usuario #${parsed}`;
  }

  function buildEventDetail(event: ApplicationEventItem) {
    const payload = parsePayload(event.payload_json);
    const actorName = resolveUserName(payload?.actor_id);
    if (event.event_type === "status_change") {
      const from = typeof payload?.from === "string" ? payload?.from : null;
      const to = typeof payload?.to === "string" ? payload?.to : null;
      const actor = actorName ? ` por ${actorName}` : "";
      return `Estado: ${formatStatus(from)} -> ${formatStatus(to)}${actor}`;
    }
    if (event.event_type === "assignment") {
      const reviewerName = resolveUserName(payload?.reviewer_user_id);
      const role = typeof payload?.role === "string" ? payload?.role : null;
      const actor = actorName ? ` por ${actorName}` : "";
      return `Asignado a ${reviewerName || "Revisor"}${role ? ` (${role})` : ""}${actor}`;
    }
    if (event.event_type === "review") {
      const rawScore = payload?.score;
      const score =
        typeof rawScore === "number" || typeof rawScore === "string" ? rawScore : "-";
      const recommendation = typeof payload?.recommendation === "string" ? payload?.recommendation : null;
      const actor = actorName ? ` por ${actorName}` : "";
      return `Review ${score}/5 · ${formatRecommendation(recommendation)}${actor}`;
    }
    if (event.event_type === "note") {
      const actor = actorName ? ` por ${actorName}` : "";
      return `Nota interna${actor}`;
    }
    if (event.event_type === "attachment") {
      const fileType = typeof payload?.file_type === "string" ? payload?.file_type : null;
      const actor = actorName ? ` por ${actorName}` : "";
      return `Adjunto${fileType ? `: ${fileType}` : ""}${actor}`;
    }
    return "Evento registrado";
  }

  async function handleAssignReviewer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;
    const parsedReviewer = Number(assignReviewerId);
    if (!parsedReviewer) {
      notifyError("Selecciona un revisor");
      return;
    }
    setAssignSaving(true);
    try {
      await assignJobApplicationReviewer(application.id, {
        reviewer_user_id: parsedReviewer,
        role: assignRole || "reviewer",
      });
      await refreshAssignments();
      await refreshTimeline();
      setAssignReviewerId("");
      setAssignRole("reviewer");
      setAssignOpen(false);
      notifySuccess("Revisor asignado", "La asignacion se registro en el timeline.");
    } catch (err) {
      notifyError("No se pudo asignar", err instanceof Error ? err.message : undefined);
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleStatusUpdate() {
    if (!application) return;
    if (!statusValue) {
      notifyError("Selecciona un estado");
      return;
    }
    const confirmed = await confirmAction({
      title: "Cambiar estado",
      text: `Mover postulacion a "${formatStatus(statusValue)}"?`,
      confirmText: "Actualizar",
    });
    if (!confirmed) return;
    setStatusSaving(true);
    try {
      const updated = await updateJobApplicationStatus(application.id, statusValue);
      setApplication(updated);
      setStatusValue(updated.status || statusValue);
      await refreshTimeline();
      notifySuccess("Estado actualizado", "El cambio quedo registrado.");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleCreateReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;
    const scoreValue = Number(reviewScore);
    if (!scoreValue || scoreValue < 1 || scoreValue > 5) {
      notifyError("Score invalido", "Usa un valor entre 1 y 5.");
      return;
    }
    setReviewSaving(true);
    try {
      await createJobApplicationReview(application.id, {
        score: scoreValue,
        recommendation: reviewRecommendation,
        notes: reviewNotes || null,
      });
      await refreshReviews();
      await refreshTimeline();
      setReviewNotes("");
      notifySuccess("Review registrada", "Se agrego al timeline.");
    } catch (err) {
      notifyError("No se pudo registrar", err instanceof Error ? err.message : undefined);
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleCreateNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;
    if (!noteText.trim()) {
      notifyError("Escribe una nota");
      return;
    }
    setNoteSaving(true);
    try {
      await createJobApplicationNote(application.id, {
        note: noteText.trim(),
        visibility: noteVisibility,
      });
      await refreshNotes();
      await refreshTimeline();
      setNoteText("");
      notifySuccess("Nota agregada", "Disponible en timeline.");
    } catch (err) {
      notifyError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleCreateAttachment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application) return;
    if (!attachmentUrl.trim()) {
      notifyError("Ingresa la URL del adjunto");
      return;
    }
    setAttachmentSaving(true);
    try {
      await createJobApplicationAttachment(application.id, {
        file_url: attachmentUrl.trim(),
        file_type: attachmentType.trim() || null,
      });
      await refreshAttachments();
      await refreshTimeline();
      setAttachmentUrl("");
      setAttachmentType("");
      notifySuccess("Adjunto agregado", "Se registro en el timeline.");
    } catch (err) {
      notifyError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    } finally {
      setAttachmentSaving(false);
    }
  }

  if (loading) {
    return <div className="state-panel">Cargando postulacion...</div>;
  }

  if (error || !application) {
    return <div className="state-panel state-error">{error || "Postulacion no encontrada"}</div>;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Postulacion</p>
          <h2>{application.full_name}</h2>
        </div>
        <div className="panel-actions">
          <Link className="button button-ghost" href="/dashboard/applications">
            Volver
          </Link>
          <span className={`badge ${getStatusBadgeClass(application.status)}`}>
            {formatStatus(application.status)}
          </span>
        </div>
      </div>

      <div className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? "tab-active" : ""}`}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Resumen</p>
              <h3>Datos del postulante</h3>
            </div>
            <div className="panel-actions">
              {isAdmin ? (
                <button className="button button-secondary" type="button" onClick={() => setAssignOpen(true)}>
                  Asignar revisor
                </button>
              ) : null}
            </div>
          </div>
          <div className="card-meta">
            <div>
              <span className="card-label">Email</span>
              <span>{application.email}</span>
            </div>
            <div>
              <span className="card-label">Telefono</span>
              <span>{application.phone || "-"}</span>
            </div>
            <div>
              <span className="card-label">Rol deseado</span>
              <span>{application.desired_role || "Sin rol"}</span>
            </div>
            <div>
              <span className="card-label">Origen</span>
              <span>{application.source || "-"}</span>
            </div>
            <div>
              <span className="card-label">Fecha</span>
              <span>{formatDateTime(application.created_at)}</span>
            </div>
            <div>
              <span className="card-label">Skills</span>
              <span>{application.skills_summary || "-"}</span>
            </div>
          </div>
          <div className="panel-actions panel-head-spaced">
            {application.cv_url ? (
              <a className="button button-ghost" href={application.cv_url} target="_blank" rel="noreferrer">
                Ver CV
              </a>
            ) : null}
            {application.portfolio_url ? (
              <a className="button button-ghost" href={application.portfolio_url} target="_blank" rel="noreferrer">
                Ver portafolio
              </a>
            ) : null}
          </div>

          <div className="panel-head panel-head-spaced">
            <div>
              <p className="eyebrow">Revisores</p>
              <h3>Asignaciones activas</h3>
            </div>
          </div>
          {assignments.length === 0 ? (
            <div className="empty-state">No hay revisores asignados.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head">
                <span>Revisor</span>
                <span>Rol</span>
                <span>Asignado</span>
              </div>
              {assignments.map((assignment) => (
                <div className="table-row" key={assignment.id}>
                  <span>
                    {resolveUserName(assignment.reviewer_user_id) ||
                      `Usuario #${assignment.reviewer_user_id}`}
                  </span>
                  <span>{assignment.role || "-"}</span>
                  <span>{formatDateTime(assignment.assigned_at)}</span>
                </div>
              ))}
            </div>
          )}

          {isAdmin ? (
            <div className="panel-head panel-head-spaced">
              <div>
                <p className="eyebrow">Estado</p>
                <h3>Cambiar estado</h3>
              </div>
            </div>
          ) : null}

          {isAdmin ? (
            <form className="entity-form" onSubmit={(event) => event.preventDefault()}>
              <select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button className="button button-primary" type="button" onClick={handleStatusUpdate} disabled={statusSaving}>
                {statusSaving ? "Actualizando..." : "Actualizar estado"}
              </button>
            </form>
          ) : (
            <p className="form-status">Solo administradores pueden cambiar estado.</p>
          )}
        </article>
      ) : null}

      {activeTab === "reviews" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Revisiones</p>
              <h3>Agregar review interna</h3>
            </div>
          </div>
          <form className="entity-form" onSubmit={handleCreateReview}>
            <select value={reviewScore} onChange={(event) => setReviewScore(event.target.value)}>
              {[1, 2, 3, 4, 5].map((score) => (
                <option key={score} value={score}>
                  Score {score}
                </option>
              ))}
            </select>
            <select value={reviewRecommendation} onChange={(event) => setReviewRecommendation(event.target.value)}>
              {recommendationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Notas internas"
              rows={4}
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
            />
            <button className="button button-primary" type="submit" disabled={reviewSaving}>
              {reviewSaving ? "Guardando..." : "Registrar review"}
            </button>
          </form>
          <p className="form-status">Las revisiones quedan registradas en el timeline.</p>

          <div className="panel-head panel-head-spaced">
            <div>
              <p className="eyebrow">Historial</p>
              <h3>Reviews registradas</h3>
            </div>
          </div>
          {reviews.length === 0 ? (
            <div className="empty-state">No hay reviews registradas.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head">
                <span>Revisor</span>
                <span>Detalle</span>
                <span>Fecha</span>
              </div>
              {reviews.map((review) => (
                <div className="table-row" key={review.id}>
                  <span>
                    {resolveUserName(review.reviewer_user_id) ||
                      `Usuario #${review.reviewer_user_id}`}
                  </span>
                  <div>
                    <strong>
                      {review.score}/5 · {formatRecommendation(review.recommendation)}
                    </strong>
                    <span className="card-subtitle">{review.notes || "Sin notas"}</span>
                  </div>
                  <span>{formatDateTime(review.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {activeTab === "notes" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Notas</p>
              <h3>Comentarios internos</h3>
            </div>
          </div>
          <form className="entity-form" onSubmit={handleCreateNote}>
            <textarea
              placeholder="Escribe una nota interna"
              rows={4}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
            />
            <select value={noteVisibility} onChange={(event) => setNoteVisibility(event.target.value)}>
              <option value="internal">Interno</option>
            </select>
            <button className="button button-primary" type="submit" disabled={noteSaving}>
              {noteSaving ? "Guardando..." : "Agregar nota"}
            </button>
          </form>
          <p className="form-status">Las notas internas solo se muestran en administracion.</p>

          <div className="panel-head panel-head-spaced">
            <div>
              <p className="eyebrow">Historial</p>
              <h3>Notas registradas</h3>
            </div>
          </div>
          {notes.length === 0 ? (
            <div className="empty-state">No hay notas registradas.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head">
                <span>Autor</span>
                <span>Nota</span>
                <span>Fecha</span>
              </div>
              {notes.map((note) => (
                <div className="table-row" key={note.id}>
                  <span>
                    {resolveUserName(note.author_user_id) || `Usuario #${note.author_user_id}`}
                  </span>
                  <div>
                    <span>{note.note}</span>
                    <span className="card-subtitle">Visibilidad: {note.visibility}</span>
                  </div>
                  <span>{formatDateTime(note.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {activeTab === "attachments" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Adjuntos</p>
              <h3>Agregar archivos de soporte</h3>
            </div>
          </div>
          <form className="entity-form" onSubmit={handleCreateAttachment}>
            <input
              placeholder="URL del archivo"
              value={attachmentUrl}
              onChange={(event) => setAttachmentUrl(event.target.value)}
            />
            <input
              placeholder="Tipo de archivo (opcional)"
              value={attachmentType}
              onChange={(event) => setAttachmentType(event.target.value)}
            />
            <button className="button button-primary" type="submit" disabled={attachmentSaving}>
              {attachmentSaving ? "Guardando..." : "Agregar adjunto"}
            </button>
          </form>
          <p className="form-status">Los adjuntos se listan en el timeline.</p>

          <div className="panel-head panel-head-spaced">
            <div>
              <p className="eyebrow">Historial</p>
              <h3>Adjuntos registrados</h3>
            </div>
          </div>
          {attachments.length === 0 ? (
            <div className="empty-state">No hay adjuntos registrados.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head table-row-wide">
                <span>Archivo</span>
                <span>Tipo</span>
                <span>Subido por</span>
                <span>Fecha</span>
              </div>
              {attachments.map((attachment) => (
                <div className="table-row table-row-wide" key={attachment.id}>
                  <span>
                    <a className="link-inline" href={attachment.file_url} target="_blank" rel="noreferrer">
                      Ver archivo
                    </a>
                  </span>
                  <span>{attachment.file_type || "-"}</span>
                  <span>
                    {resolveUserName(attachment.uploaded_by_user_id) ||
                      `Usuario #${attachment.uploaded_by_user_id}`}
                  </span>
                  <span>{formatDateTime(attachment.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {activeTab === "timeline" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Timeline</p>
              <h3>Historial de eventos</h3>
            </div>
          </div>
          {timeline.length === 0 ? (
            <div className="empty-state">No hay eventos registrados.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head">
                <span>Evento</span>
                <span>Detalle</span>
                <span>Fecha</span>
              </div>
              {timeline.map((event) => (
                <div className="table-row" key={event.id}>
                  <span>{event.event_type.replaceAll("_", " ")}</span>
                  <span>{buildEventDetail(event)}</span>
                  <span>{formatDateTime(event.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      <Modal isOpen={assignOpen} title="Asignar revisor" onClose={() => setAssignOpen(false)}>
        <form className="entity-form" onSubmit={handleAssignReviewer}>
          <select value={assignReviewerId} onChange={(event) => setAssignReviewerId(event.target.value)}>
            <option value="">Selecciona un revisor</option>
            {reviewerOptions.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.full_name}
              </option>
            ))}
          </select>
          <select value={assignRole} onChange={(event) => setAssignRole(event.target.value)}>
            <option value="reviewer">Reviewer</option>
            <option value="interviewer">Interviewer</option>
          </select>
          <button className="button button-primary" type="submit" disabled={assignSaving}>
            {assignSaving ? "Asignando..." : "Asignar"}
          </button>
        </form>
      </Modal>
    </section>
  );
}
