"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List } from "lucide-react";

import {
  CollaboratorProfile,
  DashboardUser,
  deleteCollaborator,
  getCollaborators,
  getUserCertifications,
  getUsers,
  updateCollaborator,
  uploadCollaboratorPhoto,
  UserCertificationItem,
} from "@/lib/api";
import { Award } from "lucide-react";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";
import { QK } from "@/lib/query-keys";
import { CollaboratorForm } from "@/components/forms/collaborator-form";
import {
  formatRoleLabel,
  getAvatarHue,
  getInitials,
  getRoleBadgeClass,
} from "@/lib/role-utils";
import { Modal } from "@/components/ui/modal";

// ── Availability helpers ─────────────────────────────────────────────────────
const AVAIL_COLOR: Record<string, string> = {
  available: "var(--success)",
  busy:      "var(--danger)",
  partial:   "var(--warning)",
  off:       "var(--muted)",
};
const AVAIL_LABEL: Record<string, string> = {
  available: "Disponible",
  busy:      "Ocupado",
  partial:   "Parcial",
  off:       "No disponible",
};

function availColor(status?: string | null) {
  return AVAIL_COLOR[(status ?? "").toLowerCase()] ?? "var(--muted)";
}
function availLabel(status?: string | null) {
  return AVAIL_LABEL[(status ?? "").toLowerCase()] ?? (status || "Sin estado");
}

