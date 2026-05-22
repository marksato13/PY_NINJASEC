"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardClient, deleteClient, exportClientsXlsx, getClients, updateClient } from "@/lib/api";
import { FileDown, MapPin, Server, Ticket as TicketIcon } from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { ClientForm } from "@/components/forms/client-form";
import { Modal } from "@/components/ui/modal";
import { confirmDelete, notifyError, notifySuccess } from "@/lib/alerts";
import {
  formatClientStatus,
  getAvatarHue,
  getInitials,
  getStatusBadgeClass,
} from "@/lib/role-utils";
import { QK } from "@/lib/query-keys";

const STATUS_OPTIONS = ["active", "inactive", "suspended", "prospect", "churned"];
const SECTOR_OPTIONS = ["Finanzas", "Salud", "Educación", "Retail", "Manufactura", "Gobierno", "Tecnología", "Otro"];

export default function ClientsPage() {
  const currentUser  = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin      = currentUser?.role === "admin" || isSuperAdmin;
  const queryClient  = useQueryClient();
  const [createOpen, setCreateOpen]   = useState(false);
  const [editClient, setEditClient]   = useState<DashboardClient | null>(null);
  const [editForm, setEditForm]       = useState<Partial<DashboardClient>>({});
  const [editSaving, setEditSaving]   = useState(false);

  const { data: clients = [], isLoading, error: queryError } = useQuery({
    queryKey: QK.clients(),
    queryFn: () => getClients(),
  });

  const [exporting, setExporting] = useState(false);

  function openEdit(client: DashboardClient) {
    setEditClient(client);
    setEditForm({
      company_name:      client.company_name,
      commercial_status: client.commercial_status,
      sector:            client.sector ?? "",
      size:              client.size ?? "",
      city:              client.city ?? "",
      country:           client.country ?? "",
      notes:             client.notes ?? "",
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportClientsXlsx();
      notifySuccess("Listado exportado");
    } catch (err) {
      notifyError("No se pudo exportar", err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteClient(clientId: number) {
    const confirmed = await confirmDelete({
      title: "¿Eliminar este cliente?",
      text: "Esta acción eliminará el cliente y todos sus datos asociados de forma permanente.",
    });
    if (!confirmed) return;
    try {
      await deleteClient(clientId);
      queryClient.setQueryData(QK.clients(), (prev?: DashboardClient[]) =>
        prev ? prev.filter((c) => c.id !== clientId) : []
      );
      setEditClient(null);
      notifySuccess("Cliente eliminado");
    } catch (err) {
      notifyError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleSaveEdit() {
    if (!editClient) return;
    setEditSaving(true);
    try {
      const updated = await updateClient(editClient.id, editForm);
      queryClient.setQueryData(QK.clients(), (prev?: DashboardClient[]) =>
        prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : [updated]
      );
      notifySuccess("Cliente actualizado");
      setEditClient(null);
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Módulo</p>
          <h2>Clientes</h2>
        </div>
        <div className="panel-actions">
          {isAdmin && (
            <button className="button button-ghost button-sm" type="button" onClick={handleExport} disabled={exporting}>
              <FileDown size={14} />
              {exporting ? "Exportando…" : "Exportar XLSX"}
            </button>
          )}
          {isAdmin && (
            <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>
              Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {queryError ? <p className="form-error">{queryError instanceof Error ? queryError.message : "No se pudo cargar clientes"}</p> : null}

      {isLoading ? (
        <div className="empty-state">Cargando clientes...</div>
      ) : clients.length === 0 ? (
        <div className="empty-state">No hay clientes registrados.</div>
      ) : (
        <div className="card-grid">
          {clients.map((client) => (
            <article className="card client-card" key={client.id}>
              <div className="card-header">
                <div
                  className="avatar"
                  style={{ "--avatar-hue": getAvatarHue(client.company_name) } as CSSProperties}
                >
                  {getInitials(client.company_name)}
                </div>
                <div className="card-title">
                  <strong>{client.company_name}</strong>
                  <span className="card-subtitle">{client.sector || "Sin sector"}</span>
                </div>
                <div className="card-badges">
                  <span className={`badge ${getStatusBadgeClass(client.commercial_status)}`}>
                    {formatClientStatus(client.commercial_status)}
                  </span>
                  {(client.devices_count ?? 0) > 0 && (
                    <span className="badge" title={`${client.devices_count} dispositivos monitoreados`} style={{ background: "rgba(59,130,246,0.15)", color: "#a8c9ff", border: "1px solid rgba(59,130,246,0.3)" }}>
                      <Server size={11} style={{ marginRight: 4 }} />{client.devices_count}
                    </span>
                  )}
                  {(client.open_tickets_count ?? 0) > 0 && (
                    <span className="badge" title={`${client.open_tickets_count} tickets abiertos`} style={{ background: "rgba(251,191,36,0.15)", color: "#f5d063", border: "1px solid rgba(251,191,36,0.3)" }}>
                      <TicketIcon size={11} style={{ marginRight: 4 }} />{client.open_tickets_count}
                    </span>
                  )}
                </div>
              </div>
              <div className="card-meta">
                <div>
                  <span className="card-label">Sector</span>
                  <span>{client.sector || "—"}</span>
                </div>
                <div>
                  <span className="card-label">Tamaño</span>
                  <span>{client.size || "—"}</span>
                </div>
                <div>
                  <span className="card-label">Ubicación</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {(client.city || client.country) ? (
                      <>
                        <MapPin size={12} style={{ color: "var(--muted)" }} />
                        {[client.city, client.country].filter(Boolean).join(", ")}
                      </>
                    ) : "—"}
                  </span>
                </div>
                <div>
                  <span className="card-label">Estado</span>
                  <span>{formatClientStatus(client.commercial_status)}</span>
                </div>
              </div>
              <div className="card-actions">
                <Link className="button button-secondary" href={`/dashboard/clients/${client.id}`}>
                  Ver perfil
                </Link>
                {isAdmin && (
                  <button className="button button-ghost" type="button" onClick={() => openEdit(client)}>
                    Editar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: crear cliente */}
      <Modal isOpen={createOpen} title="Nuevo cliente" onClose={() => setCreateOpen(false)}>
        <ClientForm
          onCreated={(client) => {
            queryClient.setQueryData(QK.clients(), (prev?: DashboardClient[]) =>
              prev ? [...prev, client] : [client]
            );
            setCreateOpen(false);
          }}
        />
      </Modal>

      {/* Modal: editar cliente */}
      <Modal isOpen={!!editClient} title="Editar cliente" onClose={() => setEditClient(null)}>
        {editClient ? (
          <div className="entity-form">
            <input
              placeholder="Nombre de empresa"
              value={editForm.company_name ?? ""}
              onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
            />
            <select
              value={editForm.commercial_status ?? ""}
              onChange={(e) => setEditForm((f) => ({ ...f, commercial_status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{formatClientStatus(s)}</option>)}
            </select>
            <select
              value={editForm.sector ?? ""}
              onChange={(e) => setEditForm((f) => ({ ...f, sector: e.target.value }))}
            >
              <option value="">Sector</option>
              {SECTOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              placeholder="Tamaño (startup / pyme / enterprise)"
              value={editForm.size ?? ""}
              onChange={(e) => setEditForm((f) => ({ ...f, size: e.target.value }))}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                placeholder="Ciudad"
                value={editForm.city ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
              />
              <input
                placeholder="País"
                value={editForm.country ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <textarea
              placeholder="Notas internas"
              rows={3}
              value={editForm.notes ?? ""}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="panel-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={editSaving}
                onClick={handleSaveEdit}
              >
                {editSaving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button className="button button-ghost" type="button" onClick={() => setEditClient(null)}>
                Cancelar
              </button>
              {isSuperAdmin && (
                <button
                  className="button button-danger button-sm"
                  type="button"
                  onClick={() => handleDeleteClient(editClient.id)}
                >
                  Eliminar cliente
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
