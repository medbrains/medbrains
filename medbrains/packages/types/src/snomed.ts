// SNOMED CT store (crates/medbrains-terminology). Concept ids are strings:
// SCTIDs exceed Number.MAX_SAFE_INTEGER and would round to another concept.

export type SnomedReleaseStatus = "queued" | "importing" | "closure" | "completed" | "failed";

export interface SnomedRelease {
  id: string;
  edition: string;
  version_date: string;
  module_ids: string[];
  source: "upload" | "server_path";
  file_name: string | null;
  status: SnomedReleaseStatus;
  phase: string | null;
  rows_processed: number;
  concept_count: number;
  description_count: number;
  relationship_count: number;
  refset_member_count: number;
  closure_count: number | null;
  skipped_files: string[];
  error: string | null;
  imported_by: string | null;
  imported_by_name: string | null;
  created_at: string;
  started_at: string | null;
  imported_at: string | null;
}

export interface SnomedLoadedRelease {
  edition: string;
  version_date: string;
  module_ids: string[];
  imported_at: string | null;
}

export interface SnomedStatus {
  loaded: boolean;
  releases: SnomedLoadedRelease[];
  licence_notice: string;
}

export interface SnomedImportStarted {
  release: SnomedRelease;
  already_imported: boolean;
}

export interface SnomedImportFile {
  file_name: string;
  size_bytes: number;
}

export interface SnomedImportFiles {
  directory_configured: boolean;
  files: SnomedImportFile[];
}

export interface SnomedConceptHit {
  concept_id: string;
  preferred_term: string | null;
  fsn: string | null;
  semantic_tag: string | null;
  active: boolean;
  matched_term: string | null;
}

export interface SnomedSearchResponse {
  loaded: boolean;
  results: SnomedConceptHit[];
}

export interface SnomedSearchParams {
  q: string;
  limit?: number;
  active_only?: boolean;
  semantic_tag?: string;
  refset?: string;
  lang?: string;
}

export interface SnomedConceptSummary {
  concept_id: string;
  preferred_term: string | null;
  semantic_tag: string | null;
  active: boolean;
}

export interface SnomedDescriptionRow {
  description_id: string;
  term: string;
  language_code: string;
  description_type: "fsn" | "synonym";
  acceptability: "preferred" | "acceptable" | null;
}

export interface SnomedConceptDetail {
  concept_id: string;
  active: boolean;
  effective_time: string;
  module_id: string;
  fully_defined: boolean;
  fsn: string | null;
  preferred_term: string | null;
  semantic_tag: string | null;
  descriptions: SnomedDescriptionRow[];
  parents: SnomedConceptSummary[];
  children: SnomedConceptSummary[];
  children_count: number;
  descendant_count: number;
}

export interface SnomedHierarchyResponse {
  concepts: SnomedConceptSummary[];
  total: number;
}

export interface SnomedSubsumption {
  sub: string;
  sup: string;
  is_a: boolean;
}

export interface SnomedEclResult {
  concepts: SnomedConceptSummary[];
  total: number;
  total_capped: boolean;
}

export interface SnomedConceptCount {
  concept_id: string;
  records: number;
  patients: number;
  coded_records: number;
  unknown_codes: number;
  icd_only_records: number;
}

export interface SnomedRollupRow {
  concept_id: string;
  preferred_term: string | null;
  semantic_tag: string | null;
  records: number;
  patients: number;
}

export interface SnomedRollup {
  parent_id: string;
  categories: SnomedRollupRow[];
}
