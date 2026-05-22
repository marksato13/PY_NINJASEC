import { request, buildQuery } from "./client";

export type DashboardSummaryItem = {
  reviews: { total_scheduled: number; total_executed: number; execution_rate_pct: number; open_count: number; closed_count: number };
  findings: { total: number; by_severity: Record<string, number>; by_status: Record<string, number>; critical_open: number };
  tickets: { total: number; open_count: number; closed_count: number; avg_resolution_hours?: number | null; overdue_count: number };
  inventory: { total_devices: number; by_status: Record<string, number>; active_consoles: number; expired_licenses: number };
  generated_at: string;
};

export async function getDashboardSummary(filters?: { client_id?: number; date_from?: string; date_to?: string }): Promise<DashboardSummaryItem> {
  return request<DashboardSummaryItem>(`/dashboard/summary${buildQuery({ ...filters })}`);
}
