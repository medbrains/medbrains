// The insurance desk's rows on the leakage inbox (revenue integrity RFC wave
// 1.3 and 1.4): pre-auths nearly used up and rooms above the policy limit
// (crates/medbrains-billing/src/revenue_alerts.rs, migration 1423), and the
// IPD room check before a bed is allocated
// (crates/medbrains-server-services/src/room_eligibility.rs).

export type RevenueAlertKind = "preauth_used_up" | "room_over_limit";

export interface RevenueAlert {
  id: string;
  kind: RevenueAlertKind;
  /** The `_unknown` reasons are faults: the check could not be made. */
  reason:
    | "preauth_used_up"
    | "preauth_approval_unknown"
    | "room_over_limit"
    | "room_eligibility_unknown";
  status: "open" | "actioned" | "dismissed";
  source_entity_id: string;
  patient_id: string;
  encounter_id: string | null;
  patient_name: string;
  uhid: string;
  payer: string | null;
  pa_number: string | null;
  /** The pre-auth's approved amount now, not as when the row was raised. */
  approved_amount: string | null;
  /** The extra amount already asked for, when an enhancement is pending. */
  enhancement_amount: string | null;
  /** Running bill (pre-auth) or expected cut (room); null when hidden. */
  amount: string | null;
  evidence: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
}

export interface RequestEnhancementRequest {
  additional_amount: number;
  note?: string;
}

/** The family's agreement to pay the cut for a room above the policy limit. */
export interface RoomConsentInput {
  consented_by_name: string;
  consenter_relation: string;
  estimated_bill?: number;
  /** A second member of staff who saw the family agree. */
  witness_user_id: string;
  /** The disclosure wording shown (`ROOM_DISCLOSURE_VERSION`). */
  disclosure_version: string;
}

/** A member of staff who may witness a room consent. */
export interface RoomConsentWitness {
  id: string;
  full_name: string;
  role: string;
}

export type RoomCheckStatus =
  | "not_insured"
  | "no_limit"
  | "limit_unknown"
  | "unpriced"
  | "icu"
  | "no_differential_billing"
  | "within"
  | "above";

export interface RoomCheck {
  status: RoomCheckStatus;
  patient_insurance_id: string | null;
  insurance_provider: string | null;
  room_rate: string | null;
  eligible_rate: string | null;
  /** Share of room-linked charges the insurer may pay; only when above. */
  payable_ratio: string | null;
  associated_so_far: string | null;
}

/** A policy's eligible room rent; both empty clears it. */
export interface RoomRentLimitInput {
  room_rent_limit_per_day: number | null;
  room_rent_limit_percent: number | null;
}

export interface RoomRentLimit {
  id: string;
  room_rent_limit_per_day: string | null;
  room_rent_limit_percent: string | null;
}
