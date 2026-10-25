/** De-identified research dataset exports (`/api/research/exports`). */

export type ResearchDataset = "visits" | "diagnoses" | "admissions";

/** `expired` is a ready export past its 24 hours. */
export type ResearchExportStatus = "requested" | "rejected" | "ready" | "expired" | "failed";

export interface NewResearchExport {
  dataset: ResearchDataset;
  period_from: string;
  period_to: string;
  purpose: string;
  iec_reference: string;
}

export interface ResearchExport {
  id: string;
  dataset: ResearchDataset;
  period_from: string;
  period_to: string;
  purpose: string;
  iec_reference: string;
  status: ResearchExportStatus;
  requested_by: string;
  requested_by_name: string | null;
  requested_via: "screen" | "assistant";
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  row_count: number | null;
  suppressed_rows: number | null;
  suppression_report: Record<string, unknown> | null;
  data_sha256: string | null;
  ready_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ResearchExportFile {
  filename: string;
  sha256: string;
  content: string;
}
