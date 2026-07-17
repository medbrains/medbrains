// Pharmacy phase-3 types — split from index.ts, barrel-re-exported.
import type { PharmacyPaymentMode } from "./index";

// ── Pharmacy Phase 3 ──────────────────────────────────────

export type PharmacyRxStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "on_hold"
  | "dispensing"
  | "dispensed"
  | "partially_dispensed"
  | "cancelled";
export interface PharmacyPrescriptionRx {
  id: string;
  tenant_id: string;
  prescription_id: string;
  patient_id: string;
  encounter_id: string;
  doctor_id: string;
  source: string;
  status: PharmacyRxStatus;
  priority: string;
  pharmacy_order_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  allergy_check_done: boolean;
  interaction_check_done: boolean;
  interaction_check_result?: unknown;
  store_location_id?: string;
  received_at: string;
  created_at: string;
  updated_at: string;
}

export interface RxQueueRow {
  id: string;
  prescription_id: string;
  patient_id: string;
  patient_name: string;
  doctor_name: string;
  source: string;
  status: PharmacyRxStatus;
  priority: string;
  received_at: string;
  allergy_count: number;
}

export interface PharmacyRxDetailItem {
  id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  instructions: string | null;
  quantity: number;
  catalog_item_id: string | null;
  unit_price: number;
  tax_percent: number;
  taxable_amount: number;
  tax_amount: number;
  line_total: number;
  price_source: "catalog" | "unmatched";
}

export interface PharmacyRxDetailResponse {
  prescription: PharmacyPrescriptionRx;
  items: PharmacyRxDetailItem[];
  allergies: unknown[];
}

export interface PharmacyRxReviewItemInput {
  prescription_item_id: string;
  catalog_item_id?: string | null;
  quantity: number;
  unit_price: number;
}

export interface ReviewPharmacyPrescriptionRequest {
  action: string;
  notes?: string;
  rejection_reason?: string;
  items?: PharmacyRxReviewItemInput[];
}

