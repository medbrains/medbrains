// ABDM Milestone 3 — records this hospital receives as a Health Information
// User. Mirrors crates/medbrains-server/src/routes/abdm/hiu/{requests,view}.rs.

/** ABDM's consent purposes. */
export type AbdmPurposeCode = "CAREMGT" | "BTG" | "PUBHLTH" | "HPAYMT" | "DSRCH" | "PATRQT";

export type AbdmConsentRequestStatus =
  | "requested"
  | "awaiting_patient"
  | "granted"
  | "denied"
  | "revoked"
  | "expired"
  | "failed";

export interface RaiseAbdmConsentRequest {
  purpose_code: AbdmPurposeCode;
  hi_types: string[];
  date_from: string;
  date_to: string;
  /** When the received copies must be erased (ABDM's `dataEraseAt`). */
  data_erase_at: string;
}

export interface AbdmConsentRequest {
  id: string;
  purpose_code: AbdmPurposeCode;
  hi_types: string[];
  date_from: string;
  date_to: string;
  data_erase_at: string;
  status: AbdmConsentRequestStatus;
  error: string | null;
  requester_name: string;
  requested_at: string;
  status_at: string;
  /** When ABDM was last asked where the request stands; null if never. */
  status_checked_at: string | null;
  records_received: number;
  /** Copies still held — zero once the consent is revoked or expires. */
  records_held: number;
}

export interface AbdmReceivedRecordItem {
  id: string;
  consent_request_id: string;
  hi_type: string | null;
  care_context_reference: string;
  source_hip_id: string;
  source_hip_name: string | null;
  record_date: string | null;
  title: string | null;
  received_at: string;
  erase_at: string;
}

export interface AbdmHiuPatientView {
  configured: boolean;
  /** Why records cannot be requested, in words for staff. */
  blocked_reason: string | null;
  requests: AbdmConsentRequest[];
  records: AbdmReceivedRecordItem[];
}

export interface AbdmReceivedRecord {
  id: string;
  patient_id: string;
  hi_type: string | null;
  care_context_reference: string;
  source_hip_id: string;
  source_hip_name: string | null;
  received_at: string;
  erase_at: string;
  /** The FHIR document bundle as the other facility sent it. */
  bundle: unknown;
}

/** This hospital as an HIU, for the month. */
export interface AbdmHiuCounts {
  requests: number;
  granted: number;
  denied: number;
  records_received: number;
  /** Granted consents that brought records from another facility (DHIS). */
  dhis_eligible_consents: number;
}
