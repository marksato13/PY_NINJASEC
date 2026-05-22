"use client";

import { useQuery } from "@tanstack/react-query";

import { getProjects, ProjectItem } from "@/lib/api";
import { QK } from "@/lib/query-keys";

export default function PortalProjectsPage() {
  const { data: items = [], isLoading, error } = useQuery<ProjectItem[]>({
    queryKey: QK.projects(),
    queryFn: () => getProjects(),
  });

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Portal</p>
        <h2>Proyectos</h2>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Listado</p>
            <h3>Proyectos asociados</h3>
          </div>
        </div>
        {error ? <p className="form-error">{error instanceof Error ? error.message : "No se pudo cargar proyectos"}</p> : null}
        {isLoading ? (
          <div className="empty-state">Cargando proyectos...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No hay proyectos visibles.</div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head table-row-wide">
              <span>Nombre</span>
              <span>Estado</span>
              <span>Descripcion</span>
            </div>
            {items.map((item) => (
              <div className="table-row table-row-wide" key={item.id}>
                <span>{item.name}</span>
                <span>{item.status}</span>
                <span>{item.description || "Sin descripcion"}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
