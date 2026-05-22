"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";

import {
  AreaItem,
  createProjectMember,
  createProjectRequirement,
  DashboardClient,
  getAreas,
  getClients,
  getProducts,
  getProject,
  getProjectMembers,
  getProjectRecommendations,
  getProjectRequirements,
  getProjectTypes,
  getProjectDocs,
  getServices,
  getSkills,
  getUsers,
  ProductItem,
  ProjectDocItem,
  ProjectItem,
  ProjectMemberItem,
  ProjectRecommendationItem,
  ProjectRequirementItem,
  ProjectTypeItem,
  ServiceItem,
  SkillItem,
  DashboardUser,
  updateProject,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";
import { projectEditFormSchema, type ProjectEditFormValues } from "@/lib/validation";
import { QK } from "@/lib/query-keys";

type TabKey = "info" | "members" | "docs" | "skills" | "recommendations";

const tabs: { key: TabKey; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "members", label: "Miembros" },
  { key: "docs", label: "Docs" },
  { key: "skills", label: "Skills" },
  { key: "recommendations", label: "Recomendaciones" },
];

const statusOptions = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = Number(params?.projectId);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [editMode, setEditMode] = useState(false);

  // Local override state for inline mutations
  const [localProject, setLocalProject] = useState<ProjectItem | null>(null);
  const [localMembers, setLocalMembers] = useState<ProjectMemberItem[] | null>(null);
  const [localRequirements, setLocalRequirements] = useState<ProjectRequirementItem[] | null>(null);
  const [localRecommendations, setLocalRecommendations] = useState<ProjectRecommendationItem[] | null>(null);

  const { data: projectData, isLoading: projectLoading, error: projectError } = useQuery<ProjectItem>({
    queryKey: QK.project(projectId),
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });

  const { data: membersData = [] } = useQuery<ProjectMemberItem[]>({
    queryKey: QK.projectMembers(projectId),
    queryFn: () => getProjectMembers(projectId),
    enabled: !!projectId,
  });

  const { data: requirementsData = [] } = useQuery<ProjectRequirementItem[]>({
    queryKey: ["project-requirements", projectId],
    queryFn: () => getProjectRequirements(projectId),
    enabled: !!projectId,
  });

  const { data: recommendationsData = [] } = useQuery<ProjectRecommendationItem[]>({
    queryKey: ["project-recommendations", projectId],
    queryFn: () => getProjectRecommendations(projectId),
    enabled: !!projectId,
  });

  const { data: docs = [] } = useQuery<ProjectDocItem[]>({
    queryKey: QK.projectDocs({ project_id: projectId }),
    queryFn: () => getProjectDocs({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: clients = [] } = useQuery<DashboardClient[]>({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
    enabled: !!projectId,
  });

  const { data: areas = [] } = useQuery<AreaItem[]>({
    queryKey: QK.areas(),
    queryFn: () => getAreas(),
    enabled: !!projectId,
  });

  const { data: projectTypes = [] } = useQuery<ProjectTypeItem[]>({
    queryKey: QK.projectTypes(),
    queryFn: () => getProjectTypes(),
    enabled: !!projectId,
  });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: QK.services(),
    queryFn: () => getServices(),
    enabled: !!projectId,
  });

  const { data: products = [] } = useQuery<ProductItem[]>({
    queryKey: QK.products(),
    queryFn: () => getProducts(),
    enabled: !!projectId,
  });

  const { data: skills = [] } = useQuery<SkillItem[]>({
    queryKey: QK.skills(),
    queryFn: () => getSkills(),
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery<DashboardUser[]>({
    queryKey: QK.users(),
    queryFn: () => getUsers(),
    enabled: !!projectId,
  });

  const project = localProject ?? projectData ?? null;
  const members = localMembers ?? membersData;
  const requirements = localRequirements ?? requirementsData;
  const recommendations = localRecommendations ?? recommendationsData;

  const setProject = setLocalProject;
  const setMembers = (updater: ProjectMemberItem[] | ((prev: ProjectMemberItem[]) => ProjectMemberItem[])) => {
    setLocalMembers((prev) => typeof updater === "function" ? updater(prev ?? membersData) : updater);
  };
  const setRequirements = (updater: ProjectRequirementItem[] | ((prev: ProjectRequirementItem[]) => ProjectRequirementItem[])) => {
    setLocalRequirements((prev) => typeof updater === "function" ? updater(prev ?? requirementsData) : updater);
  };
  const setRecommendations = (updater: ProjectRecommendationItem[] | ((prev: ProjectRecommendationItem[]) => ProjectRecommendationItem[])) => {
    setLocalRecommendations((prev) => typeof updater === "function" ? updater(prev ?? recommendationsData) : updater);
  };

  const loading = projectLoading;
  const error = projectError ? (projectError instanceof Error ? projectError.message : "No se pudo cargar el proyecto") : "";

  const [memberOpen, setMemberOpen] = useState(false);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberAllocation, setMemberAllocation] = useState("");
  const [memberRequired, setMemberRequired] = useState(false);
  const [memberPublishing, setMemberPublishing] = useState(false);
  const [requirementSkillId, setRequirementSkillId] = useState("");
  const [requirementLevel, setRequirementLevel] = useState("");
  const [requirementRequired, setRequirementRequired] = useState(true);
  const [savingMember, setSavingMember] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: editSubmitting },
  } = useForm<ProjectEditFormValues>({
    resolver: zodResolver(projectEditFormSchema),
    defaultValues: {
      status: "planning",
      description: "",
      startDate: "",
      endDate: "",
    },
  });
  const firstEditError = useMemo(() => Object.values(editErrors)[0]?.message, [editErrors]);

  useEffect(() => {
    if (!project) return;
    const allowedStatuses = new Set(statusOptions.map((option) => option.value));
    const normalizedStatus = allowedStatuses.has(project.status) ? (project.status as ProjectEditFormValues["status"]) : "planning";
    resetEdit({
      status: normalizedStatus,
      description: project.description ?? "",
      startDate: project.start_date ?? "",
      endDate: project.end_date ?? "",
    });
  }, [project, resetEdit]);

  function cancelEdit() {
    if (!project) return;
    const allowedStatuses = new Set(statusOptions.map((option) => option.value));
    const normalizedStatus = allowedStatuses.has(project.status) ? (project.status as ProjectEditFormValues["status"]) : "planning";
    resetEdit({
      status: normalizedStatus,
      description: project.description ?? "",
      startDate: project.start_date ?? "",
      endDate: project.end_date ?? "",
    });
    setEditMode(false);
  }

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item.company_name])), [clients]);
  const areaMap = useMemo(() => new Map(areas.map((item) => [item.id, item.name])), [areas]);
  const typeMap = useMemo(() => new Map(projectTypes.map((item) => [item.id, item.name])), [projectTypes]);
  const serviceMap = useMemo(() => new Map(services.map((item) => [item.id, item.title])), [services]);
  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);
  const skillMap = useMemo(() => new Map(skills.map((item) => [item.id, item.name])), [skills]);

  const collaboratorOptions = users.filter((user) => user.role_code !== "client");

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedUserId = Number(memberUserId);
    if (!parsedUserId) {
      notifyError("Selecciona un colaborador");
      return;
    }
    setSavingMember(true);
    try {
      await createProjectMember({
        project_id: projectId,
        user_id: parsedUserId,
        role_in_project: memberRole || null,
        allocation_percentage: memberAllocation ? Number(memberAllocation) : null,
        can_publish_docs: memberPublishing,
        assignment_type: "manual",
        is_required: memberRequired,
      });
      const refreshed = await getProjectMembers(projectId);
      setMembers(refreshed);
      setMemberOpen(false);
      setMemberUserId("");
      setMemberRole("");
      setMemberAllocation("");
      setMemberRequired(false);
      setMemberPublishing(false);
      notifySuccess("Miembro asignado");
    } catch (err) {
      notifyError("No se pudo asignar", err instanceof Error ? err.message : undefined);
    } finally {
      setSavingMember(false);
    }
  }

  async function handleAddRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedSkillId = Number(requirementSkillId);
    if (!parsedSkillId) {
      notifyError("Selecciona un skill");
      return;
    }
    setSavingRequirement(true);
    try {
      const created = await createProjectRequirement({
        project_id: projectId,
        skill_id: parsedSkillId,
        level: requirementLevel || null,
        is_required: requirementRequired,
      });
      setRequirements((current) => [...current, created]);
      setRequirementOpen(false);
      setRequirementSkillId("");
      setRequirementLevel("");
      setRequirementRequired(true);
      notifySuccess("Requerimiento agregado");
    } catch (err) {
      notifyError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    } finally {
      setSavingRequirement(false);
    }
  }

  async function refreshRecommendations() {
    setRefreshing(true);
    try {
      const refreshed = await getProjectRecommendations(projectId, true);
      setRecommendations(refreshed);
      notifySuccess("Recomendaciones actualizadas");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUpdate(values: ProjectEditFormValues) {
    try {
      const updated = await updateProject(projectId, {
        status: values.status,
        description: values.description?.trim() || null,
        start_date: values.startDate || null,
        end_date: values.endDate || null,
      });
      setProject(updated);
      setEditMode(false);
      notifySuccess("Proyecto actualizado");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }

  function parseReason(reason?: string | null) {
    if (!reason) return null;
    try {
      return JSON.parse(reason) as { matches?: { skill_id: number; score: number }[] };
    } catch {
      return null;
    }
  }

  if (loading) {
    return <div className="state-panel">Cargando proyecto...</div>;
  }

  if (error || !project) {
    return <div className="state-panel state-error">{error || "Proyecto no encontrado"}</div>;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Proyecto</p>
          <h2>{project.name}</h2>
        </div>
        <div className="panel-actions">
          <Link className="button button-ghost" href="/dashboard/projects">
            Volver
          </Link>
          <span className={`badge ${getStatusBadgeClass(project.status)}`}>{project.status}</span>
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

      {activeTab === "info" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Overview</p>
              <h3>Informacion general</h3>
            </div>
            <div className="panel-actions">
              <button className="button button-ghost" type="button" onClick={() => setEditMode((current) => !current)}>
                {editMode ? "Cerrar" : "Editar"}
              </button>
            </div>
          </div>
          <div className="card-meta">
            <div>
              <span className="card-label">Cliente</span>
              <span>{clientMap.get(project.client_id || 0) || "Sin cliente"}</span>
            </div>
            <div>
              <span className="card-label">Tipo</span>
              <span>{typeMap.get(project.project_type_id || 0) || "Sin tipo"}</span>
            </div>
            <div>
              <span className="card-label">Area</span>
              <span>{areaMap.get(project.area_id || 0) || "Sin area"}</span>
            </div>
            <div>
              <span className="card-label">Servicio</span>
              <span>{serviceMap.get(project.service_id || 0) || "Sin servicio"}</span>
            </div>
            <div>
              <span className="card-label">Producto</span>
              <span>{productMap.get(project.product_id || 0) || "Sin producto"}</span>
            </div>
            <div>
              <span className="card-label">Inicio</span>
              <span>{project.start_date || "-"}</span>
            </div>
            <div>
              <span className="card-label">Fin</span>
              <span>{project.end_date || "-"}</span>
            </div>
            <div>
              <span className="card-label">Actualizado</span>
              <span>{project.updated_at || "-"}</span>
            </div>
          </div>
          {editMode ? (
            <form className="entity-form" onSubmit={handleSubmitEdit(handleUpdate)}>
              <select {...registerEdit("status")}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <textarea placeholder="Descripcion" rows={4} {...registerEdit("description")} />
              <div className="table-row table-row-wide">
                <input type="date" {...registerEdit("startDate")} />
                <input type="date" {...registerEdit("endDate")} />
              </div>
              {firstEditError ? <p className="form-error">{firstEditError}</p> : null}
              <div className="panel-actions">
                <button className="button button-primary" type="submit" disabled={editSubmitting}>
                  {editSubmitting ? "Guardando..." : "Guardar"}
                </button>
                <button className="button button-ghost" type="button" onClick={cancelEdit}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : project.description ? (
            <p className="card-subtitle">{project.description}</p>
          ) : (
            <p className="card-subtitle">Sin descripcion</p>
          )}
        </article>
      ) : null}

      {activeTab === "members" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Equipo</p>
              <h3>Miembros asignados</h3>
            </div>
            <div className="panel-actions">
              <button className="button button-primary" type="button" onClick={() => setMemberOpen(true)}>
                Asignar miembro
              </button>
            </div>
          </div>
          {members.length === 0 ? (
            <div className="empty-state">No hay miembros asignados.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head table-row-wide">
                <span>Nombre</span>
                <span>Rol</span>
                <span>Asignacion</span>
                <span>Tipo</span>
              </div>
              {members.map((member) => (
                <div className="table-row table-row-wide" key={member.id}>
                  <span>{member.user_name || member.user_email || `#${member.user_id}`}</span>
                  <span>{member.role_in_project || "Colaborador"}</span>
                  <span>{member.allocation_percentage ? `${member.allocation_percentage}%` : "-"}</span>
                  <span>{member.assignment_type}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {activeTab === "docs" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Documentos</p>
              <h3>Docs vinculados</h3>
            </div>
          </div>
          {docs.length === 0 ? (
            <div className="empty-state">No hay documentos vinculados.</div>
          ) : (
            <div className="doc-grid">
              {docs.map((doc) => (
                <article className="panel doc-card" key={doc.id}>
                  <div className="doc-card__head">
                    <div>
                      <p className="eyebrow">Documento</p>
                      <h3>{doc.title}</h3>
                    </div>
                    <span className={`badge badge-${doc.status}`}>{doc.status}</span>
                  </div>
                  {doc.summary ? <p className="doc-summary">{doc.summary}</p> : null}
                  {doc.github_url ? (
                    <a className="link-inline" href={doc.github_url} target="_blank" rel="noreferrer">
                      Ver en GitHub
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {activeTab === "skills" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Skills</p>
              <h3>Requerimientos del proyecto</h3>
            </div>
            <div className="panel-actions">
              <button className="button button-primary" type="button" onClick={() => setRequirementOpen(true)}>
                Agregar skill
              </button>
            </div>
          </div>
          {requirements.length === 0 ? (
            <div className="empty-state">No hay requerimientos definidos.</div>
          ) : (
            <div className="table-like">
              <div className="table-row table-head table-row-wide">
                <span>Skill</span>
                <span>Nivel</span>
                <span>Requerido</span>
                <span>Creado</span>
              </div>
              {requirements.map((req) => (
                <div className="table-row table-row-wide" key={req.id}>
                  <span>{req.skill_name || skillMap.get(req.skill_id) || `Skill #${req.skill_id}`}</span>
                  <span>{req.level || "-"}</span>
                  <span>{req.is_required ? "Si" : "No"}</span>
                  <span>{req.created_at || "-"}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {activeTab === "recommendations" ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Recomendaciones</p>
              <h3>Colaboradores sugeridos</h3>
            </div>
            <div className="panel-actions">
              <button className="button button-secondary" type="button" onClick={refreshRecommendations} disabled={refreshing}>
                {refreshing ? "Calculando..." : "Recalcular"}
              </button>
            </div>
          </div>
          {recommendations.length === 0 ? (
            <div className="empty-state">No hay recomendaciones disponibles.</div>
          ) : (
            <div className="card-grid">
              {recommendations.map((rec) => {
                const reason = parseReason(rec.reason_json);
                const matchCount = reason?.matches?.length ?? 0;
                return (
                  <article className="card" key={rec.id}>
                    <div className="card-header">
                      <div className="card-title">
                        <strong>{rec.user_name || rec.user_email || `#${rec.user_id}`}</strong>
                        <span className="card-subtitle">Score {rec.score.toFixed(2)}</span>
                      </div>
                      <span className="badge badge-approved">{rec.status || "suggested"}</span>
                    </div>
                    <p className="card-subtitle">Matches: {matchCount}</p>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      ) : null}

      <Modal isOpen={memberOpen} title="Asignar miembro" onClose={() => setMemberOpen(false)}>
        <form className="entity-form" onSubmit={handleAddMember}>
          <select value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} required>
            <option value="">Selecciona un colaborador</option>
            {collaboratorOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>
          <input placeholder="Rol en proyecto" value={memberRole} onChange={(event) => setMemberRole(event.target.value)} />
          <input
            placeholder="Asignacion (%)"
            value={memberAllocation}
            onChange={(event) => setMemberAllocation(event.target.value)}
          />
          <label className="checkbox-row">
            <input type="checkbox" checked={memberRequired} onChange={(event) => setMemberRequired(event.target.checked)} />
            Requerido
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={memberPublishing} onChange={(event) => setMemberPublishing(event.target.checked)} />
            Puede publicar docs
          </label>
          <div className="panel-actions">
            <button className="button button-primary" type="submit" disabled={savingMember}>
              {savingMember ? "Guardando..." : "Asignar"}
            </button>
            <button className="button button-ghost" type="button" onClick={() => setMemberOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={requirementOpen} title="Agregar requerimiento" onClose={() => setRequirementOpen(false)}>
        <form className="entity-form" onSubmit={handleAddRequirement}>
          <select value={requirementSkillId} onChange={(event) => setRequirementSkillId(event.target.value)} required>
            <option value="">Selecciona un skill</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <input placeholder="Nivel (ej: Senior)" value={requirementLevel} onChange={(event) => setRequirementLevel(event.target.value)} />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={requirementRequired}
              onChange={(event) => setRequirementRequired(event.target.checked)}
            />
            Requerido
          </label>
          <div className="panel-actions">
            <button className="button button-primary" type="submit" disabled={savingRequirement}>
              {savingRequirement ? "Guardando..." : "Agregar"}
            </button>
            <button className="button button-ghost" type="button" onClick={() => setRequirementOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