function parseSkills(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

function resolvePhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;
  if (!photoUrl.startsWith("/")) return photoUrl;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    try {
      const u = new URL(apiBase);
      return `${u.origin}${photoUrl}`;
    } catch {
      return photoUrl;
    }
  }
  return photoUrl;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DashboardCollaboratorsPage() {
  const currentUser    = getStoredUser();
  const isSuperAdmin   = currentUser?.role === "super_admin";
  const isAdmin        = currentUser?.role === "admin" || isSuperAdmin;
  const isCollaborator = currentUser?.role === "collaborator";
  const queryClient  = useQueryClient();

  // Filters + view mode
  const [filterAvail,    setFilterAvail]    = useState("");
  const [filterSeniority, setFilterSeniority] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<CollaboratorProfile | null>(null);
  const [editForm, setEditForm] = useState({ position_title: "", bio: "", seniority: "", availability_status: "", area: "", photo_url: "", skills_json: "" });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Skills expand state (card id → expanded bool)
  const [expandedSkills, setExpandedSkills] = useState<Record<number, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: QK.collaborators(),
    queryFn: async () => {
      const [profiles, users] = await Promise.all([getCollaborators(), getUsers()]);
      return { profiles, users };
    },
  });

  // P-02: certificaciones por colaborador
  const { data: certifications = [] } = useQuery<UserCertificationItem[]>({
    queryKey: ["user-certifications", "all"],
    queryFn: () => getUserCertifications(),
  });
  const certsByUser = useMemo(() => {
    const m: Record<number, UserCertificationItem[]> = {};
    for (const c of certifications) {
      if (!m[c.user_id]) m[c.user_id] = [];
      m[c.user_id].push(c);
    }
    return m;
  }, [certifications]);

  const profiles    = data?.profiles ?? [];
  const usersById   = useMemo(() => {
    const map: Record<number, DashboardUser> = {};
    (data?.users ?? []).forEach((u) => { map[u.id] = u; });
    return map;
  }, [data?.users]);

  const seniorityOptions = useMemo(
    () => [...new Set(profiles.map((p) => p.seniority).filter(Boolean) as string[])].sort(),
    [profiles],
  );
  const areaOptions = useMemo(
    () => [...new Set(profiles.map((p) => p.area).filter(Boolean) as string[])].sort(),
    [profiles],
  );

  const filtered = useMemo(() =>
    profiles.filter((p) => {
      if (filterAvail    && (p.availability_status ?? "").toLowerCase() !== filterAvail) return false;
      if (filterSeniority && p.seniority !== filterSeniority) return false;
      if (filterArea && p.area !== filterArea) return false;
      return true;
    }),
  [profiles, filterAvail, filterSeniority, filterArea]);

  // KPIs
  const availableCount = profiles.filter((p) => (p.availability_status ?? "").toLowerCase() === "available").length;

  async function handleDelete(profileId: number) {
    const ok = await confirmDelete({ title: "¿Eliminar colaborador?", text: "Se eliminará el perfil permanentemente." });
    if (!ok) return;
    try {
      await deleteCollaborator(profileId);
      queryClient.setQueryData<typeof data>(QK.collaborators(), (prev) =>
        prev ? { ...prev, profiles: prev.profiles.filter((p) => p.id !== profileId) } : prev
      );
      notifySuccess("Colaborador eliminado");
    } catch (err) {
      notifyError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  }

  function openEdit(profile: CollaboratorProfile) {
    setEditProfile(profile);
    setEditForm({
      position_title:      profile.position_title    ?? "",
      bio:                 profile.bio               ?? "",
      seniority:           profile.seniority         ?? "",
      availability_status: (profile.availability_status ?? "").toLowerCase(),
      area:                profile.area              ?? "",
      photo_url:           profile.photo_url         ?? "",
      skills_json:         parseSkills(profile.skills_json).join(", "),
    });
  }

  async function saveEdit() {
    if (!editProfile) return;
    try {
      const skillsArray = editForm.skills_json.split(",").map((s) => s.trim()).filter(Boolean);
      const updated = await updateCollaborator(editProfile.id, {
        position_title:      editForm.position_title      || null,
        bio:                 editForm.bio                 || null,
        seniority:           editForm.seniority           || null,
        availability_status: editForm.availability_status || null,
        area:                editForm.area                || null,
        photo_url:           editForm.photo_url           || null,
        skills_json:         skillsArray.length ? JSON.stringify(skillsArray) : null,
      });
      queryClient.setQueryData<typeof data>(QK.collaborators(), (prev) =>
        prev ? { ...prev, profiles: prev.profiles.map((p) => p.id === editProfile.id ? updated : p) } : prev
      );
      notifySuccess("Perfil actualizado");
      setEditProfile(null);
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file || !editProfile) return;
    try {
      setUploadingPhoto(true);
      const updated = await uploadCollaboratorPhoto(editProfile.id, file);
      setEditProfile(updated);
      setEditForm((f) => ({ ...f, photo_url: updated.photo_url ?? "" }));
      queryClient.setQueryData<typeof data>(QK.collaborators(), (prev) =>
        prev ? { ...prev, profiles: prev.profiles.map((p) => p.id === updated.id ? updated : p) } : prev
      );
      notifySuccess("Foto subida");
    } catch (err) {
      notifyError("No se pudo subir la foto", err instanceof Error ? err.message : undefined);
    } finally {
      setUploadingPhoto(false);
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function CollabAvatar({ profile, size = 40 }: { profile: CollaboratorProfile; size?: number }) {
    const user   = usersById[profile.user_id];
    const name   = user?.full_name || user?.email || String(profile.user_id);
    const color  = availColor(profile.availability_status);
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        {profile.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvePhotoUrl(profile.photo_url) ?? ""}
            alt={name}
            style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", display: "block" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div
            className="avatar"
            style={{ "--avatar-hue": getAvatarHue(name), width: size, height: size, fontSize: size * 0.38 } as CSSProperties}
          >
            {getInitials(name)}
          </div>
        )}
        <span style={{
          position: "absolute", bottom: 0, right: 0,
          width: size * 0.28, height: size * 0.28,
          borderRadius: "50%", background: color,
          border: "2px solid var(--bg)",
        }} />
      </div>
    );
  }

  return (
    <section className="page-stack">

      {/* Header */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Colaboradores
            <span style={{ marginLeft: 10, fontSize: "1rem", fontWeight: 500, color: "var(--success)" }}>
              ● {availableCount} disponible{availableCount !== 1 ? "s" : ""}
            </span>
          </h2>
        </div>
        <div className="panel-actions">
          {/* View toggle */}
          <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              style={{ padding: "6px 10px", background: viewMode === "cards" ? "var(--primary)" : "transparent", color: viewMode === "cards" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer" }}
              title="Vista cards"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{ padding: "6px 10px", background: viewMode === "table" ? "var(--primary)" : "transparent", color: viewMode === "table" ? "#fff" : "var(--muted)", border: "none", cursor: "pointer" }}
              title="Vista tabla"
            >
              <List size={15} />
            </button>
          </div>
          {isAdmin && (
            <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
              Nuevo colaborador
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <article className="panel filters-panel">
        <div className="filters-grid">
          <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)}>
            <option value="">Todas las disponibilidades</option>
            <option value="available">● Disponible</option>
            <option value="busy">● Ocupado</option>
            <option value="partial">● Parcial</option>
            <option value="off">● No disponible</option>
          </select>
          <select value={filterSeniority} onChange={(e) => setFilterSeniority(e.target.value)}>
            <option value="">Todos los seniority</option>
            {seniorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
            <option value="">Todas las áreas</option>
            {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {(filterAvail || filterSeniority || filterArea) && (
            <button className="button button-ghost" type="button" onClick={() => { setFilterAvail(""); setFilterSeniority(""); setFilterArea(""); }}>
              Limpiar filtros
            </button>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
          {filtered.length} de {profiles.length} colaboradores
        </span>
      </article>

      {/* Loading */}
      {isLoading && <div className="state-panel">Cargando colaboradores...</div>}

      {/* ── CARDS VIEW ── */}
      {!isLoading && viewMode === "cards" && (
        <div className="card-grid">
          {filtered.map((profile) => {
            const user      = usersById[profile.user_id];
            const name      = user?.full_name || `Usuario #${profile.user_id}`;
            const skills    = parseSkills(profile.skills_json);
            const expanded  = expandedSkills[profile.id] ?? false;
            const visSkills = expanded ? skills : skills.slice(0, 4);
            const color     = availColor(profile.availability_status);

            return (
              <article
                className="card collaborator-card"
                key={profile.id}
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div className="card-header">
                  <CollabAvatar profile={profile} size={42} />
                  <div className="card-title">
                    <strong>{name}</strong>
                    <span className="card-subtitle">{user?.email || "Sin email"}</span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge badge-role ${getRoleBadgeClass(user?.role_code || "collaborator")}`}>
                      {formatRoleLabel(user?.role_code || "collaborator")}
                    </span>
                    <span style={{ fontSize: "0.72rem", color, fontWeight: 600 }}>
                      ● {availLabel(profile.availability_status)}
                    </span>
                  </div>
                </div>

                <div className="card-meta">
                  <div><span className="card-label">Cargo</span><span>{profile.position_title || "Sin cargo"}</span></div>
                  <div><span className="card-label">Seniority</span><span>{profile.seniority || "—"}</span></div>
                  {profile.area && <div><span className="card-label">Área</span><span>{profile.area}</span></div>}
                  {(certsByUser[profile.user_id]?.length ?? 0) > 0 && (
                    <div>
                      <span className="card-label">Certificaciones</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--success)" }}>
                        <Award size={12} />
                        {certsByUser[profile.user_id].length}
                      </span>
                    </div>
                  )}
                </div>

                {(certsByUser[profile.user_id]?.length ?? 0) > 0 && (
                  <div className="card-tags">
                    {certsByUser[profile.user_id].slice(0, 3).map((c) => (
                      <span key={c.id} className="tag" title={c.issuer || ""} style={{ background: "rgba(52,211,153,0.16)", color: "#9fe7c7", border: "1px solid rgba(52,211,153,0.3)" }}>
                        <Award size={10} style={{ marginRight: 4 }} />
                        {c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name}
                      </span>
                    ))}
                    {certsByUser[profile.user_id].length > 3 && (
                      <span className="tag" style={{ color: "var(--muted)" }}>
                        +{certsByUser[profile.user_id].length - 3} más
                      </span>
                    )}
                  </div>
                )}

                {skills.length > 0 && (
                  <div className="card-tags">
                    {visSkills.map((sk) => <span className="tag" key={sk}>{sk}</span>)}
                    {skills.length > 4 && (
                      <button
                        type="button"
                        className="tag"
                        style={{ cursor: "pointer", background: "var(--primary)", color: "#fff", border: "none" }}
                        onClick={() => setExpandedSkills((prev) => ({ ...prev, [profile.id]: !expanded }))}
                      >
                        {expanded ? "Menos ▲" : `+${skills.length - 4} más`}
                      </button>
                    )}
                  </div>
                )}

                <div className="card-actions">
                  {(isAdmin || (isCollaborator && profile.user_id === currentUser?.id)) && (
                    <button className="button button-secondary" type="button" onClick={() => openEdit(profile)}>
                      Editar
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(profile.id)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && <div className="empty-state">Sin colaboradores para los filtros seleccionados.</div>}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {!isLoading && viewMode === "table" && (
        <article className="panel">
          <div className="table-like">
            <div className="table-row table-head" style={{ gridTemplateColumns: "32px 1fr 140px 100px 120px 80px auto" }}>
              <span></span>
              <span>Colaborador</span>
              <span>Cargo</span>
              <span>Seniority</span>
              <span>Skills</span>
              <span>Disponib.</span>
              <span>Acciones</span>
            </div>
            {filtered.map((profile) => {
              const user   = usersById[profile.user_id];
              const name   = user?.full_name || `Usuario #${profile.user_id}`;
              const skills = parseSkills(profile.skills_json);
              const color  = availColor(profile.availability_status);
              return (
                <div className="table-row" key={profile.id} style={{ gridTemplateColumns: "32px 1fr 140px 100px 120px 80px auto", alignItems: "center" }}>
                  <CollabAvatar profile={profile} size={28} />
                  <span>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{name}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.73rem" }}>{user?.email}</div>
                  </span>
                  <span style={{ fontSize: "0.82rem" }}>{profile.position_title || "—"}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{profile.seniority || "—"}</span>
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {skills.slice(0, 2).map((sk) => <span className="tag" key={sk} style={{ fontSize: "0.68rem" }}>{sk}</span>)}
                    {skills.length > 2 && <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>+{skills.length - 2}</span>}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem", color }}>{availLabel(profile.availability_status)}</span>
                  <span className="panel-actions">
                    {(isAdmin || (isCollaborator && profile.user_id === currentUser?.id)) && (
                      <button className="button button-secondary button-sm" type="button" onClick={() => openEdit(profile)}>Editar</button>
                    )}
                    {isSuperAdmin && <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(profile.id)}>Eliminar</button>}
                  </span>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="empty-state">Sin resultados.</div>}
          </div>
        </article>
      )}

      {/* ── CREATE MODAL ── */}
      <Modal isOpen={createOpen} title="Nuevo colaborador" onClose={() => setCreateOpen(false)}>
        <CollaboratorForm
          onCreated={(profile) => {
            queryClient.setQueryData<typeof data>(QK.collaborators(), (prev) =>
              prev ? { ...prev, profiles: [...prev.profiles, profile] } : prev
            );
            setCreateOpen(false);
          }}
        />
      </Modal>

      {/* ── EDIT MODAL ── */}
      <Modal isOpen={!!editProfile} title={`Editar — ${usersById[editProfile?.user_id ?? 0]?.full_name ?? "Colaborador"}`} onClose={() => setEditProfile(null)}>
        <div className="entity-form">
          <input value={editForm.position_title} onChange={(e) => setEditForm((f) => ({ ...f, position_title: e.target.value }))} placeholder="Cargo / posición" />
          <select value={editForm.availability_status} onChange={(e) => setEditForm((f) => ({ ...f, availability_status: e.target.value }))}>
            <option value="">Disponibilidad</option>
            <option value="available">● Disponible</option>
            <option value="busy">● Ocupado</option>
            <option value="partial">● Parcial</option>
            <option value="off">● No disponible</option>
          </select>
          <select value={editForm.seniority} onChange={(e) => setEditForm((f) => ({ ...f, seniority: e.target.value }))}>
            <option value="">Seniority</option>
            {["Junior", "Mid", "Senior", "Lead", "Principal"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={editForm.area} onChange={(e) => setEditForm((f) => ({ ...f, area: e.target.value }))}>
            <option value="">Área — sin asignar</option>
            <option value="Operaciones">Operaciones</option>
            <option value="Comercial">Comercial</option>
            <option value="Administración">Administración</option>
            <option value="Tecnología">Tecnología</option>
            <option value="Seguridad">Seguridad</option>
          </select>
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0] ?? null)}
              disabled={uploadingPhoto}
            />
            {uploadingPhoto && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Subiendo...</span>}
          </div>
          <input value={editForm.photo_url} onChange={(e) => setEditForm((f) => ({ ...f, photo_url: e.target.value }))} placeholder="URL de foto (https://...)" />
          <input value={editForm.skills_json} onChange={(e) => setEditForm((f) => ({ ...f, skills_json: e.target.value }))} placeholder="Skills (separadas por coma: Python, AWS, Cisco)" />
          <textarea value={editForm.bio} onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Bio / descripción profesional" rows={3} />
          <button className="button button-primary" type="button" onClick={saveEdit}>Guardar cambios</button>
        </div>
      </Modal>

    </section>
  );
}
