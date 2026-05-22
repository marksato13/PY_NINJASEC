"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  ApplicationEventItem,
  ApplicationNoteItem,
  ApplicationReviewItem,
  createJobApplicationNote,
  createJobApplicationReview,
  getJobApplication,
  getJobApplicationNotes,
  getJobApplicationReviews,
  getJobApplicationTimeline,
  JobApplicationItem,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { QK } from "@/lib/query-keys";

type TabKey = "summary" | "review" | "notes" | "timeline";

const tabs: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Resumen" },
  { key: "review", label: "Review" },
  { key: "notes", label: "Notas" },
  { key: "timeline", label: "Timeline" },
];

const statusLabelMap = new Map([
  ["new", "Nuevo"],
  ["screening", "Screening"],
  ["interview", "Entrevista"],
  ["offer", "Oferta"],
  ["hired", "Contratado"],
  ["rejected", "Rechazado"],
  ["withdrawn", "Retirado"],
  ["on_hold", "En espera"],
]);

const recommendationLabelMap = new Map([
  ["approve", "Aprobar"],
  ["reject", "Rechazar"],
  ["hold", "En espera"],
]);

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

function resolveUserLabel(raw: unknown) {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!parsed || Number.isNaN(parsed)) return "";
  return `Usuario #${parsed}`;
}

export default function PortalApplicationDetailPage() {
  const params = useParams();
  const applicationId = Number(params?.applicationId);

  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [reviewScore, setReviewScore] = useState("3");
  const [reviewRecommendation, setReviewRecommendation] = useState("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const sessionUser = useMemo(() => getStoredUser(), []);

  const isValidId = !!applicationId && !Number.isNaN(applicationId);

  const { data: application, isLoading: appLoading, error: appError } = useQuery<JobApplicationItem>({
    queryKey: QK.jobApplication(applicationId),
    queryFn: () => getJobApplication(applicationId),
    enabled: isValidId,
  });

  const { data: timelineData = [], refetch: refetchTimeline } = useQuery<ApplicationEventItem[]>({
    queryKey: ["job-application-timeline", applicationId],
    queryFn: () => getJobApplicationTimeline(applicationId),
    enabled: isValidId,
  });

  const { data: reviewsData = [], refetch: refetchReviews } = useQuery<ApplicationReviewItem[]>({
    queryKey: ["job-application-reviews", applicationId],
    queryFn: () => getJobApplicationReviews(applicationId),
    enabled: isValidId,
  });

  const { data: notesData = [], refetch: refetchNotes } = useQuery<ApplicationNoteItem[]>({
    queryKey: ["job-application-notes", applicationId],
    queryFn: () => getJobApplicationNotes(applicationId),
    enabled: isValidId,
  });

  const timeline = timelineData;
  const reviews = sessionUser?.id
    ? reviewsData.filter((item) => item.reviewer_user_id === sessionUser.id)
    : [];
  const notes = sessionUser?.id
    ? notesData.filter((item) => item.author_user_id === sessionUser.id)
    : [];

  const loading = appLoading;
  const error = appError;

  async function refreshTimeline() {
    await refetchTimeline();
  }

  async function refreshReviews() {
    await refetchReviews();
  }

  async function refreshNotes() {
    await refetchNotes();
  }

  function buildEventDetail(event: ApplicationEventItem) {
    const payload = parsePayload(event.payload_json);
    const actor = payload?.actor_id ? ` por ${resolveUserLabel(payload.actor_id)}` : "";
    if (event.event_type === "status_change") {
      const from = typeof payload?.from === "string" ? payload?.from : null;
      const to = typeof payload?.to === "string" ? payload?.to : null;
      return `Estado: ${formatStatus(from)} -> ${formatStatus(to)}${actor}`;
    }
    if (event.event_type === "assignment") {
      const reviewer = payload?.reviewer_user_id
        ? resolveUserLabel(payload.reviewer_user_id)
        : "Revisor";
      return `Asignado a ${reviewer}${actor}`;
    }
    if (event.event_type === "review") {
      const score = payload?.score ?? "-";
      const recommendation = typeof payload?.recommendation === "string" ? payload?.recommendation : null;
      return `Review ${score}/5 · ${formatRecommendation(recommendation)}${actor}`;
    }
    if (event.event_type === "note") {
      return `Nota interna${actor}`;
    }
    if (event.event_type === "attachment") {
      return `Adjunto${actor}`;
    }
    return "Evento registrado";
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
      notifySuccess("Review registrada", "Se notifico a administracion.");
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
        visibility: "internal",
      });
      await refreshNotes();
      await refreshTimeline();
      setNoteText("");
      notifySuccess("Nota enviada", "Disponible para administracion.");
    } catch (err) {
      notifyError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    } finally {
      setNoteSaving(false);
    }
  }

  if (!isValidId) {
    return <div className="state-panel state-error">Postulacion no encontrada</div>;
  }

  if (loading) {
    return <div className="state-panel">Cargando postulacion...</div>;
  }

  if (error || !application) {
    return <div className="state-panel state-error">{error instanceof Error ? error.message : "Postulacion no encontrada"}</div>;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Postulacion</p>
          <h2>{application.full_name}</h2>
        </div>
        <div className="panel-actions">
          <Link className="button button-ghost" href="/portal/applications">
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
        </article>
      ) : null}

      {activeTab === "review" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Review</p>
              <h3>Registrar recomendacion</h3>
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
              {Array.from(recommendationLabelMap.entries()).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
              {reviewSaving ? "Guardando..." : "Enviar review"}
            </button>
          </form>

          <div className="panel-head panel-head-spaced">
            <div>
              <p className="eyebrow">Historial</p>
              <h3>Mis reviews</h3>
            </div>
          </div>
          {reviews.length === 0 ? (
            <div className="empty-state">Aun no has registrado reviews.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head">
                <span>Detalle</span>
                <span>Notas</span>
                <span>Fecha</span>
              </div>
              {reviews.map((review) => (
                <div className="table-row" key={review.id}>
                  <span>
                    <strong>
                      {review.score}/5 · {formatRecommendation(review.recommendation)}
                    </strong>
                  </span>
                  <span>{review.notes || "Sin notas"}</span>
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
              <p className="eyebrow">Notas internas</p>
              <h3>Comentarios para administracion</h3>
            </div>
          </div>
          <form className="entity-form" onSubmit={handleCreateNote}>
            <textarea
              placeholder="Comparte contexto adicional"
              rows={4}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
            />
            <button className="button button-primary" type="submit" disabled={noteSaving}>
              {noteSaving ? "Guardando..." : "Enviar nota"}
            </button>
          </form>
          <p className="form-status">Las notas internas son visibles para administracion.</p>

          <div className="panel-head panel-head-spaced">
            <div>
              <p className="eyebrow">Historial</p>
              <h3>Mis notas</h3>
            </div>
          </div>
          {notes.length === 0 ? (
            <div className="empty-state">No has registrado notas internas.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head">
                <span>Nota</span>
                <span>Fecha</span>
                <span>Visibilidad</span>
              </div>
              {notes.map((note) => (
                <div className="table-row" key={note.id}>
                  <span>{note.note}</span>
                  <span>{formatDateTime(note.created_at)}</span>
                  <span>{note.visibility}</span>
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
    </section>
  );
}
