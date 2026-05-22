import { downloadFile, request } from "./client";

export type DashboardClient = {
  id: number;
  organization_id?: number;
  company_name: string;
  commercial_status: string;
  sector?: string | null;
  size?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  devices_count?: number;
  open_tickets_count?: number;
};

export type ClientSiteItem = {
  id: number;
  client_id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  status: string;
};

export type ClientContactItem = {
  id: number;
  client_id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_primary: boolean;
};

export type ClientServiceItem = {
  id: number;
  client_id: number;
  service_id: number;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type ClientAccessItem = {
  client_id: number;
  user_id: number;
  full_name: string;
  email: string;
  position_title?: string | null;
  access_level?: string | null;
  phone?: string | null;
};

// ── Clients ──────────────────────────────────────────────────────────────────
export async function getClients(): Promise<DashboardClient[]> {
  return request<DashboardClient[]>("/clients/");
}

export async function getClient(clientId: number): Promise<DashboardClient> {
  return request<DashboardClient>(`/clients/${clientId}`);
}

export async function createClient(payload: {
  organization_id: number;
  company_name: string;
  commercial_status?: string;
  sector?: string | null;
  size?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
}): Promise<DashboardClient> {
  return request<DashboardClient>("/clients/", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateClient(clientId: number, payload: Partial<Omit<DashboardClient, "id" | "organization_id">>): Promise<DashboardClient> {
  return request<DashboardClient>(`/clients/${clientId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteClient(clientId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/clients/${clientId}`, { method: "DELETE" });
}

export async function exportClientsXlsx(): Promise<void> {
  return downloadFile("/clients/export-xlsx", "clientes.xlsx");
}

export async function getClientAccess(clientId: number): Promise<ClientAccessItem[]> {
  return request<ClientAccessItem[]>(`/clients/${clientId}/access`);
}

// ── Client Sites ──────────────────────────────────────────────────────────────
export async function getClientSites(clientId: number): Promise<ClientSiteItem[]> {
  return request<ClientSiteItem[]>(`/client-sites?client_id=${clientId}`);
}

export async function getAllClientSites(): Promise<ClientSiteItem[]> {
  return request<ClientSiteItem[]>("/client-sites");
}

export async function createClientSite(payload: Omit<ClientSiteItem, "id">): Promise<ClientSiteItem> {
  return request<ClientSiteItem>("/client-sites", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateClientSite(siteId: number, payload: Partial<Omit<ClientSiteItem, "id" | "client_id">>): Promise<ClientSiteItem> {
  return request<ClientSiteItem>(`/client-sites/${siteId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteClientSite(siteId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/client-sites/${siteId}`, { method: "DELETE" });
}

// ── Client Contacts ───────────────────────────────────────────────────────────
export async function getClientContacts(clientId: number): Promise<ClientContactItem[]> {
  return request<ClientContactItem[]>(`/client-contacts?client_id=${clientId}`);
}

export async function createClientContact(payload: Omit<ClientContactItem, "id">): Promise<ClientContactItem> {
  return request<ClientContactItem>("/client-contacts", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateClientContact(contactId: number, payload: Partial<Omit<ClientContactItem, "id" | "client_id">>): Promise<ClientContactItem> {
  return request<ClientContactItem>(`/client-contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteClientContact(contactId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/client-contacts/${contactId}`, { method: "DELETE" });
}

// ── Client Services ───────────────────────────────────────────────────────────
export async function getClientServices(clientId: number): Promise<ClientServiceItem[]> {
  return request<ClientServiceItem[]>(`/client-services?client_id=${clientId}`);
}

export async function createClientService(payload: Omit<ClientServiceItem, "id">): Promise<ClientServiceItem> {
  return request<ClientServiceItem>("/client-services", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateClientService(clientServiceId: number, payload: Partial<Pick<ClientServiceItem, "starts_at" | "ends_at">>): Promise<ClientServiceItem> {
  return request<ClientServiceItem>(`/client-services/${clientServiceId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteClientService(clientServiceId: number): Promise<void> {
  await request<void>(`/client-services/${clientServiceId}`, { method: "DELETE" });
}
