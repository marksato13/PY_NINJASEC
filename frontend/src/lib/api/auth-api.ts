import { request } from "./client";
import type { AuthUser } from "@/lib/auth";

export type { AuthUser }; // re-export so @/lib/api consumers still get the type

export type LoginResponse = {
  access_token: string;
  token_type: string;
  redirect_to: string;
  user: { id: number; name: string; role: string; email: string; job_title?: string };
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export async function updateMyProfile(payload: { full_name?: string | null; job_title?: string | null }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) });
}

export async function changeMyPassword(payload: { current_password: string; new_password: string }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/change-password", { method: "POST", body: JSON.stringify(payload) });
}
