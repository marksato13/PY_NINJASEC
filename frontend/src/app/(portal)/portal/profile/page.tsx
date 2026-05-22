"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AuthUser,
  createSkill,
  createUserCertification,
  createUserSkill,
  getMe,
  getSkills,
  getUserCertifications,
  getUserSkills,
  SkillItem,
  changeMyPassword,
  updateMyProfile,
  UserCertificationItem,
  UserSkillItem,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { Modal } from "@/components/ui/modal";

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ProfileCompleteness({ user, skills, certifications }: { user: AuthUser | null; skills: UserSkillItem[]; certifications: UserCertificationItem[] }) {
  const steps = [
    { label: "Nombre completo",      done: !!(user?.name || user?.full_name) },
    { label: "Email",                done: !!user?.email },
    { label: "Cargo registrado",     done: !!user?.job_title },
    { label: "Al menos 1 skill",     done: skills.length > 0 },
    { label: "Al menos 1 certif.",   done: certifications.length > 0 },
  ];
  const pct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  const color = pct === 100 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--danger)";

  return (
    <article className="panel">
      <div className="panel-head">
        <div><p className="eyebrow">Completitud</p><h3>Estado del perfil</h3></div>
        <strong style={{ fontSize: "1.3rem", color }}>{pct}%</strong>
      </div>
      <div style={{ background: "var(--line)", borderRadius: 8, height: 8, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 8, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {steps.map((step) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: step.done ? "var(--success)" : "var(--muted)" }}>
            <span style={{ fontSize: "1rem" }}>{step.done ? "✓" : "○"}</span>
            {step.label}
          </div>
        ))}
      </div>
    </article>
  );
}

