import { request } from "./client";

export type CollaboratorProfile = {
  id: number;
  user_id: number;
  position_title?: string | null;
  bio?: string | null;
  skills_json?: string | null;
  seniority?: string | null;
  availability_status?: string | null;
  area?: string | null;
  photo_url?: string | null;
  portfolio_url?: string | null;
};

export async function getCollaborators(): Promise<CollaboratorProfile[]> {
  return request<CollaboratorProfile[]>("/collaborators/");
}

export async function createCollaborator(payload: { user_id: number; position_title?: string | null; bio?: string | null; skills_json?: string | null; seniority?: string | null; availability_status?: string | null; area?: string | null; photo_url?: string | null; portfolio_url?: string | null }): Promise<CollaboratorProfile> {
  return request<CollaboratorProfile>("/collaborators/", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateCollaborator(profileId: number, payload: { position_title?: string | null; bio?: string | null; skills_json?: string | null; seniority?: string | null; availability_status?: string | null; area?: string | null; photo_url?: string | null; portfolio_url?: string | null }): Promise<CollaboratorProfile> {
  return request<CollaboratorProfile>(`/collaborators/${profileId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function uploadCollaboratorPhoto(profileId: number, photo: File): Promise<CollaboratorProfile> {
  const form = new FormData();
  form.append("file", photo);
  return request<CollaboratorProfile>(`/collaborators/${profileId}/photo`, { method: "POST", body: form });
}

export async function deleteCollaborator(profileId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/collaborators/${profileId}`, { method: "DELETE" });
}
