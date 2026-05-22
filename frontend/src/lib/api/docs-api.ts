import { request, buildQuery } from "./client";

export type DocTypeItem = { id: number; name: string; scope: string; is_active: boolean; created_at?: string | null };
export type ProjectDocItem = { id: number; project_id: number; doc_type_id: number; title: string; summary?: string | null; github_url?: string | null; preview_md?: string | null; visibility: string; status: string; enabled: boolean; created_by?: number | null; updated_by?: number | null; verified_by?: number | null; verified_at?: string | null; created_at?: string | null; updated_at?: string | null; file_url?: string | null; doc_type_name?: string | null };

export async function getDocTypes(): Promise<DocTypeItem[]> { return request<DocTypeItem[]>("/doc-types"); }
export async function createDocType(payload: { name: string; scope: string; is_active?: boolean }): Promise<DocTypeItem> { return request<DocTypeItem>("/doc-types", { method: "POST", body: JSON.stringify(payload) }); }
export async function updateDocType(id: number, payload: { name?: string | null; scope?: string | null; is_active?: boolean | null }): Promise<DocTypeItem> { return request<DocTypeItem>(`/doc-types/${id}`, { method: "PUT", body: JSON.stringify(payload) }); }

export async function getProjectDocs(params?: { project_id?: number | null; status?: string | null; visibility?: string | null; client_id?: number | null }): Promise<ProjectDocItem[]> { return request<ProjectDocItem[]>(`/project-docs${buildQuery({ ...params })}`); }
export async function createProjectDoc(payload: { project_id: number; doc_type_id: number; title: string; summary?: string | null; github_url?: string | null; preview_md?: string | null; visibility?: string; status?: string; enabled?: boolean }): Promise<ProjectDocItem> { return request<ProjectDocItem>("/project-docs", { method: "POST", body: JSON.stringify(payload) }); }
export async function updateProjectDoc(id: number, payload: { title?: string | null; summary?: string | null; github_url?: string | null; preview_md?: string | null; visibility?: string | null; status?: string | null; enabled?: boolean | null }): Promise<ProjectDocItem> { return request<ProjectDocItem>(`/project-docs/${id}`, { method: "PUT", body: JSON.stringify(payload) }); }
export async function toggleProjectDoc(id: number, enabled: boolean): Promise<ProjectDocItem> { return request<ProjectDocItem>(`/project-docs/${id}/toggle`, { method: "POST", body: JSON.stringify({ enabled }) }); }