export default function PortalProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkillItem[]>([]);
  const [certifications, setCertifications] = useState<UserCertificationItem[]>([]);
  const [skillId, setSkillId] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [certName, setCertName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certCredential, setCertCredential] = useState("");
  const [certUrl, setCertUrl] = useState("");
  const [certIssued, setCertIssued] = useState("");
  const [certExpires, setCertExpires] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);
  const [savingCert, setSavingCert] = useState(false);
  const [error, setError] = useState("");
  const [skillOpen, setSkillOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ["portal-profile"],
    queryFn: async () => {
      const [me, skillsData, userSkillsData, certsData] = await Promise.all([
        getMe(),
        getSkills(),
        getUserSkills(),
        getUserCertifications(),
      ]);
      return { me, skillsData, userSkillsData, certsData };
    },
  });

  useEffect(() => {
    if (!data) return;
    setUser(data.me);
    setSkills(data.skillsData);
    setUserSkills(data.userSkillsData);
    setCertifications(data.certsData);
  }, [data]);

  useEffect(() => {
    if (queryError) {
      setError(queryError instanceof Error ? queryError.message : "No se pudo cargar el perfil");
    }
  }, [queryError]);

  async function handleEditProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEdit(true);
    setError("");
    try {
      await updateMyProfile({
        full_name: editName.trim() || null,
        job_title: editJobTitle.trim() || null,
      });
      setUser((current) =>
        current ? { ...current, name: editName.trim() || current.name, job_title: editJobTitle.trim() || current.job_title } : current
      );
      notifySuccess("Perfil actualizado");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["portal-profile"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el perfil";
      setError(message);
      notifyError("No se pudo actualizar el perfil", message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAddSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!skillId && !newSkillName) {
      setError("Selecciona o crea un skill");
      notifyError("Selecciona o crea un skill");
      return;
    }
    setSavingSkill(true);
    setError("");
    try {
      let resolvedSkillId = Number(skillId);
      if (!resolvedSkillId && newSkillName) {
        const created = await createSkill({ name: newSkillName });
        resolvedSkillId = created.id;
        setSkills((current) => [...current, created]);
      }
      const createdUserSkill = await createUserSkill({
        skill_id: resolvedSkillId,
        level: skillLevel || null,
      });
      setUserSkills((current) => [...current, createdUserSkill]);
      setSkillId("");
      setNewSkillName("");
      setSkillLevel("");
      setSkillOpen(false);
      notifySuccess("Skill registrado", "Queda pendiente de aprobacion.");
      queryClient.invalidateQueries({ queryKey: ["portal-profile"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el skill";
      setError(message);
      notifyError("No se pudo guardar el skill", message);
    } finally {
      setSavingSkill(false);
    }
  }

  async function handleAddCertification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!certName) {
      setError("Ingresa el nombre de la certificacion");
      notifyError("Ingresa el nombre de la certificacion");
      return;
    }
    setSavingCert(true);
    setError("");
    try {
      const created = await createUserCertification({
        name: certName,
        issuer: certIssuer || null,
        credential_id: certCredential || null,
        url: certUrl || null,
        issued_at: certIssued || null,
        expires_at: certExpires || null,
      });
      setCertifications((current) => [...current, created]);
      setCertName("");
      setCertIssuer("");
      setCertCredential("");
      setCertUrl("");
      setCertIssued("");
      setCertExpires("");
      setCertOpen(false);
      notifySuccess("Certificacion registrada", "Queda pendiente de aprobacion.");
      queryClient.invalidateQueries({ queryKey: ["portal-profile"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo registrar la certificacion";
      setError(message);
      notifyError("No se pudo registrar la certificacion", message);
    } finally {
      setSavingCert(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Portal</p>
        <h2>Perfil</h2>
      </div>

      <ProfileCompleteness user={user} skills={userSkills} certifications={certifications} />

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Sesion</p>
            <h3>Informacion de usuario</h3>
          </div>
          <div className="panel-actions">
            <button
              className="button button-ghost button-sm"
              type="button"
              onClick={() => { setPwCurrent(""); setPwNew(""); setPwConfirm(""); setPwOpen(true); }}
            >
              Cambiar contraseña
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setEditName(user?.name || user?.full_name || "");
                setEditJobTitle(user?.job_title || "");
                setEditOpen(true);
              }}
            >
              Editar
            </button>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {isLoading ? (
          <div className="empty-state">Cargando perfil...</div>
        ) : user ? (
          <ul className="stack-list">
            <li><strong>Nombre:</strong> {user.name || user.full_name}</li>
            <li><strong>Email:</strong> {user.email}</li>
            <li><strong>Rol:</strong> {roleLabel(user.role)}</li>
            <li><strong>Cargo:</strong> {user.job_title || "Sin cargo"}</li>
          </ul>
        ) : (
          <div className="empty-state">No hay informacion disponible.</div>
        )}
      </article>

      <Modal isOpen={pwOpen} title="Cambiar contraseña" onClose={() => setPwOpen(false)}>
        <form
          className="entity-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pwNew !== pwConfirm) {
              notifyError("Las contraseñas no coinciden");
              return;
            }
            if (pwNew.length < 8) {
              notifyError("La nueva contraseña debe tener al menos 8 caracteres");
              return;
            }
            setPwSaving(true);
            try {
              await changeMyPassword({ current_password: pwCurrent, new_password: pwNew });
              notifySuccess("Contraseña actualizada");
              setPwOpen(false);
              setPwCurrent(""); setPwNew(""); setPwConfirm("");
            } catch (err) {
              notifyError("No se pudo cambiar la contraseña", err instanceof Error ? err.message : undefined);
            } finally {
              setPwSaving(false);
            }
          }}
        >
          <input type="password" placeholder="Contraseña actual"   value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} required />
          <input type="password" placeholder="Nueva contraseña (mín 8)" value={pwNew}     onChange={(e) => setPwNew(e.target.value)}     required minLength={8} />
          <input type="password" placeholder="Confirmar nueva contraseña" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} required />
          <div className="panel-actions">
            <button className="button button-primary" type="submit" disabled={pwSaving}>
              {pwSaving ? "Guardando…" : "Cambiar contraseña"}
            </button>
            <button className="button button-ghost" type="button" onClick={() => setPwOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editOpen} title="Editar datos personales" onClose={() => setEditOpen(false)}>
        <form className="entity-form" onSubmit={handleEditProfile}>
          <input
            placeholder="Nombre completo"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <input
            placeholder="Cargo"
            value={editJobTitle}
            onChange={(e) => setEditJobTitle(e.target.value)}
          />
          <div className="panel-actions">
            <button className="button button-primary" type="submit" disabled={savingEdit}>
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </button>
            <button className="button button-ghost" type="button" onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <div className="split-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Skills</p>
              <h3>Habilidades registradas</h3>
            </div>
            <div className="panel-actions">
              <button className="button button-primary" type="button" onClick={() => setSkillOpen(true)}>
                Agregar skill
              </button>
            </div>
          </div>
          {userSkills.length === 0 ? (
            <div className="empty-state">Aun no has registrado skills.</div>
          ) : (
            <ul className="stack-list">
              {userSkills.map((item) => (
                <li key={item.id}>
                  <strong>{item.skill_name || `Skill #${item.skill_id}`}</strong>
                  {item.level ? ` · ${item.level}` : ""}
                  <span className={`badge badge-${item.status}`}>{item.status}</span>
                </li>
              ))}
            </ul>
          )}
          <Modal isOpen={skillOpen} title="Agregar skill" onClose={() => setSkillOpen(false)}>
            <form className="entity-form" onSubmit={handleAddSkill}>
              <select value={skillId} onChange={(event) => setSkillId(event.target.value)}>
                <option value="">Selecciona un skill existente</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="O crea uno nuevo"
                value={newSkillName}
                onChange={(event) => setNewSkillName(event.target.value)}
              />
              <input
                placeholder="Nivel (ej: Mid, Senior)"
                value={skillLevel}
                onChange={(event) => setSkillLevel(event.target.value)}
              />
              <div className="panel-actions">
                <button className="button button-primary" type="submit" disabled={savingSkill}>
                  {savingSkill ? "Guardando..." : "Agregar skill"}
                </button>
                <button className="button button-ghost" type="button" onClick={() => setSkillOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </Modal>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Certificaciones</p>
              <h3>Credenciales verificables</h3>
            </div>
            <div className="panel-actions">
              <button className="button button-primary" type="button" onClick={() => setCertOpen(true)}>
                Nueva certificacion
              </button>
            </div>
          </div>
          {certifications.length === 0 ? (
            <div className="empty-state">Aun no has registrado certificaciones.</div>
          ) : (
            <ul className="stack-list">
              {certifications.map((cert) => (
                <li key={cert.id}>
                  <strong>{cert.name}</strong>
                  {cert.issuer ? ` · ${cert.issuer}` : ""}
                  {cert.url ? (
                    <a className="link-inline" href={cert.url} target="_blank" rel="noreferrer">
                      Ver enlace
                    </a>
                  ) : null}
                  <span className={`badge badge-${cert.status}`}>{cert.status}</span>
                </li>
              ))}
            </ul>
          )}
          <Modal isOpen={certOpen} title="Registrar certificacion" onClose={() => setCertOpen(false)}>
            <form className="entity-form" onSubmit={handleAddCertification}>
              <input placeholder="Nombre de certificacion" value={certName} onChange={(event) => setCertName(event.target.value)} />
              <input placeholder="Entidad / issuer" value={certIssuer} onChange={(event) => setCertIssuer(event.target.value)} />
              <input placeholder="Credential ID" value={certCredential} onChange={(event) => setCertCredential(event.target.value)} />
              <input placeholder="Link (Credly, LinkedIn, etc)" value={certUrl} onChange={(event) => setCertUrl(event.target.value)} />
              <div className="table-row table-row-wide">
                <input type="date" value={certIssued} onChange={(event) => setCertIssued(event.target.value)} />
                <input type="date" value={certExpires} onChange={(event) => setCertExpires(event.target.value)} />
              </div>
              <div className="panel-actions">
                <button className="button button-primary" type="submit" disabled={savingCert}>
                  {savingCert ? "Guardando..." : "Registrar certificacion"}
                </button>
                <button className="button button-ghost" type="button" onClick={() => setCertOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </Modal>
        </article>
      </div>
    </section>
  );
}
