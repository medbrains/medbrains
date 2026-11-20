/** The `/case-sheets` API area. Moved from `client.ts`; one module per first path segment. */
import type { CaseSheetScan } from "@medbrains/types";
import { request } from "../client.js";

export const caseSheetsApi = {
  // Case-sheet digitization (B2 ingestion)
  listCaseSheetScans: (params?: { status?: string; patient_id?: string }) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<CaseSheetScan[]>(`/case-sheets/scans${qs}`);
  },
  getCaseSheetScan: (id: string) => request<CaseSheetScan>(`/case-sheets/scans/${id}`),
  createCaseSheetScan: (data: {
    patient_id: string;
    encounter_id?: string;
    scan_image_url: string;
  }) =>
    request<CaseSheetScan>("/case-sheets/scans", { method: "POST", body: JSON.stringify(data) }),
  submitCaseSheetScan: (id: string) =>
    request<CaseSheetScan>(`/case-sheets/scans/${id}/submit`, { method: "POST" }),
  submitCaseSheetParseResult: (
    id: string,
    data: { extracted_json?: unknown; overall_confidence?: number; parse_error?: string },
  ) =>
    request<CaseSheetScan>(`/case-sheets/scans/${id}/parse-result`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  saveCaseSheetReview: (id: string, extractedJson: unknown) =>
    request<CaseSheetScan>(`/case-sheets/scans/${id}/review`, {
      method: "PUT",
      body: JSON.stringify({ extracted_json: extractedJson }),
    }),
  commitCaseSheetScan: (id: string) =>
    request<CaseSheetScan>(`/case-sheets/scans/${id}/commit`, { method: "POST" }),
};
