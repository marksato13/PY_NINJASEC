"use client";

import { useQuery } from "@tanstack/react-query";

import { getReports, ReportItem } from "@/lib/api";
import { QK } from "@/lib/query-keys";

export default function PortalReportsPage() {
  const { data: items = [], isLoading, error } = useQuery<ReportItem[]>({
    queryKey: QK.reports(),
    queryFn: () => getReports(),
  });

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Portal</p>
        <h2>Reportes</h2>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Listado</p>
            <h3>Reportes visibles</h3>
          </div>
        </div>
        {error ? <p className="form-error">{error instanceof Error ? error.message : "No se pudo cargar reportes"}</p> : null}
        {isLoading ? (
          <div className="empty-state">Cargando reportes...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No hay reportes visibles.</div>
        ) : (
          <div className="table-like">
            <div className="table-row table-head table-row-wide">
              <span>Titulo</span>
              <span>Tipo</span>
              <span>Plantilla</span>
            </div>
            {items.map((item) => (
              <div className="table-row table-row-wide" key={item.id}>
                <span>{item.title}</span>
                <span>{item.report_type}</span>
                <span>{item.template_name || "Sin plantilla"}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
