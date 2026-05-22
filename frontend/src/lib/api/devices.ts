import { request, downloadFile, buildQuery } from "./client";

export type DeviceCriticality = "low" | "medium" | "high" | "critical";
export type DeviceDataClassification = "public" | "internal" | "confidential" | "restricted";

export type DeviceItem = {
  id: number;
  integration_id?: number | null;
  hostname: string;
  vendor?: string | null;
  model?: string | null;
  ip_address?: string | null;
  device_type?: string | null;
  status: string;
  site_id?: number | null;
  asset_tag?: string | null;
  serial_number?: string | null;
  device_owner?: string | null;
  last_seen_at?: string | null;
  criticality?: DeviceCriticality | null;
  data_classification?: DeviceDataClassification | null;
  responsible_user_id?: number | null;
};

type DeviceFilters = { client_id?: number; integration_id?: number; site_id?: number; device_status?: string };

export async function getDevices(filters?: DeviceFilters): Promise<DeviceItem[]> {
  return request<DeviceItem[]>(`/devices/${buildQuery({ ...filters })}`);
}

export async function createDevice(payload: Omit<DeviceItem, "id">): Promise<DeviceItem> {
  return request<DeviceItem>("/devices/", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateDevice(deviceId: number, payload: Partial<Omit<DeviceItem, "id" | "integration_id">>): Promise<DeviceItem> {
  return request<DeviceItem>(`/devices/${deviceId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function retireDevice(deviceId: number): Promise<DeviceItem> {
  return request<DeviceItem>(`/devices/${deviceId}`, { method: "DELETE" });
}

export async function exportDevicesXlsx(filters?: DeviceFilters): Promise<void> {
  return downloadFile(`/devices/export-xlsx${buildQuery({ ...filters })}`, "inventario.xlsx");
}
