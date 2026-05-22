"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  collectIntegration,
  deleteIntegration,
  DashboardClient,
  getClients,
  getIntegrations,
  IntegrationItem,
  testIntegrationConnection,
} from "@/lib/api";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import { IntegrationForm } from "@/components/private/integration-form";
import { Modal } from "@/components/ui/modal";
import { getStatusBadgeClass } from "@/lib/role-utils";
import { getStoredUser } from "@/lib/auth";
import { QK } from "@/lib/query-keys";

function licenseDaysLabel(expiresAt?: string | null, isExpired?: boolean): { label: string; color: string } | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (isExpired || days < 0) return { label: "Licencia vencida", color: "var(--danger)" };
  if (days <= 30) return { label: `Vence en ${days} día${days !== 1 ? "s" : ""}`, color: "var(--warning)" };
  return { label: `Vence en ${days} días`, color: "var(--success)" };
}

function healthColor(item: IntegrationItem): string {
  const st = item.effective_status || item.status;
  if (item.is_license_expired) return "var(--danger)";
  if (st === "active") return "var(--success)";
  if (st === "risk") return "var(--danger)";
  return "var(--warning)";
}

export default function DashboardIntegrationsPage() {
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin      = currentUser?.role === "admin" || isSuperAdmin;
  const canOperate   = isAdmin || currentUser?.role === "collaborator";
  const queryClient  = useQueryClient();
  const [message, setMessage] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [viewItem, setViewItem] = useState<IntegrationItem | null>(null);

  const { data: items = [] } = useQuery<IntegrationItem[]>({
    queryKey: QK.integrations(),
    queryFn: () => getIntegrations(),
  });

  const { data: clients = [] } = useQuery<DashboardClient[]>({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
  });

  function clientName(clientId?: number | null) {
    return clients.find((c) => c.id === clientId)?.company_name ?? "—";
  }

  function load() {
    queryClient.invalidateQueries({ queryKey: QK.integrations() });
  }

  async function handleTest(item: IntegrationItem) {
    try {
      const result = await testIntegrationConnection({ connector_type: item.connector_type, base_url: item.base_url });
      setMessage(`${item.name}: ${result.message}`);
    } catch (err) {
      notifyError("Test fallido", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleCollect(item: IntegrationItem) {
    try {
      const result = await collectIntegration(item.id);
      setMessage(`${item.name}: ${result.message}`);
    } catch (err) {
      notifyError("Colección fallida", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleDelete(item: IntegrationItem) {
    const confirmed = await confirmDelete({
      title: `¿Eliminar "${item.name}"?`,
      text: "Se eliminarán todos los datos asociados a esta consola.",
    });
    if (!confirmed) return;
    try {
      await deleteIntegration(item.id);
      queryClient.setQueryData(QK.integrations(), (prev?: IntegrationItem[]) =>
        prev ? prev.filter((i) => i.id !== item.id) : []
      );
      notifySuccess("Integración eliminada");
    } catch (err) {
      notifyError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <p className="eyebrow">Admin</p>
        <h2>Integraciones</h2>
      </div>

      <div className="state-panel">
        Orden recomendado: <strong>Clientes -&gt; Dispositivos (Inventario) -&gt; Integraciones</strong>. Por ahora las integraciones soportadas son solo
        firewalls <strong>pfSense</strong> y <strong>FortiGate</strong>.
      </div>

      {message ? (
        <div className="state-panel" style={{ cursor: "pointer" }} onClick={() => setMessage("")}>
          {message}
        </div>
      ) : null}

      <div className="split-grid">
        <article className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">Conectores</p><h3>Estado de integraciones</h3></div>
            <div className="panel-actions">
              <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
                <option value="">Todos los clientes</option>
                {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.company_name}</option>)}
              </select>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="empty-state">No hay integraciones registradas.</div>
          ) : (
            <div className="card-grid">
              {items.filter((item) => !clientFilter || String(item.client_id) === clientFilter).map((item) => {
                const licenseInfo = licenseDaysLabel(item.license_expires_at, item.is_license_expired);
                const color = healthColor(item);
                return (
                  <article className="card" key={item.id} style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="card-header">
                      <div className="card-title">
                        <strong>{item.name}</strong>
                        <span className="card-subtitle">{item.connector_type}</span>
                      </div>
                      <div className="card-badges">
                        <span className={`badge ${getStatusBadgeClass(item.effective_status || item.status)}`}>
                          {item.effective_status || item.status}
                        </span>
                      </div>
                    </div>
                    <div className="card-meta">
                      <div>
                        <span className="card-label">Cliente</span>
                        <span>{clientName(item.client_id)}</span>
                      </div>
                      <div>
                        <span className="card-label">Ambiente</span>
                        <span>{item.environment || "—"}</span>
                      </div>
                      {licenseInfo && (
                        <div>
                          <span className="card-label">Licencia</span>
                          <span style={{ color: licenseInfo.color, fontWeight: 600, fontSize: "0.82rem" }}>
                            {licenseInfo.label}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="card-actions">
                      <Link className="button button-secondary" href={`/dashboard/integrations/${item.id}`}>
                        Detalle
                      </Link>
                      <button className="button button-ghost" type="button" onClick={() => setViewItem(item)}>
                        Ver
                      </button>
                      {canOperate && (
                        <button className="button button-ghost" type="button" onClick={() => handleTest(item)}>
                          Test
                        </button>
                      )}
                      {canOperate && (
                        <button className="button button-secondary" type="button" onClick={() => handleCollect(item)}>
                          Collect
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button className="button button-danger button-sm" type="button" onClick={() => handleDelete(item)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>

        {isAdmin && (
          <article className="panel">
            <IntegrationForm clients={clients} onCreated={load} />
          </article>
        )}
      </div>

      <Modal isOpen={!!viewItem} title="Detalle de consola" onClose={() => setViewItem(null)}>
        {viewItem ? (
          <div className="card-meta">
            <div><span className="card-label">Nombre</span><span>{viewItem.name}</span></div>
            <div><span className="card-label">Conector</span><span>{viewItem.connector_type}</span></div>
            <div><span className="card-label">Cliente</span><span>{clientName(viewItem.client_id)}</span></div>
            <div><span className="card-label">Ambiente</span><span>{viewItem.environment || "—"}</span></div>
            <div><span className="card-label">Estado</span><span>{viewItem.effective_status || viewItem.status}</span></div>
            <div><span className="card-label">Licencia</span><span>{viewItem.license_type || "—"}</span></div>
            {viewItem.license_expires_at && (
              <div>
                <span className="card-label">Vence</span>
                <span>{new Date(viewItem.license_expires_at).toLocaleDateString("es-PE")}</span>
              </div>
            )}
            <div><span className="card-label">Base URL</span><span>{viewItem.base_url}</span></div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
