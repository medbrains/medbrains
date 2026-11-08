// Automatic charges a clinical action could not post, and orders done but never
// billed, waiting on the billing desk (crates/medbrains-billing/src/
// charge_attention.rs and leakage.rs, migrations 1411 and 1416).

export type ChargeAttentionStatus = "open" | "posted" | "dismissed";

export interface ChargeAttentionItem {
  id: string;
  source_module: string;
  setting_module: string;
  source_entity_id: string;
  patient_id: string;
  encounter_id: string | null;
  charge_code: string;
  quantity: number;
  description_override: string | null;
  unit_price_override: string | null;
  tax_percent_override: string | null;
  apply_concessions: boolean;
  /**
   * Error class only, e.g. `charge_failed:database`, `billing_setting_unreadable`;
   * `unbilled_order` for an order the leakage check found done but unbilled.
   */
  reason: string;
  status: ChargeAttentionStatus;
  invoice_id: string | null;
  dismiss_reason: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_by_name: string | null;
  created_at: string;
  patient_name: string;
  uhid: string;
  department_id: string | null;
  department_name: string | null;
  /** When the service was done (unbilled orders); the age counts from here. */
  service_at: string | null;
  /** Whole days since the service, or since it was queued. */
  age_days: number;
  /** Unit price × quantity; null when unpriced or hidden from the viewer. */
  amount: string | null;
}

/** Which rows: orders done but never billed, or charges a module could not post. */
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
}
