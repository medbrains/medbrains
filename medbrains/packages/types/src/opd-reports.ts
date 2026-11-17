// OPD reports screen (GET /api/opd/reports/summary): counts only, no patient identifiers.

/** The range's four tiles: the sum of its day rows. */
export interface OpdReportTotals {
  visits: number;
  registrations: number;
  new_patients: number;
  repeat_patients: number;
}

/** One day of the range; a day with no visits is a row of zeros. */
export interface OpdReportDay {
  date: string;
  visits: number;
  registrations: number;
  new: number;
  repeat: number;
}

/** Visits by doctor; a visit with no doctor yet has no id. */
export interface OpdReportDoctor {
  doctor_id: string | null;
  doctor_name: string | null;
  visits: number;
}

export interface OpdReportSummary {
  totals: OpdReportTotals;
  by_day: OpdReportDay[];
  by_doctor: OpdReportDoctor[];
}

export interface OpdReportResponse {
  data: OpdReportSummary;
}
