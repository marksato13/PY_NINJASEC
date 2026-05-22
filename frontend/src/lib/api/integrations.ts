import { request } from "./client";

export type IntegrationItem = {
  id: number;
  client_id?: number | null;
  name: string;
  connector_type: string;
  status: string;
  base_url: string;
  config_json?: string | null;
  environment?: string | null;
  license_type?: string | null;
  license_expires_at?: string | null;
  responsible_user_id?: number | null;
  is_license_expired?: boolean;
  effective_status?: string;
};

export type IntegrationCreatePayload = {
  organization_id: number;
  client_id: number;
  connector_type: "pfSense" | "FortiGate";
  name: string;
  base_url: string;
  auth_type?: string;
  config_json?: string | null;
};

export async function getIntegrations(clientId?: number): Promise<IntegrationItem[]> {
  const qs = clientId ? `?client_id=${clientId}` : "";
  return request<IntegrationItem[]>(`/integrations/${qs}`);
}

export async function getIntegration(integrationId: number): Promise<IntegrationItem> {
  return request<IntegrationItem>(`/integrations/${integrationId}`);
}

export async function createIntegration(payload: IntegrationCreatePayload): Promise<IntegrationItem> {
  return request<IntegrationItem>("/integrations/", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      auth_type: payload.auth_type ?? "token",
      config_json: payload.config_json ?? '{"environment":"manual"}',
    }),
  });
}

export async function updateIntegration(
  integrationId: number,
  payload: Partial<Pick<IntegrationItem, "name" | "base_url" | "status" | "environment" | "license_type" | "license_expires_at" | "responsible_user_id" | "config_json">>,
): Promise<IntegrationItem> {
  return request<IntegrationItem>(`/integrations/${integrationId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteIntegration(integrationId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/integrations/${integrationId}`, { method: "DELETE" });
}

export async function testIntegrationConnection(payload: { connector_type: string; base_url: string }): Promise<{ connector_type: string; reachable: boolean; message: string }> {
  return request("/integrations/test-connection", { method: "POST", body: JSON.stringify(payload) });
}

export async function collectIntegration(integrationId: number): Promise<{ message: string; status: string }> {
  return request(`/integrations/${integrationId}/collect`, { method: "POST" });
}

export type SnapshotItem = {
  id: number;
  integration_id: number;
  device_id?: number | null;
  snapshot_type: string;
  raw_payload?: string | null;
  normalized_payload?: string | null;
};

export async function getSnapshots(): Promise<SnapshotItem[]> {
  return request<SnapshotItem[]>("/collection/snapshots");
}
