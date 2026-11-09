// Automatic charges a clinical action could not post, and orders done but never
// billed, stock used on a patient but never charged, and implants used with no
// patient named, waiting on the billing desk (crates/medbrains-billing/src/
// charge_attention.rs and leakage.rs, migrations 1411, 1416 and 1421).

export type ChargeAttentionStatus = "open" | "posted" | "dismissed";

export interface ChargeAttentionItem {
  id: string;
  source_module: string;
  setting_module: string;
  source_entity_id: string;
  /** Null only on an implant used with no patient named, until the desk names one. */
  patient_id: string | null;
  encounter_id: string | null;
  charge_code: string;
  quantity: number;
  description_override: string | null;
  unit_price_override: string | null;
  tax_percent_override: string | null;
  apply_concessions: boolean;
  /**
   * Error class only, e.g. `charge_failed:database`, `billing_setting_unreadable`;
   * `unbilled_order` for an order the leakage check found done but unbilled,
   * `unbilled_consumption` for stock used on a patient and never charged,
   * `implant_no_patient` for a consignment implant used on no named patient.
   */
  reason: string;
  status: ChargeAttentionStatus;
  invoice_id: string | null;
  dismiss_reason: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_by_name: string | null;
  created_at: string;
  patient_name: string | null;
  uhid: string | null;
  department_id: string | null;
  department_name: string | null;
  /** When the service was done (unbilled orders); the age counts from here. */
  service_at: string | null;
  /** Whole days since the service, or since it was queued. */
  age_days: number;
  /** Unit price × quantity; null when unpriced or hidden from the viewer. */
  amount: string | null;
  /**
   * On an implant used without a patient: who the implant registry has an implant
   * of the same batch for, near the usage date. A hint that it may be the same implant.
   */
  registry_patients?: string | null;
}

/** Which rows: care or stock never billed (leakage), or charges a module could not post. */
export type ChargeAttentionKind = "unbilled" | "failed";

/** Open rows the viewer may see, as one figure. */
export interface ChargeAttentionSummary {
  open_count: number;
  /** Sum of the priced open rows; null when amounts are hidden from the viewer. */
  open_amount: string | null;
  /** Open rows with no price, so the total is never read as complete. */
  unpriced_count: number;
}

/** What one run of the unbilled-orders check queued. */
export interface UnbilledScanResult {
  queued: number;
}

export interface DismissChargeAttentionRequest {
  reason: string;
  /**
   * On an implant used without a patient: the store record duplicates one already
   * made, so its unit goes back to stock and the vendor usage.
   */
  duplicate_usage?: boolean;
}

/** Name the patient a consignment implant was used on. */
export interface NamePatientChargeAttentionRequest {
  patient_id: string;
}
