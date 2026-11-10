// ABDM Milestone 2 — records this hospital shares as a Health Information
// Provider. Mirrors crates/medbrains-server/src/routes/abdm/hip/records.rs.

import type { AbdmHiuCounts } from "./abdm-hiu";

export type AbdmLinkStatus = "not_linked" | "linking" | "linked" | "failed";

export interface AbdmCareContext {
  id: string;
  patient_id: string;
  source_kind:
    | "opd_consult"
    | "prescription"
    | "lab_report"
    | "discharge_summary"
    | "immunization"
    | "wellness"
    | "health_document"
    | "invoice";
  reference_number: string;
  display: string;
  hi_types: string[];
  record_date: string;
  link_status: AbdmLinkStatus;
  linked_at: string | null;
  linked_via: "hip_initiated" | "user_initiated" | null;
  last_error: string | null;
  /** DHIS category: 1 (diagnostic report, discharge summary) pays ₹10, 2 pays ₹5. */
  dhis_category: 1 | 2;
  /** When ABDM accepted the "new record" notice for the patient's app. */
  notified_at: string | null;
  /** Why ABDM did not accept that notice, when it did not. */
  notify_error: string | null;
  /** NRCeS profile rules its FHIR bundle broke when last sent; empty when clean. */
  conformance_issues: string[];
}

export interface AbdmConsentArtefact {
  id: string;
  consent_id: string;
  hiu_id: string | null;
  purpose_text: string | null;
  hi_types: string[];
  date_from: string | null;
  date_to: string | null;
  data_erase_at: string | null;
  status: "GRANTED" | "REVOKED" | "EXPIRED" | "DENIED";
  notified_at: string;
}

export interface AbdmHealthTransfer {
  id: string;
  consent_id: string;
  entry_count: number;
  status: "requested" | "transferred" | "failed" | "refused";
  error: string | null;
  requested_at: string;
  transferred_at: string | null;
}

export interface AbdmPatientRecords {
  configured: boolean;
  abha_verified: boolean;
  hip_id: string | null;
  /** Why nothing links, in words for staff; null when linking can run. */
  blocked_reason: string | null;
  /** The patient has a mobile ABDM can text the ABHA app link to. */
  phone_on_file: boolean;
  /** The latest ABHA-app link texted to the patient, and ABDM's answer. */
  sms_link: AbdmSmsLink | null;
  care_contexts: AbdmCareContext[];
  consents: AbdmConsentArtefact[];
  transfers: AbdmHealthTransfer[];
}

/** ABDM's deep-link SMS to a patient with no ABHA here (HIP_INIT_NOTIFY_HIECM). */
export interface AbdmSmsLink {
  /** `sent` until ABDM answers; then `delivered` or `failed`. */
  status: "sent" | "delivered" | "failed";
  phone_last4: string;
  error: string | null;
  /** Sent when a record was captured, not by a member of staff. */
  automatic: boolean;
  created_at: string;
  answered_at: string | null;
}

/** A vaccine dose on the chart; the source of ABDM's ImmunizationRecord. */
export interface PatientImmunization {
  id: string;
  vaccine_name: string;
  vaccine_code: string | null;
  /** The schedule product it was recorded as. */
  vaccine_key: string | null;
  dose_number: number | null;
  administered_on: string;
  lot_number: string | null;
  manufacturer: string | null;
  route: ImmunizationRoute | null;
  site: string | null;
  given_elsewhere: boolean;
  notes: string | null;
  recorded_by_name: string | null;
  created_at: string;
  /** Struck off as wrong: when and why. */
  deleted_at: string | null;
  delete_reason: string | null;
}

export type ImmunizationRoute =
  | "intramuscular"
  | "subcutaneous"
  | "intradermal"
  | "oral"
  | "intranasal";

export interface RecordPatientImmunization {
  vaccine_name: string;
  vaccine_code?: string;
  vaccine_key?: string;
  dose_number?: number;
  administered_on: string;
  lot_number?: string;
  manufacturer?: string;
  route?: ImmunizationRoute;
  site?: string;
  given_elsewhere: boolean;
  encounter_id?: string;
  notes?: string;
}

export interface AbdmSharingFailure {
  id: string;
  patient_id: string;
  uhid: string;
  patient_name: string;
  display: string;
  link_status: AbdmLinkStatus;
  last_error: string | null;
  /** Sent, but its FHIR bundle broke these NRCeS profile rules. */
  conformance_issues: string[];
  updated_at: string;
}

export interface AbdmSharingCounts {
  linked_category_1: number;
  linked_category_2: number;
  eligible_category_1: number;
  eligible_category_2: number;
  linking: number;
  failed: number;
  not_linked: number;
  transfers: number;
}

export interface AbdmSharingSummary {
  month: string;
  configured: boolean;
  counts: AbdmSharingCounts;
  dhis_threshold: number;
  threshold_met: boolean;
  estimated_incentive_inr: number;
  failures: AbdmSharingFailure[];
  /** This hospital as an HIU (records requested from other facilities). */
  hiu: AbdmHiuCounts;
  /** ₹10 per eligible HIU consent, as DHIS pays it. */
  hiu_estimated_incentive_inr: number;
}