export interface PharmacyPosSale {
  id: string;
  tenant_id: string;
  sale_number: string;
  pharmacy_order_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_phone?: string;
  subtotal: number;
  discount_amount: number;
  discount_percent?: number;
  gst_amount: number;
  total_amount: number;
  payment_mode: PharmacyPaymentMode;
  payment_reference?: string;
  amount_received: number;
  change_due: number;
  receipt_number?: string;
  receipt_printed: boolean;
  pricing_tier: string;
  sold_by: string;
  store_location_id?: string;
  billing_invoice_id?: string;
  billing_posted_at?: string;
  status?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancel_reason?: string;
  refund_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface PharmacyPosSaleItem {
  id: string;
  tenant_id: string;
  pos_sale_id: string;
  order_item_id?: string;
  catalog_item_id?: string;
  drug_name: string;
  batch_id?: string;
  batch_number?: string;
  hsn_code?: string;
  quantity: number;
  mrp: number | string;
  selling_price: number | string;
  gst_rate: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  line_total: number | string;
  created_at: string;
  is_cancelled?: boolean;
  cancelled_qty?: number;
  cancel_reason?: string;
}

export interface PharmacyPricingTier {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  tier_name: string;
  price: number;
  effective_from: string;
  effective_to?: string;
  created_by: string;
  created_at: string;
}

export interface PosDaySummary {
  total_sales: number;
  total_revenue: number;
  cash_total: number;
  card_total: number;
  upi_total: number;
  gst_collected: number;
}

// ══════════════════════════════════════════════════════════
//  Payment Gateway
// ══════════════════════════════════════════════════════════

export interface PaymentGatewayTransaction {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  pharmacy_pos_sale_id: string | null;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  upi_vpa: string | null;
  card_last4: string | null;
  card_network: string | null;
  bank_name: string | null;
  wallet: string | null;
  error_code: string | null;
  error_description: string | null;
  refund_id: string | null;
  refund_amount: number | null;
  notes: Record<string, unknown>;
  webhook_payload: Record<string, unknown> | null;
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentOrderRequest {
  invoice_id?: string;
  pos_sale_id?: string;
  amount: number;
  currency?: string;
  receipt?: string;
}

export interface CreatePaymentOrderResponse {
  transaction_id: string;
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  status: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentStatusResponse {
  transaction: PaymentGatewayTransaction;
}

export interface GenerateUpiQrRequest {
  amount: number;
  invoice_id?: string;
  pos_sale_id?: string;
  description?: string;
}

export interface UpiQrResponse {
  upi_uri: string;
  vpa: string;
  amount: number;
  transaction_ref: string;
}

export interface InitiateRefundRequest {
  transaction_id: string;
  amount?: number;
  reason?: string;
}

export interface RefundGatewayResponse {
  transaction: PaymentGatewayTransaction;
  refund_id: string;
}

export interface RazorpayStatusResponse {
  configured: boolean;
  mode: string;
  source: string;
  key_id_prefix?: string;
  webhook_configured: boolean;
}

export interface PaymentProviderInfo {
  provider: string;
  label: string;
  configured: boolean;
  active: boolean;
  has_adapter: boolean;
  mode?: string;
  webhook_configured: boolean;
  methods: string[];
}

export interface PaymentProvidersResponse {
  active_provider: string;
  providers: PaymentProviderInfo[];
}

export interface OAuthProviderInfo {
  provider: string;
  label: string;
  scopes: string;
  connected: boolean;
  external_account_id?: string | null;
  status?: string | null;
}

export interface OAuthAuthorizeResponse {
  authorize_url: string;
  state: string;
}

export interface OAuthConnection {
  id: string;
  tenant_id: string;
  provider: string;
  grant_type: string;
  token_type: string;
  scope?: string | null;
  expires_at?: string | null;
  external_account_id?: string | null;
  status: string;
  last_error?: string | null;
  connected_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthExchangeRequest {
  code: string;
  redirect_uri: string;
}

export interface TeleConsultation {
  id: string;
  tenant_id: string;
  appointment_id?: string | null;
  encounter_id?: string | null;
  patient_id: string;
  doctor_id: string;
  room_id: string;
  provider: string;
  meeting_url?: string | null;
  status: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  doctor_notes?: string | null;
  cancel_reason?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/** Worklist row — omits `doctor_notes` (shown only in the detail view). */
export interface TeleConsultationListItem {
  id: string;
  tenant_id: string;
  appointment_id?: string | null;
  encounter_id?: string | null;
  patient_id: string;
  doctor_id: string;
  room_id: string;
  provider: string;
  meeting_url?: string | null;
  status: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  cancel_reason?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeleJoinInfo {
  consultation_id: string;
  room_id: string;
  join_url: string;
  display_name: string;
  status: string;
}

export interface CreateTeleConsultationRequest {
  patient_id: string;
  doctor_id?: string;
  appointment_id?: string;
  encounter_id?: string;
  scheduled_at?: string;
  provider?: string;
  meeting_url?: string;
}

export interface UpdateTeleStatusRequest {
  status: string;
  doctor_notes?: string;
  cancel_reason?: string;
}

export interface PosSaleRequest {
  terminal_id: string;
  invoice_id?: string;
  pos_sale_id?: string;
  amount: number;
}

export interface PosSaleResponse {
  transaction_id: string;
  provider: string;
  status: string;
}

export interface CreateVirtualAccountRequest {
  invoice_id: string;
  amount?: number;
}

export interface CreateVirtualAccountResponse {
  transaction_id: string;
  status: string;
}

export interface PaymentWebhookException {
  id: string;
  tenant_id?: string | null;
  provider: string;
  order_ref?: string | null;
  reason: string;
  amount?: number | null;
  raw_payload: unknown;
  status: string;
  notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface ResolveExceptionRequest {
  status: string;
  notes?: string;
}

export interface ReconStatusRow {
  status: string;
  txn_count: number;
  total_amount: number;
}

export interface ReconSummary {
  by_status: ReconStatusRow[];
  open_exceptions: number;
}

export interface PaymentTerminal {
  id: string;
  tenant_id: string;
  provider: string;
  kind: string;
  terminal_code?: string | null;
  acquiring_bank?: string | null;
  counter_id?: string | null;
  location_id?: string | null;
  label: string;
  mode: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentTerminalRequest {
  provider: string;
  kind?: string;
  terminal_code?: string;
  acquiring_bank?: string;
  counter_id?: string;
  location_id?: string;
  label: string;
  mode?: string;
}

export interface UpdatePaymentTerminalRequest {
  kind?: string;
  terminal_code?: string;
  acquiring_bank?: string;
  counter_id?: string;
  location_id?: string;
  label?: string;
  mode?: string;
  is_active?: boolean;
}

// ══════════════════════════════════════════════════════════════
//  Orchestration Engine
// ══════════════════════════════════════════════════════════════

export interface EventRegistryRow {
  id: string;
  module: string;
  entity: string;
  action: string;
  event_code: string;
  description: string | null;
  payload_schema: Record<string, unknown>;
  is_system: boolean;
  phase: string;
  is_blocking: boolean;
  category: string;
  created_at: string;
}

export interface EventListResponse {
  events: EventRegistryRow[];
  total: number;
}

export interface ConnectorRow {
  id: string;
  tenant_id: string | null;
  connector_type: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  status: string;
  health_check_url: string | null;
  last_health_check: string | null;
  is_healthy: boolean | null;
  retry_config: Record<string, unknown>;
  rate_limit: Record<string, unknown>;
  stats: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectorRequest {
  connector_type: string;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
  health_check_url?: string;
  retry_config?: Record<string, unknown>;
  rate_limit?: Record<string, unknown>;
}

export interface UpdateConnectorRequest {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  status?: string;
  health_check_url?: string;
  retry_config?: Record<string, unknown>;
  rate_limit?: Record<string, unknown>;
}

export interface ConnectorHealthCheckResponse {
  connector_id: string;
  is_healthy: boolean;
}

export interface JobQueueRow {
  id: string;
  tenant_id: string;
  job_type: string;
  pipeline_id: string | null;
  execution_id: string | null;
  connector_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  max_retries: number;
  retry_count: number;
  next_retry_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  correlation_id: string | null;
  created_at: string;
}

export interface JobListResponse {
  jobs: JobQueueRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface JobStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  dead_letter: number;
  total: number;
}
