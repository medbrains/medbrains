// ABDM Milestone 2 — records this hospital shares as a Health Information
// Provider. Mirrors crates/medbrains-server/src/routes/abdm/hip/records.rs.

export type AbdmLinkStatus = "not_linked" | "linking" | "linked" | "failed";

export interface AbdmCareContext {
  id: string;
  patient_id: string;
  source_kind: "opd_consult" | "prescription" | "lab_report" | "discharge_summary";
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
  care_contexts: AbdmCareContext[];
  consents: AbdmConsentArtefact[];
  transfers: AbdmHealthTransfer[];
}

export interface AbdmSharingFailure {
  id: string;
  patient_id: string;
  uhid: string;
  patient_name: string;
  display: string;
  link_status: AbdmLinkStatus;
  last_error: string | null;
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
}
