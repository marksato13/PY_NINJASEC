import { request, buildQuery } from "./client";

export type LinkType = "ethernet" | "wifi" | "wan" | "vpn" | "mpls" | "trunk" | "cloud_peering";

export type TopologyNode = {
  id: number;
  label: string;
  device_type?: string | null;
  vendor?: string | null;
  model?: string | null;
  ip_address?: string | null;
  status: string;
  criticality?: string | null;
  data_classification?: string | null;
  site_id?: number | null;
  responsible_user_id?: number | null;
  responsible_user_name?: string | null;
  integration_id?: number | null;
};

export type TopologyEdge = {
  id: number;
  source: number;
  target: number;
  link_type: LinkType;
  port_source?: string | null;
  port_target?: string | null;
  vlan_id?: number | null;
  bandwidth_mbps?: number | null;
};

export type TopologyCluster = {
  label: string;
  site_id?: number | null;
  node_ids: number[];
};

export type TopologyResponse = {
  client_id: number;
  client_name?: string | null;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  clusters: TopologyCluster[];
};

export type DeviceConnection = {
  id: number;
  source_device_id: number;
  target_device_id: number;
  link_type: LinkType;
  port_source?: string | null;
  port_target?: string | null;
  vlan_id?: number | null;
  bandwidth_mbps?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

export type DeviceConnectionCreate = Omit<DeviceConnection, "id" | "created_at">;

export async function getTopology(clientId: number): Promise<TopologyResponse> {
  return request<TopologyResponse>(`/devices/topology${buildQuery({ client_id: clientId })}`);
}

export async function getConnections(clientId: number): Promise<DeviceConnection[]> {
  return request<DeviceConnection[]>(`/device-connections/${buildQuery({ client_id: clientId })}`);
}

export async function createConnection(payload: DeviceConnectionCreate): Promise<DeviceConnection> {
  return request<DeviceConnection>("/device-connections/", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteConnection(connectionId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/device-connections/${connectionId}`, { method: "DELETE" });
}
