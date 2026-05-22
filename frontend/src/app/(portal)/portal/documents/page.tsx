"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { File, FileBarChart2, FileSpreadsheet, FileText, ExternalLink } from "lucide-react";

import {
  createProjectDoc,
  DocTypeItem,
  getDocTypes,
  getMe,
  getProjectDocs,
  getProjects,
  ProjectDocItem,
  ProjectItem,
  updateProjectDoc,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { Modal } from "@/components/ui/modal";

// ── File type helpers ─────────────────────────────────────────────────────────
function fileIcon(typeName: string, url?: string | null) {
  const lower = (typeName + " " + (url ?? "")).toLowerCase();
  if (lower.includes("xlsx") || lower.includes("excel") || lower.includes("hoja"))
    return { icon: <FileSpreadsheet size={24} />, color: "#10B981", bg: "rgba(16,185,129,0.12)" };
  if (lower.includes("pdf") || lower.includes("reporte") || lower.includes("contrato") || lower.includes("sla") || lower.includes("acta"))
    return { icon: <FileBarChart2 size={24} />, color: "#EF4444", bg: "rgba(239,68,68,0.12)" };
  if (lower.includes("word") || lower.includes("manual") || lower.includes("runbook") || lower.includes("procedimiento"))
    return { icon: <FileText size={24} />, color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
  return { icon: <File size={24} />, color: "var(--primary)", bg: "rgba(59,130,246,0.10)" };
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  ACTIVE:   { cls: "badge-active",    label: "Activo"    },
  DRAFT:    { cls: "badge-pending",   label: "Borrador"  },
  ARCHIVED: { cls: "badge-archived",  label: "Archivado" },
  active:   { cls: "badge-active",    label: "Activo"    },
  draft:    { cls: "badge-pending",   label: "Borrador"  },
  archived: { cls: "badge-archived",  label: "Archivado" },
};

export default function PortalDocumentsPage() {
  const [docs, setDocs] = useState<ProjectDocItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [docTypes, setDocTypes] = useState<DocTypeItem[]>([]);
  const [role, setRole] = useState<string>("client");
  const [error, setError] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterDocTypeId, setFilterDocTypeId] = useState("");
  const [previewDoc, setPreviewDoc] = useState<ProjectDocItem | null>(null);

  const [editingDoc, setEditingDoc] = useState<ProjectDocItem | null>(null);
  const [formProjectId, setFormProjectId] = useState("");
  const [formDocTypeId, setFormDocTypeId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formGithub, setFormGithub] = useState("");
  const [formPreview, setFormPreview] = useState("");
  const [formVisibility, setFormVisibility] = useState("internal");
  const [formStatus, setFormStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ["portal-documents"],
    queryFn: async () => {
      const [me, docsData, projectsData, docTypesData] = await Promise.all([
        getMe(),
        getProjectDocs(),
        getProjects(),
        getDocTypes(),
      ]);
      return { me, docsData, projectsData, docTypesData };
    },
  });

  useEffect(() => {
    if (!data) return;
    setRole(data.me.role);
    setDocs(data.docsData);
    setProjects(data.projectsData);
    setDocTypes(data.docTypesData.filter((item) => item.is_active));
  }, [data]);

  useEffect(() => {
    if (queryError) {
      setError(queryError instanceof Error ? queryError.message : "No se pudo cargar documentos");
    }
  }, [queryError]);

  const filteredDocs = useMemo(() =>
    docs.filter((doc) => {
      if (filterProjectId && doc.project_id !== Number(filterProjectId)) return false;
      if (filterDocTypeId && doc.doc_type_id !== Number(filterDocTypeId)) return false;
      return true;
    }),
  [docs, filterProjectId, filterDocTypeId]);

  const docTypeMap = useMemo(() => {
    const map = new Map<number, string>();
    docTypes.forEach((docType) => map.set(docType.id, docType.name));
    return map;
  }, [docTypes]);

  const projectMap = useMemo(() => {
    const map = new Map<number, string>();
    projects.forEach((project) => map.set(project.id, project.name));
    return map;
  }, [projects]);

  function startEdit(doc: ProjectDocItem) {
    setEditingDoc(doc);
    setFormProjectId(String(doc.project_id));
    setFormDocTypeId(String(doc.doc_type_id));
    setFormTitle(doc.title);
    setFormSummary(doc.summary || "");
    setFormGithub(doc.github_url || "");
    setFormPreview(doc.preview_md || "");
    setFormVisibility(doc.visibility);
    setFormStatus(doc.status);
    setEditorOpen(true);
  }

  function openNew() {
    resetForm();
    setEditorOpen(true);
  }

  function resetForm() {
    setEditingDoc(null);
    setFormProjectId("");
    setFormDocTypeId("");
    setFormTitle("");
    setFormSummary("");
    setFormGithub("");
    setFormPreview("");
    setFormVisibility("internal");
    setFormStatus("draft");
  }

  function closeEditor() {
    setEditorOpen(false);
    resetForm();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formProjectId || !formDocTypeId || !formTitle) {
      setError("Completa los campos obligatorios");
      notifyError("Completa los campos obligatorios");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingDoc) {
        const updated = await updateProjectDoc(editingDoc.id, {
          title: formTitle,
          summary: formSummary || null,
          github_url: formGithub || null,
          preview_md: formPreview || null,
          visibility: formVisibility,
          status: formStatus,
        });
        setDocs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        queryClient.invalidateQueries({ queryKey: ["portal-documents"] });
      } else {
        const created = await createProjectDoc({
          project_id: Number(formProjectId),
          doc_type_id: Number(formDocTypeId),
          title: formTitle,
          summary: formSummary || null,
          github_url: formGithub || null,
          preview_md: formPreview || null,
          visibility: formVisibility,
          status: formStatus,
          enabled: true,
        });
        setDocs((current) => [created, ...current]);
        queryClient.invalidateQueries({ queryKey: ["portal-documents"] });
      }
      notifySuccess(editingDoc ? "Documento actualizado" : "Documento creado");
      closeEditor();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el documento";
      setError(message);
      notifyError("No se pudo guardar el documento", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Portal</p>
        <h2>Documentos</h2>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Repositorio</p>
            <h3>Documentos disponibles</h3>
          </div>
          {role !== "client" ? (
            <div className="panel-actions">
              <button className="button button-primary" type="button" onClick={openNew}>
                Nuevo documento
              </button>
            </div>
          ) : null}
        </div>
        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
          <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)} style={{ flex: "1 1 180px" }}>
            <option value="">Todos los proyectos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterDocTypeId} onChange={(e) => setFilterDocTypeId(e.target.value)} style={{ flex: "1 1 180px" }}>
            <option value="">Todos los tipos</option>
            {docTypes.map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
          </select>
          {(filterProjectId || filterDocTypeId) && (
            <button className="button button-ghost button-sm" type="button" onClick={() => { setFilterProjectId(""); setFilterDocTypeId(""); }}>
              Limpiar
            </button>
          )}
          <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginLeft: "auto" }}>
            {filteredDocs.length} documento{filteredDocs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="empty-state">Cargando documentos...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="empty-state">No hay documentos disponibles para los filtros seleccionados.</div>
        ) : (
          <div className="doc-grid">
            {filteredDocs.map((doc) => {
              const typeName  = docTypeMap.get(doc.doc_type_id) ?? "Documento";
              const { icon, color, bg } = fileIcon(typeName, doc.github_url);
              const statusInfo = STATUS_BADGE[doc.status] ?? { cls: "badge-draft", label: doc.status };
              const isPdf = (doc.github_url ?? "").toLowerCase().includes(".pdf") || typeName.toLowerCase().includes("reporte") || typeName.toLowerCase().includes("contrato");
              return (
                <article className="panel doc-card" key={doc.id}>
                  {/* Status badge — absolute top-right */}
                  <span className={`badge ${statusInfo.cls} doc-card__status`}>{statusInfo.label}</span>

                  {/* Icon + title */}
                  <div className="doc-card__head">
                    <div className="doc-card__icon" style={{ background: bg, color }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="eyebrow" style={{ marginBottom: 2 }}>{typeName}</p>
                      <h3 style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.3 }}>{doc.title}</h3>
                    </div>
                  </div>

                  {/* Meta */}
                  <p className="doc-meta" style={{ marginTop: 0, fontSize: "0.78rem" }}>
                    📁 {projectMap.get(doc.project_id) || `Proyecto #${doc.project_id}`}
                  </p>
                  {doc.summary && <p className="doc-summary" style={{ fontSize: "0.82rem", margin: 0 }}>{doc.summary}</p>}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 4 }}>
                    {doc.github_url && (
                      <button className="button button-primary button-sm" type="button"
                        onClick={() => setPreviewDoc(doc)} style={{ flex: 1, gap: 5 }}>
                        {isPdf ? "Ver documento" : <><ExternalLink size={12} /> Abrir</>}
                      </button>
                    )}
                    {doc.github_url && !isPdf && (
                      <a className="button button-secondary button-sm" href={doc.github_url} target="_blank" rel="noreferrer" style={{ gap: 5 }}>
                        <ExternalLink size={12} /> Abrir
                      </a>
                    )}
                    {role !== "client" && (
                      <button className="button button-ghost button-sm" type="button" onClick={() => startEdit(doc)}>Editar</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </article>

      {/* Preview modal — iframe for PDF, external link for others */}
      <Modal isOpen={!!previewDoc} title={previewDoc?.title ?? "Vista previa"} onClose={() => setPreviewDoc(null)}>
        {previewDoc?.github_url ? (() => {
          const url = previewDoc.github_url;
          const isPdf = url.toLowerCase().includes(".pdf");
          return isPdf ? (
            <div>
              <iframe
                src={url}
                style={{ width: "100%", height: 480, border: "none", borderRadius: 8, background: "var(--row)" }}
                title={previewDoc.title}
              />
              <div style={{ marginTop: 10, textAlign: "right" }}>
                <a className="button button-secondary button-sm" href={url} target="_blank" rel="noreferrer">
                  <ExternalLink size={12} /> Abrir en nueva pestaña
                </a>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: "var(--muted)", marginBottom: 16 }}>Este documento se abre en una aplicación externa.</p>
              <a className="button button-primary" href={url} target="_blank" rel="noreferrer" style={{ gap: 8 }}>
                <ExternalLink size={14} /> Abrir documento
              </a>
            </div>
          );
        })() : (
          previewDoc?.preview_md ? (
            <pre className="doc-preview">{previewDoc.preview_md}</pre>
          ) : (
            <div className="empty-state">Sin URL de acceso para este documento.</div>
          )
        )}
      </Modal>

      {role !== "client" ? (
        <Modal
          isOpen={editorOpen}
          title={editingDoc ? "Editar documento" : "Nuevo documento"}
          onClose={closeEditor}
        >
          <form className="entity-form" onSubmit={handleSubmit}>
            <select value={formProjectId} onChange={(event) => setFormProjectId(event.target.value)} required>
              <option value="">Selecciona un proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select value={formDocTypeId} onChange={(event) => setFormDocTypeId(event.target.value)} required>
              <option value="">Selecciona un tipo de documento</option>
              {docTypes.map((docType) => (
                <option key={docType.id} value={docType.id}>
                  {docType.name}
                </option>
              ))}
            </select>
            <input placeholder="Titulo" value={formTitle} onChange={(event) => setFormTitle(event.target.value)} required />
            <input placeholder="Resumen corto" value={formSummary} onChange={(event) => setFormSummary(event.target.value)} />
            <input placeholder="Link GitHub" value={formGithub} onChange={(event) => setFormGithub(event.target.value)} />
            <textarea placeholder="Preview Markdown" value={formPreview} onChange={(event) => setFormPreview(event.target.value)} rows={6} />
            <div className="table-row table-row-wide">
              <select value={formVisibility} onChange={(event) => setFormVisibility(event.target.value)}>
                <option value="internal">Internal</option>
                <option value="client">Client</option>
              </select>
              <select value={formStatus} onChange={(event) => setFormStatus(event.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="panel-actions">
              <button className="button button-primary" type="submit" disabled={saving}>
                {saving ? "Guardando..." : editingDoc ? "Actualizar" : "Crear"}
              </button>
              <button className="button button-ghost" type="button" onClick={closeEditor}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
