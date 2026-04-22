//! Print-data domain types — context objects assembled for print templates.
//!
//! Each struct carries the pre-joined, pre-formatted data that a Handlebars
//! (or Liquid / Tera) template needs to render a printable document.
//! The server queries the DB, builds these structs, and returns them as JSON.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ── Prescription ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrescriptionPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub phone: String,
    pub doctor_name: String,
    pub department: Option<String>,
    pub diagnosis: Option<String>,
    pub date: String,
    pub medications: Vec<MedicationLine>,
    pub advice: Option<String>,
    pub follow_up: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MedicationLine {
    pub drug_name: String,
    pub dosage: String,
    pub route: Option<String>,
    pub frequency: String,
    pub duration: String,
    pub instructions: Option<String>,
}

// ── Lab Report ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabReportPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub order_number: Option<String>,
    pub test_name: String,
    pub sample_type: Option<String>,
    pub collected_at: Option<String>,
    pub reported_at: Option<String>,
    pub referring_doctor: Option<String>,
    pub results: Vec<LabResultLine>,
    pub pathologist_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabResultLine {
    pub parameter_name: String,
    pub value: String,
    pub unit: Option<String>,
    pub normal_range: Option<String>,
    pub flag: Option<String>,
}

// ── Radiology Report ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiologyReportPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub modality: String,
    pub body_part: Option<String>,
    pub clinical_indication: Option<String>,
    pub findings: String,
    pub impression: Option<String>,
    pub recommendations: Option<String>,
    pub reported_by: Option<String>,
    pub verified_by: Option<String>,
    pub date: String,
}

// ── Patient Card ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientCardPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub date_of_birth: Option<String>,
    pub age: Option<String>,
    pub gender: String,
    pub phone: String,
    pub email: Option<String>,
    pub address: Option<serde_json::Value>,
    pub category: String,
    pub registered_at: String,
}

// ── Wristband ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WristbandPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub date_of_birth: Option<String>,
    pub blood_group: Option<String>,
    pub admission_date: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub doctor_name: Option<String>,
    pub allergies: Vec<String>,
}

// ── Discharge Summary ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DischargeSummaryPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub discharge_date: Option<String>,
    pub department: Option<String>,
    pub doctor_name: Option<String>,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub discharge_type: Option<String>,
    pub discharge_summary: Option<String>,
    pub diagnosis: Option<String>,
}

// ── Receipt (payment) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptPrintData {
    pub receipt_number: Option<String>,
    pub patient_name: String,
    pub uhid: String,
    pub invoice_number: String,
    pub amount: String,
    pub payment_mode: String,
    pub reference_number: Option<String>,
    pub received_by: Option<String>,
    pub paid_at: String,
    pub hospital_name: Option<String>,
}

// ── Estimate / Proforma Invoice ──────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatePrintData {
    pub invoice_number: String,
    pub patient_name: String,
    pub uhid: String,
    pub subtotal: String,
    pub tax_amount: String,
    pub discount_amount: String,
    pub total_amount: String,
    pub items: Vec<EstimateItemLine>,
    pub hospital_name: Option<String>,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EstimateItemLine {
    pub description: String,
    pub quantity: i32,
    pub unit_price: String,
    pub total_price: String,
}

// ── GST Invoice ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GstInvoicePrintData {
    pub invoice_number: String,
    pub patient_name: String,
    pub uhid: String,
    pub subtotal: String,
    pub tax_amount: String,
    pub total_amount: String,
    pub hospital_gstin: Option<String>,
    pub hospital_name: Option<String>,
    pub hospital_address: Option<String>,
    pub items: Vec<GstInvoiceItemLine>,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GstInvoiceItemLine {
    pub description: String,
    pub hsn_code: Option<String>,
    pub quantity: i32,
    pub unit_price: String,
    pub tax_percent: String,
    pub total_price: String,
}

// ── Consent Forms ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub date_of_birth: Option<String>,
    pub address: Option<String>,
    pub phone: String,
    pub consent_type: String,
    pub consent_date: String,
    pub consent_time: String,
    pub admission_id: Option<String>,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub treating_doctor: Option<String>,
    pub department: Option<String>,
    // Procedure-specific (for surgical/anesthesia consents)
    pub procedure_name: Option<String>,
    pub procedure_date: Option<String>,
    pub surgeon_name: Option<String>,
    pub anesthetist_name: Option<String>,
    pub risks_explained: Vec<String>,
    pub alternatives_discussed: Vec<String>,
    pub special_instructions: Option<String>,
    // Blood transfusion specific
    pub blood_group: Option<String>,
    pub components_required: Vec<String>,
    // AMA specific
    pub reason_for_ama: Option<String>,
    pub advice_given_at_discharge: Option<String>,
    // Language
    pub language: String,
    pub translated_content: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentSignatureBlock {
    pub signatory_type: String,  // patient, guardian, witness, doctor
    pub name: String,
    pub designation: Option<String>,
    pub relation: Option<String>,
    pub signature_data: Option<String>,  // Base64 encoded
    pub signed_at: Option<String>,
}

// ── Token Slip ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenSlipPrintData {
    pub token_number: String,
    pub token_date: String,
    pub token_time: String,
    pub patient_name: Option<String>,  // Privacy configurable
    pub uhid: Option<String>,
    pub department_name: String,
    pub doctor_name: Option<String>,
    pub room_number: Option<String>,
    pub estimated_wait_minutes: Option<i32>,
    pub priority: String,
    pub qr_code_data: String,
    pub instructions: String,
}

// ── Visitor Pass ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisitorPassPrintData {
    pub pass_number: String,
    pub visitor_name: String,
    pub visitor_phone: String,
    pub visitor_id_type: Option<String>,
    pub visitor_id_number: Option<String>,
    pub patient_name: String,
    pub patient_uhid: String,
    pub patient_ward: Option<String>,
    pub patient_bed: Option<String>,
    pub relation: Option<String>,
    pub valid_from: String,
    pub valid_until: String,
    pub issued_at: String,
    pub issued_by: Option<String>,
    pub photo_url: Option<String>,
    pub qr_code_data: String,
}

