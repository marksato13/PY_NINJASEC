"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardClient, getClients, getMe } from "@/lib/api";
import { QK } from "@/lib/query-keys";

export default function PortalCompanyPage() {
  const { data: me, isLoading: meLoading, error: meError } = useQuery({
    queryKey: QK.me(),
    queryFn: () => getMe(),
  });

  const { data: clients = [], isLoading: clientsLoading, error: clientsError } = useQuery<DashboardClient[]>({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
    enabled: me?.role === "client",
  });

  const isLoading = meLoading || clientsLoading;
  const error = meError || clientsError;
  const client = clients[0] ?? null;

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Portal</p>
        <h2>Empresa</h2>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Cuenta</p>
            <h3>Informacion general</h3>
          </div>
        </div>
        {error ? <p className="form-error">{error instanceof Error ? error.message : "No se pudo cargar la empresa"}</p> : null}
        {isLoading ? (
          <div className="empty-state">Cargando empresa...</div>
        ) : me?.role !== "client" ? (
          <div className="empty-state">Esta seccion esta disponible solo para clientes.</div>
        ) : client ? (
          <ul className="stack-list">
            <li><strong>Empresa:</strong> {client.company_name}</li>
            <li><strong>Estado:</strong> {client.commercial_status}</li>
            <li><strong>Sector:</strong> {client.sector || "No definido"}</li>
            <li><strong>Tamano:</strong> {client.size || "No definido"}</li>
          </ul>
        ) : (
          <div className="empty-state">No hay informacion de empresa asignada.</div>
        )}
      </article>
    </section>
  );
}
