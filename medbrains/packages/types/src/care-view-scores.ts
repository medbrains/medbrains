/**
 * Clinical assessment scores recorded against a patient.
 *
 * The Care View calculators computed a number and discarded it. An Aldrete is
 * the evidence a patient was fit to leave recovery, and NEWS2 only means
 * anything as a trend — neither survives being arithmetic.
 *
 * Stored in `icu_scores`, a general assessment record named for where it
 * started; migration 1011 widened its enum so ward scores live there too.
 */
export interface ClinicalScoreRow {
  id: string;
  admission_id: string;
  score_type: string;
  score_value: number;
  /** The inputs the total came from. A score without them cannot be reviewed. */
  score_details: Record<string, unknown> | null;
  scored_at: string;
  scored_by: string;
  scored_by_name: string | null;
  notes: string | null;
}

export interface RecordScoreRequest {
  score_type: string;
  score_value: number;
  score_details?: Record<string, unknown>;
  notes?: string;
}
