import { request, downloadFile, buildQuery } from "./client";

export type ReportItem = { id: number; title: string; report_type: string; template_name?: string | null; definition_json?: string | null };
export type ReportRunItem = { id: number; report_id: number; status: string; output_file?: string | null; summary_json?: string | null; started_at?: string | null; finished_at?: string | null };
export type LastExportsMap = Record<string, string | null>;

export async function getReports(): Promise<ReportItem[]> { return request<ReportItem[]>("/reports/"); }
export async function runReport(reportId: number): Promise<ReportRunItem> { return request<ReportRunItem>(`/reports/${reportId}/run`, { method: "POST" }); }
export async function getReportRuns(): Promise<ReportRunItem[]> { return request<ReportRunItem[]>("/reports/runs"); }
export async function getLastExports(): Promise<LastExportsMap> { return request<LastExportsMap>("/reports/last-exports"); }

export async function exportConsolidatedReportPdf(payload: { client_id: number; date_from?: string; date_to?: string }): Promise<void> {
  return downloadFile(`/reports/consolidated-pdf${buildQuery(payload)}`, "reporte-consolidado.pdf");
}

export async function exportConsolidatedReportXlsx(payload: { client_id: number; date_from?: string; date_to?: string }): Promise<void> {
  return downloadFile(`/reports/consolidated-xlsx${buildQuery(payload)}`, "reporte-consolidado.xlsx");
}
