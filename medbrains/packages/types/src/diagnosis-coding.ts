// The hospital's diagnosis coding switch and its licensed ICD-10 catalogue
// (`/api/terminology/diagnosis-coding`, `/api/terminology/icd10/releases`).

/** ICD-11, ICD-10, or both — set in Settings → Diagnosis coding. */
export type DiagnosisCodingMode = "icd11" | "icd10" | "both";

export type Icd10FileFormat = "claml" | "csv";

export interface Icd10Release {
  id: string;
  version: string;
  source: string;
  licence_note: string;
  file_name: string | null;
  format: Icd10FileFormat;
  content_sha256: string;
  code_count: number;
  loaded_by: string;
  loaded_by_name: string | null;
  loaded_at: string;
}

export interface DiagnosisCodingStatus {
  mode: DiagnosisCodingMode;
  /** The ICD-10 catalogue in use; null = none loaded. */
  icd10_catalogue: Icd10Release | null;
}

export interface SetDiagnosisCodingRequest {
  mode: DiagnosisCodingMode;
}

export interface ImportIcd10Request {
  format: Icd10FileFormat;
  version: string;
  source: string;
  licence_note: string;
  file_name?: string;
  content: string;
}

export interface Icd10ImportResult {
  release: Icd10Release;
  already_loaded: boolean;
}
