import { request } from "./client";

export type ProjectItem = { id: number; name: string; status: string; description?: string | null; organization_id?: number | null; client_id?: number | null; project_type_id?: number | null; area_id?: number | null; service_id?: number | null; product_id?: number | null; start_date?: string | null; end_date?: string | null; budget_label?: string | null; created_at?: string | null; updated_at?: string | null };
export type AreaItem = { id: number; name: string; slug: string; is_active: boolean };
export type ProjectTypeItem = { id: number; name: string; slug: string; is_active: boolean };
export type ProductItem = { id: number; name: string; slug: string; summary?: string | null; is_active: boolean; area_id?: number | null; project_type_id?: number | null };
export type ProjectMemberItem = { id: number; project_id: number; user_id: number; role_in_project?: string | null; allocation_percentage?: number | null; can_publish_docs: boolean; assignment_type: string; is_required: boolean; joined_at?: string | null; user_name?: string | null; user_email?: string | null; user_role_code?: string | null };
export type ProjectRequirementItem = { id: number; project_id: number; skill_id: number; level?: string | null; is_required: boolean; created_at?: string | null; skill_name?: string | null };
export type ProjectRecommendationItem = { id: number; project_id: number; user_id: number; score: number; status?: string | null; reason_json?: string | null; created_at?: string | null; user_name?: string | null; user_email?: string | null };

export async function getProjects(): Promise<ProjectItem[]> { return request<ProjectItem[]>("/projects/"); }
export async function getProject(id: number): Promise<ProjectItem> { return request<ProjectItem>(`/projects/${id}`); }
export async function createProject(payload: { organization_id: number; client_id?: number | null; project_type_id?: number | null; service_id?: number | null; product_id?: number | null; name: string; description?: string | null; status?: string; start_date?: string | null; end_date?: string | null; budget_label?: string | null }): Promise<ProjectItem> { return request<ProjectItem>("/projects/", { method: "POST", body: JSON.stringify(payload) }); }
export async function updateProject(id: number, payload: { name?: string | null; description?: string | null; status?: string | null; start_date?: string | null; end_date?: string | null; budget_label?: string | null }): Promise<ProjectItem> { return request<ProjectItem>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export async function deleteProject(id: number): Promise<{ message: string }> { return request<{ message: string }>(`/projects/${id}`, { method: "DELETE" }); }

export async function getAreas(): Promise<AreaItem[]> { return request<AreaItem[]>("/areas"); }
export async function getProjectTypes(): Promise<ProjectTypeItem[]> { return request<ProjectTypeItem[]>("/project-types"); }
export async function getProducts(): Promise<ProductItem[]> { return request<ProductItem[]>("/products"); }

export async function getProjectMembers(projectId: number): Promise<ProjectMemberItem[]> { return request<ProjectMemberItem[]>(`/project-members?project_id=${projectId}`); }
export async function getAllProjectMembers(): Promise<ProjectMemberItem[]> { return request<ProjectMemberItem[]>("/project-members"); }
export async function createProjectMember(payload: { project_id: number; user_id: number; role_in_project?: string | null; allocation_percentage?: number | null; can_publish_docs?: boolean; assignment_type?: string; is_required?: boolean }): Promise<{ message: string }> { return request<{ message: string }>("/project-members", { method: "POST", body: JSON.stringify(payload) }); }
export async function getProjectRequirements(projectId: number): Promise<ProjectRequirementItem[]> { return request<ProjectRequirementItem[]>(`/project-requirements?project_id=${projectId}`); }
export async function createProjectRequirement(payload: { project_id: number; skill_id: number; level?: string | null; is_required?: boolean }): Promise<ProjectRequirementItem> { return request<ProjectRequirementItem>("/project-requirements", { method: "POST", body: JSON.stringify(payload) }); }
export async function getProjectRecommendations(projectId: number, refresh = false): Promise<ProjectRecommendationItem[]> { return request<ProjectRecommendationItem[]>(`/project-recommendations?project_id=${projectId}${refresh ? "&refresh=true" : ""}`); }
