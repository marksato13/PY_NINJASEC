import { request } from "./client";

export type DashboardUser = {
  id: number;
  full_name: string;
  email: string;
  role_code: string;
  job_title?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
};

export async function getUsers(): Promise<DashboardUser[]> {
  return request<DashboardUser[]>("/users/");
}

export async function createUser(payload: {
  organization_id: number;
  full_name: string;
  email: string;
  password: string;
  role_code: string;
  job_title?: string | null;
}): Promise<DashboardUser> {
  return request<DashboardUser>("/users/", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateUser(userId: number, payload: {
  full_name?: string | null;
  job_title?: string | null;
  is_active?: boolean | null;
  role_code?: string | null;
}): Promise<DashboardUser> {
  return request<DashboardUser>(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteUser(userId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/users/${userId}`, { method: "DELETE" });
}
