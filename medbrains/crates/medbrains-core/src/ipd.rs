use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "admission_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AdmissionStatus {
    Admitted,
    Transferred,
    Discharged,
    Absconded,
    Deceased,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "discharge_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DischargeType {
    Normal,
    Lama,
    Dama,
    Absconded,
    Referred,
    Deceased,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "progress_note_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ProgressNoteType {
    DoctorRound,
    NursingNote,
    SpecialistOpinion,
    DietitianNote,
    PhysiotherapyNote,
    SocialWorkerNote,
    DischargeNote,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "clinical_assessment_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ClinicalAssessmentType {
    MorseFallScale,
    BradenScale,
    Gcs,
    PainVas,
    PainNrs,
    PainFlacc,
    BarthelAdl,
    NortonScale,
    WaterlowScore,
    Rass,
    Cam,
    News2,
    Mews,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "nursing_task_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NursingTaskPriority {
    Routine,
    Urgent,
    Stat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "nursing_task_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NursingTaskCategory {
    VitalCheck,
    WoundCare,
    CatheterCare,
    Repositioning,
    MouthCare,
    Hygiene,
    Mobilization,
    Teaching,
    DrainCare,
    TracheostomyCare,
    Medication,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "mar_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MarStatus {
    Scheduled,
    Given,
    Held,
    Refused,
    Missed,
    SelfAdministered,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "care_plan_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CarePlanStatus {
    Active,
    Resolved,
    Discontinued,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "nursing_shift", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NursingShift {
    Morning,
    Afternoon,
    Night,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "discharge_summary_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DischargeSummaryStatus {
    Draft,
    Finalized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "admission_source", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AdmissionSource {
    Er,
    Opd,
    Direct,
    Referral,
    TransferIn,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Admission {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub bed_id: Option<Uuid>,
    pub admitting_doctor: Uuid,
    pub status: AdmissionStatus,
    pub admitted_at: DateTime<Utc>,
    pub discharged_at: Option<DateTime<Utc>>,
    pub discharge_type: Option<DischargeType>,
    pub discharge_summary: Option<String>,
    pub provisional_diagnosis: Option<String>,
    pub comorbidities: serde_json::Value,
    pub estimated_los_days: Option<i32>,
    pub deposit_amount: Option<rust_decimal::Decimal>,
    pub deposit_paid: bool,
    pub priority: String,
    pub admission_source: Option<AdmissionSource>,
    pub referral_from: Option<String>,
    pub referral_doctor: Option<String>,
    pub referral_notes: Option<String>,
    pub admission_weight_kg: Option<rust_decimal::Decimal>,
    pub admission_height_cm: Option<rust_decimal::Decimal>,
    pub expected_discharge_date: Option<NaiveDate>,
    pub ward_id: Option<Uuid>,
    pub mlc_case_id: Option<Uuid>,
    pub ip_type: Option<IpType>,
    pub estimated_cost: Option<rust_decimal::Decimal>,
    pub is_critical: bool,
    pub isolation_required: bool,
    pub isolation_reason: Option<String>,
    pub primary_nurse_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NursingTask {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub assigned_to: Option<Uuid>,
    pub task_type: String,
    pub description: String,
    pub is_completed: bool,
    pub due_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub completed_by: Option<Uuid>,
    pub priority: NursingTaskPriority,
    pub category: Option<NursingTaskCategory>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdProgressNote {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub note_type: ProgressNoteType,
    pub author_id: Uuid,
    pub note_date: NaiveDate,
    pub subjective: Option<String>,
    pub objective: Option<String>,
    pub assessment: Option<String>,
    pub plan: Option<String>,
    pub is_addendum: bool,
    pub parent_note_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdClinicalAssessment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub assessment_type: ClinicalAssessmentType,
    pub score_value: Option<rust_decimal::Decimal>,
    pub risk_level: Option<String>,
    pub score_details: serde_json::Value,
    pub assessed_by: Uuid,
    pub assessed_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdMedicationAdministration {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub prescription_item_id: Option<Uuid>,
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub frequency: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub administered_at: Option<DateTime<Utc>>,
    pub status: MarStatus,
    pub administered_by: Option<Uuid>,
    pub witnessed_by: Option<Uuid>,
    pub barcode_verified: bool,
    pub is_high_alert: bool,
    pub hold_reason: Option<String>,
    pub refused_reason: Option<String>,
    pub prn_reason: Option<String>,
    pub missed_reason: Option<String>,
    pub double_checked_by: Option<Uuid>,
    pub notes: Option<String>,
    pub batch_stock_id: Option<Uuid>,
    pub batch_number: Option<String>,
    pub batch_expiry: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdIntakeOutput {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub is_intake: bool,
    pub category: String,
    pub volume_ml: rust_decimal::Decimal,
    pub description: Option<String>,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub shift: NursingShift,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdNursingAssessment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub assessed_by: Uuid,
    pub assessed_at: DateTime<Utc>,
    pub general_appearance: serde_json::Value,
    pub skin_assessment: serde_json::Value,
    pub pain_assessment: serde_json::Value,
    pub nutritional_status: serde_json::Value,
    pub elimination_status: serde_json::Value,
    pub respiratory_status: serde_json::Value,
    pub psychosocial_status: serde_json::Value,
    pub fall_risk_assessment: serde_json::Value,
    pub allergies: Option<String>,
    pub medications_on_admission: Option<String>,
    pub personal_belongings: serde_json::Value,
    pub patient_education_needs: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdCarePlan {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub nursing_diagnosis: String,
    pub goals: Option<String>,
    pub interventions: serde_json::Value,
    pub evaluation: Option<String>,
    pub status: CarePlanStatus,
    pub initiated_by: Uuid,
    pub initiated_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdHandoverReport {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub shift: NursingShift,
    pub handover_date: NaiveDate,
    pub outgoing_nurse: Uuid,
    pub incoming_nurse: Uuid,
    pub identification: Option<String>,
    pub situation: Option<String>,
    pub background: Option<String>,
    pub assessment: Option<String>,
    pub recommendation: Option<String>,
    pub pending_tasks: serde_json::Value,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdDischargeChecklist {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub item_code: String,
    pub item_label: String,
    pub status: String,
    pub completed_by: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Phase 2 structs ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Ward {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub department_id: Option<Uuid>,
    pub ward_type: String,
    pub total_beds: i32,
    pub gender_restriction: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WardBedMapping {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub ward_id: Uuid,
    pub bed_location_id: Uuid,
    pub bed_type_id: Option<Uuid>,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AdmissionAttender {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub relationship: String,
    pub name: String,
    pub phone: Option<String>,
    pub alt_phone: Option<String>,
    pub address: Option<String>,
    pub id_proof_type: Option<String>,
    pub id_proof_number: Option<String>,
    pub is_primary: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DischargeSummaryTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub sections: serde_json::Value,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdDischargeSummary {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub template_id: Option<Uuid>,
    pub status: DischargeSummaryStatus,
    pub final_diagnosis: Option<String>,
    pub condition_at_discharge: Option<String>,
    pub course_in_hospital: Option<String>,
    pub treatment_given: Option<String>,
    pub procedures_performed: serde_json::Value,
    pub investigation_summary: Option<String>,
    pub medications_on_discharge: serde_json::Value,
    pub follow_up_instructions: Option<String>,
    pub follow_up_date: Option<NaiveDate>,
    pub dietary_advice: Option<String>,
    pub activity_restrictions: Option<String>,
    pub warning_signs: Option<String>,
    pub emergency_contact_info: Option<String>,
    pub prepared_by: Option<Uuid>,
    pub verified_by: Option<Uuid>,
    pub finalized_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Phase 2b enums ─────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ip_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IpType {
    General,
    SemiPrivate,
    Private,
    Deluxe,
    Suite,
    Icu,
    Nicu,
    Picu,
    Hdu,
    Isolation,
    Nursery,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "bed_reservation_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BedReservationStatus {
    Active,
    Confirmed,
    Cancelled,
    Expired,
    Fulfilled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ipd_clinical_doc_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IpdClinicalDocType {
    WoundCare,
    CentralLine,
    Catheter,
    Drain,
    Restraint,
    Transfusion,
    ClinicalPathway,
    Other,
    ElopementRisk,
    Dialysis,
    Endoscopy,
    Chemotherapy,
    BloodTransfusionChecklist,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "restraint_check_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RestraintCheckStatus {
    CirculationOk,
    SkinIntact,
    Repositioned,
    Released,
    Escalated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TransferType {
    InterWard,
    InterDepartment,
    InterHospital,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "death_cert_form_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeathCertFormType {
    Form4,
    Form4a,
}

// ── Phase 2b structs ───────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpTypeConfiguration {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub ip_type: IpType,
    pub label: String,
    pub daily_rate: rust_decimal::Decimal,
    pub nursing_charge: rust_decimal::Decimal,
    pub deposit_required: rust_decimal::Decimal,
    pub description: Option<String>,
    pub is_active: bool,
    pub billing_alert_threshold: Option<rust_decimal::Decimal>,
    pub auto_billing_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AdmissionChecklist {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub item_label: String,
    pub category: Option<String>,
    pub is_completed: bool,
    pub completed_by: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub sort_order: i32,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedReservation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub bed_id: Uuid,
    pub patient_id: Uuid,
    pub reserved_by: Uuid,
    pub status: BedReservationStatus,
    pub reserved_from: DateTime<Utc>,
    pub reserved_until: DateTime<Utc>,
    pub purpose: Option<String>,
    pub notes: Option<String>,
    pub cancelled_by: Option<Uuid>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedTurnaroundLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub bed_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub vacated_at: DateTime<Utc>,
    pub cleaning_started_at: Option<DateTime<Utc>>,
    pub cleaning_completed_at: Option<DateTime<Utc>>,
    pub ready_at: Option<DateTime<Utc>>,
    pub turnaround_minutes: Option<i32>,
    pub cleaned_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdClinicalDocumentation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub doc_type: IpdClinicalDocType,
    pub title: String,
    pub body: serde_json::Value,
    pub recorded_by: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub next_review_at: Option<DateTime<Utc>>,
    pub is_resolved: bool,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RestraintMonitoringLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub clinical_doc_id: Uuid,
    pub check_time: DateTime<Utc>,
    pub status: RestraintCheckStatus,
    pub circulation_status: Option<String>,
    pub skin_status: Option<String>,
    pub patient_response: Option<String>,
    pub checked_by: Uuid,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdTransferLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub transfer_type: TransferType,
    pub from_ward_id: Option<Uuid>,
    pub to_ward_id: Option<Uuid>,
    pub from_bed_id: Option<Uuid>,
    pub to_bed_id: Option<Uuid>,
    pub reason: Option<String>,
    pub clinical_summary: Option<String>,
    pub transferred_by: Uuid,
    pub transferred_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdDeathSummary {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub date_of_death: NaiveDate,
    pub time_of_death: NaiveTime,
    pub cause_of_death_primary: String,
    pub cause_of_death_secondary: Option<String>,
    pub cause_of_death_tertiary: Option<String>,
    pub cause_of_death_underlying: Option<String>,
    pub manner_of_death: Option<String>,
    pub duration_of_illness: Option<String>,
    pub autopsy_requested: bool,
    pub is_medico_legal: bool,
    pub form_type: DeathCertFormType,
    pub certifying_doctor_id: Option<Uuid>,
    pub witness_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdBirthRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub mother_patient_id: Uuid,
    pub baby_patient_id: Option<Uuid>,
    pub date_of_birth: NaiveDate,
    pub time_of_birth: NaiveTime,
    pub gender: String,
    pub weight_grams: Option<rust_decimal::Decimal>,
    pub length_cm: Option<rust_decimal::Decimal>,
    pub head_circumference_cm: Option<rust_decimal::Decimal>,
    pub apgar_1min: Option<i32>,
    pub apgar_5min: Option<i32>,
    pub delivery_type: Option<String>,
    pub is_live_birth: bool,
    pub birth_certificate_number: Option<String>,
    pub complications: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IpdDischargeTatLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub admission_id: Uuid,
    pub discharge_initiated_at: Option<DateTime<Utc>>,
    pub billing_cleared_at: Option<DateTime<Utc>>,
    pub pharmacy_cleared_at: Option<DateTime<Utc>>,
    pub nursing_cleared_at: Option<DateTime<Utc>>,
    pub doctor_cleared_at: Option<DateTime<Utc>>,
    pub discharge_completed_at: Option<DateTime<Utc>>,
    pub total_tat_minutes: Option<i32>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Available bed for OPD→IPD admission bed selection.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AvailableBed {
    pub bed_id: Uuid,
    pub bed_number: String,
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub room_number: Option<String>,
    pub bed_type: Option<String>,
    pub is_isolation: bool,
}

// ── Phase 3a response structs ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabOrderSummary {
    pub id: Uuid,
    pub test_name: String,
    pub ordered_at: DateTime<Utc>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabResultSummary {
    pub id: Uuid,
    pub order_id: Uuid,
    pub parameter_name: String,
    pub value: Option<String>,
    pub unit: Option<String>,
    pub reference_range: Option<String>,
    pub is_abnormal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RadiologyOrderSummary {
    pub id: Uuid,
    pub modality: String,
    pub body_part: Option<String>,
    pub ordered_at: DateTime<Utc>,
    pub status: String,
    pub findings: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestigationsResponse {
    pub lab_orders: Vec<LabOrderSummary>,
    pub lab_results: Vec<LabResultSummary>,
    pub radiology_orders: Vec<RadiologyOrderSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatedCostResponse {
    pub daily_rate: rust_decimal::Decimal,
    pub nursing_charge: rust_decimal::Decimal,
    pub estimated_days: i32,
    pub room_total: rust_decimal::Decimal,
    pub nursing_total: rust_decimal::Decimal,
    pub deposit_required: rust_decimal::Decimal,
    pub total_estimated: rust_decimal::Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DeptChargeGroup {
    pub department_name: String,
    pub total: rust_decimal::Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingSummaryResponse {
    pub charges_by_dept: Vec<DeptChargeGroup>,
    pub total_charges: rust_decimal::Decimal,
    pub total_payments: rust_decimal::Decimal,
    pub outstanding_balance: rust_decimal::Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AdmissionPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub admission_date: DateTime<Utc>,
    pub bed_number: Option<String>,
    pub ward_name: Option<String>,
    pub department_name: Option<String>,
    pub doctor_name: Option<String>,
    pub ip_type: Option<String>,
    pub provisional_diagnosis: Option<String>,
}

// ── Phase 3b analytics structs ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SurgeonCaseloadEntry {
    pub surgeon_id: Uuid,
    pub surgeon_name: String,
    pub total_cases: i64,
    pub avg_duration_minutes: Option<f64>,
    pub complication_count: i64,
    pub cancellation_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnesthesiaComplicationEntry {
    pub case_id: Uuid,
    pub patient_name: String,
    pub procedure_name: String,
    pub anesthesia_type: String,
    pub complications: Option<String>,
    pub adverse_events: Option<serde_json::Value>,
    pub case_date: NaiveDate,
}
