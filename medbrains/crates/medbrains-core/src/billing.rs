use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "invoice_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    Draft,
    Issued,
    PartiallyPaid,
    Paid,
    Cancelled,
    Refunded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "payment_mode", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PaymentMode {
    Cash,
    Card,
    Upi,
    BankTransfer,
    Cheque,
    Insurance,
    Credit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "charge_source", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ChargeSource {
    Opd,
    Ipd,
    Lab,
    Pharmacy,
    Procedure,
    Radiology,
    Manual,
    Ot,
    Emergency,
    Diet,
    Cssd,
    Ambulance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "gst_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum GstType {
    CgstSgst,
    Igst,
    Exempt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "advance_purpose", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AdvancePurpose {
    Admission,
    Prepaid,
    General,
    Procedure,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "advance_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AdvanceStatus {
    Active,
    PartiallyUsed,
    FullyUsed,
    Refunded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "insurance_scheme_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum InsuranceSchemeType {
    Private,
    Cghs,
    Echs,
    Pmjay,
    Esis,
    StateScheme,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChargeMaster {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub category: String,
    pub base_price: rust_decimal::Decimal,
    pub tax_percent: rust_decimal::Decimal,
    pub is_active: bool,
    pub hsn_sac_code: Option<String>,
    pub gst_category: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Invoice {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_number: String,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub status: InvoiceStatus,
    pub subtotal: rust_decimal::Decimal,
    pub tax_amount: rust_decimal::Decimal,
    pub discount_amount: rust_decimal::Decimal,
    pub total_amount: rust_decimal::Decimal,
    pub paid_amount: rust_decimal::Decimal,
    pub notes: Option<String>,
    pub issued_at: Option<DateTime<Utc>>,
    pub cgst_amount: rust_decimal::Decimal,
    pub sgst_amount: rust_decimal::Decimal,
    pub igst_amount: rust_decimal::Decimal,
    pub cess_amount: rust_decimal::Decimal,
    pub is_interim: bool,
    pub billing_period_start: Option<DateTime<Utc>>,
    pub billing_period_end: Option<DateTime<Utc>>,
    pub sequence_number: Option<i32>,
    pub corporate_id: Option<Uuid>,
    pub place_of_supply: Option<String>,
    pub is_er_deferred: bool,
    pub cloned_from_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InvoiceItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub charge_code: String,
    pub description: String,
    pub source: ChargeSource,
    pub source_id: Option<Uuid>,
    pub quantity: i32,
    pub unit_price: rust_decimal::Decimal,
    pub tax_percent: rust_decimal::Decimal,
    pub total_price: rust_decimal::Decimal,
    pub gst_rate: rust_decimal::Decimal,
    pub gst_type: GstType,
    pub cgst_amount: rust_decimal::Decimal,
    pub sgst_amount: rust_decimal::Decimal,
    pub igst_amount: rust_decimal::Decimal,
    pub hsn_sac_code: Option<String>,
    pub ordering_doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Payment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub amount: rust_decimal::Decimal,
    pub mode: PaymentMode,
    pub reference_number: Option<String>,
    pub received_by: Option<Uuid>,
    pub notes: Option<String>,
    pub paid_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillingPackage {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub total_price: rust_decimal::Decimal,
    pub discount_percent: rust_decimal::Decimal,
    pub is_active: bool,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_to: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillingPackageItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub package_id: Uuid,
    pub charge_code: String,
    pub description: String,
    pub quantity: i32,
    pub unit_price: rust_decimal::Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RatePlan {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub patient_category: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RatePlanItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub rate_plan_id: Uuid,
    pub charge_code: String,
    pub override_price: rust_decimal::Decimal,
    pub override_tax_percent: Option<rust_decimal::Decimal>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InvoiceDiscount {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub discount_type: String,
    pub discount_value: rust_decimal::Decimal,
    pub reason: Option<String>,
    pub approved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Refund {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub payment_id: Option<Uuid>,
    pub refund_number: String,
    pub amount: rust_decimal::Decimal,
    pub reason: String,
    pub mode: PaymentMode,
    pub reference_number: Option<String>,
    pub refunded_by: Option<Uuid>,
    pub refunded_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CreditNote {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub credit_note_number: String,
    pub invoice_id: Uuid,
    pub amount: rust_decimal::Decimal,
    pub reason: String,
    pub status: String,
    pub used_against_invoice_id: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Receipt {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub receipt_number: String,
    pub invoice_id: Uuid,
    pub payment_id: Uuid,
    pub amount: rust_decimal::Decimal,
    pub receipt_date: DateTime<Utc>,
    pub printed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InsuranceClaim {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub patient_id: Uuid,
    pub insurance_provider: String,
    pub policy_number: Option<String>,
    pub claim_number: Option<String>,
    pub claim_type: String,
    pub status: String,
    pub pre_auth_amount: Option<rust_decimal::Decimal>,
    pub approved_amount: Option<rust_decimal::Decimal>,
    pub settled_amount: Option<rust_decimal::Decimal>,
    pub tpa_name: Option<String>,
    pub notes: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub settled_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub scheme_type: InsuranceSchemeType,
    pub co_pay_percent: Option<rust_decimal::Decimal>,
    pub deductible_amount: Option<rust_decimal::Decimal>,
    pub member_id: Option<String>,
    pub scheme_card_number: Option<String>,
    pub is_secondary: bool,
    pub primary_claim_id: Option<Uuid>,
    pub tpa_rate_plan_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientAdvance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub advance_number: String,
    pub amount: rust_decimal::Decimal,
    pub balance: rust_decimal::Decimal,
    pub payment_mode: PaymentMode,
    pub reference_number: Option<String>,
    pub purpose: AdvancePurpose,
    pub status: AdvanceStatus,
    pub received_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AdvanceAdjustment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub advance_id: Uuid,
    pub invoice_id: Uuid,
    pub amount_adjusted: rust_decimal::Decimal,
    pub adjusted_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CorporateClient {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub gst_number: Option<String>,
    pub billing_address: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub credit_limit: rust_decimal::Decimal,
    pub credit_days: i32,
    pub agreed_discount_percent: rust_decimal::Decimal,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CorporateEnrollment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub corporate_id: Uuid,
    pub patient_id: Uuid,
    pub employee_id: Option<String>,
    pub department: Option<String>,
    pub is_active: bool,
    pub enrolled_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

// ═══════════════════════════════════════════════════════════
//  Phase 2b — Day Close, Write-Offs, Audit, TPA
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "day_close_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DayCloseStatus {
    Open,
    Verified,
    Discrepancy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "write_off_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum WriteOffStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "audit_action", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    InvoiceCreated,
    InvoiceIssued,
    InvoiceCancelled,
    PaymentRecorded,
    PaymentVoided,
    RefundCreated,
    DiscountApplied,
    DiscountRemoved,
    AdvanceCollected,
    AdvanceAdjusted,
    AdvanceRefunded,
    CreditNoteCreated,
    CreditNoteApplied,
    ClaimCreated,
    ClaimUpdated,
    DayClosed,
    WriteOffCreated,
    WriteOffApproved,
    InvoiceCloned,
    JournalEntryPosted,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DayEndClose {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub close_date: NaiveDate,
    pub cashier_id: Uuid,
    pub expected_cash: rust_decimal::Decimal,
    pub actual_cash: rust_decimal::Decimal,
    pub cash_difference: rust_decimal::Decimal,
    pub total_card: rust_decimal::Decimal,
    pub total_upi: rust_decimal::Decimal,
    pub total_cheque: rust_decimal::Decimal,
    pub total_bank_transfer: rust_decimal::Decimal,
    pub total_insurance: rust_decimal::Decimal,
    pub total_collected: rust_decimal::Decimal,
    pub invoices_count: i32,
    pub payments_count: i32,
    pub refunds_total: rust_decimal::Decimal,
    pub advances_total: rust_decimal::Decimal,
    pub status: DayCloseStatus,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BadDebtWriteOff {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub write_off_number: String,
    pub amount: rust_decimal::Decimal,
    pub reason: String,
    pub status: WriteOffStatus,
    pub requested_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillingAuditEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub action: AuditAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub amount: Option<rust_decimal::Decimal>,
    pub previous_state: Option<serde_json::Value>,
    pub new_state: Option<serde_json::Value>,
    pub performed_by: Uuid,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TpaRateCard {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub tpa_name: String,
    pub insurance_provider: String,
    pub rate_plan_id: Uuid,
    pub scheme_type: InsuranceSchemeType,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ═══════════════════════════════════════════════════════════
//  Phase 3 — Multi-Currency, Credit, Accounting, TDS, GST, ERP
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "currency_code", rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CurrencyCode {
    #[serde(alias = "INR")]
    Inr,
    #[serde(alias = "USD")]
    Usd,
    #[serde(alias = "EUR")]
    Eur,
    #[serde(alias = "GBP")]
    Gbp,
    #[serde(alias = "AED")]
    Aed,
    #[serde(alias = "SAR")]
    Sar,
    #[serde(alias = "SGD")]
    Sgd,
    #[serde(alias = "BDT")]
    Bdt,
    #[serde(alias = "NPR")]
    Npr,
    #[serde(alias = "LKR")]
    Lkr,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "credit_patient_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreditPatientStatus {
    Active,
    Overdue,
    Suspended,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "journal_entry_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum JournalEntryType {
    Manual,
    AutoInvoice,
    AutoPayment,
    AutoRefund,
    AutoWriteOff,
    AutoAdvance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "journal_entry_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum JournalEntryStatus {
    Draft,
    Posted,
    Reversed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "recon_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ReconStatus {
    Unmatched,
    Matched,
    Discrepancy,
    Excluded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "gstr_filing_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum GstrFilingStatus {
    Draft,
    Validated,
    Filed,
    Accepted,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "tds_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TdsStatus {
    Deducted,
    Deposited,
    CertificateIssued,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "erp_export_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ErpExportStatus {
    Pending,
    Exported,
    Failed,
    Acknowledged,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ExchangeRate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub from_currency: CurrencyCode,
    pub to_currency: CurrencyCode,
    pub rate: rust_decimal::Decimal,
    pub effective_date: NaiveDate,
    pub source: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CreditPatient {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub credit_limit: rust_decimal::Decimal,
    pub current_balance: rust_decimal::Decimal,
    pub status: CreditPatientStatus,
    pub approved_by: Option<Uuid>,
    pub overdue_since: Option<DateTime<Utc>>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GlAccount {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub account_type: String,
    pub parent_id: Option<Uuid>,
    pub is_active: bool,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct JournalEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entry_number: String,
    pub entry_date: NaiveDate,
    pub entry_type: JournalEntryType,
    pub status: JournalEntryStatus,
    pub total_debit: rust_decimal::Decimal,
    pub total_credit: rust_decimal::Decimal,
    pub description: Option<String>,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub posted_by: Option<Uuid>,
    pub posted_at: Option<DateTime<Utc>>,
    pub reversal_of_id: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct JournalEntryLine {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub journal_entry_id: Uuid,
    pub account_id: Uuid,
    pub department_id: Option<Uuid>,
    pub debit_amount: rust_decimal::Decimal,
    pub credit_amount: rust_decimal::Decimal,
    pub narration: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BankTransaction {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub bank_name: String,
    pub account_number: String,
    pub transaction_date: NaiveDate,
    pub value_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub debit_amount: rust_decimal::Decimal,
    pub credit_amount: rust_decimal::Decimal,
    pub running_balance: Option<rust_decimal::Decimal>,
    pub reference_number: Option<String>,
    pub recon_status: ReconStatus,
    pub matched_payment_id: Option<Uuid>,
    pub matched_refund_id: Option<Uuid>,
    pub import_batch: Option<String>,
    pub matched_by: Option<Uuid>,
    pub matched_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TdsDeduction {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub deductee_name: String,
    pub deductee_pan: String,
    pub tds_section: String,
    pub tds_rate: rust_decimal::Decimal,
    pub base_amount: rust_decimal::Decimal,
    pub tds_amount: rust_decimal::Decimal,
    pub status: TdsStatus,
    pub deducted_date: NaiveDate,
    pub challan_number: Option<String>,
    pub challan_date: Option<NaiveDate>,
    pub certificate_number: Option<String>,
    pub certificate_date: Option<NaiveDate>,
    pub financial_year: String,
    pub quarter: String,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GstReturnSummary {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub return_type: String,
    pub period: String,
    pub filing_status: GstrFilingStatus,
    pub total_taxable: rust_decimal::Decimal,
    pub total_cgst: rust_decimal::Decimal,
    pub total_sgst: rust_decimal::Decimal,
    pub total_igst: rust_decimal::Decimal,
    pub total_cess: rust_decimal::Decimal,
    pub total_tax: rust_decimal::Decimal,
    pub hsn_summary: Option<serde_json::Value>,
    pub invoice_count: i32,
    pub arn: Option<String>,
    pub filed_by: Option<Uuid>,
    pub filed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ErpExportLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub target_system: String,
    pub export_type: String,
    pub record_ids: Vec<Uuid>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
    pub status: ErpExportStatus,
    pub payload: Option<serde_json::Value>,
    pub response: Option<serde_json::Value>,
    pub error_message: Option<String>,
    pub exported_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "concession_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ConcessionStatus {
    Pending,
    Approved,
    Rejected,
    AutoApplied,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillingConcession {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub invoice_item_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub concession_type: String,
    pub original_amount: rust_decimal::Decimal,
    pub concession_percent: Option<rust_decimal::Decimal>,
    pub concession_amount: rust_decimal::Decimal,
    pub final_amount: rust_decimal::Decimal,
    pub reason: Option<String>,
    pub status: ConcessionStatus,
    pub requested_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub auto_rule: Option<String>,
    pub source_module: Option<String>,
    pub source_entity_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
