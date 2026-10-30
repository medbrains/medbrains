/**
 * Storefront part 2 (#4864): stock holds, the stores that fill online
 * orders, substitutes with the doctor's and the patient's consent, the
 * outside-pharmacy print, returns by law, quarantine and destruction,
 * refunds, NPPA ceilings.
 */

import type { PatientIdentity } from "./medication-timing";

/** One step of a hold ladder: while online has at most `max_available` left (any, when null), hold for `minutes`. */
export interface HoldTier {
  max_available: number | null;
  minutes: number;
}

export interface HoldTiers {
  checkout: HoldTier[];
  review: HoldTier[];
}

export type DeliverySlotName = "morning" | "afternoon" | "evening";

export interface DeliverySlotRule {
  slot: DeliverySlotName;
  capacity: number;
}

/** A pharmacy named on the outside-pharmacy print, beside its disclosure. */
export interface OutsidePartner {
  name: string;
  address: string;
  phone: string;
  disclosure: string;
}

export interface StorefrontRules {
  hold_tiers: HoldTiers;
  max_days_supply: number;
  repeat_flag_days: number;
  free_delivery_above: string | number;
  cod_max_amount: string | number;
  delivery_slots: DeliverySlotRule[];
  outside_partner: OutsidePartner | null;
}

/** A location as the online-stores screen shows it. */
export interface OnlineStore {
  store_location_id: string;
  code: string;
  name: string;
  location_type: string;
  is_pharmacy: boolean;
  enabled: boolean;
  pincode: string | null;
  serviceable_pincodes: string[];
}

export interface OnlineStoreUpdate {
  enabled: boolean;
  pincode: string | null;
  serviceable_pincodes: string[];
}

export interface StorefrontFloorRow {
  id: string;
  code: string;
  name: string;
  online_reserve_floor: number | null;
  reorder_level: number;
  on_hand: number;
  held: number;
}

export interface StoreServiceability {
  multi_store: boolean;
  delivers: boolean;
  pickup_stores: { id: string; name: string; address: string | null }[];
}

export interface StoreHeldCart {
  store: string | null;
  held_until: string | null;
}

export type SubstitutionStatus =
  | "with_doctor"
  | "phone_pending"
  | "approved"
  | "declined"
  | "reverted"
  | "lapsed";

/** A substitute proposed for an online order line. */
export interface LineSubstitution {
  id: string;
  substitute_item_id: string;
  substitute_name: string;
  status: SubstitutionStatus;
  method: "sign_off" | "phone";
  reason: string;
  patient_consent: "accepted" | "declined" | null;
  confirm_due_at: string | null;
}

export interface SubstituteCandidate {
  id: string;
  name: string;
  price: string | null;
  stock: "available" | "low" | "out";
}

export interface SubstituteCandidates {
  /** Why this line can never be substituted, when it can't. */
  blocked: string | null;
  candidates: SubstituteCandidate[];
}

export interface ProposeSubstitution {
  catalog_item_id: string;
  substitute_item_id: string;
  reason: string;
  method: "sign_off" | "phone";
  phone_note?: string;
  patient_agreed_by_phone?: string;
}

/** A substitute as the doctor decides it, with the matches to choose from. */
export interface DoctorSubstitutionRequest {
  id: string;
  status: SubstitutionStatus;
  method: "sign_off" | "phone";
  reason: string;
  phone_note: string | null;
  confirm_due_at: string | null;
  original_item_id: string;
  original_name: string;
  substitute_item_id: string;
  substitute_name: string;
  patient_consent: "accepted" | "declined" | null;
  options: SubstituteCandidates | null;
}

export interface DoctorSubstitutionDecision {
  approve: boolean;
  substitute_item_id?: string;
  note?: string;
}

export interface OutsidePrintItem {
  name: string;
  generic_name: string | null;
  strength: string | null;
  form: string | null;
  quantity: number;
  directions: string | null;
}

export interface OutsidePrint {
  id: string;
  hospital_name: string;
  patient_name: string;
  uhid: string | null;
  prescribed_on: string | null;
  doctor_name: string | null;
  doctor_registration: string | null;
  items: OutsidePrintItem[];
  any_pharmacy: string;
  partner: OutsidePartner | null;
  printed_at: string;
}

export type StoreReturnReason = "wrong_item" | "damaged" | "short_dated" | "excess";

export interface StoreReturnRequest {
  lines: { catalog_item_id: string; quantity: number }[];
  reason: StoreReturnReason;
  note?: string;
}

export interface StoreReturnTicket {
  id: string;
  complaint_code: string | null;
  status: string;
  ack_due_at: string;
  resolve_due_at: string;
}

export interface StoreReturnLine {
  id: string;
  drug_name: string;
  quantity: number;
  unit_price: string;
  sealed: boolean | null;
  disposition: "restocked" | "quarantined" | null;
  reasons: string[];
}

export interface StoreReturnRow {
  id: string;
  store_order_id: string;
  patient_id: string;
  reason: StoreReturnReason;
  note: string | null;
  status: "requested" | "acknowledged" | "received" | "refused";
  complaint_code: string | null;
  ack_due_at: string;
  resolve_due_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  credit_note_number: string | null;
  created_at: string;
  lines: StoreReturnLine[];
}

export interface StoreReturnQueue {
  returns: StoreReturnRow[];
  patients: PatientIdentity[];
}

export interface StoreReturnReceive {
  lines: { line_id: string; sealed: boolean }[];
  note?: string;
}

export interface StoreRefund {
  id: string;
  store_order_id: string;
  cause: "cancelled" | "returned";
  amount: string;
  method: "online" | "cash";
  status: "pending" | "issued";
  due_by: string;
  refund_reference: string | null;
  issued_at: string | null;
  patient_id: string;
}

export interface QuarantineRow {
  id: string;
  source: "online" | "counter";
  drug_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  reasons: string[];
  route: "bmw" | "ndps";
  status: "quarantined" | "destroyed";
  certificate_number: string | null;
  created_at: string;
}

export interface QuarantineDestroyRequest {
  ids: string[];
  witness_user_id?: string;
  witness_name: string;
  cbmwtf_name?: string;
  cbmwtf_manifest_number?: string;
  notes?: string;
}

export interface QuarantineDestroyed {
  certificate_number: string;
  route: "bmw" | "ndps";
  quantity: number;
}

export interface NppaCeilingRow {
  id: string;
  code: string;
  name: string;
  strength: string | null;
  mrp: string | null;
  nppa_ceiling_price: string | null;
  nppa_notification: string | null;
  nppa_ceiling_source: "manual" | "import" | null;
  nppa_updated_at: string | null;
}

export interface NppaCeilings {
  rows: NppaCeilingRow[];
  source_note: string;
}

export interface NppaCeilingUpdate {
  ceiling_price: string | number | null;
  notification?: string;
}

export interface NppaImportRow {
  code: string;
  ceiling_price: string | number;
  notification?: string;
}

export interface NppaImported {
  updated: number;
  unmatched: string[];
}

export interface CounterReturnPolicy {
  window_days: number;
  text: string;
}
