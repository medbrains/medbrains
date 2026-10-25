// Collect anywhere (#4885): dues by department and bill, one collection
// endpoint, and the billing entities and lanes behind them.
// Mirrors crates/medbrains-billing/src/collect/*.rs.

import type { Payment } from "./medication-timing";

/** The department a charge is collected by. */
export type BillingLaneName =
  | "registration"
  | "opd"
  | "lab"
  | "radiology"
  | "emergency"
  | "ipd"
  | "pharmacy";

export interface DueBill {
  invoice_id: string;
  invoice_number: string;
  status: string;
  legal_entity_id: string | null;
  entity_name: string | null;
  bill_group_id: string | null;
  encounter_id: string | null;
  admission_id: string | null;
  total_amount: string;
  paid_amount: string;
  balance: string;
  lanes: BillingLaneName[];
  can_collect: boolean;
}

export interface DueGroup {
  bill_group_id: string | null;
  bill_count: number;
  balance: string;
}

export interface LaneDue {
  lane: BillingLaneName;
  due: string;
  can_collect: boolean;
}

export interface DepartmentCharge {
  department_id: string | null;
  department_name: string | null;
  lane: BillingLaneName;
  charged: string;
}

export interface PatientDues {
  patient_id: string;
  amounts_hidden: boolean;
  total_due: string;
  collectable_due: string;
  this_department: LaneDue | null;
  bills: DueBill[];
  groups: DueGroup[];
  by_department: DepartmentCharge[];
}

export type CollectScope = "department" | "all";

export interface CollectTender {
  mode: string;
  amount?: number;
  reference?: string;
  /** An approved gateway, UPI QR or card-machine payment. */
  gateway_transaction_id?: string;
}

export interface CollectRequest {
  patient_id: string;
  scope: CollectScope;
  lane?: BillingLaneName;
  invoice_ids?: string[];
  tenders: CollectTender[];
  station_id?: string;
  shift_id?: string;
  /** The counter's free-text label, which day close still tallies by. */
  counter_id?: string;
  idempotency_key: string;
}

export interface CollectionReceipt {
  id: string;
  receipt_number: string;
  legal_entity_id: string | null;
  entity_name: string | null;
  amount: string;
  payment_id: string;
  invoice_id: string;
}

export interface CollectResult {
  collection_id: string;
  replayed: boolean;
  total_amount: string;
  station_id: string | null;
  shift_id: string | null;
  issued_invoice_ids: string[];
  payments: Payment[];
  receipts: CollectionReceipt[];
}

export interface BillingEntity {
  id: string;
  code: string;
  name: string;
  gstin: string | null;
  drug_licence: string | null;
  address: string | null;
  receipt_prefix: string;
  is_default: boolean;
  is_active: boolean;
}

export interface BillingEntityInput {
  code: string;
  name: string;
  gstin?: string | null;
  drug_licence?: string | null;
  address?: string | null;
  receipt_prefix: string;
  is_default?: boolean;
  is_active?: boolean;
}

export type BillingLaneMode = "individual" | "together";
export type FeeChargeAt = "checkin" | "complete";

export interface BillingLane {
  lane: BillingLaneName;
  legal_entity_id: string;
  entity_name: string | null;
  revenue_department_id: string | null;
  department_name: string | null;
  default_mode: BillingLaneMode;
  charge_at: FeeChargeAt;
  fee_amount: string | null;
}

export interface BillingLaneInput {
  legal_entity_id: string;
  revenue_department_id: string | null;
  default_mode: BillingLaneMode;
  charge_at: FeeChargeAt;
  fee_amount: number | null;
}

/** A patient with an open bill charged today — the cashier counter's list. */
export interface CounterOpenTodayRow {
  patient_id: string;
  /** Null for a caller who may not see patient names. */
  patient_name: string | null;
  uhid: string;
  bill_count: number;
  balance: string;
  last_charged_at: string;
}