// ── MRD Forms ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressNotePrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub diagnosis: Option<String>,
    pub note_date: String,
    pub note_time: Option<String>,
    pub shift: Option<String>,
    pub subjective: Option<String>,
    pub objective: Option<String>,
    pub assessment: Option<String>,
    pub plan: Option<String>,
    pub vital_signs: Option<VitalSignsBlock>,
    pub io_balance: Option<IoBalanceBlock>,
    pub doctor_name: String,
    pub doctor_signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VitalSignsBlock {
    pub temperature: Option<String>,
    pub pulse: Option<String>,
    pub bp_systolic: Option<String>,
    pub bp_diastolic: Option<String>,
    pub respiratory_rate: Option<String>,
    pub spo2: Option<String>,
    pub pain_score: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoBalanceBlock {
    pub intake_oral: Option<String>,
    pub intake_iv: Option<String>,
    pub intake_other: Option<String>,
    pub output_urine: Option<String>,
    pub output_drain: Option<String>,
    pub output_other: Option<String>,
    pub balance: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NursingAssessmentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub assessment_date: String,
    pub assessment_time: String,
    pub shift: String,
    pub chief_complaint: Option<String>,
    pub history: Option<String>,
    pub allergies: Vec<String>,
    pub vital_signs: VitalSignsBlock,
    pub consciousness_level: Option<String>,
    pub pain_assessment: Option<String>,
    pub skin_integrity: Option<String>,
    pub mobility_status: Option<String>,
    pub fall_risk_score: Option<i32>,
    pub braden_score: Option<i32>,
    pub nutritional_status: Option<String>,
    pub iv_lines: Vec<String>,
    pub drains_tubes: Vec<String>,
    pub nursing_diagnosis: Vec<String>,
    pub care_plan: Option<String>,
    pub nurse_name: String,
    pub nurse_signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub allergies: Vec<String>,
    pub chart_date: String,
    pub medications: Vec<MarMedicationRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarMedicationRow {
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub frequency: String,
    pub scheduled_times: Vec<String>,
    pub administrations: Vec<MarAdministration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarAdministration {
    pub scheduled_time: String,
    pub actual_time: Option<String>,
    pub given_by: Option<String>,
    pub status: String,  // given, held, refused, not_available
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VitalsChartPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub chart_date: String,
    pub readings: Vec<VitalReading>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VitalReading {
    pub recorded_at: String,
    pub shift: Option<String>,
    pub temperature: Option<String>,
    pub pulse: Option<String>,
    pub bp_systolic: Option<String>,
    pub bp_diastolic: Option<String>,
    pub respiratory_rate: Option<String>,
    pub spo2: Option<String>,
    pub pain_score: Option<String>,
    pub recorded_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoChartPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub chart_date: String,
    pub entries: Vec<IoEntry>,
    pub daily_totals: IoTotals,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoEntry {
    pub recorded_at: String,
    pub shift: Option<String>,
    pub intake_oral: Option<i32>,
    pub intake_iv: Option<i32>,
    pub intake_ng: Option<i32>,
    pub intake_other: Option<i32>,
    pub output_urine: Option<i32>,
    pub output_vomit: Option<i32>,
    pub output_drain: Option<i32>,
    pub output_stool: Option<i32>,
    pub output_other: Option<i32>,
    pub recorded_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoTotals {
    pub total_intake: i32,
    pub total_output: i32,
    pub balance: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DischargeChecklistPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub expected_discharge_date: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub diagnosis: Option<String>,
    pub discharge_type: Option<String>,
    pub checklist_items: Vec<ChecklistItem>,
    pub discharge_medications: Vec<String>,
    pub follow_up_appointments: Vec<FollowUpItem>,
    pub patient_education_completed: bool,
    pub discharge_summary_ready: bool,
    pub final_bill_settled: bool,
    pub verified_by: Option<String>,
    pub verified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistItem {
    pub category: String,
    pub item: String,
    pub completed: bool,
    pub completed_by: Option<String>,
    pub completed_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowUpItem {
    pub department: String,
    pub doctor_name: Option<String>,
    pub recommended_date: String,
    pub reason: Option<String>,
}

// ── Billing Prints (Phase 2) ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpdBillPrintData {
    pub invoice_number: String,
    pub invoice_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub phone: String,
    pub doctor_name: Option<String>,
    pub department: Option<String>,
    pub items: Vec<BillLineItem>,
    pub subtotal: String,
    pub discount_amount: String,
    pub tax_amount: String,
    pub total_amount: String,
    pub amount_paid: String,
    pub balance_due: String,
    pub payment_mode: Option<String>,
    pub hospital_name: Option<String>,
    pub hospital_gstin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillLineItem {
    pub description: String,
    pub service_code: Option<String>,
    pub hsn_sac: Option<String>,
    pub quantity: i32,
    pub unit_price: String,
    pub discount: String,
    pub tax_percent: String,
    pub total: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpdInterimBillPrintData {
    pub bill_number: String,
    pub bill_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub doctor_name: Option<String>,
    pub department: Option<String>,
    pub diagnosis: Option<String>,
    pub room_charges: String,
    pub investigation_charges: String,
    pub procedure_charges: String,
    pub pharmacy_charges: String,
    pub consumable_charges: String,
    pub professional_fees: String,
    pub other_charges: String,
    pub items: Vec<BillLineItem>,
    pub subtotal: String,
    pub discount_amount: String,
    pub tax_amount: String,
    pub total_amount: String,
    pub advance_paid: String,
    pub balance_due: String,
    pub los_days: i32,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpdFinalBillPrintData {
    pub invoice_number: String,
    pub invoice_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub discharge_date: Option<String>,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub doctor_name: Option<String>,
    pub department: Option<String>,
    pub diagnosis: Option<String>,
    pub discharge_type: Option<String>,
    pub category_breakup: Vec<BillCategoryTotal>,
    pub items: Vec<BillLineItem>,
    pub subtotal: String,
    pub discount_amount: String,
    pub tax_amount: String,
    pub total_amount: String,
    pub advance_paid: String,
    pub insurance_approved: String,
    pub patient_payable: String,
    pub amount_paid: String,
    pub balance_due: String,
    pub los_days: i32,
    pub hospital_name: Option<String>,
    pub hospital_gstin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillCategoryTotal {
    pub category: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvanceReceiptPrintData {
    pub receipt_number: String,
    pub receipt_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub admission_id: Option<String>,
    pub amount: String,
    pub amount_in_words: String,
    pub payment_mode: String,
    pub reference_number: Option<String>,
    pub purpose: String,
    pub received_by: Option<String>,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefundReceiptPrintData {
    pub receipt_number: String,
    pub receipt_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub original_receipt_number: Option<String>,
    pub refund_amount: String,
    pub amount_in_words: String,
    pub refund_mode: String,
    pub reference_number: Option<String>,
    pub reason: String,
    pub approved_by: Option<String>,
    pub processed_by: Option<String>,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsurancePreauthPrintData {
    pub request_number: String,
    pub request_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub policy_number: String,
    pub insurance_company: String,
    pub tpa_name: Option<String>,
    pub employee_id: Option<String>,
    pub corporate_name: Option<String>,
    pub admission_date: Option<String>,
    pub expected_los: Option<i32>,
    pub diagnosis: Option<String>,
    pub icd_codes: Vec<String>,
    pub planned_procedures: Vec<String>,
    pub estimated_cost: String,
    pub treating_doctor: Option<String>,
    pub contact_number: String,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashlessClaimPrintData {
    pub claim_number: String,
    pub claim_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub policy_number: String,
    pub insurance_company: String,
    pub tpa_name: Option<String>,
    pub admission_date: String,
    pub discharge_date: Option<String>,
    pub diagnosis: Option<String>,
    pub procedures_performed: Vec<String>,
    pub total_bill_amount: String,
    pub approved_amount: String,
    pub deductions: String,
    pub patient_payable: String,
    pub claim_status: String,
    pub treating_doctor: Option<String>,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageEstimatePrintData {
    pub estimate_number: String,
    pub estimate_date: String,
    pub valid_until: String,
    pub patient_name: Option<String>,
    pub package_name: String,
    pub package_code: String,
    pub procedure_name: String,
    pub inclusions: Vec<String>,
    pub exclusions: Vec<String>,
    pub package_price: String,
    pub additional_charges_note: Option<String>,
    pub terms_conditions: Vec<String>,
    pub hospital_name: Option<String>,
}

// ── Lab/Blood Bank Report Prints (Phase 2) ───────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CultureSensitivityPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub sample_type: String,
    pub sample_id: String,
    pub collected_at: Option<String>,
    pub received_at: Option<String>,
    pub reported_at: Option<String>,
    pub referring_doctor: Option<String>,
    pub clinical_history: Option<String>,
    pub organism_isolated: Option<String>,
    pub colony_count: Option<String>,
    pub gram_stain: Option<String>,
    pub sensitivity_results: Vec<AntibioticSensitivity>,
    pub interpretation: Option<String>,
    pub comments: Option<String>,
    pub microbiologist_name: Option<String>,
    pub hospital_name: Option<String>,
    pub nabl_logo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AntibioticSensitivity {
    pub antibiotic_name: String,
    pub antibiotic_class: Option<String>,
    pub mic: Option<String>,
    pub interpretation: String, // S, I, R
    pub zone_size: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistopathReportPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub specimen_type: String,
    pub specimen_id: String,
    pub collected_at: Option<String>,
    pub received_at: Option<String>,
    pub reported_at: Option<String>,
    pub referring_doctor: Option<String>,
    pub clinical_history: Option<String>,
    pub gross_description: Option<String>,
    pub microscopic_description: Option<String>,
    pub diagnosis: String,
    pub icd_o_morphology: Option<String>,
    pub icd_o_topography: Option<String>,
    pub staging: Option<String>,
    pub grade: Option<String>,
    pub margin_status: Option<String>,
    pub lymph_node_status: Option<String>,
    pub ihc_markers: Vec<IhcMarker>,
    pub comments: Option<String>,
    pub pathologist_name: Option<String>,
    pub hospital_name: Option<String>,
    pub nabl_logo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IhcMarker {
    pub marker_name: String,
    pub result: String,
    pub intensity: Option<String>,
    pub percentage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossmatchReportPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub blood_group: String,
    pub rh_type: String,
    pub request_date: String,
    pub request_number: String,
    pub ward: Option<String>,
    pub bed: Option<String>,
    pub diagnosis: Option<String>,
    pub requesting_doctor: Option<String>,
    pub units_requested: i32,
    pub component_type: String,
    pub crossmatch_results: Vec<CrossmatchUnit>,
    pub antibody_screen: Option<String>,
    pub special_requirements: Option<String>,
    pub technician_name: Option<String>,
    pub verified_by: Option<String>,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CrossmatchUnit {
    pub bag_number: String,
    pub donation_date: String,
    pub expiry_date: String,
    pub donor_blood_group: String,
    pub volume_ml: i32,
    pub crossmatch_result: String, // Compatible, Incompatible
    pub issue_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentSlipPrintData {
    pub issue_number: String,
    pub issue_date: String,
    pub issue_time: String,
    pub patient_name: String,
    pub uhid: String,
    pub blood_group: String,
    pub ward: Option<String>,
    pub bed: Option<String>,
    pub bag_number: String,
    pub component_type: String,
    pub volume_ml: i32,
    pub donation_date: String,
    pub expiry_date: String,
    pub crossmatch_result: String,
    pub special_instructions: Option<String>,
    pub issued_by: Option<String>,
    pub verified_by: Option<String>,
    pub barcode_data: String,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestigationRequisitionPrintData {
    pub requisition_number: String,
    pub requisition_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub ward: Option<String>,
    pub bed: Option<String>,
    pub requesting_doctor: Option<String>,
    pub department: Option<String>,
    pub clinical_history: Option<String>,
    pub diagnosis: Option<String>,
    pub tests_ordered: Vec<OrderedTest>,
    pub priority: String,
    pub fasting_required: bool,
    pub special_instructions: Option<String>,
    pub barcode_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OrderedTest {
    pub test_name: String,
    pub test_code: Option<String>,
    pub sample_type: Option<String>,
    pub container: Option<String>,
}

// ── Additional Consent Forms (Phase 2) ───────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnrConsentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub diagnosis: Option<String>,
    pub prognosis: Option<String>,
    pub consent_date: String,
    pub consent_time: String,
    pub dnr_type: String, // full_dnr, limited_dnr, comfort_care
    pub interventions_declined: Vec<String>,
    pub interventions_allowed: Vec<String>,
    pub patient_wishes: Option<String>,
    pub family_discussion_notes: Option<String>,
    pub treating_doctor: Option<String>,
    pub witness_name: Option<String>,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganDonationConsentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub address: Option<String>,
    pub consent_date: String,
    pub consent_type: String, // pledge, family_consent, cadaver
    pub organs_consented: Vec<String>,
    pub tissues_consented: Vec<String>,
    pub next_of_kin_name: Option<String>,
    pub next_of_kin_relation: Option<String>,
    pub next_of_kin_phone: Option<String>,
    pub thoa_registration_number: Option<String>,
    pub transplant_coordinator: Option<String>,
    pub hospital_name: Option<String>,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchConsentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub consent_date: String,
    pub study_title: String,
    pub study_protocol_number: String,
    pub principal_investigator: String,
    pub iec_approval_number: String,
    pub iec_approval_date: String,
    pub sponsor_name: Option<String>,
    pub study_purpose: String,
    pub procedures_involved: Vec<String>,
    pub risks_benefits: String,
    pub compensation: Option<String>,
    pub confidentiality_statement: String,
    pub withdrawal_rights: String,
    pub contact_details: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbdmConsentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub abha_number: Option<String>,
    pub abha_address: Option<String>,
    pub consent_date: String,
    pub consent_type: String, // registration, linking, data_sharing
    pub purposes_consented: Vec<String>,
    pub health_info_types: Vec<String>,
    pub hip_name: String,
    pub hiu_name: Option<String>,
    pub validity_period: Option<String>,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeachingConsentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_id: Option<String>,
    pub consent_date: String,
    pub consent_type: String, // observation, examination, procedure_observation
    pub teaching_activity: String,
    pub student_level: String, // intern, pg, ug, nursing
    pub department: Option<String>,
    pub faculty_supervisor: Option<String>,
    pub patient_rights_explained: bool,
    pub can_withdraw_anytime: bool,
    pub language: String,
}

// ── Clinical Prints (Phase 2) ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreatmentChartPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_date: String,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub diagnosis: Option<String>,
    pub allergies: Vec<String>,
    pub chart_date: String,
    pub medications: Vec<TreatmentChartMedication>,
    pub iv_fluids: Vec<TreatmentChartIvFluid>,
    pub stat_orders: Vec<StatOrder>,
    pub treating_doctor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TreatmentChartMedication {
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub frequency: String,
    pub time_slots: Vec<String>, // 06:00, 12:00, 18:00, 22:00
    pub start_date: String,
    pub end_date: Option<String>,
    pub special_instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TreatmentChartIvFluid {
    pub fluid_name: String,
    pub volume_ml: i32,
    pub rate: String,
    pub additives: Vec<String>,
    pub start_time: String,
    pub duration_hours: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StatOrder {
    pub order_type: String,
    pub description: String,
    pub ordered_at: String,
    pub ordered_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferSummaryPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub transfer_date: String,
    pub transfer_time: String,
    pub from_ward: String,
    pub from_bed: Option<String>,
    pub to_ward: String,
    pub to_bed: Option<String>,
    pub transfer_reason: String,
    pub diagnosis: Option<String>,
    pub current_condition: String,
    pub vital_signs: Option<String>,
    pub current_medications: Vec<String>,
    pub pending_investigations: Vec<String>,
    pub pending_consultations: Vec<String>,
    pub special_precautions: Vec<String>,
    pub handover_notes: Option<String>,
    pub transferring_doctor: Option<String>,
    pub receiving_doctor: Option<String>,
    pub transferring_nurse: Option<String>,
    pub receiving_nurse: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientEducationPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub material_title: String,
    pub material_code: String,
    pub category: String, // disease, procedure, medication, lifestyle
    pub content_sections: Vec<EducationSection>,
    pub language: String,
    pub provided_date: String,
    pub provided_by: Option<String>,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EducationSection {
    pub heading: String,
    pub content: String,
    pub bullet_points: Vec<String>,
}

// ── Identity Prints Enhancement (Phase 2) ────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationCardPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub date_of_birth: Option<String>,
    pub age: Option<String>,
    pub gender: String,
    pub blood_group: Option<String>,
    pub phone: String,
    pub email: Option<String>,
    pub address: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub allergies: Vec<String>,
    pub photo_url: Option<String>,
    pub qr_code_data: String,
    pub registration_date: String,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfantWristbandPrintData {
    pub mother_name: String,
    pub mother_uhid: String,
    pub baby_id: String,
    pub baby_gender: String,
    pub date_of_birth: String,
    pub time_of_birth: String,
    pub birth_weight_grams: i32,
    pub delivery_type: String,
    pub ward_name: Option<String>,
    pub bed_number: Option<String>,
    pub attending_doctor: Option<String>,
    pub barcode_data: String,
    pub rfid_tag: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Phase 3: Surgical & OT Forms
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSheetCoverPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_number: String,
    pub admission_date: String,
    pub ward_name: String,
    pub bed_number: String,
    pub attending_doctor: String,
    pub department: String,
    pub provisional_diagnosis: Option<String>,
    pub final_diagnosis: Option<String>,
    pub allergies: Vec<String>,
    pub blood_group: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub insurance_provider: Option<String>,
    pub policy_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreopAssessmentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_number: String,
    pub planned_surgery: String,
    pub surgery_date: String,
    pub surgeon_name: String,
    pub anesthesiologist_name: Option<String>,
    pub asa_grade: Option<String>,
    pub allergies: Vec<String>,
    pub current_medications: Vec<String>,
    pub medical_history: Vec<String>,
    pub surgical_history: Vec<String>,
    pub vitals: PreopVitals,
    pub lab_results: Vec<PreopLabResult>,
    pub ecg_findings: Option<String>,
    pub chest_xray_findings: Option<String>,
    pub anesthesia_plan: Option<String>,
    pub special_instructions: Option<String>,
    pub consent_obtained: bool,
    pub npo_status: Option<String>,
    pub assessed_by: String,
    pub assessed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PreopVitals {
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse: Option<i32>,
    pub temperature: Option<f64>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<f64>,
    pub height_cm: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PreopLabResult {
    pub test_name: String,
    pub value: String,
    pub unit: Option<String>,
    pub flag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurgicalSafetyChecklistPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub surgery_id: String,
    pub procedure_name: String,
    pub surgery_date: String,
    pub ot_number: String,
    // Sign In (Before Anesthesia)
    pub sign_in: SurgicalSignIn,
    // Time Out (Before Skin Incision)
    pub time_out: SurgicalTimeOut,
    // Sign Out (Before Patient Leaves OT)
    pub sign_out: SurgicalSignOut,
    pub surgeon_name: String,
    pub anesthesiologist_name: String,
    pub scrub_nurse_name: String,
    pub circulating_nurse_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurgicalSignIn {
    pub patient_confirmed_identity: bool,
    pub site_marked: bool,
    pub consent_signed: bool,
    pub anesthesia_check_complete: bool,
    pub pulse_oximeter_working: bool,
    pub known_allergy: Option<String>,
    pub difficult_airway_risk: bool,
    pub blood_loss_risk: bool,
    pub completed_by: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurgicalTimeOut {
    pub team_members_introduced: bool,
    pub patient_name_confirmed: bool,
    pub procedure_confirmed: bool,
    pub site_confirmed: bool,
    pub antibiotics_given: bool,
    pub antibiotics_time: Option<String>,
    pub essential_imaging_displayed: bool,
    pub anticipated_critical_events: Option<String>,
    pub completed_by: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurgicalSignOut {
    pub procedure_recorded: bool,
    pub instrument_count_correct: bool,
    pub sponge_count_correct: bool,
    pub specimens_labeled: bool,
    pub equipment_issues: Option<String>,
    pub recovery_concerns: Option<String>,
    pub completed_by: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnesthesiaRecordPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub weight_kg: Option<f64>,
    pub surgery_id: String,
    pub procedure_name: String,
    pub surgery_date: String,
    pub anesthesia_type: String,
    pub asa_grade: String,
    pub anesthesiologist_name: String,
    // Airway Management
    pub airway_type: Option<String>,
    pub ett_size: Option<String>,
    pub intubation_grade: Option<String>,
    // Drugs Administered
    pub induction_agents: Vec<AnesthesiaDrug>,
    pub maintenance_agents: Vec<AnesthesiaDrug>,
    pub muscle_relaxants: Vec<AnesthesiaDrug>,
    pub analgesics: Vec<AnesthesiaDrug>,
    pub other_drugs: Vec<AnesthesiaDrug>,
    // Vitals Timeline (every 5 mins typically)
    pub vitals_timeline: Vec<AnesthesiaVitalEntry>,
    // Fluids & Blood
    pub iv_fluids: Vec<FluidEntry>,
    pub blood_products: Vec<BloodProductEntry>,
    pub urine_output_ml: Option<i32>,
    pub blood_loss_ml: Option<i32>,
    // Times
    pub anesthesia_start: String,
    pub surgery_start: String,
    pub surgery_end: String,
    pub anesthesia_end: String,
    // Recovery
    pub extubation_time: Option<String>,
    pub pacu_arrival_time: Option<String>,
    pub aldrete_score: Option<i32>,
    pub complications: Option<String>,
    pub postop_orders: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnesthesiaDrug {
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnesthesiaVitalEntry {
    pub time: String,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse: Option<i32>,
    pub spo2: Option<i32>,
    pub etco2: Option<i32>,
    pub temp: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FluidEntry {
    pub fluid_type: String,
    pub volume_ml: i32,
    pub start_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BloodProductEntry {
    pub product_type: String,
    pub bag_number: String,
    pub volume_ml: i32,
    pub start_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationNotesPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub surgery_id: String,
    pub surgery_date: String,
    pub procedure_name: String,
    pub procedure_code: Option<String>,
    pub indication: String,
    pub surgeon_name: String,
    pub assistant_surgeons: Vec<String>,
    pub anesthesiologist_name: String,
    pub anesthesia_type: String,
    pub ot_number: String,
    // Operative Details
    pub position: Option<String>,
    pub incision: Option<String>,
    pub findings: String,
    pub procedure_details: String,
    pub specimens_sent: Vec<String>,
    pub drain_details: Option<String>,
    pub closure_details: Option<String>,
    pub estimated_blood_loss_ml: Option<i32>,
    pub transfusion_given: Option<String>,
    pub complications: Option<String>,
    // Times
    pub surgery_start: String,
    pub surgery_end: String,
    pub duration_minutes: i32,
    // Post-Op
    pub immediate_postop_condition: Option<String>,
    pub postop_instructions: Option<String>,
    pub dictated_by: String,
    pub dictated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostopOrdersPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub admission_number: String,
    pub surgery_date: String,
    pub procedure_name: String,
    pub surgeon_name: String,
    pub ward_name: String,
    pub bed_number: String,
    // Orders
    pub diet_orders: Option<String>,
    pub position_orders: Option<String>,
    pub activity_orders: Option<String>,
    pub iv_fluids: Vec<PostopFluidOrder>,
    pub medications: Vec<PostopMedicationOrder>,
    pub monitoring_orders: Vec<String>,
    pub drain_care: Option<String>,
    pub wound_care: Option<String>,
    pub vte_prophylaxis: Option<String>,
    pub pain_management: Option<String>,
    pub lab_orders: Vec<String>,
    pub imaging_orders: Vec<String>,
    pub special_instructions: Option<String>,
    pub warning_signs: Vec<String>,
    pub ordered_by: String,
    pub ordered_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PostopFluidOrder {
    pub fluid_type: String,
    pub rate_ml_hr: i32,
    pub duration_hours: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PostopMedicationOrder {
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub frequency: String,
    pub duration: Option<String>,
    pub special_instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransfusionMonitoringPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub admission_number: String,
    pub ward_name: String,
    pub bed_number: String,
    pub transfusion_id: String,
    pub transfusion_date: String,
    // Blood Product Details
    pub product_type: String,
    pub bag_number: String,
    pub blood_group: String,
    pub rh_factor: String,
    pub volume_ml: i32,
    pub expiry_date: String,
    // Pre-Transfusion
    pub pre_vitals: TransfusionVitals,
    pub crossmatch_compatible: bool,
    pub patient_id_verified_by: String,
    pub product_verified_by: String,
    pub consent_on_file: bool,
    pub transfusion_start_time: String,
    pub started_by: String,
    // During Transfusion (15 min intervals)
    pub monitoring_entries: Vec<TransfusionMonitoringEntry>,
    // Post-Transfusion
    pub transfusion_end_time: Option<String>,
    pub post_vitals: Option<TransfusionVitals>,
    pub total_volume_infused_ml: Option<i32>,
    pub adverse_reaction: bool,
    pub reaction_type: Option<String>,
    pub reaction_time: Option<String>,
    pub action_taken: Option<String>,
    pub completed_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TransfusionVitals {
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse: Option<i32>,
    pub temperature: Option<f64>,
    pub spo2: Option<i32>,
    pub respiratory_rate: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TransfusionMonitoringEntry {
    pub time: String,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse: Option<i32>,
    pub temperature: Option<f64>,
    pub spo2: Option<i32>,
    pub symptoms: Option<String>,
    pub recorded_by: String,
}

// ══════════════════════════════════════════════════════════
// Phase 3: Clinical Charts
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FluidBalanceChartPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub admission_number: String,
    pub ward_name: String,
    pub bed_number: String,
    pub chart_date: String,
    pub attending_doctor: String,
    // Intake entries (hourly or per-event)
    pub intake_entries: Vec<FluidIntakeEntry>,
    // Output entries
    pub output_entries: Vec<FluidOutputEntry>,
    // Totals
    pub total_intake_ml: i32,
    pub total_output_ml: i32,
    pub net_balance_ml: i32,
    // 24-hour running totals (if multi-day)
    pub cumulative_intake_ml: Option<i32>,
    pub cumulative_output_ml: Option<i32>,
    pub cumulative_balance_ml: Option<i32>,
    pub shift_nurse: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FluidIntakeEntry {
    pub time: String,
    pub intake_type: String,
    pub description: String,
    pub volume_ml: i32,
    pub route: String,
    pub recorded_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FluidOutputEntry {
    pub time: String,
    pub output_type: String,
    pub description: Option<String>,
    pub volume_ml: i32,
    pub characteristics: Option<String>,
    pub recorded_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PainAssessmentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub admission_number: String,
    pub ward_name: String,
    pub bed_number: String,
    pub assessment_date: String,
    pub assessments: Vec<PainAssessmentEntry>,
    pub pain_management_plan: Option<String>,
    pub assessed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PainAssessmentEntry {
    pub time: String,
    pub pain_score: i32,
    pub pain_scale_used: String,
    pub pain_location: Option<String>,
    pub pain_character: Option<String>,
    pub aggravating_factors: Option<String>,
    pub relieving_factors: Option<String>,
    pub intervention_given: Option<String>,
    pub response_to_intervention: Option<String>,
    pub reassessment_score: Option<i32>,
    pub assessed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FallRiskAssessmentPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub admission_number: String,
    pub ward_name: String,
    pub bed_number: String,
    pub assessment_date: String,
    // Morse Fall Scale components
    pub history_of_falling: i32,
    pub secondary_diagnosis: i32,
    pub ambulatory_aid: i32,
    pub iv_therapy: i32,
    pub gait: i32,
    pub mental_status: i32,
    pub total_score: i32,
    pub risk_level: String,
    // Interventions
    pub interventions: Vec<String>,
    pub fall_precautions_implemented: bool,
    pub bed_alarm_on: bool,
    pub side_rails_up: bool,
    pub call_bell_within_reach: bool,
    pub non_slip_footwear: bool,
    pub assessed_by: String,
    pub next_reassessment_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PressureUlcerRiskPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub admission_number: String,
    pub ward_name: String,
    pub bed_number: String,
    pub assessment_date: String,
    // Braden Scale components
    pub sensory_perception: i32,
    pub moisture: i32,
    pub activity: i32,
    pub mobility: i32,
    pub nutrition: i32,
    pub friction_shear: i32,
    pub total_score: i32,
    pub risk_level: String,
    // Current skin assessment
    pub skin_assessment: Vec<SkinAssessmentEntry>,
    // Prevention plan
    pub repositioning_schedule: Option<String>,
    pub support_surface: Option<String>,
    pub nutrition_plan: Option<String>,
    pub moisture_management: Option<String>,
    pub other_interventions: Vec<String>,
    pub assessed_by: String,
    pub next_reassessment_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SkinAssessmentEntry {
    pub body_area: String,
    pub skin_condition: String,
    pub stage: Option<String>,
    pub wound_size_cm: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcsChartPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub admission_number: String,
    pub ward_name: String,
    pub bed_number: String,
    pub chart_date: String,
    pub diagnosis: Option<String>,
    pub entries: Vec<GcsEntry>,
    pub attending_doctor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GcsEntry {
    pub time: String,
    pub eye_opening: i32,
    pub verbal_response: i32,
    pub motor_response: i32,
    pub total_score: i32,
    pub pupil_left_size: Option<String>,
    pub pupil_left_reaction: Option<String>,
    pub pupil_right_size: Option<String>,
    pub pupil_right_reaction: Option<String>,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse: Option<i32>,
    pub spo2: Option<i32>,
    pub temperature: Option<f64>,
    pub assessed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransfusionRequisitionPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub blood_group: Option<String>,
    pub rh_factor: Option<String>,
    pub admission_number: Option<String>,
    pub ward_name: String,
    pub bed_number: String,
    pub request_id: String,
    pub request_date: String,
    pub clinical_indication: String,
    pub diagnosis: Option<String>,
    pub hemoglobin: Option<String>,
    pub hematocrit: Option<String>,
    pub platelet_count: Option<String>,
    pub pt_inr: Option<String>,
    pub aptt: Option<String>,
    pub product_requested: String,
    pub units_requested: i32,
    pub urgency: String,
    pub special_requirements: Option<String>,
    pub previous_transfusions: Option<String>,
    pub previous_reactions: Option<String>,
    pub pregnancy_history: Option<String>,
    pub consent_obtained: bool,
    pub sample_collected_by: Option<String>,
    pub sample_collected_at: Option<String>,
    pub requested_by: String,
    pub requested_at: String,
}

// ══════════════════════════════════════════════════════════
// Phase 3: Medico-Legal Forms
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmaFormPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub admission_number: String,
    pub admission_date: String,
    pub ward_name: String,
    pub bed_number: String,
    pub diagnosis: String,
    pub treating_doctor: String,
    pub ama_date: String,
    pub ama_time: String,
    // Declaration content
    pub risks_explained: Vec<String>,
    pub patient_understands_risks: bool,
    pub patient_refuses_treatment: bool,
    pub patient_assumes_responsibility: bool,
    pub reason_for_ama: Option<String>,
    // Signatures
    pub patient_signature_obtained: bool,
    pub relative_name: Option<String>,
    pub relative_relationship: Option<String>,
    pub relative_signature_obtained: bool,
    pub witness1_name: Option<String>,
    pub witness1_designation: Option<String>,
    pub witness2_name: Option<String>,
    pub witness2_designation: Option<String>,
    pub doctor_name: String,
    pub doctor_signature_obtained: bool,
    // Thumb impression if illiterate
    pub thumb_impression_taken: bool,
    pub interpreter_used: bool,
    pub interpreter_name: Option<String>,
    pub interpreter_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MlcRegisterPrintData {
    pub mlc_number: String,
    pub registration_date: String,
    pub registration_time: String,
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub address: Option<String>,
    pub brought_by: Option<String>,
    pub police_station: Option<String>,
    pub police_officer_name: Option<String>,
    pub police_officer_rank: Option<String>,
    pub police_dd_number: Option<String>,
    pub nature_of_case: String,
    pub alleged_history: String,
    pub date_time_of_incident: Option<String>,
    pub place_of_incident: Option<String>,
    pub weapon_used: Option<String>,
    pub condition_on_arrival: String,
    pub injuries_noted: Vec<InjuryEntry>,
    pub treatment_given: String,
    pub samples_collected: Vec<String>,
    pub samples_handed_to: Option<String>,
    pub opinion: Option<String>,
    pub patient_condition_at_discharge: Option<String>,
    pub examining_doctor: String,
    pub examined_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InjuryEntry {
    pub injury_number: i32,
    pub injury_type: String,
    pub location: String,
    pub size_cm: Option<String>,
    pub description: String,
    pub probable_age: Option<String>,
    pub probable_weapon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WoundCertificatePrintData {
    pub certificate_number: String,
    pub certificate_date: String,
    pub patient_name: String,
    pub patient_age: Option<String>,
    pub patient_gender: String,
    pub patient_address: Option<String>,
    pub patient_occupation: Option<String>,
    pub identified_by: Option<String>,
    pub identification_document: Option<String>,
    pub examination_date: String,
    pub examination_time: String,
    pub mlc_number: Option<String>,
    pub police_requisition_number: Option<String>,
    pub police_station: Option<String>,
    pub alleged_incident_date: Option<String>,
    pub alleged_incident_time: Option<String>,
    pub alleged_incident_place: Option<String>,
    pub alleged_manner: Option<String>,
    pub general_condition: String,
    pub vital_signs: Option<String>,
    pub injuries: Vec<WoundEntry>,
    pub x_ray_findings: Option<String>,
    pub other_investigations: Option<String>,
    pub opinion_nature: String,
    pub opinion_weapon: Option<String>,
    pub opinion_duration: Option<String>,
    pub opinion_disability: Option<String>,
    pub opinion_danger_to_life: Option<String>,
    pub examining_doctor: String,
    pub doctor_designation: String,
    pub doctor_registration_number: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WoundEntry {
    pub wound_number: i32,
    pub wound_type: String,
    pub location: String,
    pub dimensions: Option<String>,
    pub margins: Option<String>,
    pub floor: Option<String>,
    pub surrounding_area: Option<String>,
    pub healing_stage: Option<String>,
    pub probable_age_of_wound: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgeEstimationPrintData {
    pub certificate_number: String,
    pub certificate_date: String,
    pub person_name: String,
    pub person_gender: String,
    pub stated_age: Option<String>,
    pub purpose_of_examination: String,
    pub requisition_from: Option<String>,
    pub requisition_number: Option<String>,
    pub requisition_date: Option<String>,
    pub identification_marks: Vec<String>,
    pub general_physical_development: String,
    pub height_cm: Option<f64>,
    pub weight_kg: Option<f64>,
    // Secondary Sexual Characters
    pub secondary_sexual_characters: SecondaryCharacters,
    // Dental Examination
    pub dental_formula: String,
    pub third_molars_status: String,
    pub teeth_wear: Option<String>,
    // Radiological Examination
    pub xray_wrist_findings: Option<String>,
    pub xray_elbow_findings: Option<String>,
    pub xray_shoulder_findings: Option<String>,
    pub epiphyseal_fusion_status: Vec<EpiphysealFusion>,
    // Opinion
    pub estimated_age_years: String,
    pub age_range_min: Option<i32>,
    pub age_range_max: Option<i32>,
    pub opinion_basis: String,
    pub examining_doctor: String,
    pub doctor_designation: String,
    pub doctor_registration_number: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecondaryCharacters {
    pub breast_development: Option<String>,
    pub pubic_hair: Option<String>,
    pub axillary_hair: Option<String>,
    pub facial_hair: Option<String>,
    pub voice_change: Option<String>,
    pub other_findings: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EpiphysealFusion {
    pub joint: String,
    pub bone: String,
    pub fusion_status: String,
    pub typical_age_range: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeathDeclarationPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub address: Option<String>,
    pub admission_number: Option<String>,
    pub admission_date: Option<String>,
    pub ward_name: Option<String>,
    pub bed_number: Option<String>,
    pub date_of_death: String,
    pub time_of_death: String,
    pub place_of_death: String,
    pub brought_dead: bool,
    pub cause_of_death_immediate: String,
    pub cause_of_death_antecedent: Option<String>,
    pub cause_of_death_underlying: Option<String>,
    pub other_significant_conditions: Option<String>,
    pub manner_of_death: String,
    pub is_mlc: bool,
    pub mlc_number: Option<String>,
    pub autopsy_required: bool,
    pub autopsy_performed: bool,
    pub relatives_informed: bool,
    pub relative_name: Option<String>,
    pub relative_relationship: Option<String>,
    pub declared_by: String,
    pub doctor_designation: String,
    pub doctor_registration_number: String,
    pub death_certificate_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MlcDocumentationPrintData {
    pub mlc_number: String,
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub address: Option<String>,
    pub admission_date: Option<String>,
    pub discharge_date: Option<String>,
    pub final_diagnosis: String,
    pub treatment_summary: String,
    pub operative_procedures: Vec<String>,
    pub investigation_summary: String,
    pub clinical_findings_at_discharge: String,
    pub complications: Option<String>,
    pub prognosis: String,
    pub permanent_disability: Option<String>,
    pub disability_percentage: Option<String>,
    // Police/Legal
    pub police_station: Option<String>,
    pub fir_number: Option<String>,
    pub court_case_number: Option<String>,
    pub police_visits: Vec<PoliceVisitEntry>,
    // Samples
    pub samples_preserved: Vec<SamplePreservedEntry>,
    // Certificates Issued
    pub certificates_issued: Vec<String>,
    // Timeline
    pub important_dates: Vec<MlcDateEntry>,
    pub prepared_by: String,
    pub verified_by: String,
    pub prepared_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PoliceVisitEntry {
    pub visit_date: String,
    pub officer_name: String,
    pub officer_rank: String,
    pub purpose: String,
    pub statement_recorded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SamplePreservedEntry {
    pub sample_type: String,
    pub quantity: String,
    pub preservation_method: String,
    pub collected_date: String,
    pub handed_to: Option<String>,
    pub handed_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MlcDateEntry {
    pub event_date: String,
    pub event_description: String,
}

// ══════════════════════════════════════════════════════════
// Phase 3: Quality & Safety Forms
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentReportPrintData {
    pub incident_id: String,
    pub report_date: String,
    pub report_time: String,
    pub incident_date: String,
    pub incident_time: String,
    pub incident_location: String,
    pub department: String,
    pub incident_type: String,
    pub incident_category: String,
    pub severity_level: String,
    pub patient_involved: bool,
    pub patient_name: Option<String>,
    pub patient_uhid: Option<String>,
    pub patient_harm_level: Option<String>,
    pub staff_involved: Vec<StaffInvolvedEntry>,
    pub witnesses: Vec<String>,
    pub incident_description: String,
    pub immediate_action_taken: String,
    pub patient_condition_post_incident: Option<String>,
    pub notification_list: Vec<String>,
    pub root_cause_identified: Option<String>,
    pub contributing_factors: Vec<String>,
    pub reported_by: String,
    pub reported_by_designation: String,
    pub department_head_notified: bool,
    pub quality_dept_notified: bool,
    pub risk_management_notified: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StaffInvolvedEntry {
    pub staff_name: String,
    pub designation: String,
    pub role_in_incident: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcaTemplatePrintData {
    pub rca_id: String,
    pub incident_id: String,
    pub incident_date: String,
    pub incident_description: String,
    pub rca_start_date: String,
    pub rca_completion_date: Option<String>,
    pub rca_team: Vec<RcaTeamMember>,
    // Problem Statement
    pub problem_statement: String,
    // Data Collection
    pub data_sources: Vec<String>,
    pub timeline_of_events: Vec<RcaTimelineEntry>,
    // Analysis
    pub analysis_method: String,
    pub five_whys: Vec<FiveWhyEntry>,
    pub fishbone_categories: Vec<FishboneCategory>,
    // Root Causes
    pub root_causes_identified: Vec<String>,
    pub contributing_factors: Vec<String>,
    // Action Plan
    pub corrective_actions: Vec<CorrectiveAction>,
    pub preventive_actions: Vec<PreventiveAction>,
    // Effectiveness
    pub effectiveness_measures: Vec<String>,
    pub follow_up_dates: Vec<String>,
    // Approval
    pub prepared_by: String,
    pub reviewed_by: Option<String>,
    pub approved_by: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RcaTeamMember {
    pub name: String,
    pub designation: String,
    pub department: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RcaTimelineEntry {
    pub event_time: String,
    pub event_description: String,
    pub who_involved: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FiveWhyEntry {
    pub level: i32,
    pub question: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FishboneCategory {
    pub category: String,
    pub causes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CorrectiveAction {
    pub action_description: String,
    pub responsible_person: String,
    pub target_date: String,
    pub status: String,
    pub completion_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PreventiveAction {
    pub action_description: String,
    pub responsible_person: String,
    pub target_date: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapaFormPrintData {
    pub capa_id: String,
    pub capa_type: String,
    pub source: String,
    pub source_reference: Option<String>,
    pub initiated_date: String,
    pub initiated_by: String,
    pub department: String,
    // Problem
    pub problem_description: String,
    pub problem_scope: String,
    pub affected_processes: Vec<String>,
    // Root Cause (if corrective)
    pub root_cause_analysis: Option<String>,
    pub root_cause_method: Option<String>,
    // Action Plan
    pub proposed_actions: Vec<CapaAction>,
    // Implementation
    pub implementation_status: String,
    pub implementation_date: Option<String>,
    pub implemented_by: Option<String>,
    // Verification
    pub verification_method: Option<String>,
    pub verification_date: Option<String>,
    pub verified_by: Option<String>,
    pub verification_result: Option<String>,
    // Effectiveness
    pub effectiveness_check_date: Option<String>,
    pub effectiveness_result: Option<String>,
    pub effectiveness_evidence: Option<String>,
    // Closure
    pub closure_date: Option<String>,
    pub closed_by: Option<String>,
    pub closure_remarks: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CapaAction {
    pub action_number: i32,
    pub action_description: String,
    pub responsible_person: String,
    pub target_date: String,
    pub actual_date: Option<String>,
    pub status: String,
    pub remarks: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdrReportPrintData {
    pub report_id: String,
    pub report_date: String,
    pub report_type: String,
    // Patient Information
    pub patient_initials: String,
    pub patient_age: Option<String>,
    pub patient_gender: String,
    pub patient_weight_kg: Option<f64>,
    pub patient_height_cm: Option<f64>,
    // Suspected Adverse Reaction
    pub reaction_description: String,
    pub reaction_start_date: String,
    pub reaction_end_date: Option<String>,
    pub reaction_outcome: String,
    pub seriousness: String,
    pub seriousness_criteria: Vec<String>,
    // Suspected Medications
    pub suspected_drugs: Vec<SuspectedDrug>,
    // Concomitant Medications
    pub concomitant_drugs: Vec<ConcomitantDrug>,
    // Relevant History
    pub relevant_history: Option<String>,
    pub allergies: Option<String>,
    // De-challenge / Re-challenge
    pub dechallenge_done: bool,
    pub dechallenge_result: Option<String>,
    pub rechallenge_done: bool,
    pub rechallenge_result: Option<String>,
    // Causality Assessment
    pub causality_assessment: Option<String>,
    pub who_umc_category: Option<String>,
    pub naranjo_score: Option<i32>,
    // Reporter Information
    pub reporter_name: String,
    pub reporter_qualification: String,
    pub reporter_department: String,
    pub reporter_contact: Option<String>,
    pub hospital_name: String,
    // For PvPI
    pub pvpi_id: Option<String>,
    pub vigiflow_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SuspectedDrug {
    pub drug_name: String,
    pub generic_name: Option<String>,
    pub manufacturer: Option<String>,
    pub batch_number: Option<String>,
    pub dose: String,
    pub route: String,
    pub frequency: String,
    pub start_date: String,
    pub end_date: Option<String>,
    pub indication: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConcomitantDrug {
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub indication: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransfusionReactionPrintData {
    pub report_id: String,
    pub report_date: String,
    // Patient Information
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub blood_group: String,
    pub rh_factor: String,
    pub ward_name: String,
    pub bed_number: String,
    // Transfusion Details
    pub transfusion_date: String,
    pub transfusion_start_time: String,
    pub reaction_time: String,
    pub product_type: String,
    pub bag_number: String,
    pub donor_blood_group: String,
    pub volume_transfused_ml: i32,
    pub volume_remaining_ml: i32,
    // Reaction Details
    pub reaction_type: String,
    pub symptoms: Vec<String>,
    pub vital_signs_during_reaction: TransfusionVitals,
    pub severity: String,
    // Immediate Management
    pub transfusion_stopped: bool,
    pub transfusion_stopped_time: Option<String>,
    pub iv_line_kept_open: bool,
    pub doctor_informed: bool,
    pub doctor_name: Option<String>,
    pub blood_bank_informed: bool,
    pub immediate_treatment: String,
    // Investigation
    pub repeat_grouping_done: bool,
    pub repeat_crossmatch_done: bool,
    pub dcoombs_test: Option<String>,
    pub urine_hemoglobin: Option<String>,
    pub plasma_hemoglobin: Option<String>,
    pub ldh: Option<String>,
    pub bilirubin: Option<String>,
    pub blood_culture_sent: bool,
    pub bag_returned_to_blood_bank: bool,
    // Outcome
    pub patient_outcome: String,
    pub reaction_resolved: bool,
    pub permanent_sequelae: Option<String>,
    // For Hemovigilance
    pub imputability: Option<String>,
    pub naco_report_number: Option<String>,
    // Reporting
    pub reported_by: String,
    pub reported_by_designation: String,
    pub blood_bank_mo_name: Option<String>,
    pub blood_bank_mo_remarks: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Phase 4: Clinical Delivery Print Data
// ══════════════════════════════════════════════════════════

/// OPD Prescription print data with pharmacy copy
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct OpdPrescriptionPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age_display: String,
    pub gender: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub encounter_date: String,
    pub encounter_number: Option<String>,
    pub department: Option<String>,
    pub doctor_name: String,
    pub doctor_registration_number: Option<String>,
    pub doctor_qualification: Option<String>,
    pub chief_complaints: Option<String>,
    pub examination_findings: Option<String>,
    pub diagnosis: Option<String>,
    pub icd_codes: Vec<String>,
    pub medications: Vec<PrescriptionMedication>,
    pub advice: Option<String>,
    pub follow_up_date: Option<String>,
    pub follow_up_instructions: Option<String>,
    pub referral_notes: Option<String>,
    pub vitals: Option<OpdVitals>,
    pub doctor_signature_url: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
    pub hospital_address: Option<String>,
    pub hospital_phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrescriptionMedication {
    pub drug_name: String,
    pub generic_name: Option<String>,
    pub dose: String,
    pub route: String,
    pub frequency: String,
    pub duration: String,
    pub quantity: Option<i32>,
    pub instructions: Option<String>,
    pub is_controlled: bool,
    pub schedule: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpdVitals {
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse: Option<i32>,
    pub temperature: Option<f64>,
    pub spo2: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub height_cm: Option<f64>,
    pub weight_kg: Option<f64>,
    pub bmi: Option<f64>,
}

/// Full Lab Report with NABL compliance
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabReportFullPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age_display: String,
    pub gender: String,
    pub sample_id: String,
    pub accession_number: String,
    pub order_date: String,
    pub collection_date: Option<String>,
    pub report_date: String,
    pub referring_doctor: Option<String>,
    pub department: Option<String>,
    pub ward_name: Option<String>,
    pub bed_number: Option<String>,
    pub test_name: String,
    pub test_code: Option<String>,
    pub loinc_code: Option<String>,
    pub specimen_type: Option<String>,
    pub parameters: Vec<LabParameter>,
    pub interpretation: Option<String>,
    pub comments: Option<String>,
    pub pathologist_name: String,
    pub pathologist_registration_number: Option<String>,
    pub pathologist_signature_url: Option<String>,
    pub technician_name: Option<String>,
    pub verified_at: Option<String>,
    pub nabl_accredited: bool,
    pub nabl_certificate_number: Option<String>,
    pub nabl_logo_url: Option<String>,
    pub barcode_data: String,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LabParameter {
    pub parameter_name: String,
    pub result_value: String,
    pub unit: Option<String>,
    pub reference_range: Option<String>,
    pub is_abnormal: bool,
    pub is_critical: bool,
    pub critical_flag: Option<String>,
    pub method: Option<String>,
}

/// Cumulative Lab Report for trending across visits
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CumulativeLabReportPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age_display: String,
    pub gender: String,
    pub report_date: String,
    pub date_range_start: String,
    pub date_range_end: String,
    pub test_name: String,
    pub parameter_trends: Vec<ParameterTrend>,
    pub pathologist_name: String,
    pub pathologist_registration_number: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParameterTrend {
    pub parameter_name: String,
    pub unit: Option<String>,
    pub reference_range: Option<String>,
    pub values: Vec<TrendValue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrendValue {
    pub date: String,
    pub value: String,
    pub is_abnormal: bool,
}

/// Full Radiology Report with key images
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RadiologyReportFullPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age_display: String,
    pub gender: String,
    pub accession_number: String,
    pub order_date: String,
    pub exam_date: String,
    pub report_date: String,
    pub referring_doctor: Option<String>,
    pub department: Option<String>,
    pub ward_name: Option<String>,
    pub bed_number: Option<String>,
    pub modality: String,
    pub exam_name: String,
    pub exam_code: Option<String>,
    pub body_part: Option<String>,
    pub laterality: Option<String>,
    pub clinical_history: Option<String>,
    pub contrast_used: bool,
    pub contrast_details: Option<String>,
    pub technique: Option<String>,
    pub findings: String,
    pub impression: String,
    pub recommendations: Option<String>,
    pub key_images: Vec<KeyImage>,
    pub radiologist_name: String,
    pub radiologist_registration_number: Option<String>,
    pub radiologist_signature_url: Option<String>,
    pub technologist_name: Option<String>,
    pub verified_at: Option<String>,
    pub pacs_study_uid: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyImage {
    pub image_url: String,
    pub series_description: Option<String>,
    pub annotation: Option<String>,
}

/// Death Certificate (Form 4/4A per Births & Deaths Act)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DeathCertificatePrintData {
    pub certificate_number: String,
    pub registration_number: Option<String>,
    pub registration_date: Option<String>,
    // Deceased Information
    pub deceased_name: String,
    pub uhid: Option<String>,
    pub age_at_death: String,
    pub gender: String,
    pub date_of_birth: Option<String>,
    pub father_name: Option<String>,
    pub mother_name: Option<String>,
    pub spouse_name: Option<String>,
    pub permanent_address: Option<String>,
    pub place_of_death: String,
    // Death Details
    pub date_of_death: String,
    pub time_of_death: String,
    pub manner_of_death: String,
    pub cause_of_death_immediate: String,
    pub cause_of_death_antecedent: Option<String>,
    pub cause_of_death_underlying: Option<String>,
    pub other_significant_conditions: Vec<String>,
    pub duration_of_illness: Option<String>,
    pub icd_code_immediate: Option<String>,
    pub icd_code_underlying: Option<String>,
    // Medical Attendance
    pub attended_by_doctor: bool,
    pub attending_doctor_name: Option<String>,
    pub doctor_registration_number: Option<String>,
    pub hospital_admission_date: Option<String>,
    // For Female Deaths
    pub pregnancy_status: Option<String>,
    pub pregnancy_contributed: Option<bool>,
    // Administrative
    pub mlc_case: bool,
    pub mlc_number: Option<String>,
    pub autopsy_performed: bool,
    pub autopsy_findings: Option<String>,
    pub informant_name: Option<String>,
    pub informant_relationship: Option<String>,
    pub informant_address: Option<String>,
    pub certifying_doctor_name: String,
    pub certifying_doctor_registration: Option<String>,
    pub certification_date: String,
    pub hospital_name: String,
    pub hospital_address: Option<String>,
    pub hospital_logo_url: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Phase 4: Billing Print Data
// ══════════════════════════════════════════════════════════

/// Credit Note print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CreditNotePrintData {
    pub credit_note_number: String,
    pub credit_note_date: String,
    pub original_invoice_number: String,
    pub original_invoice_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub patient_address: Option<String>,
    pub patient_gstin: Option<String>,
    pub reason_for_credit: String,
    pub line_items: Vec<CreditNoteItem>,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
    pub total_credit_amount: f64,
    pub amount_in_words: String,
    pub remarks: Option<String>,
    pub approved_by: Option<String>,
    pub approved_at: Option<String>,
    pub hospital_name: String,
    pub hospital_address: Option<String>,
    pub hospital_gstin: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreditNoteItem {
    pub description: String,
    pub hsn_code: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub amount: f64,
    pub tax_rate: f64,
    pub tax_amount: f64,
}

/// Package Bill print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PackageBillPrintData {
    pub bill_number: String,
    pub bill_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub admission_number: Option<String>,
    pub admission_date: Option<String>,
    pub discharge_date: Option<String>,
    pub package_name: String,
    pub package_code: Option<String>,
    pub package_description: Option<String>,
    pub package_inclusions: Vec<String>,
    pub package_amount: f64,
    pub additional_charges: Vec<PackageAdditionalCharge>,
    pub additional_total: f64,
    pub exclusions_used: Vec<PackageExclusion>,
    pub exclusion_total: f64,
    pub gross_amount: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub net_amount: f64,
    pub advance_paid: f64,
    pub insurance_amount: f64,
    pub balance_due: f64,
    pub amount_in_words: String,
    pub doctor_name: Option<String>,
    pub department: Option<String>,
    pub hospital_name: String,
    pub hospital_address: Option<String>,
    pub hospital_gstin: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PackageAdditionalCharge {
    pub description: String,
    pub amount: f64,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PackageExclusion {
    pub description: String,
    pub amount: f64,
}

/// Insurance Claim Form (CGHS/ECHS/ESI/Ayushman Bharat)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InsuranceClaimPrintData {
    pub claim_number: String,
    pub claim_date: String,
    pub claim_type: String,
    pub tpa_name: Option<String>,
    pub insurance_company: Option<String>,
    pub policy_number: Option<String>,
    pub member_id: Option<String>,
    // Patient Information
    pub patient_name: String,
    pub uhid: String,
    pub age_display: String,
    pub gender: String,
    pub relation_to_primary: Option<String>,
    pub primary_holder_name: Option<String>,
    pub primary_holder_id: Option<String>,
    // Treatment Details
    pub admission_date: Option<String>,
    pub discharge_date: Option<String>,
    pub length_of_stay: Option<i32>,
    pub diagnosis: String,
    pub icd_codes: Vec<String>,
    pub procedure_performed: Option<String>,
    pub procedure_codes: Vec<String>,
    pub treating_doctor: String,
    pub department: Option<String>,
    // Billing
    pub room_charges: f64,
    pub nursing_charges: f64,
    pub investigation_charges: f64,
    pub medicine_charges: f64,
    pub consultation_charges: f64,
    pub procedure_charges: f64,
    pub other_charges: f64,
    pub total_bill_amount: f64,
    pub pre_auth_amount: Option<f64>,
    pub claim_amount: f64,
    pub patient_payable: f64,
    // Documents
    pub pre_auth_number: Option<String>,
    pub pre_auth_date: Option<String>,
    pub discharge_summary_attached: bool,
    pub investigation_reports_attached: bool,
    pub bill_attached: bool,
    // Declaration
    pub declaration_date: String,
    pub patient_signature_obtained: bool,
    pub hospital_stamp: bool,
    pub hospital_name: String,
    pub hospital_address: Option<String>,
    pub hospital_empanelment_number: Option<String>,
    pub hospital_logo_url: Option<String>,
}

/// TDS Certificate print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TdsCertificatePrintData {
    pub certificate_number: String,
    pub financial_year: String,
    pub quarter: String,
    // Deductor Details (Hospital)
    pub deductor_name: String,
    pub deductor_tan: String,
    pub deductor_pan: String,
    pub deductor_address: Option<String>,
    // Deductee Details (Vendor/Doctor)
    pub deductee_name: String,
    pub deductee_pan: String,
    pub deductee_address: Option<String>,
    // TDS Details
    pub section_code: String,
    pub nature_of_payment: String,
    pub tds_entries: Vec<TdsEntry>,
    pub total_payment: f64,
    pub total_tds_deducted: f64,
    pub total_tds_deposited: f64,
    // Challan Details
    pub challan_number: Option<String>,
    pub challan_date: Option<String>,
    pub bsr_code: Option<String>,
    // Verification
    pub verified_by: Option<String>,
    pub designation: Option<String>,
    pub verification_date: String,
    pub place: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TdsEntry {
    pub invoice_number: String,
    pub invoice_date: String,
    pub payment_date: String,
    pub gross_amount: f64,
    pub tds_rate: f64,
    pub tds_amount: f64,
}

// ══════════════════════════════════════════════════════════
// Phase 4: Regulatory Print Data
// ══════════════════════════════════════════════════════════

/// NABH Quality Indicators Report
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct NabhQualityReportPrintData {
    pub report_period: String,
    pub report_date: String,
    pub hospital_name: String,
    pub nabh_certificate_number: Option<String>,
    pub accreditation_valid_until: Option<String>,
    pub indicators: Vec<QualityIndicator>,
    pub summary: QualitySummary,
    pub action_items: Vec<String>,
    pub prepared_by: Option<String>,
    pub reviewed_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QualityIndicator {
    pub indicator_code: String,
    pub indicator_name: String,
    pub category: String,
    pub numerator: i32,
    pub denominator: i32,
    pub rate: f64,
    pub benchmark: Option<f64>,
    pub status: String,
    pub trend: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QualitySummary {
    pub total_indicators: i32,
    pub met_benchmark: i32,
    pub below_benchmark: i32,
    pub not_applicable: i32,
}

/// NMC Compliance Report
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct NmcComplianceReportPrintData {
    pub report_period: String,
    pub report_date: String,
    pub hospital_name: String,
    pub registration_number: Option<String>,
    pub compliance_sections: Vec<ComplianceSection>,
    pub overall_compliance_percentage: f64,
    pub non_compliance_items: Vec<String>,
    pub corrective_actions: Vec<String>,
    pub prepared_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComplianceSection {
    pub section_name: String,
    pub total_requirements: i32,
    pub compliant: i32,
    pub non_compliant: i32,
    pub compliance_percentage: f64,
}

/// NABL Lab Quality Report
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct NablQualityReportPrintData {
    pub report_period: String,
    pub report_date: String,
    pub laboratory_name: String,
    pub nabl_certificate_number: Option<String>,
    pub scope_of_accreditation: Vec<String>,
    pub qc_metrics: Vec<QcMetric>,
    pub proficiency_testing: Vec<PtResult>,
    pub turnaround_times: Vec<TatMetric>,
    pub critical_value_reporting: CriticalValueMetrics,
    pub sample_rejection_rate: f64,
    pub repeat_rate: f64,
    pub prepared_by: Option<String>,
    pub quality_manager: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QcMetric {
    pub analyte: String,
    pub mean: f64,
    pub sd: f64,
    pub cv: f64,
    pub westgard_violations: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PtResult {
    pub program_name: String,
    pub analyte: String,
    pub result: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TatMetric {
    pub test_category: String,
    pub target_tat_hours: f64,
    pub actual_tat_hours: f64,
    pub compliance_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CriticalValueMetrics {
    pub total_critical_values: i32,
    pub reported_within_target: i32,
    pub average_reporting_time_minutes: f64,
}

/// SPCB BMW Quarterly Returns
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SpcbBmwReturnsPrintData {
    pub quarter: String,
    pub year: i32,
    pub report_date: String,
    pub hospital_name: String,
    pub hospital_address: Option<String>,
    pub authorization_number: Option<String>,
    pub total_beds: i32,
    pub average_occupancy: f64,
    pub waste_categories: Vec<BmwCategory>,
    pub total_waste_kg: f64,
    pub cbwtf_name: Option<String>,
    pub cbwtf_authorization: Option<String>,
    pub disposal_records: Vec<DisposalRecord>,
    pub training_conducted: bool,
    pub training_attendees: Option<i32>,
    pub incidents_reported: i32,
    pub authorized_signatory: Option<String>,
    pub designation: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BmwCategory {
    pub category: String,
    pub color_code: String,
    pub description: String,
    pub quantity_kg: f64,
    pub disposal_method: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DisposalRecord {
    pub date: String,
    pub category: String,
    pub quantity_kg: f64,
    pub vehicle_number: Option<String>,
    pub manifest_number: Option<String>,
}

/// PESO Compliance Report (Petroleum & Explosives Safety)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PesoComplianceReportPrintData {
    pub report_year: i32,
    pub report_date: String,
    pub hospital_name: String,
    pub peso_license_number: Option<String>,
    pub license_valid_until: Option<String>,
    pub medical_gas_systems: Vec<MedicalGasSystem>,
    pub cylinder_storage: CylinderStorage,
    pub safety_inspections: Vec<SafetyInspection>,
    pub incidents: Vec<GasIncident>,
    pub compliance_status: String,
    pub prepared_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MedicalGasSystem {
    pub gas_type: String,
    pub source_type: String,
    pub location: String,
    pub capacity: String,
    pub last_tested: Option<String>,
    pub next_test_due: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CylinderStorage {
    pub total_capacity: i32,
    pub oxygen_cylinders: i32,
    pub nitrous_oxide_cylinders: i32,
    pub co2_cylinders: i32,
    pub other_cylinders: i32,
    pub storage_compliant: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyInspection {
    pub inspection_date: String,
    pub inspector: String,
    pub findings: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GasIncident {
    pub incident_date: String,
    pub gas_type: String,
    pub description: String,
    pub action_taken: String,
}

/// Drug License Report
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DrugLicenseReportPrintData {
    pub report_date: String,
    pub hospital_name: String,
    pub drug_license_number: String,
    pub license_type: String,
    pub valid_from: String,
    pub valid_until: String,
    pub licensing_authority: String,
    pub registered_pharmacist: Option<String>,
    pub registration_number: Option<String>,
    pub authorized_categories: Vec<String>,
    pub controlled_substance_license: Option<String>,
    pub storage_conditions_compliant: bool,
    pub inspection_history: Vec<DrugInspection>,
    pub current_stock_summary: Vec<DrugStockCategory>,
    pub expiry_alerts: Vec<ExpiryAlert>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DrugInspection {
    pub inspection_date: String,
    pub inspector_name: String,
    pub findings: String,
    pub compliance_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DrugStockCategory {
    pub category: String,
    pub total_items: i32,
    pub total_value: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpiryAlert {
    pub drug_name: String,
    pub batch_number: String,
    pub expiry_date: String,
    pub quantity: i32,
    pub days_to_expiry: i32,
}

/// PCPNDT Compliance Report
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PcpndtReportPrintData {
    pub report_period: String,
    pub report_date: String,
    pub hospital_name: String,
    pub registration_number: String,
    pub registration_valid_until: String,
    pub appropriate_authority: String,
    pub registered_equipment: Vec<PcpndtEquipment>,
    pub qualified_personnel: Vec<PcpndtPersonnel>,
    pub procedures_performed: Vec<PcpndtProcedure>,
    pub form_f_compliance: FormFCompliance,
    pub inspections: Vec<PcpndtInspection>,
    pub declaration_text: String,
    pub signatory_name: String,
    pub signatory_designation: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PcpndtEquipment {
    pub equipment_name: String,
    pub registration_number: String,
    pub location: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PcpndtPersonnel {
    pub name: String,
    pub qualification: String,
    pub registration_number: String,
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PcpndtProcedure {
    pub procedure_type: String,
    pub total_count: i32,
    pub male_fetus: i32,
    pub female_fetus: i32,
    pub indeterminate: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FormFCompliance {
    pub total_forms: i32,
    pub complete_forms: i32,
    pub incomplete_forms: i32,
    pub compliance_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PcpndtInspection {
    pub date: String,
    pub authority: String,
    pub findings: String,
    pub status: String,
}

/// Birth Register (Municipal)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct BirthRegisterPrintData {
    pub report_period: String,
    pub report_date: String,
    pub hospital_name: String,
    pub hospital_code: Option<String>,
    pub municipal_area: Option<String>,
    pub entries: Vec<BirthRegisterEntry>,
    pub total_births: i32,
    pub male_births: i32,
    pub female_births: i32,
    pub live_births: i32,
    pub still_births: i32,
    pub prepared_by: Option<String>,
    pub verified_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BirthRegisterEntry {
    pub serial_number: i32,
    pub registration_number: String,
    pub date_of_birth: String,
    pub time_of_birth: String,
    pub gender: String,
    pub birth_weight_grams: i32,
    pub birth_type: String,
    pub mother_name: String,
    pub mother_age: i32,
    pub father_name: String,
    pub address: String,
    pub delivery_type: String,
    pub attending_doctor: String,
}

/// Death Register (Municipal)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DeathRegisterPrintData {
    pub report_period: String,
    pub report_date: String,
    pub hospital_name: String,
    pub hospital_code: Option<String>,
    pub municipal_area: Option<String>,
    pub entries: Vec<DeathRegisterEntry>,
    pub total_deaths: i32,
    pub male_deaths: i32,
    pub female_deaths: i32,
    pub mlc_cases: i32,
    pub prepared_by: Option<String>,
    pub verified_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeathRegisterEntry {
    pub serial_number: i32,
    pub registration_number: String,
    pub date_of_death: String,
    pub time_of_death: String,
    pub deceased_name: String,
    pub age: String,
    pub gender: String,
    pub address: String,
    pub cause_of_death: String,
    pub icd_code: Option<String>,
    pub certifying_doctor: String,
    pub mlc_case: bool,
}

/// MLC Register Summary (Police Authority)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MlcRegisterSummaryPrintData {
    pub report_period: String,
    pub report_date: String,
    pub hospital_name: String,
    pub entries: Vec<MlcRegisterSummaryEntry>,
    pub total_cases: i32,
    pub by_case_type: Vec<MlcCaseTypeCount>,
    pub by_outcome: Vec<MlcOutcomeCount>,
    pub pending_cases: i32,
    pub prepared_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MlcRegisterSummaryEntry {
    pub serial_number: i32,
    pub mlc_number: String,
    pub registration_date: String,
    pub patient_name: String,
    pub age_gender: String,
    pub case_type: String,
    pub police_station: String,
    pub fir_number: Option<String>,
    pub outcome: String,
    pub current_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MlcCaseTypeCount {
    pub case_type: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MlcOutcomeCount {
    pub outcome: String,
    pub count: i32,
}

/// AEBAS Attendance Report
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AebasAttendanceReportPrintData {
    pub report_period: String,
    pub report_date: String,
    pub hospital_name: String,
    pub aebas_unit_code: Option<String>,
    pub department_summary: Vec<DepartmentAttendance>,
    pub total_employees: i32,
    pub average_attendance_percentage: f64,
    pub total_working_days: i32,
    pub holidays: i32,
    pub prepared_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DepartmentAttendance {
    pub department_name: String,
    pub total_employees: i32,
    pub average_present: f64,
    pub average_absent: f64,
    pub average_leave: f64,
    pub attendance_percentage: f64,
}

/// NMC NARF Self-Assessment
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct NmcNarfAssessmentPrintData {
    pub assessment_year: i32,
    pub report_date: String,
    pub hospital_name: String,
    pub nmc_registration_number: Option<String>,
    pub assessment_sections: Vec<NarfSection>,
    pub overall_score: f64,
    pub maximum_score: f64,
    pub percentage: f64,
    pub grade: String,
    pub strengths: Vec<String>,
    pub areas_for_improvement: Vec<String>,
    pub action_plan: Vec<String>,
    pub assessed_by: Option<String>,
    pub verified_by: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NarfSection {
    pub section_name: String,
    pub max_score: f64,
    pub achieved_score: f64,
    pub percentage: f64,
    pub criteria: Vec<NarfCriterion>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NarfCriterion {
    pub criterion: String,
    pub max_marks: f64,
    pub achieved_marks: f64,
    pub evidence: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Phase 4: Admin & Procurement Print Data
// ══════════════════════════════════════════════════════════

/// Indent Form
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IndentFormPrintData {
    pub indent_number: String,
    pub indent_date: String,
    pub indent_type: String,
    pub priority: String,
    pub requesting_department: String,
    pub requesting_store: Option<String>,
    pub requested_by: String,
    pub items: Vec<IndentItem>,
    pub total_items: i32,
    pub estimated_value: Option<f64>,
    pub justification: Option<String>,
    pub approved_by: Option<String>,
    pub approved_at: Option<String>,
    pub status: String,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndentItem {
    pub item_code: String,
    pub item_name: String,
    pub specification: Option<String>,
    pub unit: String,
    pub quantity_requested: f64,
    pub quantity_approved: Option<f64>,
    pub current_stock: Option<f64>,
    pub remarks: Option<String>,
}

/// Purchase Order
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PurchaseOrderPrintData {
    pub po_number: String,
    pub po_date: String,
    pub vendor_name: String,
    pub vendor_address: Option<String>,
    pub vendor_gstin: Option<String>,
    pub vendor_contact: Option<String>,
    pub delivery_address: String,
    pub delivery_date: Option<String>,
    pub payment_terms: Option<String>,
    pub items: Vec<PoItem>,
    pub subtotal: f64,
    pub discount_percentage: Option<f64>,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub freight_charges: f64,
    pub total_amount: f64,
    pub amount_in_words: String,
    pub terms_and_conditions: Vec<String>,
    pub prepared_by: Option<String>,
    pub approved_by: Option<String>,
    pub hospital_name: String,
    pub hospital_address: Option<String>,
    pub hospital_gstin: Option<String>,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PoItem {
    pub item_code: String,
    pub item_name: String,
    pub specification: Option<String>,
    pub hsn_code: Option<String>,
    pub unit: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub tax_rate: f64,
    pub amount: f64,
}

/// Goods Receipt Note (GRN)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GrnPrintData {
    pub grn_number: String,
    pub grn_date: String,
    pub po_number: Option<String>,
    pub po_date: Option<String>,
    pub vendor_name: String,
    pub vendor_invoice_number: Option<String>,
    pub vendor_invoice_date: Option<String>,
    pub challan_number: Option<String>,
    pub receiving_store: String,
    pub items: Vec<GrnItem>,
    pub total_items: i32,
    pub total_quantity: f64,
    pub total_value: f64,
    pub quality_check_done: bool,
    pub quality_remarks: Option<String>,
    pub received_by: String,
    pub verified_by: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GrnItem {
    pub item_code: String,
    pub item_name: String,
    pub batch_number: Option<String>,
    pub expiry_date: Option<String>,
    pub manufacturing_date: Option<String>,
    pub unit: String,
    pub quantity_ordered: f64,
    pub quantity_received: f64,
    pub quantity_accepted: f64,
    pub quantity_rejected: f64,
    pub rejection_reason: Option<String>,
    pub unit_price: f64,
    pub amount: f64,
}

/// Material Issue Voucher
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MaterialIssueVoucherPrintData {
    pub voucher_number: String,
    pub voucher_date: String,
    pub issue_type: String,
    pub issuing_store: String,
    pub receiving_department: String,
    pub receiving_cost_center: Option<String>,
    pub requested_by: String,
    pub items: Vec<IssueItem>,
    pub total_items: i32,
    pub total_value: f64,
    pub purpose: Option<String>,
    pub issued_by: String,
    pub received_by: Option<String>,
    pub received_at: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IssueItem {
    pub item_code: String,
    pub item_name: String,
    pub batch_number: Option<String>,
    pub expiry_date: Option<String>,
    pub unit: String,
    pub quantity_requested: f64,
    pub quantity_issued: f64,
    pub unit_price: f64,
    pub amount: f64,
}

/// Stock Transfer Note
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockTransferNotePrintData {
    pub transfer_number: String,
    pub transfer_date: String,
    pub from_store: String,
    pub to_store: String,
    pub transfer_type: String,
    pub items: Vec<TransferItem>,
    pub total_items: i32,
    pub total_value: f64,
    pub reason: Option<String>,
    pub initiated_by: String,
    pub dispatched_by: Option<String>,
    pub dispatched_at: Option<String>,
    pub received_by: Option<String>,
    pub received_at: Option<String>,
    pub status: String,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransferItem {
    pub item_code: String,
    pub item_name: String,
    pub batch_number: Option<String>,
    pub expiry_date: Option<String>,
    pub unit: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub amount: f64,
}

/// NDPS Controlled Substance Register
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct NdpsRegisterPrintData {
    pub report_period: String,
    pub report_date: String,
    pub store_name: String,
    pub license_number: String,
    pub license_valid_until: String,
    pub opening_balance: Vec<NdpsBalance>,
    pub transactions: Vec<NdpsTransaction>,
    pub closing_balance: Vec<NdpsBalance>,
    pub physical_verification_date: Option<String>,
    pub discrepancies: Vec<String>,
    pub register_maintained_by: String,
    pub verified_by: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NdpsBalance {
    pub drug_name: String,
    pub schedule: String,
    pub batch_number: String,
    pub unit: String,
    pub quantity: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NdpsTransaction {
    pub transaction_date: String,
    pub drug_name: String,
    pub batch_number: String,
    pub transaction_type: String,
    pub quantity: f64,
    pub balance_after: f64,
    pub patient_name: Option<String>,
    pub patient_uhid: Option<String>,
    pub prescribing_doctor: Option<String>,
    pub witness_name: Option<String>,
    pub reference_number: String,
}

/// Drug Expiry Alert List
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DrugExpiryAlertPrintData {
    pub report_date: String,
    pub store_name: String,
    pub alert_threshold_days: i32,
    pub expired_drugs: Vec<ExpiryDrugItem>,
    pub expiring_soon: Vec<ExpiryDrugItem>,
    pub total_expired_value: f64,
    pub total_expiring_value: f64,
    pub prepared_by: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpiryDrugItem {
    pub item_code: String,
    pub drug_name: String,
    pub batch_number: String,
    pub expiry_date: String,
    pub days_to_expiry: i32,
    pub quantity: f64,
    pub unit: String,
    pub unit_price: f64,
    pub total_value: f64,
    pub manufacturer: Option<String>,
    pub supplier: Option<String>,
    pub location: String,
}

/// Equipment Condemnation Form
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct EquipmentCondemnationPrintData {
    pub condemnation_number: String,
    pub condemnation_date: String,
    pub equipment_name: String,
    pub equipment_code: String,
    pub serial_number: Option<String>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub location: String,
    pub department: String,
    pub purchase_date: Option<String>,
    pub purchase_value: Option<f64>,
    pub current_book_value: Option<f64>,
    pub reason_for_condemnation: String,
    pub condition_assessment: String,
    pub inspection_findings: String,
    pub repair_history: Vec<RepairHistoryEntry>,
    pub total_repair_cost: f64,
    pub disposal_recommendation: String,
    pub estimated_salvage_value: Option<f64>,
    pub inspected_by: String,
    pub recommended_by: String,
    pub approved_by: Option<String>,
    pub approval_date: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RepairHistoryEntry {
    pub repair_date: String,
    pub issue: String,
    pub action_taken: String,
    pub cost: f64,
    pub vendor: Option<String>,
}

/// Work Order Form
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WorkOrderPrintData {
    pub work_order_number: String,
    pub work_order_date: String,
    pub work_type: String,
    pub priority: String,
    pub requested_by: String,
    pub requesting_department: String,
    pub location: String,
    pub description: String,
    pub equipment_involved: Option<String>,
    pub equipment_code: Option<String>,
    pub estimated_hours: Option<f64>,
    pub estimated_cost: Option<f64>,
    pub materials_required: Vec<WorkOrderMaterial>,
    pub assigned_to: Option<String>,
    pub assigned_team: Option<String>,
    pub scheduled_date: Option<String>,
    pub completion_date: Option<String>,
    pub actual_hours: Option<f64>,
    pub actual_cost: Option<f64>,
    pub work_done: Option<String>,
    pub status: String,
    pub verified_by: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkOrderMaterial {
    pub material_name: String,
    pub quantity: f64,
    pub unit: String,
    pub estimated_cost: f64,
}

/// Preventive Maintenance Checklist
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PmChecklistPrintData {
    pub pm_number: String,
    pub pm_date: String,
    pub equipment_name: String,
    pub equipment_code: String,
    pub serial_number: Option<String>,
    pub location: String,
    pub department: String,
    pub last_pm_date: Option<String>,
    pub pm_frequency: String,
    pub checklist_items: Vec<PmChecklistItem>,
    pub overall_condition: String,
    pub issues_found: Vec<String>,
    pub corrective_actions: Vec<String>,
    pub parts_replaced: Vec<PartReplaced>,
    pub next_pm_due: Option<String>,
    pub performed_by: String,
    pub verified_by: Option<String>,
    pub department_head_acknowledgment: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PmChecklistItem {
    pub item_number: i32,
    pub check_description: String,
    pub status: String,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PartReplaced {
    pub part_name: String,
    pub part_number: Option<String>,
    pub quantity: i32,
    pub reason: String,
}

// ── Helper row types (used in SQL queries) ───────────────

/// Flat row returned by prescription-items join.
#[derive(Debug, sqlx::FromRow)]
pub struct PrescriptionHeaderRow {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<f64>,
    pub gender: String,
    pub phone: String,
    pub doctor_name: String,
    pub department: Option<String>,
    pub diagnosis: Option<String>,
    pub encounter_date: DateTime<Utc>,
    pub advice: Option<String>,
    pub follow_up: Option<String>,
}

/// Flat row returned by lab-order + test catalog join.
#[derive(Debug, sqlx::FromRow)]
pub struct LabOrderHeaderRow {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<f64>,
    pub gender: String,
    pub test_name: String,
    pub sample_type: Option<String>,
    pub collected_at: Option<DateTime<Utc>>,
    pub verified_at: Option<DateTime<Utc>>,
    pub referring_doctor: Option<String>,
    pub pathologist_name: Option<String>,
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Admin/HR, BME, Blood Bank, Safety Forms
// ══════════════════════════════════════════════════════════════════════════════

// ── Admin/HR Forms ────────────────────────────────────────────────────────────

/// Employee ID Card print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct EmployeeIdCardPrintData {
    pub employee_id: String,
    pub employee_name: String,
    pub designation: String,
    pub department: String,
    pub date_of_joining: String,
    pub blood_group: Option<String>,
    pub emergency_contact: Option<String>,
    pub photo_url: Option<String>,
    pub access_zones: Vec<String>,
    pub valid_from: String,
    pub valid_until: String,
    pub barcode_data: String,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

/// Duty Roster / Shift Schedule print data
#[derive(Debug, Serialize, Deserialize)]
pub struct DutyRosterPrintData {
    pub department: String,
    pub period_start: String,
    pub period_end: String,
    pub generated_date: String,
    pub generated_by: String,
    pub shifts: Vec<ShiftDefinition>,
    pub roster_entries: Vec<RosterEntry>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShiftDefinition {
    pub shift_name: String,
    pub start_time: String,
    pub end_time: String,
    pub color_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RosterEntry {
    pub employee_name: String,
    pub employee_id: String,
    pub designation: String,
    pub schedule: Vec<DayShift>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DayShift {
    pub date: String,
    pub shift: String,
    pub is_off: bool,
}

/// Leave Application Form print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct LeaveApplicationPrintData {
    pub application_number: String,
    pub application_date: String,
    pub employee_name: String,
    pub employee_id: String,
    pub department: String,
    pub designation: String,
    pub leave_type: String,
    pub leave_from: String,
    pub leave_to: String,
    pub total_days: i32,
    pub reason: String,
    pub leave_balance_before: i32,
    pub leave_balance_after: i32,
    pub relieving_officer: Option<String>,
    pub contact_during_leave: Option<String>,
    pub approver_name: Option<String>,
    pub approval_status: String,
    pub approval_date: Option<String>,
    pub remarks: Option<String>,
    pub hospital_name: String,
}

/// Staff Attendance Report print data
#[derive(Debug, Serialize, Deserialize)]
pub struct StaffAttendanceReportPrintData {
    pub department: String,
    pub month: String,
    pub year: i32,
    pub generated_date: String,
    pub attendance_records: Vec<AttendanceRecord>,
    pub summary: AttendanceSummary,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceRecord {
    pub employee_name: String,
    pub employee_id: String,
    pub designation: String,
    pub days_present: i32,
    pub days_absent: i32,
    pub days_leave: i32,
    pub late_arrivals: i32,
    pub early_departures: i32,
    pub overtime_hours: f64,
    pub daily_attendance: Vec<DailyAttendance>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyAttendance {
    pub date: String,
    pub status: String, // P, A, L, WO, H
    pub in_time: Option<String>,
    pub out_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceSummary {
    pub total_staff: i32,
    pub avg_attendance_percent: f64,
    pub total_leave_days: i32,
    pub total_absent_days: i32,
}

/// Training Attendance / Certificate print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TrainingCertificatePrintData {
    pub certificate_number: String,
    pub certificate_date: String,
    pub employee_name: String,
    pub employee_id: String,
    pub designation: String,
    pub department: String,
    pub training_title: String,
    pub training_type: String, // Internal, External, Online
    pub training_date: String,
    pub training_duration: String,
    pub trainer_name: Option<String>,
    pub trainer_organization: Option<String>,
    pub topics_covered: Vec<String>,
    pub score: Option<f64>,
    pub grade: Option<String>,
    pub certificate_valid_until: Option<String>,
    pub issued_by: String,
    pub qr_verification_url: Option<String>,
    pub hospital_name: String,
    pub hospital_logo_url: Option<String>,
}

/// Staff Credential Verification Form print data
#[derive(Debug, Serialize, Deserialize)]
pub struct StaffCredentialFormPrintData {
    pub verification_number: String,
    pub verification_date: String,
    pub employee_name: String,
    pub employee_id: String,
    pub designation: String,
    pub department: String,
    pub credentials: Vec<CredentialDetail>,
    pub verification_status: String,
    pub verified_by: Option<String>,
    pub remarks: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialDetail {
    pub credential_type: String, // Degree, License, Registration, Certification
    pub credential_name: String,
    pub issuing_authority: String,
    pub credential_number: String,
    pub issue_date: Option<String>,
    pub expiry_date: Option<String>,
    pub verification_status: String, // Verified, Pending, Failed
    pub document_attached: bool,
}

/// Visitor Register print data
#[derive(Debug, Serialize, Deserialize)]
pub struct VisitorRegisterPrintData {
    pub register_date: String,
    pub location: String, // Security Desk, Department
    pub entries: Vec<VisitorEntry>,
    pub total_visitors: i32,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VisitorEntry {
    pub serial_no: i32,
    pub visitor_name: String,
    pub visitor_phone: Option<String>,
    pub visitor_id_type: Option<String>,
    pub visitor_id_number: Option<String>,
    pub purpose: String,
    pub visiting_department: Option<String>,
    pub visiting_person: Option<String>,
    pub patient_name: Option<String>,
    pub patient_uhid: Option<String>,
    pub in_time: String,
    pub out_time: Option<String>,
    pub badge_number: Option<String>,
}

// ── BME/Engineering Forms ─────────────────────────────────────────────────────

/// AMC/CMC Contract Summary Sheet print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AmcContractPrintData {
    pub contract_number: String,
    pub contract_type: String, // AMC, CMC
    pub vendor_name: String,
    pub vendor_contact: Option<String>,
    pub vendor_email: Option<String>,
    pub equipment_covered: Vec<EquipmentCoverage>,
    pub contract_start: String,
    pub contract_end: String,
    pub contract_value: f64,
    pub payment_terms: Option<String>,
    pub response_time_sla: Option<String>,
    pub resolution_time_sla: Option<String>,
    pub inclusions: Vec<String>,
    pub exclusions: Vec<String>,
    pub escalation_contacts: Vec<EscalationContact>,
    pub renewal_date: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EquipmentCoverage {
    pub equipment_name: String,
    pub equipment_id: String,
    pub location: String,
    pub serial_number: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EscalationContact {
    pub level: i32,
    pub name: String,
    pub designation: String,
    pub phone: String,
    pub email: Option<String>,
}

/// Calibration Certificate / Record print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CalibrationCertificatePrintData {
    pub certificate_number: String,
    pub calibration_date: String,
    pub next_calibration_due: String,
    pub equipment_name: String,
    pub equipment_id: String,
    pub serial_number: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub location: String,
    pub calibration_agency: String,
    pub agency_accreditation: Option<String>,
    pub calibration_standard: Option<String>,
    pub parameters_calibrated: Vec<CalibrationParameter>,
    pub calibration_result: String, // Pass, Fail, Conditional
    pub calibrated_by: String,
    pub approved_by: Option<String>,
    pub remarks: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalibrationParameter {
    pub parameter_name: String,
    pub unit: String,
    pub nominal_value: String,
    pub measured_value: String,
    pub tolerance: String,
    pub result: String, // Pass, Fail
}

/// Equipment Breakdown Report print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct EquipmentBreakdownReportPrintData {
    pub report_number: String,
    pub report_date: String,
    pub equipment_name: String,
    pub equipment_id: String,
    pub serial_number: Option<String>,
    pub location: String,
    pub department: String,
    pub breakdown_datetime: String,
    pub reported_by: String,
    pub fault_description: String,
    pub impact_assessment: Option<String>,
    pub immediate_action_taken: Option<String>,
    pub root_cause: Option<String>,
    pub repair_action: Option<String>,
    pub parts_replaced: Vec<ReplacedPart>,
    pub downtime_hours: f64,
    pub repair_cost: Option<f64>,
    pub repaired_by: Option<String>,
    pub repair_completed_at: Option<String>,
    pub verified_by: Option<String>,
    pub preventive_measures: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplacedPart {
    pub part_name: String,
    pub part_number: Option<String>,
    pub quantity: i32,
    pub cost: Option<f64>,
}

/// Equipment History Card (lifecycle summary) print data
#[derive(Debug, Serialize, Deserialize)]
pub struct EquipmentHistoryCardPrintData {
    pub equipment_name: String,
    pub equipment_id: String,
    pub serial_number: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub purchase_date: Option<String>,
    pub installation_date: Option<String>,
    pub warranty_expiry: Option<String>,
    pub purchase_cost: Option<f64>,
    pub location: String,
    pub department: String,
    pub asset_category: Option<String>,
    pub maintenance_history: Vec<MaintenanceEvent>,
    pub breakdown_history: Vec<BreakdownEvent>,
    pub calibration_history: Vec<CalibrationEvent>,
    pub total_maintenance_cost: f64,
    pub total_downtime_hours: f64,
    pub current_status: String,
    pub last_updated: String,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaintenanceEvent {
    pub date: String,
    pub maintenance_type: String, // PM, CM, Inspection
    pub description: String,
    pub performed_by: String,
    pub cost: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BreakdownEvent {
    pub date: String,
    pub fault: String,
    pub downtime_hours: f64,
    pub repair_cost: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalibrationEvent {
    pub date: String,
    pub agency: String,
    pub result: String,
    pub next_due: String,
}

/// MGPS Daily Log (Medical Gas Pipeline System) print data
#[derive(Debug, Serialize, Deserialize)]
pub struct MgpsDailyLogPrintData {
    pub log_date: String,
    pub shift: String,
    pub operator_name: String,
    pub readings: Vec<MgpsReading>,
    pub consumption: MgpsConsumption,
    pub incidents: Vec<MgpsIncident>,
    pub cylinder_status: Vec<CylinderBank>,
    pub manifold_status: String,
    pub remarks: Option<String>,
    pub supervisor_verified: bool,
    pub supervisor_name: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MgpsReading {
    pub time: String,
    pub gas_type: String, // O2, N2O, Air, Vacuum, N2
    pub line_pressure: f64, // bar
    pub purity_percent: Option<f64>,
    pub flow_rate: Option<f64>,
    pub alarm_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MgpsConsumption {
    pub o2_liters: f64,
    pub n2o_liters: f64,
    pub air_liters: f64,
    pub vacuum_liters: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MgpsIncident {
    pub time: String,
    pub description: String,
    pub action_taken: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CylinderBank {
    pub bank_id: String,
    pub gas_type: String,
    pub primary_pressure: f64,
    pub secondary_pressure: f64,
    pub cylinders_full: i32,
    pub cylinders_in_use: i32,
    pub cylinders_empty: i32,
}

/// Water Quality Test Record print data
#[derive(Debug, Serialize, Deserialize)]
pub struct WaterQualityTestPrintData {
    pub test_date: String,
    pub sample_id: String,
    pub sample_location: String,
    pub sample_type: String, // RO Water, Raw Water, Treated Water, Dialysis Water
    pub collected_by: String,
    pub tested_by: String,
    pub test_parameters: Vec<WaterTestParameter>,
    pub overall_result: String, // Pass, Fail
    pub microbiological_results: Option<MicrobiologicalResult>,
    pub action_required: Option<String>,
    pub next_test_due: Option<String>,
    pub remarks: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WaterTestParameter {
    pub parameter: String,
    pub unit: String,
    pub result: String,
    pub acceptable_range: String,
    pub status: String, // Pass, Fail
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MicrobiologicalResult {
    pub total_plate_count: String,
    pub coliform_count: String,
    pub e_coli: String,
    pub pseudomonas: Option<String>,
    pub endotoxin_level: Option<String>,
}

/// DG/UPS Run Log print data
#[derive(Debug, Serialize, Deserialize)]
pub struct DgUpsRunLogPrintData {
    pub log_date: String,
    pub equipment_type: String, // DG, UPS
    pub equipment_id: String,
    pub location: String,
    pub capacity: String,
    pub run_events: Vec<RunEvent>,
    pub fuel_status: Option<FuelStatus>,
    pub battery_status: Option<BatteryStatus>,
    pub daily_parameters: DgUpsParameters,
    pub operator_name: String,
    pub remarks: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunEvent {
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_minutes: f64,
    pub reason: String, // Scheduled Test, Power Outage, Maintenance
    pub load_percent: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FuelStatus {
    pub opening_level: f64,
    pub closing_level: f64,
    pub fuel_added: f64,
    pub fuel_consumed: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatteryStatus {
    pub voltage: f64,
    pub current: f64,
    pub charge_percent: f64,
    pub health_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DgUpsParameters {
    pub voltage_r: Option<f64>,
    pub voltage_y: Option<f64>,
    pub voltage_b: Option<f64>,
    pub frequency: Option<f64>,
    pub load_kw: Option<f64>,
    pub runtime_hours: f64,
}

/// Fire Equipment Inspection Checklist print data
#[derive(Debug, Serialize, Deserialize)]
pub struct FireEquipmentInspectionPrintData {
    pub inspection_date: String,
    pub inspection_number: String,
    pub inspector_name: String,
    pub inspector_designation: String,
    pub area_inspected: String,
    pub fire_extinguishers: Vec<FireExtinguisherCheck>,
    pub fire_alarms: Vec<FireAlarmCheck>,
    pub fire_hydrants: Vec<FireHydrantCheck>,
    pub emergency_exits: Vec<EmergencyExitCheck>,
    pub sprinkler_system: Option<SprinklerCheck>,
    pub overall_status: String,
    pub deficiencies_found: Vec<String>,
    pub corrective_actions: Vec<String>,
    pub next_inspection_due: String,
    pub supervisor_verified: bool,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FireExtinguisherCheck {
    pub location: String,
    pub extinguisher_type: String, // ABC, CO2, DCP, Foam
    pub capacity: String,
    pub expiry_date: String,
    pub pressure_ok: bool,
    pub seal_intact: bool,
    pub accessible: bool,
    pub signage_ok: bool,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FireAlarmCheck {
    pub zone: String,
    pub panel_ok: bool,
    pub detectors_ok: bool,
    pub sounders_ok: bool,
    pub battery_ok: bool,
    pub last_tested: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FireHydrantCheck {
    pub location: String,
    pub water_flow_ok: bool,
    pub hose_condition: String,
    pub nozzle_ok: bool,
    pub valve_operational: bool,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmergencyExitCheck {
    pub location: String,
    pub signage_illuminated: bool,
    pub path_clear: bool,
    pub door_operational: bool,
    pub panic_bar_ok: bool,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SprinklerCheck {
    pub zones_inspected: i32,
    pub heads_ok: bool,
    pub valve_ok: bool,
    pub pressure_ok: bool,
    pub last_flow_test: Option<String>,
    pub status: String,
}

/// Equipment Malfunction / Materiovigilance Report print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MateriovigilanceReportPrintData {
    pub report_number: String,
    pub report_date: String,
    pub reporter_name: String,
    pub reporter_designation: String,
    pub reporter_department: String,
    pub equipment_name: String,
    pub equipment_id: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub lot_batch_number: Option<String>,
    pub incident_date: String,
    pub incident_description: String,
    pub patient_involved: bool,
    pub patient_outcome: Option<String>,
    pub injury_type: Option<String>,
    pub immediate_action: Option<String>,
    pub root_cause_analysis: Option<String>,
    pub corrective_action: Option<String>,
    pub reported_to_cdsco: bool,
    pub cdsco_reference: Option<String>,
    pub status: String,
    pub hospital_name: String,
}

/// Fire Safety Mock Drill Report print data
#[derive(Debug, Serialize, Deserialize)]
pub struct FireMockDrillReportPrintData {
    pub drill_number: String,
    pub drill_date: String,
    pub drill_time: String,
    pub drill_type: String, // Announced, Unannounced
    pub scenario: String,
    pub area_covered: String,
    pub participants_count: i32,
    pub evacuation_time_minutes: f64,
    pub target_time_minutes: f64,
    pub observations: Vec<DrillObservation>,
    pub equipment_used: Vec<String>,
    pub first_responders: Vec<FirstResponder>,
    pub areas_for_improvement: Vec<String>,
    pub recommendations: Vec<String>,
    pub drill_conductor: String,
    pub fire_officer_name: Option<String>,
    pub overall_rating: String, // Excellent, Good, Satisfactory, Needs Improvement
    pub next_drill_scheduled: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DrillObservation {
    pub observation: String,
    pub category: String, // Positive, Negative, Neutral
    pub action_required: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FirstResponder {
    pub name: String,
    pub role: String,
    pub response_time_seconds: i32,
    pub performance: String,
}

// ── Blood Bank & OT Forms ─────────────────────────────────────────────────────

/// OT Register (daily operation theatre list) print data
#[derive(Debug, Serialize, Deserialize)]
pub struct OtRegisterPrintData {
    pub register_date: String,
    pub ot_name: String,
    pub ot_number: String,
    pub surgeries: Vec<OtSurgeryEntry>,
    pub total_surgeries: i32,
    pub total_elective: i32,
    pub total_emergency: i32,
    pub printed_by: String,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OtSurgeryEntry {
    pub serial_no: i32,
    pub patient_name: String,
    pub uhid: String,
    pub age_gender: String,
    pub ip_number: Option<String>,
    pub diagnosis: String,
    pub procedure: String,
    pub surgery_type: String, // Elective, Emergency
    pub surgeon: String,
    pub assistant_surgeon: Option<String>,
    pub anesthesiologist: String,
    pub anesthesia_type: String,
    pub scrub_nurse: Option<String>,
    pub circulating_nurse: Option<String>,
    pub scheduled_time: String,
    pub actual_start: Option<String>,
    pub actual_end: Option<String>,
    pub duration_minutes: Option<i32>,
    pub outcome: Option<String>,
    pub complications: Option<String>,
}

/// Blood Bank Donor Registration Form print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct BloodDonorFormPrintData {
    pub registration_number: String,
    pub registration_date: String,
    pub donor_name: String,
    pub age: i32,
    pub gender: String,
    pub blood_group: String,
    pub rh_factor: String,
    pub father_husband_name: Option<String>,
    pub address: String,
    pub phone: String,
    pub email: Option<String>,
    pub id_proof_type: String,
    pub id_proof_number: String,
    pub occupation: Option<String>,
    pub donation_type: String, // Voluntary, Replacement
    pub previous_donations: i32,
    pub last_donation_date: Option<String>,
    pub medical_history: DonorMedicalHistory,
    pub physical_exam: DonorPhysicalExam,
    pub consent_given: bool,
    pub consent_date: Option<String>,
    pub medical_officer: Option<String>,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DonorMedicalHistory {
    pub recent_illness: bool,
    pub recent_surgery: bool,
    pub recent_transfusion: bool,
    pub chronic_disease: bool,
    pub on_medication: bool,
    pub pregnant_or_lactating: bool,
    pub high_risk_behavior: bool,
    pub tattoo_recent: bool,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DonorPhysicalExam {
    pub weight_kg: f64,
    pub blood_pressure: String,
    pub pulse: i32,
    pub temperature: f64,
    pub hemoglobin: f64,
    pub fit_to_donate: bool,
    pub deferral_reason: Option<String>,
}

/// Blood Bank Cross-Match Requisition print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CrossMatchRequisitionPrintData {
    pub requisition_number: String,
    pub requisition_date: String,
    pub urgency: String, // Routine, Urgent, Emergency
    pub patient_name: String,
    pub uhid: String,
    pub age_gender: String,
    pub ip_number: Option<String>,
    pub ward_bed: String,
    pub blood_group: String,
    pub rh_factor: String,
    pub diagnosis: String,
    pub indication_for_transfusion: String,
    pub units_required: i32,
    pub component_type: String, // Whole Blood, PRBC, FFP, Platelets, Cryoprecipitate
    pub previous_transfusions: i32,
    pub transfusion_reactions_history: bool,
    pub reaction_details: Option<String>,
    pub sample_collected_by: String,
    pub sample_collected_at: String,
    pub requesting_doctor: String,
    pub doctor_signature_date: String,
    pub hospital_name: String,
}

// ── Identity/Clinical Prints ──────────────────────────────────────────────────

/// Appointment Confirmation Slip print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AppointmentSlipPrintData {
    pub appointment_number: String,
    pub appointment_date: String,
    pub appointment_time: String,
    pub patient_name: String,
    pub uhid: String,
    pub phone: Option<String>,
    pub doctor_name: String,
    pub doctor_designation: Option<String>,
    pub department: String,
    pub clinic_location: Option<String>,
    pub visit_type: String, // New, Follow-up
    pub preparation_instructions: Option<String>,
    pub documents_to_bring: Vec<String>,
    pub estimated_wait_time: Option<String>,
    pub contact_for_queries: Option<String>,
    pub cancellation_policy: Option<String>,
    pub qr_code_data: Option<String>,
    pub hospital_name: String,
    pub hospital_address: Option<String>,
    pub hospital_logo_url: Option<String>,
}

/// DPDP Act Data Processing Consent print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DpdpConsentPrintData {
    pub consent_number: String,
    pub consent_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub guardian_name: Option<String>,
    pub data_categories: Vec<DataCategory>,
    pub processing_purposes: Vec<ProcessingPurpose>,
    pub data_sharing: Vec<DataSharingEntity>,
    pub retention_period: String,
    pub patient_rights: Vec<String>,
    pub grievance_officer: GrievanceOfficer,
    pub consent_given: bool,
    pub consent_method: String, // Physical, Digital, OTP
    pub witness_name: Option<String>,
    pub hospital_name: String,
    pub hospital_dpo_contact: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataCategory {
    pub category: String,
    pub description: String,
    pub is_sensitive: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessingPurpose {
    pub purpose: String,
    pub legal_basis: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataSharingEntity {
    pub entity_type: String,
    pub entity_name: Option<String>,
    pub purpose: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GrievanceOfficer {
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
}

/// Video Consent Recording Attachment print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct VideoConsentPrintData {
    pub consent_number: String,
    pub consent_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub consent_type: String,
    pub procedure_name: Option<String>,
    pub video_reference_id: String,
    pub video_duration_seconds: i32,
    pub video_recorded_at: String,
    pub qr_code_to_video: String,
    pub video_url: String,
    pub video_verified: bool,
    pub patient_visible_in_video: bool,
    pub verbal_consent_given: bool,
    pub witness_name: Option<String>,
    pub witness_relationship: Option<String>,
    pub recording_staff: String,
    pub hospital_name: String,
}

/// Restraint Documentation Form (MHCA 2017) print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RestraintDocumentationPrintData {
    pub form_number: String,
    pub form_date: String,
    pub patient_name: String,
    pub uhid: String,
    pub ip_number: Option<String>,
    pub ward: String,
    pub diagnosis: String,
    pub restraint_type: String, // Physical, Chemical, Seclusion
    pub restraint_device: Option<String>,
    pub indication: String,
    pub alternatives_tried: Vec<String>,
    pub start_datetime: String,
    pub planned_duration: String,
    pub actual_end_datetime: Option<String>,
    pub ordering_physician: String,
    pub physician_assessment: String,
    pub nursing_monitoring: Vec<RestraintMonitoring>,
    pub patient_condition_on_release: Option<String>,
    pub family_notified: bool,
    pub family_notification_datetime: Option<String>,
    pub patient_rights_explained: bool,
    pub consent_obtained: bool,
    pub consent_from: Option<String>,
    pub review_by_psychiatrist: bool,
    pub psychiatrist_name: Option<String>,
    pub mhca_compliance_verified: bool,
    pub hospital_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RestraintMonitoring {
    pub datetime: String,
    pub nurse_name: String,
    pub patient_condition: String,
    pub circulation_checked: bool,
    pub hydration_offered: bool,
    pub toileting_offered: bool,
    pub position_changed: bool,
    pub continued_need_assessed: bool,
    pub remarks: Option<String>,
}

// ============================================================================
// PHASE 6: ACADEMIC/SPECIALTY FORMS (Medical College & Branding)
// ============================================================================

/// Student Admission Form print data (Medical College)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StudentAdmissionFormPrintData {
    pub admission_number: String,
    pub admission_date: String,
    pub academic_year: String,
    pub course: String, // MBBS, MD, MS, etc.
    pub batch_year: i32,
    pub student_name: String,
    pub date_of_birth: String,
    pub gender: String,
    pub photo_url: Option<String>,
    pub father_name: String,
    pub mother_name: String,
    pub permanent_address: String,
    pub correspondence_address: String,
    pub phone: String,
    pub email: String,
    pub emergency_contact: String,
    pub blood_group: String,
    pub nationality: String,
    pub category: String, // General, OBC, SC, ST, EWS
    pub admission_quota: String, // Government, Management, NRI
    pub neet_score: Option<i32>,
    pub neet_rank: Option<i32>,
    pub qualifying_exam: String,
    pub qualifying_marks_percent: f64,
    pub documents_submitted: Vec<SubmittedDocument>,
    pub fee_details: AdmissionFeeDetails,
    pub hostel_opted: bool,
    pub medical_fitness_certified: bool,
    pub undertaking_signed: bool,
    pub college_name: String,
    pub university_name: String,
    pub registrar_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmittedDocument {
    pub document_name: String,
    pub original_submitted: bool,
    pub verified: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdmissionFeeDetails {
    pub tuition_fee: f64,
    pub hostel_fee: Option<f64>,
    pub caution_deposit: f64,
    pub total_amount: f64,
    pub payment_mode: String,
    pub receipt_number: Option<String>,
}

/// Intern Rotation Schedule print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InternRotationSchedulePrintData {
    pub schedule_id: String,
    pub academic_year: String,
    pub intern_name: String,
    pub intern_registration_number: String,
    pub batch: String,
    pub internship_start_date: String,
    pub internship_end_date: String,
    pub rotations: Vec<InternRotation>,
    pub total_days: i32,
    pub leave_allowed: i32,
    pub current_posting: Option<InternRotation>,
    pub completed_rotations: i32,
    pub pending_rotations: i32,
    pub mentor_name: String,
    pub coordinator_name: String,
    pub college_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InternRotation {
    pub department: String,
    pub unit: Option<String>,
    pub start_date: String,
    pub end_date: String,
    pub duration_days: i32,
    pub posting_type: String, // Core, Elective
    pub supervisor: String,
    pub status: String, // Pending, Ongoing, Completed
}

/// PG Logbook Entry print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PgLogbookEntryPrintData {
    pub entry_id: String,
    pub entry_date: String,
    pub resident_name: String,
    pub resident_registration: String,
    pub course: String, // MD/MS/DNB
    pub department: String,
    pub year_of_training: i32,
    pub entry_type: String, // Case, Procedure, Surgery, Academic
    pub case_details: Option<PgCaseEntry>,
    pub procedure_details: Option<PgProcedureEntry>,
    pub academic_activity: Option<PgAcademicEntry>,
    pub supervisor_name: String,
    pub supervisor_remarks: Option<String>,
    pub verified: bool,
    pub verification_date: Option<String>,
    pub college_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PgCaseEntry {
    pub diagnosis: String,
    pub presenting_complaints: String,
    pub examination_findings: String,
    pub investigations: String,
    pub treatment_given: String,
    pub learning_points: String,
    pub case_outcome: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PgProcedureEntry {
    pub procedure_name: String,
    pub indication: String,
    pub technique: String,
    pub complications: Option<String>,
    pub assisted_or_performed: String,
    pub count_this_rotation: i32,
    pub cumulative_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PgAcademicEntry {
    pub activity_type: String, // Seminar, Journal Club, Case Presentation
    pub topic: String,
    pub duration_minutes: i32,
    pub feedback_received: Option<String>,
}

/// Internal Assessment Marks print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InternalAssessmentMarksPrintData {
    pub assessment_id: String,
    pub academic_year: String,
    pub term: String, // I, II, III
    pub student_name: String,
    pub roll_number: String,
    pub course: String,
    pub year: i32,
    pub subject: String,
    pub theory_marks: Vec<AssessmentComponent>,
    pub practical_marks: Vec<AssessmentComponent>,
    pub viva_marks: Option<AssessmentComponent>,
    pub theory_total: f64,
    pub theory_max: f64,
    pub practical_total: f64,
    pub practical_max: f64,
    pub grand_total: f64,
    pub grand_max: f64,
    pub percentage: f64,
    pub attendance_percent: f64,
    pub eligible_for_exam: bool,
    pub remarks: Option<String>,
    pub faculty_name: String,
    pub hod_name: String,
    pub college_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssessmentComponent {
    pub component_name: String, // IA1, IA2, Prelims
    pub marks_obtained: f64,
    pub max_marks: f64,
    pub date: String,
}

/// Exam Hall Ticket print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ExamHallTicketPrintData {
    pub hall_ticket_number: String,
    pub exam_name: String,
    pub exam_session: String, // Winter, Summer
    pub academic_year: String,
    pub student_name: String,
    pub roll_number: String,
    pub photo_url: Option<String>,
    pub course: String,
    pub year: i32,
    pub subjects: Vec<ExamSubject>,
    pub exam_center: String,
    pub center_address: String,
    pub reporting_time: String,
    pub instructions: Vec<String>,
    pub student_signature_required: bool,
    pub controller_exam_name: String,
    pub university_name: String,
    pub college_name: String,
    pub issue_date: String,
    pub barcode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExamSubject {
    pub subject_code: String,
    pub subject_name: String,
    pub exam_date: String,
    pub exam_time: String,
    pub paper_type: String, // Theory, Practical, Viva
}

/// OSCE Scoring Sheet print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct OsceScoringSheetPrintData {
    pub exam_id: String,
    pub exam_date: String,
    pub station_number: i32,
    pub station_name: String,
    pub station_type: String, // Manned, Unmanned, Rest
    pub time_allowed_minutes: i32,
    pub candidate_roll: String,
    pub candidate_name: String,
    pub clinical_scenario: String,
    pub tasks: Vec<OsceTask>,
    pub global_rating: Option<OsceGlobalRating>,
    pub total_marks: f64,
    pub max_marks: f64,
    pub pass_marks: f64,
    pub examiner_comments: Option<String>,
    pub examiner_name: String,
    pub examiner_signature_date: String,
    pub college_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsceTask {
    pub task_number: i32,
    pub task_description: String,
    pub max_marks: f64,
    pub marks_obtained: f64,
    pub competency_level: String, // Done correctly, Partially done, Not done
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OsceGlobalRating {
    pub communication_skills: i32, // 1-5
    pub professionalism: i32,
    pub clinical_judgment: i32,
    pub overall_performance: String, // Below expectations, Meets, Exceeds
}

/// Simulation Debriefing Form print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SimulationDebriefingPrintData {
    pub session_id: String,
    pub session_date: String,
    pub scenario_name: String,
    pub scenario_type: String, // BLS, ACLS, Trauma, OB Emergency
    pub duration_minutes: i32,
    pub participants: Vec<SimulationParticipant>,
    pub scenario_objectives: Vec<String>,
    pub events_timeline: Vec<SimulationEvent>,
    pub debriefing_points: Vec<DebriefingPoint>,
    pub key_learning_outcomes: Vec<String>,
    pub areas_for_improvement: Vec<String>,
    pub participant_feedback: Option<String>,
    pub facilitator_name: String,
    pub technician_name: Option<String>,
    pub simulation_center: String,
    pub college_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationParticipant {
    pub name: String,
    pub role_assigned: String,
    pub course: String,
    pub year: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationEvent {
    pub timestamp_minutes: i32,
    pub event_description: String,
    pub expected_action: String,
    pub actual_action: String,
    pub was_correct: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DebriefingPoint {
    pub category: String, // Technical, Communication, Teamwork, Leadership
    pub observation: String,
    pub discussion_summary: String,
}

/// CME Certificate print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CmeCertificatePrintData {
    pub certificate_number: String,
    pub program_name: String,
    pub program_date: String,
    pub program_duration_hours: f64,
    pub credit_hours_awarded: f64,
    pub participant_name: String,
    pub participant_registration: String,
    pub participant_designation: String,
    pub participant_institution: String,
    pub topics_covered: Vec<String>,
    pub faculty_speakers: Vec<CmeFaculty>,
    pub organizing_department: String,
    pub accreditation_body: String, // MCI, State Medical Council
    pub accreditation_number: String,
    pub organizing_secretary: String,
    pub dean_name: String,
    pub college_name: String,
    pub issue_date: String,
    pub qr_code_for_verification: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CmeFaculty {
    pub name: String,
    pub designation: String,
    pub institution: String,
    pub topic: String,
}

/// IEC Approval Certificate print data (Institutional Ethics Committee)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IecApprovalCertificatePrintData {
    pub approval_number: String,
    pub approval_date: String,
    pub study_title: String,
    pub principal_investigator: String,
    pub pi_department: String,
    pub pi_designation: String,
    pub co_investigators: Vec<String>,
    pub study_type: String, // Clinical Trial, Observational, Thesis
    pub study_design: String,
    pub sample_size: i32,
    pub study_duration_months: i32,
    pub approval_type: String, // Full Board, Expedited
    pub approval_category: String, // Initial, Amendment, Continuing Review
    pub conditions: Vec<String>,
    pub valid_until: String,
    pub reporting_requirements: Vec<String>,
    pub ctri_registration: Option<String>,
    pub iec_chairman: String,
    pub member_secretary: String,
    pub meeting_date: String,
    pub meeting_number: String,
    pub institution_name: String,
}

/// Research Proposal Form print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ResearchProposalFormPrintData {
    pub proposal_id: String,
    pub submission_date: String,
    pub project_title: String,
    pub principal_investigator: String,
    pub pi_designation: String,
    pub pi_department: String,
    pub pi_email: String,
    pub pi_phone: String,
    pub co_investigators: Vec<CoInvestigator>,
    pub research_type: String, // Basic, Clinical, Translational, Epidemiological
    pub study_design: String,
    pub objectives: Vec<String>,
    pub background_summary: String,
    pub methodology_summary: String,
    pub sample_size: i32,
    pub sample_size_justification: String,
    pub inclusion_criteria: Vec<String>,
    pub exclusion_criteria: Vec<String>,
    pub outcome_measures: Vec<String>,
    pub statistical_methods: String,
    pub ethical_considerations: String,
    pub informed_consent_process: String,
    pub funding_source: String,
    pub budget_summary: BudgetSummary,
    pub timeline_months: i32,
    pub expected_outcomes: Vec<String>,
    pub institution_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CoInvestigator {
    pub name: String,
    pub designation: String,
    pub department: String,
    pub institution: String,
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetSummary {
    pub personnel: f64,
    pub equipment: f64,
    pub consumables: f64,
    pub travel: f64,
    pub contingency: f64,
    pub total: f64,
}

/// Hostel Allotment Order print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct HostelAllotmentOrderPrintData {
    pub order_number: String,
    pub order_date: String,
    pub academic_year: String,
    pub student_name: String,
    pub student_roll: String,
    pub course: String,
    pub year: i32,
    pub hostel_name: String,
    pub room_number: String,
    pub room_type: String, // Single, Double, Triple
    pub block_wing: Option<String>,
    pub floor: i32,
    pub allotment_from: String,
    pub allotment_to: String,
    pub mess_facility: bool,
    pub mess_type: Option<String>, // Veg, Non-Veg
    pub fee_details: HostelFeeDetails,
    pub rules_acknowledged: bool,
    pub emergency_contact: String,
    pub emergency_phone: String,
    pub medical_conditions: Option<String>,
    pub warden_name: String,
    pub chief_warden_name: String,
    pub college_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HostelFeeDetails {
    pub room_rent: f64,
    pub mess_charges: f64,
    pub establishment_charges: f64,
    pub electricity_advance: f64,
    pub caution_money: f64,
    pub total: f64,
    pub payment_deadline: String,
}

/// Anti-Ragging Undertaking print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AntiRaggingUndertakingPrintData {
    pub undertaking_number: String,
    pub date: String,
    pub academic_year: String,
    pub student_name: String,
    pub student_roll: String,
    pub course: String,
    pub year: i32,
    pub student_phone: String,
    pub student_email: String,
    pub parent_guardian_name: String,
    pub parent_relationship: String,
    pub parent_phone: String,
    pub parent_email: String,
    pub parent_address: String,
    pub ugc_regulations_read: bool,
    pub consequences_understood: bool,
    pub student_declaration: String,
    pub parent_declaration: String,
    pub student_signature_date: String,
    pub parent_signature_date: String,
    pub aadhar_last_four: String, // For verification
    pub anti_ragging_helpline: String,
    pub anti_ragging_email: String,
    pub college_name: String,
}

/// Disability Accommodation Plan print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DisabilityAccommodationPlanPrintData {
    pub plan_id: String,
    pub plan_date: String,
    pub academic_year: String,
    pub student_name: String,
    pub student_roll: String,
    pub course: String,
    pub year: i32,
    pub disability_type: String,
    pub disability_percentage: i32,
    pub disability_certificate_number: String,
    pub issuing_authority: String,
    pub functional_limitations: Vec<String>,
    pub accommodations_granted: Vec<AccommodationItem>,
    pub classroom_accommodations: Vec<String>,
    pub examination_accommodations: Vec<String>,
    pub hostel_accommodations: Option<Vec<String>>,
    pub assistive_devices_provided: Vec<String>,
    pub support_staff_assigned: Option<String>,
    pub review_period_months: i32,
    pub next_review_date: String,
    pub student_consent: bool,
    pub disability_coordinator: String,
    pub dean_academics_name: String,
    pub college_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccommodationItem {
    pub accommodation_type: String,
    pub description: String,
    pub approved: bool,
    pub effective_from: String,
}

/// Internship Completion Certificate print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InternshipCompletionCertificatePrintData {
    pub certificate_number: String,
    pub issue_date: String,
    pub intern_name: String,
    pub intern_registration: String,
    pub parent_name: String,
    pub permanent_address: String,
    pub date_of_birth: String,
    pub mbbs_pass_year: i32,
    pub mbbs_university: String,
    pub internship_start_date: String,
    pub internship_end_date: String,
    pub total_days: i32,
    pub leave_taken: i32,
    pub extension_days: i32,
    pub postings_completed: Vec<InternshipPosting>,
    pub conduct: String, // Good, Satisfactory, etc.
    pub eligible_for_registration: bool,
    pub state_medical_council: String,
    pub principal_name: String,
    pub principal_registration: String,
    pub dean_name: String,
    pub university_name: String,
    pub college_name: String,
    pub college_address: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InternshipPosting {
    pub department: String,
    pub duration_days: i32,
    pub from_date: String,
    pub to_date: String,
    pub supervisor: String,
    pub satisfactory: bool,
}

/// Service Bond Agreement print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ServiceBondAgreementPrintData {
    pub bond_number: String,
    pub bond_date: String,
    pub employee_name: String,
    pub employee_designation: String,
    pub employee_department: String,
    pub employee_address: String,
    pub employee_phone: String,
    pub date_of_joining: String,
    pub bond_period_years: i32,
    pub bond_amount: f64,
    pub bond_amount_words: String,
    pub terms_and_conditions: Vec<String>,
    pub leave_rules: String,
    pub exit_clause: String,
    pub penalty_clause: String,
    pub surety_name: String,
    pub surety_address: String,
    pub surety_relationship: String,
    pub surety_occupation: String,
    pub witness_1_name: String,
    pub witness_1_address: String,
    pub witness_2_name: String,
    pub witness_2_address: String,
    pub notarization_required: bool,
    pub notary_name: Option<String>,
    pub notary_date: Option<String>,
    pub institution_name: String,
    pub institution_address: String,
    pub authorized_signatory: String,
    pub authorized_designation: String,
}

/// Stipend Payment Advice print data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StipendPaymentAdvicePrintData {
    pub advice_number: String,
    pub payment_month: String,
    pub payment_year: i32,
    pub payment_date: String,
    pub recipient_name: String,
    pub recipient_type: String, // Intern, PG Resident, Fellow
    pub recipient_registration: String,
    pub department: String,
    pub year_of_training: i32,
    pub bank_name: String,
    pub bank_account: String,
    pub ifsc_code: String,
    pub earnings: Vec<StipendComponent>,
    pub deductions: Vec<StipendComponent>,
    pub gross_stipend: f64,
    pub total_deductions: f64,
    pub net_payable: f64,
    pub attendance_days: i32,
    pub leave_days: i32,
    pub working_days_in_month: i32,
    pub arrears: f64,
    pub remarks: Option<String>,
    pub prepared_by: String,
    pub verified_by: String,
    pub approved_by: String,
    pub institution_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StipendComponent {
    pub component_name: String,
    pub amount: f64,
}

/// Hospital Branding Configuration print data (letterhead, logo placement)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct HospitalBrandingPrintData {
    pub hospital_name: String,
    pub hospital_tagline: Option<String>,
    pub logo_url: String,
    pub logo_position: String, // Left, Center, Right
    pub logo_size: String, // Small, Medium, Large
    pub secondary_logo_url: Option<String>,
    pub header_style: String, // Minimal, Standard, Full
    pub header_background_color: Option<String>,
    pub header_text_color: Option<String>,
    pub footer_style: String,
    pub address_line_1: String,
    pub address_line_2: Option<String>,
    pub city: String,
    pub state: String,
    pub pincode: String,
    pub phone_numbers: Vec<String>,
    pub email: String,
    pub website: Option<String>,
    pub registration_numbers: Vec<HospitalRegistration>,
    pub accreditations: Vec<String>,
    pub iso_certifications: Vec<String>,
    pub nabh_accredited: bool,
    pub nabl_accredited: bool,
    pub jci_accredited: bool,
    pub watermark_text: Option<String>,
    pub watermark_opacity: f64,
    pub footer_disclaimer: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HospitalRegistration {
    pub registration_type: String, // CEA, NABH, NABL, Drug License, etc.
    pub registration_number: String,
    pub valid_until: Option<String>,
}
