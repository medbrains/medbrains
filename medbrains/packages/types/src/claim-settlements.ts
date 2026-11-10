// Insurer settlements posted against bills under maker-checker
// (crates/medbrains-billing/src/claim_settlements.rs).

export type ClaimSettlementStatus = "pending" | "approved" | "rejected" | "reversed";
export type ClaimSettlementSource =
  | "manual"
  | "nhcx"
  | "bank"
  | "claim_update"
  | "import"
  | "backfill";
export type SettlementDeductionTreatment = "patient" | "write_off";

export interface SettlementDeduction {
  reason: string;
  amount: string;
  treatment: SettlementDeductionTreatment;
}

export interface ClaimSettlementPosting {
  id: string;
  insurance_claim_id: string;
  invoice_id: string;
  patient_id: string;
  source: ClaimSettlementSource;
  source_ref: string;
  payer: string | null;
  settled_amount: string;
  tds_amount: string;
  payment_reference: string | null;
  settlement_date: string | null;
  deductions: SettlementDeduction[];
  deduction_total: string;
  notes: string | null;
  status: ClaimSettlementStatus;
  needs_review: boolean;
  review_reason: string | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  recorded_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  posted_amount: string | null;
  excess_amount: string | null;
  payment_id: string | null;
  write_off_id: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  claim_number: string | null;
  claim_status: string;
  claim_amount: string | null;
  approved_amount: string | null;
  invoice_number: string;
  invoice_total: string;
  invoice_paid: string;
  patient_name: string;
  uhid: string;
}

export interface RecordClaimSettlementRequest {
  insurance_claim_id: string;
  settled_amount: number;
  tds_amount?: number;
  payment_reference: string;
  settlement_date: string;
  deductions: { reason: string; amount: number; treatment: SettlementDeductionTreatment }[];
  notes?: string;
}

export interface ApproveClaimSettlementRequest {
  accept_excess: boolean;
}

export interface ClaimSettlementReasonRequest {
  reason: string;
}

export interface ClaimSettlementBackfillResult {
  dry_run: boolean;
  claims: number;
  amount: string;
  filed: number;
}
