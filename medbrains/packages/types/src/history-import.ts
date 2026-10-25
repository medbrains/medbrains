/**
 * Historical import — a hospital's past (patients, visits, admissions, lab
 * results, dispenses, bills, claims) brought in as dated records before its
 * go-live cut-over. Mirrors `medbrains-history-import`.
 */

export type HistoryImportKind =
  | "patient"
  | "visit"
  | "admission"
  | "lab_order"
  | "dispense"
  | "invoice"
  | "claim";

export interface HistoryImportSettings {
  /** History must end before this moment (RFC 3339). Null until set. */
  go_live_at: string | null;
}

export interface HistoryImportTally {
  kind: HistoryImportKind;
  added: number;
  /** Already imported earlier (same external id), left as it was. */
  skipped: number;
}

export interface HistoryImportProblem {
  /** 1-based position of the record in the upload. */
  record: number;
  kind: HistoryImportKind;
  external_id: string;
  field: string;
  message: string;
}

export type HistoryImportStatus = "validated" | "refused" | "committed";

export interface HistoryImportResult {
  batch_id: string;
  applied: boolean;
  dry_run: boolean;
  status: HistoryImportStatus;
  go_live_at: string;
  tallies: HistoryImportTally[];
  problems: HistoryImportProblem[];
}

/** One record as the old system's export carries it; fields depend on `kind`. */
export interface HistoryImportRecord {
  kind: HistoryImportKind;
  external_id: string;
  [field: string]: unknown;
}

export interface HistoryImportBatchRequest {
  label: string;
  dry_run: boolean;
  records: HistoryImportRecord[];
}

export interface HistoryImportBatch {
  id: string;
  label: string;
  dry_run: boolean;
  status: HistoryImportStatus;
  go_live_at: string;
  record_count: number;
  tallies: HistoryImportTally[];
  problems: HistoryImportProblem[];
  problem_count: number;
  created_by_name: string | null;
  created_at: string;
}
