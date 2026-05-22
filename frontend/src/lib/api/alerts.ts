import { request } from "./client";

export type AlertItem = { type: string; severity: string; entity_type: string; entity_id: number; message: string; created_at: string };
export type AlertRefreshResult = { integrations_marked_risk: number; devices_marked_pending_review: number };

export async function getAlerts(clientId?: number): Promise<AlertItem[]> {
  const qs = clientId ? `?client_id=${clientId}` : "";
  return request<AlertItem[]>(`/alerts/active${qs}`);
}

export async function refreshAlerts(): Promise<AlertRefreshResult> {
  return request<AlertRefreshResult>("/alerts/refresh", { method: "POST" });
}
