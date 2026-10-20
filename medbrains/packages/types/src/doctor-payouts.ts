// Doctor payouts (#4886): agreements, rate cards, the earnings ledger,
// statements, payouts, day settlement, reports. Money is a decimal string.

export type PayoutBasis = "billed" | "collected" | "realised";
export type PayoutBearer = "hospital" | "doctor" | "pro_rata";
export type PayoutEngagement =
  | "salaried"
  | "retainer"
  | "fee_for_service"
  | "visiting"
  | "day"
  | "on_call";
export type PayoutMode = "bank" | "upi" | "cash";

export interface DoctorPayoutSettings {
  default_basis: PayoutBasis;
  default_share_on: "gross" | "net";
  default_discount_bearer: PayoutBearer;
  default_disallowance_bearer: PayoutBearer;
  excluded_categories: string[];
  tds_section_code: string;
  tds_section_label: string;
  tds_rate: string;
  tds_no_pan_rate: string;
  tds_threshold: string;
  cash_daily_warn_limit: string;
  referral_enabled: boolean;
  referral_individuals_enabled: boolean;
  referral_tds_section_code: string;
  referral_tds_rate: string;
  referral_tds_threshold: string;
  updated_at: string;
}

export interface DoctorPayoutPolicyEvent {
  id: string;
  switch: "referral" | "referral_individuals";
  enabled: boolean;
  acknowledgement: string | null;
  acted_by: string;
  acted_by_name: string | null;
  created_at: string;
}

export interface DoctorPayoutSettingsView {
  settings: DoctorPayoutSettings;
  acknowledgements: { referral: string; referral_individuals: string };
  events: DoctorPayoutPolicyEvent[];
}

export type UpdateDoctorPayoutSettings = Omit<
  DoctorPayoutSettings,
  "referral_enabled" | "referral_individuals_enabled" | "updated_at"
>;

export interface ReferralSwitchRequest {
  switch: "referral" | "referral_individuals";
  enabled: boolean;
  acknowledgement?: string;
}

export interface DoctorAgreement {
  id: string;
  doctor_id: string;
  doctor_name: string | null;
  plan_id: string;
  plan_name: string | null;
  plan_code: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  engagement_type: PayoutEngagement;
  accrual_basis: PayoutBasis | null;
  share_on: "gross" | "net" | null;
  discount_bearer: PayoutBearer | null;
  disallowance_bearer: PayoutBearer | null;
  charity_rule: "zero" | "full" | "fixed";
  charity_fixed_amount: string | null;
  session_minimum: string | null;
  settlement_cycle: "same_day" | "monthly";
  tds_section_code: string | null;
  pan: string | null;
  payout_mode: PayoutMode;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi_vpa: string | null;
  notes: string | null;
  updated_at: string;
}

export interface DoctorAgreementInput {
  doctor_id: string;
  plan_id: string;
  effective_from: string;
  effective_to?: string | null;
  is_active?: boolean;
  engagement_type: PayoutEngagement;
  accrual_basis?: PayoutBasis | null;
  share_on?: "gross" | "net" | null;
  discount_bearer?: PayoutBearer | null;
  disallowance_bearer?: PayoutBearer | null;
  charity_rule: "zero" | "full" | "fixed";
  charity_fixed_amount?: string | null;
  session_minimum?: string | null;
  settlement_cycle: "same_day" | "monthly";
  tds_section_code?: string | null;
  pan?: string | null;
  payout_mode: PayoutMode;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  upi_vpa?: string | null;
  notes?: string | null;
}

export interface PayoutRateCard {
  id: string;
  plan_name: string;
  plan_code: string;
  description: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  version: number;
  frozen_at: string | null;
  supersedes_id: string | null;
  rule_count: number;
}

export interface CreatePayoutRateCard {
  plan_name: string;
  plan_code: string;
  description?: string | null;
  effective_from: string;
  effective_to?: string | null;
}

export type PayoutRole = "primary" | "assistant" | "anaesthetist";

export interface PayoutRule {
  id: string;
  plan_id: string;
  rule_name: string;
  service_type: string | null;
  match_charge_code: string | null;
  department_id: string | null;
  payer_class: string | null;
  visit_kind: "first" | "follow_up" | null;
  role: PayoutRole;
  calc_kind: "percent" | "fixed";
  percentage: string | null;
  fixed_amount: string | null;
  min_threshold: string | null;
  max_threshold: string | null;
}

export interface PayoutRuleInput {
  rule_name: string;
  category?: string | null;
  charge_code?: string | null;
  department_id?: string | null;
  payer_class?: string | null;
  visit_kind?: string | null;
  role: PayoutRole;
  calc_kind: "percent" | "fixed";
  percentage?: string | null;
  fixed_amount?: string | null;
  cap_min?: string | null;
  cap_max?: string | null;
}

