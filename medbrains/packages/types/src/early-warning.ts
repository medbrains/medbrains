// Early-warning scores computed from charted vitals
// (crates/medbrains-clinical-scores/src/ews, crates/medbrains-nursing/src/nurse_ews*.rs).

export type EwsTool = "news2" | "pews" | "meows";
export type EwsBand = "routine" | "low" | "low_medium" | "urgent" | "emergency";
export type EwsZone = "white" | "yellow" | "orange" | "red" | "blue";
export type Consciousness = "A" | "C" | "V" | "P" | "U";
export type OxygenDevice = "room_air" | "nasal_prongs" | "mask" | "high_flow" | "other";
export type RespiratoryDistress = "nil" | "mild" | "moderate" | "severe";
export type PewsAgeBand = "0-11m" | "1-4y" | "5-11y" | "12+y";

export interface EwsParamScore {
  name: string;
  score: number;
  zone: EwsZone;
}

/** The score returned with a newly charted reading. */
export interface EwsView {
  tool: EwsTool;
  total: number;
  band: EwsBand;
  incomplete: boolean;
  missing: string[];
  params: EwsParamScore[];
  spo2_scale: 1 | 2 | null;
  age_band: PewsAgeBand | null;
  next_due_at: string;
  escalation_id: string | null;
}

/** What the scores need beyond the classic vitals. */
export interface EwsScoringInputs {
  consciousness?: Consciousness;
  oxygen_device?: OxygenDevice;
  oxygen_flow_lpm?: number;
  fio2_percent?: number;
  capillary_refill_seconds?: number;
  respiratory_distress?: RespiratoryDistress;
}

/** The score stored on a reading, as the vitals list returns it. */
export interface EwsReadingFields {
  consciousness?: Consciousness | null;
  oxygen_device?: OxygenDevice | null;
  oxygen_flow_lpm?: string | null;
  fio2_percent?: number | null;
  capillary_refill_seconds?: string | null;
  respiratory_distress?: RespiratoryDistress | null;
  ews_tool?: EwsTool | null;
  ews_total?: number | null;
  ews_band?: EwsBand | null;
  ews_incomplete?: boolean | null;
  ews_missing?: string[] | null;
  ews_params?: EwsParamScore[] | null;
  ews_spo2_scale?: number | null;
  ews_age_band?: PewsAgeBand | null;
  ews_next_due_at?: string | null;
}

export type EwsResponseAction =
  | "bedside_review"
  | "medical_review"
  | "plan_changed"
  | "rapid_response_called"
  | "transfer_higher_care"
  | "other";

export interface EwsEscalation {
  id: string;
  encounter_id: string;
  admission_id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  ward_name: string | null;
  bed_name: string | null;
  ews_tool: EwsTool;
  ews_total: number;
  band: EwsBand;
  incomplete: boolean;
  status: "open" | "acknowledged" | "superseded";
  level: number;
  created_at: string;
  next_escalation_at: string;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  response_action: EwsResponseAction | null;
  response_note: string | null;
}

export interface AcknowledgeEwsRequest {
  response_action: EwsResponseAction;
  response_note: string;
}

export interface EwsPlan {
  spo2_scale2: boolean;
  scale2_target: string | null;
  tool_override: EwsTool | null;
  reason: string | null;
  set_by_name: string | null;
  set_at: string | null;
}

export interface SetEwsPlanRequest {
  spo2_scale2: boolean;
  scale2_target?: string;
  tool_override?: EwsTool | null;
  reason: string;
}

export interface EwsBandMinutes {
  routine: number;
  low: number;
  low_medium: number;
  urgent: number;
  emergency: number;
}

export interface EwsPolicy {
  news2: EwsBandMinutes;
  pews: EwsBandMinutes;
  meows: EwsBandMinutes;
  incomplete_max_minutes: number;
  escalate_bands: EwsBand[];
  ack_minutes_urgent: number;
  ack_minutes_emergency: number;
  max_escalation_levels: number;
}
