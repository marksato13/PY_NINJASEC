import { request } from "./client";

export type SkillItem = { id: number; name: string; category?: string | null; is_active: boolean; created_at?: string | null };
export type UserSkillItem = { id: number; user_id: number; skill_id: number; skill_name?: string | null; level?: string | null; status: string; verified_by?: number | null; verified_at?: string | null; created_at?: string | null };
export type UserCertificationItem = { id: number; user_id: number; name: string; issuer?: string | null; credential_id?: string | null; url?: string | null; status: string; verified_by?: number | null; verified_at?: string | null; issued_at?: string | null; expires_at?: string | null; created_at?: string | null };

export async function getSkills(): Promise<SkillItem[]> { return request<SkillItem[]>("/skills/"); }
export async function createSkill(payload: { name: string; category?: string | null }): Promise<SkillItem> { return request<SkillItem>("/skills/", { method: "POST", body: JSON.stringify(payload) }); }
export async function getUserSkills(): Promise<UserSkillItem[]> { return request<UserSkillItem[]>("/skills/user-skills"); }
export async function createUserSkill(payload: { skill_id: number; level?: string | null; user_id?: number | null }): Promise<UserSkillItem> { return request<UserSkillItem>("/skills/user-skills", { method: "POST", body: JSON.stringify(payload) }); }
export async function updateUserSkill(id: number, payload: { level?: string | null }): Promise<UserSkillItem> { return request<UserSkillItem>(`/skills/user-skills/${id}`, { method: "PUT", body: JSON.stringify(payload) }); }
export async function verifyUserSkill(id: number, status: string): Promise<UserSkillItem> { return request<UserSkillItem>(`/skills/user-skills/${id}/verify`, { method: "POST", body: JSON.stringify({ status }) }); }
export async function getUserCertifications(): Promise<UserCertificationItem[]> { return request<UserCertificationItem[]>("/user-certifications/"); }
export async function createUserCertification(payload: { name: string; issuer?: string | null; credential_id?: string | null; url?: string | null; issued_at?: string | null; expires_at?: string | null }): Promise<UserCertificationItem> { return request<UserCertificationItem>("/user-certifications/", { method: "POST", body: JSON.stringify(payload) }); }
export async function updateUserCertification(id: number, payload: { name?: string | null; issuer?: string | null; credential_id?: string | null; url?: string | null; issued_at?: string | null; expires_at?: string | null }): Promise<UserCertificationItem> { return request<UserCertificationItem>(`/user-certifications/${id}`, { method: "PUT", body: JSON.stringify(payload) }); }
export async function verifyUserCertification(id: number, status: string): Promise<UserCertificationItem> { return request<UserCertificationItem>(`/user-certifications/${id}/verify`, { method: "POST", body: JSON.stringify({ status }) }); }