export interface PayoutCalcInput {
  charge_code: string;
  category: string;
  department_id?: string | null;
  payer_class: string;
  visit_kind?: string | null;
  role: PayoutRole;
  quantity: number;
  gross: string;
  discount: string;
  share_on?: "gross" | "net" | null;
  discount_bearer?: PayoutBearer | null;
}

export interface PayoutCalcResult {
  rule: PayoutRule | null;
  base: string;
  amount: string;
}

export interface PayoutLedgerLine {
  id: string;
  doctor_id: string | null;
  doctor_name: string | null;
  event: string;
  basis: PayoutBasis | null;
  role: string;
  service_date: string;
  description: string | null;
  invoice_number: string | null;
  patient: string | null;
  payer_class: string | null;
  line_amount: string;
  base_amount: string;
  share_amount: string;
  fraction: string;
  amount: string;
  reason: string | null;
  created_at: string;
}

export interface PayoutLedgerQuery {
  doctor_id?: string;
  from: string;
  to: string;
  event?: string;
}

export type PayoutStatementStatus =
  | "draft"
  | "disputed"
  | "approved"
  | "paid"
  | "superseded"
  | "cancelled";

export interface PayoutStatement {
  id: string;
  kind: "monthly" | "same_day" | "referral";
  status: PayoutStatementStatus;
  version: number;
  supersedes_id: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  referral_doctor_id: string | null;
  partner_name: string | null;
  agreement_id: string | null;
  period_start: string;
  period_end: string;
  incentive_amount: string | null;
  adjustments_total: string;
  session_minimum_total: string;
  tds_section: string | null;
  tds_rate: string | null;
  tds_base: string;
  tds_amount: string;
  net_payable: string | null;
  payee_pan: string | null;
  financial_year: string | null;
  prepared_by: string | null;
  prepared_by_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  disputed_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
}

export interface PayoutStatementDetail {
  statement: PayoutStatement;
  lines: PayoutLedgerLine[];
}

export interface PreparePayoutStatement {
  doctor_id: string;
  period_start: string;
  period_end: string;
}

export interface ReferralStatementRequest {
  referral_doctor_id: string;
  period_start: string;
  period_end: string;
}

export interface DoctorPayout {
  id: string;
  statement_id: string;
  run_id: string;
  mode: PayoutMode;
  provider: "manual" | "bank_file" | "razorpayx";
  amount: string;
  status: "pending" | "processing" | "paid" | "failed" | "reversed";
  provider_ref: string | null;
  utr: string | null;
  warning: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
  payee_name: string | null;
  statement_kind: string;
}

export interface RunPayoutsRequest {
  statement_ids: string[];
  provider: "bank_file" | "razorpayx" | "manual";
  mode?: PayoutMode;
  reference?: string;
}

export interface RunPayoutsResult {
  run_id: string;
  warnings: string[];
}

export interface PayoutBankFile {
  filename: string;
  rows: number;
  csv: string;
}

export interface DaySettlementSummary {
  doctor_id: string;
  date: string;
  has_agreement: boolean;
  engagement_type: PayoutEngagement | null;
  payout_mode: PayoutMode | null;
  session_minimum: string | null;
  lines: PayoutLedgerLine[];
  earned: string;
  session_topup: string;
  total: string;
  cash_paid_today: string;
  cash_limit: string;
  cash_warning: string | null;
}

export interface SettleDayRequest {
  doctor_id: string;
  date: string;
  mode: "cash" | "upi" | "bank" | "roll";
  reference?: string;
}

export interface SettleDayResult {
  rolled?: boolean;
  statement?: PayoutStatement;
  payout_id?: string;
  warning?: string | null;
}

export interface DoctorPayoutSummaryRow {
  doctor_id: string;
  doctor_name: string;
  revenue: string;
  earned: string;
  paid: string;
  tds: string;
  awaiting_payment: string;
}

export interface PayoutTdsRow {
  statement_id: string;
  kind: string;
  payee_name: string | null;
  payee_pan: string | null;
  tds_section: string | null;
  tds_rate: string | null;
  gross: string | null;
  tds_base: string;
  tds_amount: string;
  paid_at: string | null;
  quarter: string | null;
  tds_status: string | null;
  challan_number: string | null;
}

export interface ReferralComplianceRow {
  statement_id: string;
  partner_name: string | null;
  partner_kind: string | null;
  payee_pan: string | null;
  period_start: string;
  period_end: string;
  commission: string | null;
  tds_amount: string;
  status: string;
  prepared_by_name: string | null;
  approved_by_name: string | null;
  paid_at: string | null;
  payment_reference: string | null;
}

export interface ReferralComplianceReport {
  referral_enabled: boolean;
  referral_individuals_enabled: boolean;
  events: DoctorPayoutPolicyEvent[];
  rows: ReferralComplianceRow[];
}
