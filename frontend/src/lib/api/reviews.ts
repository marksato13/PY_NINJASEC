import { request, downloadFile, buildQuery } from "./client";

export type SecurityReviewItem = {
  id: number;
  organization_id: number;
  client_id: number;
  integration_id: number;
  scheduled_at?: string | null;
  executed_at?: string | null;
  status: string;
  reviewer_user_id?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  findings_count?: number;
  critical_findings_count?: number;
};

export type ReviewChecklistItem = { id: number; review_id: number; criteria: string; result?: string | null; notes?: string | null };
export type ReviewFindingItem = { id: number; review_id: number; severity: string; title: string; description?: string | null; status: string; evidence_url?: string | null; created_at: string };
export type ReviewRecommendationItem = { id: number; review_id: number; finding_id?: number | null; recommendation: string; owner_user_id?: number | null; due_date?: string | null; status: string };
export type ReviewAttachmentItem = { id: number; review_id: number; finding_id?: number | null; file_url: string; filename: string; uploaded_at: string };

export type SecurityReviewDetail = SecurityReviewItem & {
  checklist_items: ReviewChecklistItem[];
  findings: ReviewFindingItem[];
  recommendations: ReviewRecommendationItem[];
  attachments: ReviewAttachmentItem[];
};

type ReviewFilters = { client_id?: number; integration_id?: number; status?: string };

export async function getSecurityReviews(filters?: ReviewFilters): Promise<SecurityReviewItem[]> {
  return request<SecurityReviewItem[]>(`/security-reviews/${buildQuery({ ...filters })}`);
}

export async function getSecurityReview(reviewId: number): Promise<SecurityReviewDetail> {
  return request<SecurityReviewDetail>(`/security-reviews/${reviewId}`);
}

export async function createSecurityReview(payload: { client_id: number; integration_id: number; scheduled_at?: string | null; reviewer_user_id?: number | null; notes?: string | null }): Promise<SecurityReviewItem> {
  return request<SecurityReviewItem>("/security-reviews/", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteSecurityReview(reviewId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/security-reviews/${reviewId}`, { method: "DELETE" });
}

export async function updateSecurityReview(reviewId: number, payload: { scheduled_at?: string | null; executed_at?: string | null; status?: string | null; reviewer_user_id?: number | null; notes?: string | null }): Promise<SecurityReviewItem> {
  return request<SecurityReviewItem>(`/security-reviews/${reviewId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function createChecklistItem(reviewId: number, payload: { criteria: string; result?: string | null; notes?: string | null }): Promise<ReviewChecklistItem> {
  return request<ReviewChecklistItem>(`/security-reviews/${reviewId}/checklist`, { method: "POST", body: JSON.stringify(payload) });
}

export async function createReviewFinding(reviewId: number, payload: { severity: string; title: string; description?: string | null; evidence_url?: string | null }): Promise<ReviewFindingItem> {
  return request<ReviewFindingItem>(`/security-reviews/${reviewId}/findings`, { method: "POST", body: JSON.stringify(payload) });
}

export async function patchReviewFinding(findingId: number, payload: { status?: string; severity?: string; title?: string; description?: string | null }): Promise<ReviewFindingItem> {
  return request<ReviewFindingItem>(`/security-reviews/findings/${findingId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function createReviewRecommendation(reviewId: number, payload: { finding_id?: number | null; recommendation: string; owner_user_id?: number | null; due_date?: string | null }): Promise<ReviewRecommendationItem> {
  return request<ReviewRecommendationItem>(`/security-reviews/${reviewId}/recommendations`, { method: "POST", body: JSON.stringify(payload) });
}

export async function createReviewAttachment(reviewId: number, payload: { finding_id?: number | null; file_url: string; filename: string }): Promise<ReviewAttachmentItem> {
  return request<ReviewAttachmentItem>(`/security-reviews/${reviewId}/attachments`, { method: "POST", body: JSON.stringify(payload) });
}

export async function exportSecurityReviewsXlsx(filters?: { client_id?: number; review_status?: string; date_from?: string; date_to?: string }): Promise<void> {
  return downloadFile(`/security-reviews/export-xlsx${buildQuery({ ...filters })}`, "revisiones.xlsx");
}

export async function exportSecurityReviewPdf(reviewId: number): Promise<void> {
  return downloadFile(`/security-reviews/${reviewId}/pdf`, `revision_${reviewId}.pdf`);
}
