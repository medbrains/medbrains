// Automatic charges a clinical action could not post, waiting on the billing
// desk (crates/medbrains-billing/src/charge_attention.rs, migration 1411).

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
  /** Error class only, e.g. `charge_failed:database`, `billing_setting_unreadable`. */
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
}

export interface DismissChargeAttentionRequest {
  reason: string;
}
