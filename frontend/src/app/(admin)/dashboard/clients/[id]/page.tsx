"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, FileBarChart2, Server, Shield, Ticket, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  ClientAccessItem,
  ClientContactItem,
  ClientServiceItem,
  ClientSiteItem,
  DashboardClient,
  DeviceItem,
  exportConsolidatedReportPdf,
  getClient,
  getClientAccess,
  getClientContacts,
  getClientServices,
  getClientSites,
  getDevices,
  getIntegrations,
  getSecurityReviews,
  getServices,
  getSupportTickets,
  IntegrationItem,
  SecurityReviewItem,
  ServiceItem,
  SupportTicketItem,
  createClientSite,
  updateClientSite,
  deleteClientSite,
  createClientContact,
  updateClientContact,
  deleteClientContact,
  createClientService,
  updateClientService,
  deleteClientService,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/alerts";
import { formatClientStatus, getStatusBadgeClass } from "@/lib/role-utils";
import { QK } from "@/lib/query-keys";

type TabKey = "resumen" | "info" | "sites" | "contacts" | "services" | "access" | "integrations" | "inventory" | "tickets" | "reviews";

const tabs: { key: TabKey; label: string }[] = [
  { key: "resumen",      label: "Resumen" },
  { key: "info",         label: "Info" },
  { key: "sites",        label: "Sedes" },
  { key: "contacts",     label: "Contactos" },
  { key: "services",     label: "Servicios" },
  { key: "access",       label: "Acceso" },
  { key: "integrations", label: "Consolas" },
  { key: "inventory",    label: "Inventario" },
  { key: "tickets",      label: "Tickets" },
  { key: "reviews",      label: "Revisiones" },
];

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = Number(params?.id);
  const [activeTab, setActiveTab] = useState<TabKey>("resumen");
  const [exportingPdf, setExportingPdf]       = useState(false);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("");

  const { data: client = null, isLoading: clientLoading, error: clientError } = useQuery<DashboardClient | null>({
    queryKey: QK.client(clientId),
    queryFn: () => getClient(clientId),
    enabled: !!clientId,
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<ClientSiteItem[]>({
    queryKey: QK.clientSites(clientId),
    queryFn: () => getClientSites(clientId),
    enabled: !!clientId,
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<ClientContactItem[]>({
    queryKey: QK.clientContacts(clientId),
    queryFn: () => getClientContacts(clientId),
    enabled: !!clientId,
  });

  const { data: clientServices = [], isLoading: clientServicesLoading } = useQuery<ClientServiceItem[]>({
    queryKey: QK.clientServices(clientId),
    queryFn: () => getClientServices(clientId),
    enabled: !!clientId,
  });

  const { data: access = [] } = useQuery<ClientAccessItem[]>({
    queryKey: QK.clientAccess(clientId),
    queryFn: () => getClientAccess(clientId),
    enabled: !!clientId,
  });

  const { data: integrations = [] } = useQuery<IntegrationItem[]>({
    queryKey: QK.integrations(clientId),
    queryFn: () => getIntegrations(clientId),
    enabled: !!clientId,
  });

  const { data: devices = [] } = useQuery<DeviceItem[]>({
    queryKey: QK.devices({ client_id: clientId }),
    queryFn: () => getDevices({ client_id: clientId }),
    enabled: !!clientId,
  });

  const { data: tickets = [] } = useQuery<SupportTicketItem[]>({
    queryKey: QK.tickets({ client_id: clientId }),
    queryFn: () => getSupportTickets({ client_id: clientId }),
    enabled: !!clientId,
  });

  const { data: reviews = [] } = useQuery<SecurityReviewItem[]>({
    queryKey: QK.reviews({ client_id: clientId }),
    queryFn: () => getSecurityReviews({ client_id: clientId }),
    enabled: !!clientId,
  });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: QK.services(),
    queryFn: () => getServices(),
    enabled: !!clientId,
  });

  // Local override states for inline editing (mutations still use local state)
  const [localSites, setLocalSites] = useState<ClientSiteItem[] | null>(null);
  const [localContacts, setLocalContacts] = useState<ClientContactItem[] | null>(null);
  const [localClientServices, setLocalClientServices] = useState<ClientServiceItem[] | null>(null);

  const activeSites = localSites ?? sites;
  const activeContacts = localContacts ?? contacts;
  const activeClientServices = localClientServices ?? clientServices;

  const setSites = (updater: ClientSiteItem[] | ((prev: ClientSiteItem[]) => ClientSiteItem[])) => {
    setLocalSites((prev) => typeof updater === "function" ? updater(prev ?? sites) : updater);
  };
  const setContacts = (updater: ClientContactItem[] | ((prev: ClientContactItem[]) => ClientContactItem[])) => {
    setLocalContacts((prev) => typeof updater === "function" ? updater(prev ?? contacts) : updater);
  };
  const setClientServices = (updater: ClientServiceItem[] | ((prev: ClientServiceItem[]) => ClientServiceItem[])) => {
    setLocalClientServices((prev) => typeof updater === "function" ? updater(prev ?? clientServices) : updater);
  };

  const loading = clientLoading;
  const error = clientError ? (clientError instanceof Error ? clientError.message : "No se pudo cargar el cliente") : "";

  async function saveSite(site: ClientSiteItem) {
    try {
      const updated = await updateClientSite(site.id, site);
      setSites((current) => current.map((item) => (item.id === site.id ? updated : item)));
      notifySuccess("Sede actualizada");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }

  async function addSite() {
    if (!clientId) return;
    try {
      const created = await createClientSite({ client_id: clientId, name: "Nueva sede", status: "active" });
      setSites((current) => [...current, created]);
    } catch (err) {
      notifyError("No se pudo crear sede", err instanceof Error ? err.message : undefined);
    }
  }

  async function removeSite(siteId: number) {
    await deleteClientSite(siteId);
    setSites((current) => current.filter((item) => item.id !== siteId));
  }

  async function saveContact(contact: ClientContactItem) {
    try {
      const updated = await updateClientContact(contact.id, contact);
      setContacts((current) => current.map((item) => (item.id === contact.id ? updated : item)));
      notifySuccess("Contacto actualizado");
    } catch (err) {
      notifyError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  }

  async function addContact() {
    if (!clientId) return;
    try {
      const created = await createClientContact({ client_id: clientId, name: "Nuevo contacto", is_primary: false });
      setContacts((current) => [...current, created]);
    } catch (err) {
      notifyError("No se pudo crear contacto", err instanceof Error ? err.message : undefined);
    }
  }

  async function removeContact(contactId: number) {
    await deleteClientContact(contactId);
    setContacts((current) => current.filter((item) => item.id !== contactId));
  }

  async function addClientService(serviceId: number) {
    if (!clientId || !serviceId) return;
    try {
      const created = await createClientService({ client_id: clientId, service_id: serviceId, starts_at: null, ends_at: null });
      setClientServices((current) => [...current, created]);
    } catch (err) {
      notifyError("No se pudo vincular servicio", err instanceof Error ? err.message : undefined);
    }
  }

  async function saveClientService(item: ClientServiceItem) {
    try {
      const updated = await updateClientService(item.id, { starts_at: item.starts_at, ends_at: item.ends_at });
      setClientServices((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (err) {
      notifyError("No se pudo actualizar servicio", err instanceof Error ? err.message : undefined);
    }
  }

  async function removeClientService(itemId: number) {
    await deleteClientService(itemId);
    setClientServices((current) => current.filter((item) => item.id !== itemId));
  }

  function serviceName(serviceId: number) {
    return services.find((item) => item.id === serviceId)?.title || `Servicio ${serviceId}`;
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      await exportConsolidatedReportPdf({ client_id: clientId });
      notifySuccess("PDF generado");
    } catch (err) {
      notifyError("No se pudo generar el PDF", err instanceof Error ? err.message : undefined);
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) return <div className="state-panel">Cargando cliente...</div>;
  if (error || !client) return <div className="state-panel state-error">{error || "Cliente no encontrado"}</div>;

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cliente</p>
          <h2>{client.company_name}</h2>
        </div>
        <div className="panel-actions">
          <Link className="button button-ghost" href="/dashboard/clients">Volver</Link>
          <span className={`badge ${getStatusBadgeClass(client.commercial_status)}`}>{formatClientStatus(client.commercial_status)}</span>
          <button
            className="button button-secondary"
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            style={{ gap: 6 }}
          >
            <FileBarChart2 size={14} />
            {exportingPdf ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      <div className="tab-list">
        {tabs.map((tab) => (
          <button key={tab.key} className={`tab ${activeTab === tab.key ? "tab-active" : ""}`} type="button" onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resumen" ? (() => {
        const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "pending");
        const activeIntegrations = integrations.filter((i) => i.status === "active" || i.effective_status === "active").length;
        const pendingDevices = devices.filter((d) => d.status === "pending_review").length;
        const expiredServices = activeClientServices.filter((s) => s.ends_at && new Date(s.ends_at) < new Date()).length;
        const hasIssues = openTickets.length > 0 || pendingDevices > 0 || expiredServices > 0;
        return (
          <>
            {hasIssues && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 18px", borderRadius: 12,
                background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.28)",
                color: "var(--danger)", fontSize: "0.88rem", fontWeight: 600,
              }}>
                <AlertTriangle size={16} />
                {openTickets.length > 0 && `${openTickets.length} ticket${openTickets.length > 1 ? "s" : ""} abierto${openTickets.length > 1 ? "s" : ""}`}
                {openTickets.length > 0 && (pendingDevices > 0 || expiredServices > 0) && " · "}
                {pendingDevices > 0 && `${pendingDevices} activo${pendingDevices > 1 ? "s" : ""} pendiente${pendingDevices > 1 ? "s" : ""}`}
                {pendingDevices > 0 && expiredServices > 0 && " · "}
                {expiredServices > 0 && `${expiredServices} servicio${expiredServices > 1 ? "s" : ""} vencido${expiredServices > 1 ? "s" : ""}`}
              </div>
            )}
            <div className="metrics-grid">
              <article className="metric-card panel">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Server size={16} style={{ color: "var(--primary)", opacity: 0.7 }} />
                  <span className="eyebrow" style={{ margin: 0 }}>Activos monitoreados</span>
                </div>
                <strong style={{ fontSize: "2rem", color: devices.length > 0 ? "var(--success)" : "var(--muted)" }}>
                  {devices.length}
                </strong>
                <span style={{ color: pendingDevices > 0 ? "var(--warning)" : "var(--muted)", fontSize: "0.8rem", fontWeight: pendingDevices > 0 ? 600 : 400 }}>
                  {pendingDevices > 0 ? `${pendingDevices} pendientes de revisión` : "Sin pendientes"}
                </span>
              </article>

              <article className="metric-card panel">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Ticket size={16} style={{ color: "var(--warning)", opacity: 0.7 }} />
                  <span className="eyebrow" style={{ margin: 0 }}>Tickets abiertos</span>
                </div>
                <strong style={{ fontSize: "2rem", color: openTickets.length === 0 ? "var(--success)" : openTickets.length <= 3 ? "var(--warning)" : "var(--danger)" }}>
                  {openTickets.length}
                </strong>
                <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  {openTickets.length === 0 ? "Sin incidencias abiertas" : `${openTickets.filter((t) => t.priority === "critical" || t.priority === "high").length} de alta prioridad`}
                </span>
              </article>

              <article className="metric-card panel">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={16} style={{ color: "var(--security)", opacity: 0.7 }} />
                  <span className="eyebrow" style={{ margin: 0 }}>Consolas activas</span>
                </div>
                <strong style={{ fontSize: "2rem", color: activeIntegrations > 0 ? "var(--success)" : "var(--muted)" }}>
                  {activeIntegrations}
                </strong>
                <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  {integrations.length} consola{integrations.length !== 1 ? "s" : ""} total
                </span>
              </article>

              <article className="metric-card panel">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={16} style={{ color: "var(--success)", opacity: 0.7 }} />
                  <span className="eyebrow" style={{ margin: 0 }}>Servicios contratados</span>
                </div>
                <strong style={{ fontSize: "2rem", color: expiredServices > 0 ? "var(--danger)" : "var(--success)" }}>
                  {activeClientServices.length}
                </strong>
                <span style={{ color: expiredServices > 0 ? "var(--danger)" : "var(--muted)", fontSize: "0.8rem", fontWeight: expiredServices > 0 ? 600 : 400 }}>
                  {expiredServices > 0 ? `⚠ ${expiredServices} vencido${expiredServices > 1 ? "s" : ""}` : `${activeClientServices.length - expiredServices} activo${activeClientServices.length - expiredServices !== 1 ? "s" : ""}`}
                </span>
              </article>
            </div>

            {openTickets.length > 0 && (
              <article className="panel">
                <div className="panel-head">
                  <div><p className="eyebrow">Soporte</p><h3>Tickets abiertos recientes</h3></div>
                  <button className="button button-ghost" type="button" onClick={() => setActiveTab("tickets")}>Ver todos</button>
                </div>
                <div className="table-like">
                  <div className="table-row table-head" style={{ gridTemplateColumns: "auto 1fr auto auto" }}>
                    <span>ID</span><span>Título</span><span>Prioridad</span><span>Estado</span>
                  </div>
                  {openTickets.slice(0, 5).map((ticket) => (
                    <div className="table-row" key={ticket.id} style={{ gridTemplateColumns: "auto 1fr auto auto" }}>
                      <span>#{ticket.id}</span>
                      <span style={{ fontSize: "0.85rem" }}>{ticket.title}</span>
                      <span><span className={`badge ${getStatusBadgeClass(ticket.priority)}`}>{ticket.priority}</span></span>
                      <span><span className={`badge ${getStatusBadgeClass(ticket.status)}`}>{ticket.status}</span></span>
                    </div>
                  ))}
                </div>
              </article>
            )}
          </>
        );
      })() : null}

      {activeTab === "info" ? (
        <article className="panel">
          <div className="card-meta">
            <div><span className="card-label">Empresa</span><span>{client.company_name}</span></div>
            <div><span className="card-label">Estado</span><span>{formatClientStatus(client.commercial_status)}</span></div>
            <div><span className="card-label">Sector</span><span>{client.sector || "-"}</span></div>
            <div><span className="card-label">Tamano</span><span>{client.size || "-"}</span></div>
            <div><span className="card-label">Notas</span><span>{client.notes || "-"}</span></div>
          </div>
        </article>
      ) : null}

      {activeTab === "sites" ? (
        <article className="panel">
          <div className="panel-head"><h3>Sedes</h3><div className="panel-actions"><button className="button button-primary" type="button" onClick={addSite}>Nueva sede</button></div></div>
          <div className="table-like">
            <div className="table-row table-head table-row-wide"><span>Nombre</span><span>Direccion</span><span>Ciudad</span><span>Estado</span></div>
            {activeSites.map((site) => (
              <div className="table-row table-row-wide" key={site.id}>
                <input value={site.name} onChange={(e) => setSites((current) => current.map((item) => item.id === site.id ? { ...item, name: e.target.value } : item))} />
                <input value={site.address || ""} onChange={(e) => setSites((current) => current.map((item) => item.id === site.id ? { ...item, address: e.target.value } : item))} />
                <input value={site.city || ""} onChange={(e) => setSites((current) => current.map((item) => item.id === site.id ? { ...item, city: e.target.value } : item))} />
                <div className="panel-actions"><button className="button button-secondary" type="button" onClick={() => saveSite(site)}>Guardar</button><button className="button button-ghost" type="button" onClick={() => removeSite(site.id)}>Eliminar</button></div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {activeTab === "contacts" ? (
        <article className="panel">
          <div className="panel-head"><h3>Contactos</h3><div className="panel-actions"><button className="button button-primary" type="button" onClick={addContact}>Nuevo contacto</button></div></div>
          <div className="table-like">
            <div className="table-row table-head table-row-wide"><span>Nombre</span><span>Email</span><span>Telefono</span><span>Rol</span></div>
            {activeContacts.map((contact) => (
              <div className="table-row table-row-wide" key={contact.id}>
                <input value={contact.name} onChange={(e) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, name: e.target.value } : item))} />
                <input value={contact.email || ""} onChange={(e) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, email: e.target.value } : item))} />
                <input value={contact.phone || ""} onChange={(e) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, phone: e.target.value } : item))} />
                <div className="panel-actions"><button className="button button-secondary" type="button" onClick={() => saveContact(contact)}>Guardar</button><button className="button button-ghost" type="button" onClick={() => removeContact(contact.id)}>Eliminar</button></div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {activeTab === "services" ? (
        <article className="panel">
          <div className="panel-head"><h3>Servicios contratados</h3></div>
          <div className="panel-actions">
            {services.filter((service) => !activeClientServices.some((item) => item.service_id === service.id)).map((service) => (
              <button key={service.id} className="button button-ghost" type="button" onClick={() => addClientService(service.id)}>{service.title}</button>
            ))}
          </div>
          <div className="table-like">
            <div className="table-row table-head table-row-wide"><span>Servicio</span><span>Inicio</span><span>Fin</span><span>Acciones</span></div>
            {activeClientServices.map((item) => (
              <div className="table-row table-row-wide" key={item.id}>
                <span>{serviceName(item.service_id)}</span>
                <input type="date" value={item.starts_at || ""} onChange={(e) => setClientServices((current) => current.map((entry) => entry.id === item.id ? { ...entry, starts_at: e.target.value } : entry))} />
                <input type="date" value={item.ends_at || ""} onChange={(e) => setClientServices((current) => current.map((entry) => entry.id === item.id ? { ...entry, ends_at: e.target.value } : entry))} />
                <div className="panel-actions"><button className="button button-secondary" type="button" onClick={() => saveClientService(item)}>Guardar</button><button className="button button-ghost" type="button" onClick={() => removeClientService(item.id)}>Eliminar</button></div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {activeTab === "access" ? (
        <article className="panel">
          <div className="table-like">
            <div className="table-row table-head table-row-wide"><span>Usuario</span><span>Email</span><span>Cargo</span><span>Acceso</span></div>
            {access.map((item) => (
              <div className="table-row table-row-wide" key={item.user_id}>
                <span>{item.full_name}</span><span>{item.email}</span>
                <span>{item.position_title || "—"}</span><span>{item.access_level || "—"}</span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {activeTab === "integrations" ? (
        <article className="panel">
          <div className="card-grid">
            {integrations.map((item) => (
              <article className="card" key={item.id}>
                <div className="card-header">
                  <div className="card-title">
                    <strong>{item.name}</strong>
                    <span className="card-subtitle">{item.connector_type}</span>
                  </div>
                  <div className="card-badges">
                    <span className={`badge ${getStatusBadgeClass(item.effective_status || item.status)}`}>
                      {item.effective_status || item.status}
                    </span>
                    {item.is_license_expired && <span className="badge badge-rejected">Licencia vencida</span>}
                  </div>
                </div>
                <div className="card-meta">
                  {item.license_expires_at && (
                    <div>
                      <span className="card-label">Vence licencia</span>
                      <span style={{ color: item.is_license_expired ? "var(--danger)" : "var(--fg)", fontWeight: item.is_license_expired ? 600 : 400 }}>
                        {new Date(item.license_expires_at).toLocaleDateString("es-PE")}
                      </span>
                    </div>
                  )}
                  {item.license_type && (
                    <div><span className="card-label">Tipo</span><span>{item.license_type}</span></div>
                  )}
                </div>
                <div className="card-actions">
                  <Link className="button button-secondary" href={`/dashboard/integrations/${item.id}`}>Ver consola</Link>
                </div>
              </article>
            ))}
          </div>
        </article>
      ) : null}

      {activeTab === "inventory" ? (() => {
        const deviceTypes = [...new Set(devices.map((d) => d.device_type).filter(Boolean))] as string[];
        const filteredDevices = deviceTypeFilter
          ? devices.filter((d) => d.device_type === deviceTypeFilter)
          : devices;
        return (
          <article className="panel">
            <div className="panel-head">
              <div><p className="eyebrow">Activos</p><h3>Inventario</h3></div>
              <div className="panel-actions">
                <select value={deviceTypeFilter} onChange={(e) => setDeviceTypeFilter(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {deviceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="table-like">
              <div className="table-row table-head table-row-wide"><span>Hostname</span><span>Tipo</span><span>IP</span><span>Estado</span></div>
              {filteredDevices.map((device) => (
                <div className="table-row table-row-wide" key={device.id}>
                  <span>{device.hostname}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{device.device_type || "—"}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{device.ip_address || "—"}</span>
                  <span><span className={`badge ${getStatusBadgeClass(device.status)}`}>{device.status}</span></span>
                </div>
              ))}
              {filteredDevices.length === 0 && <div className="empty-state">Sin activos{deviceTypeFilter ? ` de tipo "${deviceTypeFilter}"` : ""}.</div>}
            </div>
          </article>
        );
      })() : null}

      {activeTab === "tickets" ? (() => {
        const filteredTickets = tickets.filter((t) => {
          if (ticketStatusFilter && t.status !== ticketStatusFilter) return false;
          if (ticketPriorityFilter && t.priority !== ticketPriorityFilter) return false;
          return true;
        });
        const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
        return (
          <article className="panel">
            <div className="panel-head">
              <div><p className="eyebrow">Soporte</p><h3>Tickets ({openCount} abiertos)</h3></div>
              <div className="panel-actions">
                <select value={ticketStatusFilter} onChange={(e) => setTicketStatusFilter(e.target.value)}>
                  <option value="">Todos los estados</option>
                  {["open","in_progress","pending","resolved","closed"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={ticketPriorityFilter} onChange={(e) => setTicketPriorityFilter(e.target.value)}>
                  <option value="">Todas las prioridades</option>
                  {["critical","high","medium","low"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="table-like">
              <div className="table-row table-head table-row-wide"><span>ID</span><span>Título</span><span>Prioridad</span><span>Estado</span></div>
              {filteredTickets.map((ticket) => (
                <div className="table-row table-row-wide" key={ticket.id}>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>#{ticket.id}</span>
                  <span style={{ fontSize: "0.85rem" }}>{ticket.title}</span>
                  <span><span className={`badge ${getStatusBadgeClass(ticket.priority)}`}>{ticket.priority}</span></span>
                  <span><span className={`badge ${getStatusBadgeClass(ticket.status)}`}>{ticket.status}</span></span>
                </div>
              ))}
              {filteredTickets.length === 0 && <div className="empty-state">Sin tickets con los filtros seleccionados.</div>}
            </div>
          </article>
        );
      })() : null}

      {activeTab === "reviews" ? (() => {
        const closedCount = reviews.filter((r) => r.status === "closed").length;
        return (
          <article className="panel">
            <div className="panel-head">
              <div><p className="eyebrow">Seguridad</p><h3>Revisiones de seguridad ({closedCount} completadas)</h3></div>
              <Link className="button button-ghost" href={`/dashboard/security-reviews?client_id=${clientId}`}>
                Ver en módulo →
              </Link>
            </div>
            <div className="table-like">
              <div className="table-row table-head" style={{ gridTemplateColumns: "60px 1fr 1fr 110px 120px 100px" }}>
                <span>ID</span><span>Programada</span><span>Ejecutada</span><span>Estado</span><span>Hallazgos</span><span></span>
              </div>
              {reviews.length === 0 ? (
                <div className="empty-state">Sin revisiones de seguridad para este cliente.</div>
              ) : reviews.map((review) => {
                const totalFindings = review.findings_count ?? 0;
                const critical = review.critical_findings_count ?? 0;
                return (
                  <div className="table-row" key={review.id} style={{ gridTemplateColumns: "60px 1fr 1fr 110px 120px 100px", alignItems: "center" }}>
                    <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>#{review.id}</span>
                    <span style={{ fontSize: "0.82rem" }}>
                      {review.scheduled_at ? new Date(review.scheduled_at).toLocaleDateString("es-PE") : "—"}
                    </span>
                    <span style={{ fontSize: "0.82rem" }}>
                      {review.executed_at ? new Date(review.executed_at).toLocaleDateString("es-PE") : "—"}
                    </span>
                    <span><span className={`badge ${getStatusBadgeClass(review.status)}`}>{review.status}</span></span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {totalFindings === 0 ? (
                        <span style={{ color: "var(--success)", fontSize: "0.78rem", fontWeight: 600 }}>✓ Sin hallazgos</span>
                      ) : (
                        <>
                          <span className="badge" title={`${totalFindings} hallazgos totales`} style={{ background: "rgba(59,130,246,0.15)", color: "#a8c9ff", border: "1px solid rgba(59,130,246,0.3)" }}>
                            {totalFindings}
                          </span>
                          {critical > 0 && (
                            <span className="badge" title={`${critical} crítico${critical > 1 ? "s" : ""}`} style={{ background: "rgba(239,68,68,0.18)", color: "#ff9d9d", border: "1px solid rgba(239,68,68,0.35)" }}>
                              {critical} crítico{critical > 1 ? "s" : ""}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    <span>
                      <Link className="button button-ghost button-sm" href={`/dashboard/security-reviews/${review.id}`}>
                        Detalle
                      </Link>
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })() : null}
    </section>
  );
}
