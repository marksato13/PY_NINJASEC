import { request, buildQuery } from "./client";

export type JobApplicationItem = { id: number; full_name: string; email: string; status: string; desired_role?: string | null; phone?: string | null; skills_summary?: string | null; cv_url?: string | null; portfolio_url?: string | null; source?: string | null; created_at?: string | null };
export type ApplicationAssignmentItem = { id: number; application_id: number; reviewer_user_id: number; assigned_by_user_id: number; role?: string | null; assigned_at?: string | null };
export type ApplicationReviewItem = { id: number; application_id: number; reviewer_user_id: number; score: number; recommendation: string; notes?: string | null; created_at?: string | null };
export type ApplicationNoteItem = { id: number; application_id: number; author_user_id: number; note: string; visibility: string; created_at?: string | null };
export type ApplicationAttachmentItem = { id: number; application_id: number; file_url: string; file_type?: string | null; uploaded_by_user_id: number; created_at?: string | null };
export type ApplicationEventItem = { id: number; application_id: number; event_type: string; payload_json?: string | null; created_at?: string | null };
export type JobApplicationFilters = { status?: string; desired_role?: string; reviewer_id?: number; date_from?: string; date_to?: string };

export async function getJobApplications(filters?: JobApplicationFilters): Promise<JobApplicationItem[]> { return request<JobApplicationItem[]>(`/job-applications/${buildQuery({ ...filters })}`); }
export async function getJobApplication(id: number): Promise<JobApplicationItem> { return request<JobApplicationItem>(`/job-applications/${id}`); }
export async function updateJobApplicationStatus(id: number, status: string): Promise<JobApplicationItem> { return request<JobApplicationItem>(`/job-applications/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
export async function assignJobApplicationReviewer(id: number, payload: { reviewer_user_id: number; role?: string | null }): Promise<ApplicationAssignmentItem> { return request<ApplicationAssignmentItem>(`/job-applications/${id}/assign`, { method: "POST", body: JSON.stringify(payload) }); }
export async function createJobApplicationReview(id: number, payload: { score: number; recommendation: string; notes?: string | null }): Promise<ApplicationReviewItem> { return request<ApplicationReviewItem>(`/job-applications/${id}/reviews`, { method: "POST", body: JSON.stringify(payload) }); }
export async function createJobApplicationNote(id: number, payload: { note: string; visibility?: string }): Promise<ApplicationNoteItem> { return request<ApplicationNoteItem>(`/job-applications/${id}/notes`, { method: "POST", body: JSON.stringify(payload) }); }
export async function createJobApplicationAttachment(id: number, payload: { file_url: string; file_type?: string | null }): Promise<ApplicationAttachmentItem> { return request<ApplicationAttachmentItem>(`/job-applications/${id}/attachments`, { method: "POST", body: JSON.stringify(payload) }); }
export async function getJobApplicationTimeline(id: number): Promise<ApplicationEventItem[]> { return request<ApplicationEventItem[]>(`/job-applications/${id}/timeline`); }
export async function getJobApplicationAssignments(id: number): Promise<ApplicationAssignmentItem[]> { return request<ApplicationAssignmentItem[]>(`/job-applications/${id}/assignments`); }
export async function getJobApplicationReviews(id: number): Promise<ApplicationReviewItem[]> { return request<ApplicationReviewItem[]>(`/job-applications/${id}/reviews`); }
export async function getJobApplicationNotes(id: number): Promise<ApplicationNoteItem[]> { return request<ApplicationNoteItem[]>(`/job-applications/${id}/notes`); }
export async function getJobApplicationAttachments(id: number): Promise<ApplicationAttachmentItem[]> { return request<ApplicationAttachmentItem[]>(`/job-applications/${id}/attachments`); }
