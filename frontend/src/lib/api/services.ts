import { request, requestPublic } from "./client";

export type ServiceItem = { id: number; title: string; slug: string; category?: string | null; summary?: string | null; description?: string | null; price_label?: string | null; is_public?: boolean; active: boolean };
export type ServiceRequestItem = { id: number; service_id: number; requester_name: string; requester_email: string; status: string; request_type?: string | null; message?: string | null; created_at?: string | null; client_id?: number | null };

export async function getServices(): Promise<ServiceItem[]> {
  return request<ServiceItem[]>("/services/");
}

export async function createService(payload: { organization_id: number; title: string; slug: string; category?: string | null; summary?: string | null; description?: string | null; price_label?: string | null; is_public?: boolean; active?: boolean }): Promise<ServiceItem> {
  return request<ServiceItem>("/services/", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteService(serviceId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/services/${serviceId}`, { method: "DELETE" });
}

export async function getServiceRequests(): Promise<ServiceRequestItem[]> {
  return request<ServiceRequestItem[]>("/services/requests");
}

export async function createServiceRequest(payload: { service_id: number; requester_name: string; requester_email: string; message?: string | null; request_type?: string | null; client_id?: number | null }): Promise<ServiceRequestItem> {
  return requestPublic<ServiceRequestItem>("/services/requests", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateServiceRequestStatus(requestId: number, status: string): Promise<ServiceRequestItem> {
  return request<ServiceRequestItem>(`/services/requests/${requestId}`, { method: "PATCH", body: JSON.stringify({ status }) });
}
