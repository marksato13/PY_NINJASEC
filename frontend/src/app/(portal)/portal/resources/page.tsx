"use client";

import { BookOpen, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getProjectDocs, getProjects, ProjectDocItem } from "@/lib/api";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PortalResourcesPage() {

  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [selected,      setSelected]      = useState<ProjectDocItem | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["portal-projects"],
    queryFn:  () => getProjects(),
  });

  const { data: docs = [], isLoading, error } = useQuery({
    queryKey: ["portal-docs", projectFilter, statusFilter],
    queryFn:  () => getProjectDocs({
      project_id: projectFilter ? Number(projectFilter) : null,
      status:     statusFilter  || null,
      visibility: "internal",
    }),
  });

  const filtered = docs.filter((d) => d.enabled);

  return (
    <section className="page-stack">
      {/* Encabezado */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Portal</p>
          <h2>Recursos</h2>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          {filtered.length} documento{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filtros */}
      <div className="panel-actions">
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="draft">Borrador</option>
          <option value="archived">Archivado</option>
        </select>
      </div>

      {/* Documentos */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Biblioteca</p>
            <h3>Documentación interna</h3>
          </div>
        </div>

        {error && <p className="form-error">Error al cargar documentos</p>}

        {isLoading ? (
          <div className="empty-state">Cargando documentos…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={28} style={{ opacity: 0.35, margin: "0 auto 8px", display: "block" }} />
            No hay documentos disponibles para tu perfil.
          </div>
        ) : (
          <div className="card-grid">
            {filtered.map((doc) => (
              <div className="card doc-card" key={doc.id}>
                <div className="doc-card__head">
                  <div className="card-title">
                    <strong style={{ fontSize: "0.92rem" }}>{doc.title}</strong>
                    <span className={`badge ${getStatusBadgeClass(doc.status)}`}>{doc.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {doc.github_url && (
                      <a
                        href={doc.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button button-ghost button-icon-sm"
                        title="Ver en GitHub"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {doc.preview_md && (
                      <button
                        className="button button-secondary button-sm"
                        type="button"
                        onClick={() => setSelected(doc)}
                      >
                        Ver
                      </button>
                    )}
                  </div>
                </div>
                {doc.summary && <p className="doc-summary">{doc.summary}</p>}
                <p className="doc-meta" style={{ fontSize: "0.76rem" }}>
                  Actualizado: {formatDate(doc.updated_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* Modal preview */}
      <Modal
        isOpen={!!selected}
        title={selected?.title ?? "Documento"}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="entity-form">
            {selected.summary && (
              <p style={{ color: "var(--muted)", margin: 0 }}>{selected.summary}</p>
            )}
            {selected.preview_md && (
              <pre className="doc-preview">{selected.preview_md}</pre>
            )}
            {selected.github_url && (
              <a
                href={selected.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-secondary"
                style={{ alignSelf: "flex-start" }}
              >
                <ExternalLink size={14} /> Ver en GitHub
              </a>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
