// Setup config types (CSV import, module-masters seeding, print templates) — split from index.ts, barrel-re-exported.

// ── CSV Import ──────────────────────────────────────────────

export interface CsvImportRow {
  values: string[];
}

export interface CsvImportRequest {
  headers: string[];
  rows: CsvImportRow[];
}

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ── Module Masters Seeding ──────────────────────────────────

export interface SeedModuleMastersRequest {
  module_code: string;
}

export interface SeedModuleMastersResponse {
  status: string;
  module?: string;
  message?: string;
  seeded: string[];
}

// ── Print Templates ─────────────────────────────────────────

export interface PrintTemplateRequest {
  template_type: string;
  header_text?: string;
  footer_text?: string;
  logo_position?: string;
  font_family?: string;
  font_size?: number;
  margin_top?: number;
  margin_bottom?: number;
  margin_left?: number;
  margin_right?: number;
  show_logo?: boolean;
  show_hospital_name?: boolean;
  show_hospital_address?: boolean;
  show_hospital_phone?: boolean;
  show_registration_no?: boolean;
  custom_css?: string;
}

export type PrintTemplateType =
  | "letterhead"
  | "prescription_pad"
  | "invoice"
  | "lab_report"
  | "discharge_summary";
