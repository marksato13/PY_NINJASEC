"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSecurityReview, getSecurityReviews, ReviewAttachmentItem, SecurityReviewDetail, SecurityReviewItem } from "@/lib/api";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";
import { QK } from "@/lib/query-keys";

export default function PortalReviewsPage() {
  const [detail, setDetail] = useState<SecurityReviewDetail | null>(null);

  const { data: reviews = [], isLoading, error } = useQuery<SecurityReviewItem[]>({
    queryKey: QK.reviews({ status: "closed" }),
    queryFn: () => getSecurityReviews({ status: "closed" }),
  });

  function reportAttachment(items: ReviewAttachmentItem[]) {
    return items.find((item) => item.filename.toLowerCase().includes("informe")) || items[0] || null;
  }

  return (
    <section className="page-stack">
      <div className="section-heading"><p className="eyebrow">Portal</p><h2>Revisiones</h2></div>
      <article className="panel">
        {error ? <p className="form-error">{error instanceof Error ? error.message : "No se pudieron cargar revisiones"}</p> : null}
        {isLoading ? <div className="empty-state">Cargando revisiones...</div> : <div className="card-grid">{reviews.map((review) => <article className="card" key={review.id}><div className="card-header"><div className="card-title"><strong>Revision #{review.id}</strong><span className="card-subtitle">{review.executed_at || review.scheduled_at || "Sin fecha"}</span></div><div className="card-badges"><span className={`badge ${getStatusBadgeClass(review.status)}`}>{review.status}</span></div></div><div className="card-actions"><button className="button button-secondary" type="button" onClick={async () => setDetail(await getSecurityReview(review.id))}>Ver detalle</button></div></article>)}</div>}
      </article>
      <Modal isOpen={!!detail} title={detail ? `Revision #${detail.id}` : "Detalle revisión"} onClose={() => setDetail(null)}>
        {detail ? <div className="page-stack"><div className="table-like"><div className="table-row table-head table-row-wide"><span>Hallazgo</span><span>Severidad</span><span>Estado</span><span>Evidencia</span></div>{detail.findings.map((finding) => <div className="table-row table-row-wide" key={finding.id}><span>{finding.title}</span><span>{finding.severity}</span><span>{finding.status}</span><span>{finding.evidence_url ? <a className="link-inline" href={finding.evidence_url} target="_blank" rel="noreferrer">Abrir</a> : "-"}</span></div>)}</div><div className="table-like"><div className="table-row table-head table-row-wide"><span>Recomendacion</span><span>Responsable</span><span>Fecha limite</span><span>Estado</span></div>{detail.recommendations.map((item) => <div className="table-row table-row-wide" key={item.id}><span>{item.recommendation}</span><span>{item.owner_user_id || "-"}</span><span>{item.due_date || "-"}</span><span>{item.status}</span></div>)}</div>{reportAttachment(detail.attachments) ? <a className="button button-primary" href={reportAttachment(detail.attachments)?.file_url} target="_blank" rel="noreferrer">Descargar informe</a> : null}</div> : null}
      </Modal>
    </section>
  );
}
