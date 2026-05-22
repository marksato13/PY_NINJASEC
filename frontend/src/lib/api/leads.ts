import { buildQuery, downloadFile, request } from "./client";

export type LeadItem = {
  id: number;
  contact_name: string;
  email: string;
  status: string;
  company_name?: string | null;
  interest_area?: string | null;
  source?: string | null;
  phone?: string | null;
  message?: string | null;
  created_at?: string | null;
};

export async function getLeads(): Promise<LeadItem[]> {
  return request<LeadItem[]>("/leads/");
}

export async function createLead(payload: { contact_name: string; email: string; company_name?: string | null; phone?: string | null; interest_area?: string | null; message?: string | null; source?: string | null }): Promise<LeadItem> {
  return request<LeadItem>("/leads/", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateLeadStatus(leadId: number, status: string): Promise<LeadItem> {
  return request<LeadItem>(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function updateLead(leadId: number, payload: Partial<Omit<LeadItem, "id" | "status" | "created_at">>): Promise<LeadItem> {
  return request<LeadItem>(`/leads/${leadId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteLead(leadId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/leads/${leadId}`, { method: "DELETE" });
}

export async function exportLeadsXlsx(filters?: { date_from?: string; date_to?: string }): Promise<void> {
  return downloadFile(`/leads/export-xlsx${buildQuery({ ...filters })}`, "pipeline.xlsx");
}
