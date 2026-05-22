"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  AreaItem,
  DocTypeItem,
  ProjectTypeItem,
  createDocType,
  getAreas,
  getDocTypes,
  getProjectTypes,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { getStoredUser } from "@/lib/auth";

type Tab = "project-types" | "areas" | "doc-types";

const docTypeSchema = z.object({
  name:  z.string().min(2, "Mínimo 2 caracteres").max(100),
  scope: z.enum(["public", "private", "both"]),
});
type DocTypeFormValues = z.infer<typeof docTypeSchema>;

export default function DashboardSettingsPage() {
  const user         = getStoredUser();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin      = user?.role === "admin" || isSuperAdmin;
  const queryClient  = useQueryClient();

  const [tab,        setTab]        = useState<Tab>("project-types");
  const [showCreate, setShowCreate] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DocTypeFormValues>({
    resolver: zodResolver(docTypeSchema),
    defaultValues: { name: "", scope: "public" },
  });

  const { data: projectTypes = [], isLoading: ptLoading } = useQuery<ProjectTypeItem[]>({
    queryKey: ["project-types"],
    queryFn:  () => getProjectTypes(),
  });

  const { data: areas = [], isLoading: arLoading } = useQuery<AreaItem[]>({
    queryKey: ["areas"],
    queryFn:  () => getAreas(),
  });

  const { data: docTypes = [], isLoading: dtLoading } = useQuery<DocTypeItem[]>({
    queryKey: ["doc-types"],
    queryFn:  () => getDocTypes(),
  });

  const createDocTypeMutation = useMutation({
    mutationFn: (v: DocTypeFormValues) => createDocType({ name: v.name, scope: v.scope }),
    onSuccess: () => {
      notifySuccess("Tipo de documento creado");
      reset();
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["doc-types"] });
    },
    onError: (err) => notifyError("Error", err instanceof Error ? err.message : undefined),
  });

  const TAB_LABELS: Record<Tab, string> = {
    "project-types": "Tipos de proyecto",
    "areas":         "Áreas",
    "doc-types":     "Tipos de documento",
  };

  const isLoading = ptLoading || arLoading || dtLoading;

  if (!isAdmin) {
    return (
      <section className="page-stack">
        <div className="empty-state">No tienes permisos para acceder a esta sección.</div>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sistema</p>
          <h2>Configuración</h2>
        </div>
        {isSuperAdmin && <span className="badge badge-active">Super Admin</span>}
      </div>

      <div className="tab-list">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "tab-active" : ""}`}
            type="button"
            onClick={() => { setTab(t); setShowCreate(false); reset(); }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h3>{TAB_LABELS[tab]}</h3>
          </div>
          {isAdmin && tab === "doc-types" && (
            <button
              className="button button-primary button-sm"
              type="button"
              onClick={() => setShowCreate((s) => !s)}
            >
              <Plus size={14} /> Nuevo
            </button>
          )}
        </div>

        {showCreate && tab === "doc-types" && (
          <form
            className="entity-form"
            onSubmit={handleSubmit((v) => createDocTypeMutation.mutate(v))}
            style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 14 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "start" }}>
              <div>
                <input type="text" placeholder="Nombre del tipo de documento" {...register("name")} />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>
              <select {...register("scope")} style={{ height: 42 }}>
                <option value="public">Público</option>
                <option value="private">Privado</option>
                <option value="both">Ambos</option>
              </select>
              <button className="button button-success button-sm" type="submit" disabled={isSubmitting}>
                Guardar
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="empty-state">Cargando…</div>
        ) : (
          <div className="table-like">
            {tab === "project-types" && (
              <>
                <div className="table-row table-head" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>Nombre</span><span>Estado</span>
                </div>
                {projectTypes.map((item) => (
                  <div className="table-row" key={item.id} style={{ gridTemplateColumns: "1fr auto" }}>
                    <span>{item.name}</span>
                    <span className={`badge ${item.is_active ? "badge-active" : "badge-archived"}`}>
                      {item.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                ))}
                {projectTypes.length === 0 && <div className="empty-state">Sin registros.</div>}
              </>
            )}

            {tab === "areas" && (
              <>
                <div className="table-row table-head" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>Área</span><span>Estado</span>
                </div>
                {areas.map((item) => (
                  <div className="table-row" key={item.id} style={{ gridTemplateColumns: "1fr auto" }}>
                    <span>{item.name}</span>
                    <span className={`badge ${item.is_active ? "badge-active" : "badge-archived"}`}>
                      {item.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                ))}
                {areas.length === 0 && <div className="empty-state">Sin registros.</div>}
              </>
            )}

            {tab === "doc-types" && (
              <>
                <div className="table-row table-head" style={{ gridTemplateColumns: "1fr auto auto" }}>
                  <span>Nombre</span><span>Alcance</span><span>Estado</span>
                </div>
                {docTypes.map((item) => (
                  <div className="table-row" key={item.id} style={{ gridTemplateColumns: "1fr auto auto" }}>
                    <span>{item.name}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{item.scope}</span>
                    <span className={`badge ${item.is_active ? "badge-active" : "badge-archived"}`}>
                      {item.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                ))}
                {docTypes.length === 0 && <div className="empty-state">Sin registros.</div>}
              </>
            )}
          </div>
        )}
      </article>

      {isSuperAdmin && (
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Seguridad</p><h3>Variables de entorno</h3></div>
          </div>
          <p style={{ color: "var(--muted)", margin: "0 0 14px", fontSize: "0.88rem" }}>
            Los parámetros críticos se configuran en el archivo{" "}
            <code style={{ background: "var(--row)", padding: "2px 6px", borderRadius: 4 }}>.env</code>{" "}
            del backend y se inyectan vía Docker Compose.
          </p>
          <div className="table-like">
            {[
              { key: "APP_ENV",     value: "production / development" },
              { key: "API_PREFIX",  value: "/api/v1" },
              { key: "PORTS",       value: "8024 backend · 3018 frontend · 5433 postgres" },
            ].map((item) => (
              <div className="table-row" key={item.key} style={{ gridTemplateColumns: "1fr 2fr" }}>
                <code style={{ fontSize: "0.82rem", color: "var(--primary)" }}>{item.key}</code>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
