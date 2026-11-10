// The paperless meter (`medbrains_analytics::paperless`). Every share is a
// percentage, or null when there is nothing under it: no documents is not 0%.

/** Counts behind the shares. */
export interface PaperlessCounts {
  created: number;
  signed: number;
  scanned: number;
  printed: number;
}

/** One day of the trend; a day never counted has no counts. */
export interface PaperlessDay {
  date: string;
  measured: boolean;
  counts: PaperlessCounts | null;
  digital_pct: number | null;
  signed_pct: number | null;
}

/** One department's row; a null id is "no department". */
export interface PaperlessDepartment {
  department_id: string | null;
  name: string;
  counts: PaperlessCounts;
  digital_pct: number | null;
  signed_pct: number | null;
}

/** One document type's row. */
export interface PaperlessDocType {
  doc_type: string;
  label: string;
  created: number;
  signed: number;
  signed_pct: number | null;
}

/** The legally-signed share: 0% of a known count while no provider exists. */
export interface PaperlessLegal {
  signed: number;
  pct: number | null;
  provider_connected: boolean;
  note: string;
}

/** `GET /api/analytics/paperless`. */
export interface PaperlessReport {
  from: string;
  to: string;
  days: number;
  measured_days: number;
  last_counted_at: string | null;
  totals: PaperlessCounts;
  digital_pct: number | null;
  signed_pct: number | null;
  legal: PaperlessLegal;
  summary: string;
  series: PaperlessDay[];
  departments: PaperlessDepartment[];
  doc_types: PaperlessDocType[];
  not_counted: string[];
  /** Sources a recount in this range could not count, and on how many days. */
  could_not_count: string[];
}

/** Query of `GET /api/analytics/paperless`. */
export interface PaperlessQuery {
  from?: string;
  to?: string;
  /** Days ending `to` when `from` is absent. */
  days?: number;
}

/** `POST /api/analytics/paperless/refresh`. */
export interface PaperlessRebuilt {
  from: string;
  to: string;
  rows: number;
  skipped: string[];
}
