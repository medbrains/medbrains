#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, NaiveTime, Utc};
use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::encounter::Encounter;
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::ipd::{
    Admission, AdmissionAttender, AdmissionChecklist, AdmissionPrintData, AdmissionStatus,
    BedReservation, BedTurnaroundLog, BillingSummaryResponse, DeptChargeGroup,
    DischargeSummaryStatus, DischargeSummaryTemplate, DischargeType, EstimatedCostResponse,
    InvestigationsResponse, IpType, IpTypeConfiguration, IpdBirthRecord, IpdCarePlan,
    IpdClinicalAssessment, IpdClinicalDocumentation, IpdDeathSummary, IpdDischargeChecklist,
    IpdDischargeSummary, IpdDischargeTatLog, IpdHandoverReport, IpdIntakeOutput,
    IpdMedicationAdministration, IpdNoDuesCertificate, IpdNursingAssessment, IpdProgressNote,
    IpdTransferLog, IvFluidOrder, LabOrderSummary, LabResultSummary, MarStatus, NursingShift,
    NursingTask,
    ProgressNoteType, RadiologyOrderSummary, RestraintMonitoringLog, Ward, WardBedMapping,
};
use medbrains_core::permissions;
use medbrains_core::privacy::{mask_free_text, mask_identifier_keep_last, mask_name, mask_phone};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use axum::routing::{get,post,put,delete};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_any_permission, require_permission};
use medbrains_server_core::middleware::field_access;
use medbrains_notifications::{NewNotification, create_notification};
use medbrains_server_core::state::AppState;

// ══════════════════════════════════════════════════════════
//  Query / Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListAdmissionsQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AdmissionPrintQuery {
    pub reprint_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AdmissionListResponse {
    pub admissions: Vec<AdmissionRow>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AdmissionRow {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub bed_id: Option<Uuid>,
    pub admitting_doctor: Uuid,
    pub status: AdmissionStatus,
    pub admitted_at: chrono::DateTime<Utc>,
    pub discharged_at: Option<chrono::DateTime<Utc>>,
    pub patient_name: String,
    pub uhid: String,
    pub ward_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAdmissionRequest {
    pub patient_id: Uuid,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub bed_id: Option<Uuid>,
    pub notes: Option<String>,
    pub admission_source: Option<String>,
    pub referral_from: Option<String>,
    pub referral_doctor: Option<String>,
    pub referral_notes: Option<String>,
    pub admission_weight_kg: Option<Decimal>,
    pub admission_height_cm: Option<Decimal>,
    pub expected_discharge_date: Option<NaiveDate>,
    pub ward_id: Option<Uuid>,
    /// Internal training / simulator flag. See OPD CreateEncounterRequest.
    #[serde(default)]
    pub is_dummy: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CreateAdmissionResponse {
    pub encounter: Encounter,
    pub admission: Admission,
}

#[derive(Debug, Serialize)]
pub struct AdmissionDetailResponse {
    pub admission: Admission,
    pub encounter: Encounter,
    pub tasks: Vec<NursingTask>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAdmissionRequest {
    pub bed_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TransferBedRequest {
    pub bed_id: Uuid,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DischargeRequest {
    pub discharge_type: String,
    pub discharge_summary: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct BedOccupancyState {
    pub ward_id: Option<Uuid>,
    pub status: String,
    pub admission_id: Option<Uuid>,
}

#[derive(Debug, sqlx::FromRow)]
struct TransferAdmissionSnapshot {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub from_bed_id: Option<Uuid>,
    pub from_ward_id: Option<Uuid>,
}

async fn lock_available_bed_for_assignment(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    bed_id: Uuid,
    patient_id: Uuid,
) -> Result<BedOccupancyState, AppError> {
    let bed = sqlx::query_as::<_, BedOccupancyState>(
        "SELECT ward_id, status::text AS status, admission_id \
         FROM bed_states \
         WHERE location_id = $1 AND tenant_id = $2 \
         FOR UPDATE",
    )
    .bind(bed_id)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::BadRequest("Target bed is not configured".to_owned()))?;

    if bed.status != "vacant_clean" || bed.admission_id.is_some() {
        return Err(AppError::BadRequest(
            "Target bed is not vacant and clean".to_owned(),
        ));
    }

    let reserved_for_other_patient = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
           SELECT 1 FROM bed_reservations \
           WHERE tenant_id = $1 AND bed_id = $2 \
             AND status IN ('active', 'confirmed') \
             AND reserved_until > NOW() \
             AND patient_id <> $3 \
         )",
    )
    .bind(tenant_id)
    .bind(bed_id)
    .bind(patient_id)
    .fetch_one(&mut *conn)
    .await?;

    if reserved_for_other_patient {
        return Err(AppError::BadRequest(
            "Target bed is reserved for another patient".to_owned(),
        ));
    }

    Ok(bed)
}

struct BedOccupancy<'a> {
    tenant_id: Uuid,
    bed_id: Uuid,
    patient_id: Uuid,
    admission_id: Uuid,
    ward_id: Option<Uuid>,
    changed_by: Uuid,
    reason: &'a str,
}

async fn occupy_admission_bed(
    conn: &mut sqlx::PgConnection,
    occupancy: BedOccupancy<'_>,
) -> Result<(), AppError> {
    let BedOccupancy {
        tenant_id,
        bed_id,
        patient_id,
        admission_id,
        ward_id,
        changed_by,
        reason,
    } = occupancy;
    sqlx::query(
        "UPDATE bed_states SET \
           status = 'occupied'::bed_status, \
           patient_id = $3, \
           admission_id = $4, \
           ward_id = COALESCE($5, ward_id), \
           changed_by = $6, \
           reason = $7, \
           changed_at = NOW(), \
           reserved_for_patient = NULL, \
           reserved_until = NULL \
         WHERE location_id = $1 AND tenant_id = $2",
    )
    .bind(bed_id)
    .bind(tenant_id)
    .bind(patient_id)
    .bind(admission_id)
    .bind(ward_id)
    .bind(changed_by)
    .bind(reason)
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "UPDATE bed_reservations SET status = 'fulfilled'::bed_reservation_status \
         WHERE tenant_id = $1 AND bed_id = $2 AND patient_id = $3 \
           AND status IN ('active', 'confirmed') \
           AND reserved_until > NOW()",
    )
    .bind(tenant_id)
    .bind(bed_id)
    .bind(patient_id)
    .execute(&mut *conn)
    .await?;

    Ok(())
}

async fn release_admission_bed(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    bed_id: Uuid,
    admission_id: Uuid,
    changed_by: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE bed_states SET \
           status = 'vacant_dirty'::bed_status, \
           patient_id = NULL, \
           admission_id = NULL, \
           changed_by = $4, \
           reason = $5, \
           changed_at = NOW(), \
           cleaning_started_at = NULL, \
           cleaning_completed_at = NULL \
         WHERE location_id = $1 AND tenant_id = $2 AND admission_id = $3",
    )
    .bind(bed_id)
    .bind(tenant_id)
    .bind(admission_id)
    .bind(changed_by)
    .bind(reason)
    .execute(&mut *conn)
    .await?;

    sqlx::query(
        "INSERT INTO bed_turnaround_log (tenant_id, bed_id, admission_id, notes) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(bed_id)
    .bind(admission_id)
    .bind(reason)
    .execute(&mut *conn)
    .await?;

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct CreateNursingTaskRequest {
    pub task_type: String,
    pub description: String,
    pub assigned_to: Option<Uuid>,
    pub due_at: Option<chrono::DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNursingTaskRequest {
    pub task_type: Option<String>,
    pub description: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub is_completed: Option<bool>,
    pub due_at: Option<chrono::DateTime<Utc>>,
    pub notes: Option<String>,
}

// ── Progress Notes ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateProgressNoteRequest {
    pub note_type: String,
    pub note_date: NaiveDate,
    pub subjective: Option<String>,
    pub objective: Option<String>,
    pub assessment: Option<String>,
    pub plan: Option<String>,
    pub is_addendum: Option<bool>,
    pub parent_note_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProgressNoteRequest {
    pub subjective: Option<String>,
    pub objective: Option<String>,
    pub assessment: Option<String>,
    pub plan: Option<String>,
}

// ── Assessments ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateAssessmentRequest {
    pub assessment_type: String,
    pub score_value: Option<Decimal>,
    pub risk_level: Option<String>,
    pub score_details: Option<serde_json::Value>,
}

// ── MAR ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateMarRequest {
    pub prescription_item_id: Option<Uuid>,
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub frequency: Option<String>,
    pub scheduled_at: chrono::DateTime<Utc>,
    pub is_high_alert: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMarRequest {
    pub status: String,
    pub administered_at: Option<chrono::DateTime<Utc>>,
    pub witnessed_by: Option<Uuid>,
    pub barcode_verified: Option<bool>,
    pub hold_reason: Option<String>,
    pub refused_reason: Option<String>,
    pub missed_reason: Option<String>,
    pub notes: Option<String>,
}

// ── I/O Chart ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateIoRequest {
    pub is_intake: bool,
    pub category: String,
    pub volume_ml: Decimal,
    pub description: Option<String>,
    pub shift: String,
}

#[derive(Debug, Serialize)]
pub struct IoBalanceResponse {
    pub total_intake_ml: Decimal,
    pub total_output_ml: Decimal,
    pub balance_ml: Decimal,
}

// ── Nursing Assessment ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateNursingAssessmentRequest {
    pub general_appearance: Option<serde_json::Value>,
    pub skin_assessment: Option<serde_json::Value>,
    pub pain_assessment: Option<serde_json::Value>,
    pub nutritional_status: Option<serde_json::Value>,
    pub elimination_status: Option<serde_json::Value>,
    pub respiratory_status: Option<serde_json::Value>,
    pub psychosocial_status: Option<serde_json::Value>,
    pub fall_risk_assessment: Option<serde_json::Value>,
    pub allergies: Option<String>,
    pub medications_on_admission: Option<String>,
    pub personal_belongings: Option<serde_json::Value>,
    pub patient_education_needs: Option<String>,
}

// ── Care Plans ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCarePlanRequest {
    pub nursing_diagnosis: String,
    pub goals: Option<String>,
    pub interventions: Option<serde_json::Value>,
    pub evaluation: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCarePlanRequest {
    pub goals: Option<String>,
    pub interventions: Option<serde_json::Value>,
    pub evaluation: Option<String>,
    pub status: Option<String>,
}

// ── Handover ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateHandoverRequest {
    pub shift: String,
    pub handover_date: NaiveDate,
    pub incoming_nurse: Uuid,
    pub identification: Option<String>,
    pub situation: Option<String>,
    pub background: Option<String>,
    pub assessment: Option<String>,
    pub recommendation: Option<String>,
    pub pending_tasks: Option<serde_json::Value>,
}

// ── Discharge Checklist ────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct InitDischargeChecklistRequest {
    pub items: Vec<DischargeChecklistItem>,
}

#[derive(Debug, Deserialize)]
pub struct DischargeChecklistItem {
    pub item_code: String,
    pub item_label: String,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistItemRequest {
    pub status: String,
}

// ── Phase 2: Wards ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateWardRequest {
    pub code: String,
    pub name: String,
    pub department_id: Option<Uuid>,
    pub ward_type: Option<String>,
    pub gender_restriction: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWardRequest {
    pub name: Option<String>,
    pub department_id: Option<Uuid>,
    pub ward_type: Option<String>,
    pub gender_restriction: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WardListRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub ward_type: String,
    pub total_beds: i32,
    pub vacant_beds: i64,
    pub gender_restriction: String,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct AssignBedToWardRequest {
    pub bed_location_id: Uuid,
    pub bed_type_id: Option<Uuid>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WardBedRow {
    pub mapping_id: Uuid,
    pub bed_location_id: Uuid,
    pub bed_name: String,
    pub bed_type_name: Option<String>,
    pub bed_status: Option<String>,
    pub patient_name: Option<String>,
    pub patient_uhid: Option<String>,
    pub sort_order: i32,
}

// ── Phase 2: Bed Dashboard ───────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BedDashboardSummaryRow {
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub total: i64,
    pub vacant_clean: i64,
    pub vacant_dirty: i64,
    pub occupied: i64,
    pub reserved: i64,
    pub maintenance: i64,
    pub blocked: i64,
}

#[derive(Debug, Deserialize)]
pub struct BedDashboardQuery {
    pub ward_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BedDashboardRow {
    pub bed_state_id: Uuid,
    pub bed_location_id: Uuid,
    pub bed_name: String,
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub bed_status: String,
    pub patient_name: Option<String>,
    pub patient_uhid: Option<String>,
    pub admission_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBedStatusRequest {
    pub status: String,
}

// ── Phase 2: Attenders ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateAttenderRequest {
    pub relationship: String,
    pub name: String,
    pub phone: Option<String>,
    pub alt_phone: Option<String>,
    pub address: Option<String>,
    pub id_proof_type: Option<String>,
    pub id_proof_number: Option<String>,
    pub is_primary: Option<bool>,
}

const IPD_ATTENDER_NAME_FIELD: &str = "ipd.attenders.name";
const IPD_ATTENDER_RELATIONSHIP_FIELD: &str = "ipd.attenders.relationship";
const IPD_ATTENDER_PHONE_FIELD: &str = "ipd.attenders.phone";
const IPD_ATTENDER_ALT_PHONE_FIELD: &str = "ipd.attenders.alt_phone";
const IPD_ATTENDER_ADDRESS_FIELD: &str = "ipd.attenders.address";
const IPD_ATTENDER_ID_PROOF_FIELD: &str = "ipd.attenders.id_proof_number";
const IPD_ADMISSION_PROVISIONAL_DIAGNOSIS_FIELD: &str = "ipd.admissions.provisional_diagnosis";
const IPD_DISCHARGE_FINAL_DIAGNOSIS_FIELD: &str = "ipd.discharge_summary.final_diagnosis";
const IPD_BILLING_AMOUNT_FIELD: &str = "billing.amount";
const MLC_FIR_NUMBER_FIELD: &str = "emergency.mlc.fir_number";
const MLC_POLICE_STATION_FIELD: &str = "emergency.mlc.police_station";
const MLC_INFORMANT_NAME_FIELD: &str = "emergency.mlc.informant_name";
const MLC_INFORMANT_RELATION_FIELD: &str = "emergency.mlc.informant_relation";
const MLC_INFORMANT_CONTACT_FIELD: &str = "emergency.mlc.informant_contact";
const MLC_HISTORY_FIELD: &str = "emergency.mlc.history_of_incident";
const MLC_EXAMINATION_FIELD: &str = "emergency.mlc.examination_findings";
const MLC_MEDICAL_OPINION_FIELD: &str = "emergency.mlc.medical_opinion";
const MLC_CAUSE_OF_DEATH_FIELD: &str = "emergency.mlc.cause_of_death";
const IPD_ADMISSION_WORKSPACE_PERMISSIONS: &[&str] = &[
    permissions::ipd::admissions::VIEW,
    permissions::ipd::admissions::UPDATE,
    permissions::ipd::admissions::PRINT,
    permissions::ipd::admissions::REPRINT,
    permissions::ipd::attenders::MANAGE,
    permissions::ipd::wristband::PRINT,
    permissions::ipd::wristband::REPRINT,
    permissions::ipd::discharge::CREATE,
    permissions::ipd::progress_notes::LIST,
    permissions::ipd::progress_notes::CREATE,
    permissions::ipd::assessments::LIST,
    permissions::ipd::assessments::CREATE,
    permissions::ipd::mar::LIST,
    permissions::ipd::mar::CREATE,
    permissions::ipd::mar::UPDATE,
    permissions::ipd::io_chart::LIST,
    permissions::ipd::io_chart::CREATE,
    permissions::ipd::nursing_assessment::LIST,
    permissions::ipd::nursing_assessment::CREATE,
    permissions::ipd::care_plans::LIST,
    permissions::ipd::care_plans::CREATE,
    permissions::ipd::handover::LIST,
    permissions::ipd::handover::CREATE,
    permissions::ipd::discharge_checklist::LIST,
    permissions::ipd::discharge_checklist::UPDATE,
    permissions::ipd::discharge_summary::CREATE,
    permissions::ipd::discharge_summary::FINALIZE,
    permissions::ipd::clinical_docs::LIST,
    permissions::ipd::clinical_docs::CREATE,
    permissions::ipd::transfers::CREATE,
    permissions::ipd::death_records::MANAGE,
    permissions::ipd::birth_records::MANAGE,
    permissions::ipd::discharge_tat::VIEW,
    permissions::ipd::discharge_tat::UPDATE,
    permissions::ipd::discharge_tat::BILLING_UPDATE,
    permissions::ipd::discharge_tat::PHARMACY_UPDATE,
    permissions::ipd::discharge_tat::NURSING_UPDATE,
    permissions::ipd::discharge_tat::DOCTOR_UPDATE,
    permissions::ipd::discharge_tat::COMPLETE,
    permissions::pharmacy::prescriptions::LIST,
    permissions::pharmacy::dispensing::CREATE,
    permissions::billing::invoices::LIST,
    permissions::billing::invoices::VIEW,
    permissions::billing::advances::LIST,
    permissions::billing::corporate::LIST,
    permissions::consent::signatures::LIST,
    permissions::emergency::mlc::LIST,
    permissions::lab::orders::LIST,
    permissions::lab::orders::VIEW,
    permissions::lab::reports::VIEW,
    permissions::lab::orders::CREATE,
    permissions::opd::diagnoses::LIST,
    permissions::opd::diagnoses::CREATE,
    permissions::opd::diagnoses::UPDATE,
    permissions::opd::diagnoses::DELETE,
    permissions::radiology::orders::LIST,
    permissions::radiology::orders::VIEW,
    permissions::radiology::orders::CREATE,
    permissions::ot::bookings::LIST,
    permissions::ot::bookings::CREATE,
    permissions::diet::orders::LIST,
    permissions::diet::orders::CREATE,
    permissions::bedside::VIEW,
    permissions::bedside::REQUEST,
    permissions::bedside::videos::LIST,
    permissions::bedside::videos::MANAGE,
    permissions::bedside::feedback::LIST,
    permissions::bedside::feedback::CREATE,
    permissions::bedside::sessions::LIST,
    permissions::bedside::sessions::MANAGE,
    permissions::nurse::dashboard::VIEW,
    permissions::nurse::mar::VIEW,
    permissions::nurse::vitals::VIEW,
    permissions::nurse::vitals::RECORD,
    permissions::nurse::intake_output::VIEW,
    permissions::nurse::intake_output::RECORD,
    permissions::nurse::pain::VIEW,
    permissions::nurse::pain::RECORD,
    permissions::nurse::fall_risk::VIEW,
    permissions::nurse::fall_risk::RECORD,
    permissions::nurse::wound::VIEW,
    permissions::nurse::wound::RECORD,
    permissions::nurse::handoff::VIEW,
    permissions::nurse::handoff::RECORD,
    permissions::nurse::equipment::VIEW,
    permissions::nurse::equipment::RECORD,
    permissions::nurse::code_blue::VIEW,
    permissions::nurse::code_blue::RECORD,
    permissions::indent::LIST,
    permissions::indent::CONSUMABLES_LIST,
    permissions::assets::LIST,
    permissions::bme::equipment::LIST,
    permissions::infection_control::surveillance::LIST,
    permissions::infection_control::biowaste::LIST,
    permissions::facilities::gas::LIST,
    permissions::mrd::case_sheets::GENERATE,
    permissions::specialty::palliative::mortuary::LIST,
    permissions::specialty::palliative::mortuary::MANAGE,
];
const IPD_ADMISSION_TASK_CONTEXT_PERMISSIONS: &[&str] = &[
    permissions::ipd::admissions::VIEW,
    permissions::ipd::nursing_assessment::LIST,
    permissions::ipd::nursing_assessment::CREATE,
];

fn claims_have_any_permission(claims: &Claims, permissions: &[&str]) -> bool {
    is_bypass_role(claims)
        || permissions.iter().any(|permission| {
            claims
                .permissions
                .iter()
                .any(|granted| granted == permission)
        })
}

fn resolved_attender_field_access(
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
    field: &str,
    fallback: Option<&str>,
) -> FieldAccessLevel {
    restricted
        .get(field)
        .copied()
        .or_else(|| fallback.and_then(|fallback_field| restricted.get(fallback_field).copied()))
        .unwrap_or(FieldAccessLevel::Edit)
}

fn can_write_attender_field(level: FieldAccessLevel) -> bool {
    level == FieldAccessLevel::Edit
}

fn should_hide_attender_field(level: FieldAccessLevel) -> bool {
    level == FieldAccessLevel::Hidden
}

fn should_mask_attender_field(level: FieldAccessLevel) -> bool {
    level == FieldAccessLevel::Mask
}

fn billing_amount_access(
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> FieldAccessLevel {
    resolved_attender_field_access(restricted, IPD_BILLING_AMOUNT_FIELD, None)
}

fn should_scrub_ipd_billing_amount(
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> bool {
    matches!(
        billing_amount_access(restricted),
        FieldAccessLevel::Mask | FieldAccessLevel::Hidden
    )
}

fn has_attender_text(value: &Option<String>) -> bool {
    value.as_deref().is_some_and(|text| !text.trim().is_empty())
}

async fn resolve_ipd_restricted_fields(
    state: &AppState,
    claims: &Claims,
) -> Result<std::collections::HashMap<String, FieldAccessLevel>, AppError> {
    field_access::resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role)
        .await
}

fn validate_attender_write_access(
    body: &CreateAttenderRequest,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    let mut violations = Vec::new();
    let name_access = resolved_attender_field_access(restricted, IPD_ATTENDER_NAME_FIELD, None);
    let relationship_access =
        resolved_attender_field_access(restricted, IPD_ATTENDER_RELATIONSHIP_FIELD, None);
    let phone_access = resolved_attender_field_access(restricted, IPD_ATTENDER_PHONE_FIELD, None);
    let alt_phone_access = resolved_attender_field_access(
        restricted,
        IPD_ATTENDER_ALT_PHONE_FIELD,
        Some(IPD_ATTENDER_PHONE_FIELD),
    );
    let address_access =
        resolved_attender_field_access(restricted, IPD_ATTENDER_ADDRESS_FIELD, None);
    let id_proof_access =
        resolved_attender_field_access(restricted, IPD_ATTENDER_ID_PROOF_FIELD, None);

    if !can_write_attender_field(name_access) {
        violations.push("name");
    }
    if !can_write_attender_field(relationship_access) {
        violations.push("relationship");
    }
    if has_attender_text(&body.phone) && !can_write_attender_field(phone_access) {
        violations.push("phone");
    }
    if has_attender_text(&body.alt_phone) && !can_write_attender_field(alt_phone_access) {
        violations.push("alt_phone");
    }
    if has_attender_text(&body.address) && !can_write_attender_field(address_access) {
        violations.push("address");
    }
    if (has_attender_text(&body.id_proof_type) || has_attender_text(&body.id_proof_number))
        && !can_write_attender_field(id_proof_access)
    {
        violations.push("id_proof");
    }

    if violations.is_empty() {
        return Ok(());
    }

    Err(AppError::BadRequest(format!(
        "Cannot write restricted IPD attender fields: {}",
        violations.join(", ")
    )))
}

fn filter_attender_response(
    mut row: AdmissionAttender,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> AdmissionAttender {
    let name_access = resolved_attender_field_access(restricted, IPD_ATTENDER_NAME_FIELD, None);
    let relationship_access =
        resolved_attender_field_access(restricted, IPD_ATTENDER_RELATIONSHIP_FIELD, None);
    let phone_access = resolved_attender_field_access(restricted, IPD_ATTENDER_PHONE_FIELD, None);
    let alt_phone_access = resolved_attender_field_access(
        restricted,
        IPD_ATTENDER_ALT_PHONE_FIELD,
        Some(IPD_ATTENDER_PHONE_FIELD),
    );
    let address_access =
        resolved_attender_field_access(restricted, IPD_ATTENDER_ADDRESS_FIELD, None);
    let id_proof_access =
        resolved_attender_field_access(restricted, IPD_ATTENDER_ID_PROOF_FIELD, None);

    if should_hide_attender_field(name_access) {
        row.name = "Restricted".to_owned();
    } else if should_mask_attender_field(name_access) {
        row.name = mask_name(&row.name);
    }
    if should_hide_attender_field(relationship_access) {
        row.relationship = "Restricted".to_owned();
    } else if should_mask_attender_field(relationship_access) {
        row.relationship = mask_free_text(&row.relationship);
    }
    if should_hide_attender_field(phone_access) {
        row.phone = None;
        row.alt_phone = None;
    } else if should_mask_attender_field(phone_access) {
        row.phone = row.phone.map(|value| mask_phone(&value));
        row.alt_phone = row.alt_phone.map(|value| mask_phone(&value));
    } else if should_hide_attender_field(alt_phone_access) {
        row.alt_phone = None;
    } else if should_mask_attender_field(alt_phone_access) {
        row.alt_phone = row.alt_phone.map(|value| mask_phone(&value));
    }
    if should_hide_attender_field(address_access) {
        row.address = None;
    } else if should_mask_attender_field(address_access) {
        row.address = row.address.map(|value| mask_free_text(&value));
    }
    if should_hide_attender_field(id_proof_access) {
        row.id_proof_type = None;
        row.id_proof_number = None;
    } else if should_mask_attender_field(id_proof_access) {
        row.id_proof_number = row
            .id_proof_number
            .map(|value| mask_identifier_keep_last(&value, 4));
    }

    row
}

fn filter_admission_response(
    mut row: Admission,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> Admission {
    let diagnosis_access =
        resolved_attender_field_access(restricted, IPD_ADMISSION_PROVISIONAL_DIAGNOSIS_FIELD, None);
    if should_hide_attender_field(diagnosis_access) {
        row.provisional_diagnosis = None;
    } else if should_mask_attender_field(diagnosis_access) {
        row.provisional_diagnosis = row
            .provisional_diagnosis
            .map(|value| mask_free_text(&value));
    }
    if should_scrub_ipd_billing_amount(restricted) {
        row.deposit_amount = None;
        row.estimated_cost = None;
    }
    row
}

fn filter_admission_row_response(
    mut row: AdmissionRow,
    can_view_patient_identity: bool,
) -> AdmissionRow {
    if !can_view_patient_identity {
        row.patient_name = "Restricted".to_owned();
        row.uhid = "Restricted".to_owned();
    }
    row
}

fn filter_ip_type_configuration_response(
    mut row: IpTypeConfiguration,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> IpTypeConfiguration {
    if should_scrub_ipd_billing_amount(restricted) {
        row.daily_rate = Decimal::ZERO;
        row.nursing_charge = Decimal::ZERO;
        row.deposit_required = Decimal::ZERO;
        row.billing_alert_threshold = None;
    }
    row
}

fn filter_estimated_cost_response(
    mut row: EstimatedCostResponse,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> EstimatedCostResponse {
    if should_scrub_ipd_billing_amount(restricted) {
        row.daily_rate = Decimal::ZERO;
        row.nursing_charge = Decimal::ZERO;
        row.room_total = Decimal::ZERO;
        row.nursing_total = Decimal::ZERO;
        row.deposit_required = Decimal::ZERO;
        row.total_estimated = Decimal::ZERO;
    }
    row
}

fn filter_billing_summary_response(
    mut row: BillingSummaryResponse,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> BillingSummaryResponse {
    if should_scrub_ipd_billing_amount(restricted) {
        row.charges_by_dept = row
            .charges_by_dept
            .into_iter()
            .map(|mut charge| {
                charge.total = Decimal::ZERO;
                charge
            })
            .collect();
        row.total_charges = Decimal::ZERO;
        row.total_payments = Decimal::ZERO;
        row.outstanding_balance = Decimal::ZERO;
    }
    row
}

fn filter_receipt_amount_response(
    mut row: medbrains_core::billing::Receipt,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> medbrains_core::billing::Receipt {
    if should_scrub_ipd_billing_amount(restricted) {
        row.amount = Decimal::ZERO;
    }
    row
}

fn filter_admission_print_data_response(
    mut row: AdmissionPrintData,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> AdmissionPrintData {
    let diagnosis_access =
        resolved_attender_field_access(restricted, IPD_ADMISSION_PROVISIONAL_DIAGNOSIS_FIELD, None);
    if should_hide_attender_field(diagnosis_access) {
        row.provisional_diagnosis = None;
    } else if should_mask_attender_field(diagnosis_access) {
        row.provisional_diagnosis = row
            .provisional_diagnosis
            .map(|value| mask_free_text(&value));
    }
    row
}

fn filter_discharge_summary_response(
    mut row: IpdDischargeSummary,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> IpdDischargeSummary {
    let diagnosis_access =
        resolved_attender_field_access(restricted, IPD_DISCHARGE_FINAL_DIAGNOSIS_FIELD, None);
    if should_hide_attender_field(diagnosis_access) {
        row.final_diagnosis = None;
    } else if should_mask_attender_field(diagnosis_access) {
        row.final_diagnosis = row.final_diagnosis.map(|value| mask_free_text(&value));
    }
    row
}

fn has_ipd_text(value: &Option<String>) -> bool {
    value.as_deref().is_some_and(|text| !text.trim().is_empty())
}

fn has_ip_type_amount_change(
    daily_rate: Option<Decimal>,
    nursing_charge: Option<Decimal>,
    deposit_required: Option<Decimal>,
    billing_alert_threshold: Option<Decimal>,
) -> bool {
    daily_rate.is_some()
        || nursing_charge.is_some()
        || deposit_required.is_some()
        || billing_alert_threshold.is_some()
}

fn validate_ip_type_amount_write_access(
    daily_rate: Option<Decimal>,
    nursing_charge: Option<Decimal>,
    deposit_required: Option<Decimal>,
    billing_alert_threshold: Option<Decimal>,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if !has_ip_type_amount_change(
        daily_rate,
        nursing_charge,
        deposit_required,
        billing_alert_threshold,
    ) || billing_amount_access(restricted) == FieldAccessLevel::Edit
    {
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Cannot write restricted IPD billing amount fields".to_owned(),
    ))
}

fn ip_type_room_charge_code(ip_type: IpType) -> &'static str {
    match ip_type {
        IpType::General => "ROOM_GEN",
        IpType::SemiPrivate => "ROOM_SEMI",
        IpType::Private => "ROOM_PVT",
        IpType::Deluxe => "ROOM_DELUXE",
        IpType::Suite => "ROOM_SUITE",
        IpType::Icu => "ROOM_ICU",
        IpType::Nicu => "ROOM_NICU",
        IpType::Picu => "ROOM_PICU",
        IpType::Hdu => "ROOM_HDU",
        IpType::Isolation => "ROOM_ISO",
        IpType::Nursery => "ROOM_NURSERY",
    }
}

fn validate_discharge_summary_write_access(
    final_diagnosis: &Option<String>,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if !has_ipd_text(final_diagnosis) {
        return Ok(());
    }
    let diagnosis_access =
        resolved_attender_field_access(restricted, IPD_DISCHARGE_FINAL_DIAGNOSIS_FIELD, None);
    if can_write_attender_field(diagnosis_access) {
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Cannot write restricted IPD discharge diagnosis fields".to_owned(),
    ))
}

fn filter_ipd_mlc_case_response(
    mut row: medbrains_core::emergency::MlcCase,
    restricted: &std::collections::HashMap<String, FieldAccessLevel>,
) -> medbrains_core::emergency::MlcCase {
    let fir_access = resolved_attender_field_access(restricted, MLC_FIR_NUMBER_FIELD, None);
    if should_hide_attender_field(fir_access) {
        row.fir_number = None;
    } else if should_mask_attender_field(fir_access) {
        row.fir_number = row
            .fir_number
            .map(|value| mask_identifier_keep_last(&value, 4));
    }
    let police_access = resolved_attender_field_access(restricted, MLC_POLICE_STATION_FIELD, None);
    if should_hide_attender_field(police_access) {
        row.police_station = None;
    } else if should_mask_attender_field(police_access) {
        row.police_station = row.police_station.map(|value| mask_free_text(&value));
    }
    let informant_name_access =
        resolved_attender_field_access(restricted, MLC_INFORMANT_NAME_FIELD, None);
    if should_hide_attender_field(informant_name_access) {
        row.informant_name = None;
    } else if should_mask_attender_field(informant_name_access) {
        row.informant_name = row.informant_name.map(|value| mask_name(&value));
    }
    let informant_relation_access =
        resolved_attender_field_access(restricted, MLC_INFORMANT_RELATION_FIELD, None);
    if should_hide_attender_field(informant_relation_access) {
        row.informant_relation = None;
    } else if should_mask_attender_field(informant_relation_access) {
        row.informant_relation = row.informant_relation.map(|value| mask_free_text(&value));
    }
    let informant_contact_access =
        resolved_attender_field_access(restricted, MLC_INFORMANT_CONTACT_FIELD, None);
    if should_hide_attender_field(informant_contact_access) {
        row.informant_contact = None;
    } else if should_mask_attender_field(informant_contact_access) {
        row.informant_contact = row.informant_contact.map(|value| mask_phone(&value));
    }
    let history_access = resolved_attender_field_access(restricted, MLC_HISTORY_FIELD, None);
    if should_hide_attender_field(history_access) {
        row.history_of_incident = None;
    } else if should_mask_attender_field(history_access) {
        row.history_of_incident = row.history_of_incident.map(|value| mask_free_text(&value));
    }
    let examination_access =
        resolved_attender_field_access(restricted, MLC_EXAMINATION_FIELD, None);
    if should_hide_attender_field(examination_access) {
        row.examination_findings = None;
    } else if should_mask_attender_field(examination_access) {
        row.examination_findings = row.examination_findings.map(|value| mask_free_text(&value));
    }
    let opinion_access =
        resolved_attender_field_access(restricted, MLC_MEDICAL_OPINION_FIELD, None);
    if should_hide_attender_field(opinion_access) {
        row.medical_opinion = None;
    } else if should_mask_attender_field(opinion_access) {
        row.medical_opinion = row.medical_opinion.map(|value| mask_free_text(&value));
    }
    let cause_access = resolved_attender_field_access(restricted, MLC_CAUSE_OF_DEATH_FIELD, None);
    if should_hide_attender_field(cause_access) {
        row.cause_of_death = None;
    } else if should_mask_attender_field(cause_access) {
        row.cause_of_death = row.cause_of_death.map(|value| mask_free_text(&value));
    }

    row
}

// ── Phase 2: Discharge Summary ───────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateDischargeTemplateRequest {
    pub code: String,
    pub name: String,
    pub sections: Option<serde_json::Value>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDischargeSummaryRequest {
    pub template_id: Option<Uuid>,
    pub final_diagnosis: Option<String>,
    pub condition_at_discharge: Option<String>,
    pub course_in_hospital: Option<String>,
    pub treatment_given: Option<String>,
    pub procedures_performed: Option<serde_json::Value>,
    pub investigation_summary: Option<String>,
    pub medications_on_discharge: Option<serde_json::Value>,
    pub follow_up_instructions: Option<String>,
    pub follow_up_date: Option<NaiveDate>,
    pub dietary_advice: Option<String>,
    pub activity_restrictions: Option<String>,
    pub warning_signs: Option<String>,
    pub emergency_contact_info: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDischargeSummaryRequest {
    pub final_diagnosis: Option<String>,
    pub condition_at_discharge: Option<String>,
    pub course_in_hospital: Option<String>,
    pub treatment_given: Option<String>,
    pub procedures_performed: Option<serde_json::Value>,
    pub investigation_summary: Option<String>,
    pub medications_on_discharge: Option<serde_json::Value>,
    pub follow_up_instructions: Option<String>,
    pub follow_up_date: Option<NaiveDate>,
    pub dietary_advice: Option<String>,
    pub activity_restrictions: Option<String>,
    pub warning_signs: Option<String>,
    pub emergency_contact_info: Option<String>,
}

// ── Phase 2: Reports ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ReportDateQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CensusWardRow {
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub total_beds: i64,
    pub occupied: i64,
    pub vacant: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OccupancyRow {
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub total_beds: i64,
    pub occupied_bed_days: i64,
    pub total_bed_days: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AlosRow {
    pub department_name: Option<String>,
    pub discharge_type: Option<DischargeType>,
    pub avg_los_days: Option<f64>,
    pub discharge_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DischargeStatRow {
    pub discharge_type: Option<DischargeType>,
    pub count: i64,
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions
// ══════════════════════════════════════════════════════════

pub async fn list_admissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAdmissionsQuery>,
) -> Result<Json<AdmissionListResponse>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::LIST)?;
    let can_view_patient_identity =
        claims_have_any_permission(&claims, &[permissions::patients::VIEW]);

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // ── ReBAC scope — only admissions caller has `view` on ────
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    let visible_ids: Option<Vec<Uuid>> = if authz_ctx.is_bypass {
        None
    } else {
        Some(
            match state.authz.list_accessible(&authz_ctx, "admission", medbrains_authz::Relation::Viewer).await {
            Ok(ids) => ids,
            Err(e) => {
                tracing::error!(error = %e, object_type = "admission",
                    "rebac: list_accessible failed; refusing rather than showing an empty list");
                return Err(AppError::ServiceUnavailable(
                    "authorization backend unavailable".to_owned(),
                ));
            }
        },
        )
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut conditions = vec!["a.tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;
    if let Some(ref ids) = visible_ids {
        if ids.is_empty() {
            return Ok(Json(AdmissionListResponse {
                admissions: Vec::new(),
                total: 0,
                page,
                per_page,
            }));
        }
        conditions.push(format!("a.id = ANY(${bind_idx}::uuid[])"));
        bind_idx += 1;
    }

    #[allow(clippy::items_after_statements, clippy::struct_field_names)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref status) = params.status {
        conditions.push(format!("a.status::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
        });
        bind_idx += 1;
    }
    if let Some(dept) = params.department_id {
        conditions.push(format!("e.department_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(dept),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(doc) = params.doctor_id {
        conditions.push(format!("a.admitting_doctor = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(doc),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(pid) = params.patient_id {
        conditions.push(format!("a.patient_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(pid),
            string_val: None,
        });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!(
        "SELECT COUNT(*) FROM admissions a \
         JOIN encounters e ON e.id = a.encounter_id \
         WHERE {where_clause}"
    );
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            count_q = count_q.bind(u);
        }
        if let Some(ref s) = b.string_val {
            count_q = count_q.bind(s.clone());
        }
    }
    if let Some(ref ids) = visible_ids {
        count_q = count_q.bind(ids.clone());
    }
    let total = count_q.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT a.id, a.encounter_id, a.patient_id, a.bed_id, \
               a.admitting_doctor, a.status, a.admitted_at, a.discharged_at, \
               CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) AS patient_name, \
               p.uhid, \
               w.name AS ward_name \
         FROM admissions a \
         JOIN encounters e ON e.id = a.encounter_id \
         JOIN patients p ON p.id = a.patient_id \
         LEFT JOIN wards w ON w.id = a.ward_id \
         WHERE {where_clause} \
         ORDER BY a.admitted_at DESC \
         LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut data_q = sqlx::query_as::<_, AdmissionRow>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            data_q = data_q.bind(u);
        }
        if let Some(ref s) = b.string_val {
            data_q = data_q.bind(s.clone());
        }
    }
    if let Some(ref ids) = visible_ids {
        data_q = data_q.bind(ids.clone());
    }
    let admissions = data_q
        .bind(per_page)
        .bind(offset)
        .fetch_all(&mut *tx)
        .await?
        .into_iter()
        .map(|row| filter_admission_row_response(row, can_view_patient_identity))
        .collect();

    tx.commit().await?;

    Ok(Json(AdmissionListResponse {
        admissions,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions
// ══════════════════════════════════════════════════════════

pub async fn create_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAdmissionRequest>,
) -> Result<Json<CreateAdmissionResponse>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // A patient recorded as deceased must never be admitted — re-admitting a dead patient
    // is a data-integrity and medico-legal error (correct the death record instead).
    if sqlx::query_scalar::<_, bool>(
        "SELECT is_deceased FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or(false)
    {
        return Err(AppError::Conflict(
            "Patient is recorded as deceased and cannot be admitted.".to_owned(),
        ));
    }

    // A patient can physically occupy only one bed at a time. Block a second active
    // admission so bed census, billing, and order routing can't fork across duplicate
    // records for the same patient.
    // ponytail: this SELECT guard catches the realistic case (double-click / sequential
    // re-admit). A partial unique index on (tenant_id, patient_id) WHERE status IN
    // ('admitted','transferred') would also close the concurrent-request race — add once
    // existing data is confirmed free of duplicate active admissions.
    if let Some(existing_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM admissions \
         WHERE tenant_id = $1 AND patient_id = $2 \
           AND status IN ('admitted'::admission_status, 'transferred'::admission_status) \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .fetch_optional(&mut *tx)
    .await?
    {
        return Err(AppError::Conflict(format!(
            "Patient already has an active admission ({existing_id}). Discharge or transfer \
             the current admission before admitting the patient again."
        )));
    }

    let today = medbrains_server_core::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?;
    let doctor_id = body.doctor_id.unwrap_or(claims.sub);
    let is_dummy = body.is_dummy.unwrap_or(false) && is_bypass_role(&claims);
    let target_bed = if let Some(bed_id) = body.bed_id {
        Some(
            lock_available_bed_for_assignment(&mut tx, claims.tenant_id, bed_id, body.patient_id)
                .await?,
        )
    } else {
        None
    };
    let effective_ward_id = body
        .ward_id
        .or_else(|| target_bed.as_ref().and_then(|bed| bed.ward_id));

    let encounter = sqlx::query_as::<_, Encounter>(
        "INSERT INTO encounters \
           (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
            encounter_date, notes, attributes, is_dummy) \
         VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, $4, $5, $6, '{}', $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(doctor_id)
    .bind(today)
    .bind(&body.notes)
    .bind(is_dummy)
    .fetch_one(&mut *tx)
    .await?;

    let admission = sqlx::query_as::<_, Admission>(
        "INSERT INTO admissions \
           (tenant_id, encounter_id, patient_id, bed_id, admitting_doctor, status, admitted_at, \
            admission_source, referral_from, referral_doctor, referral_notes, \
            admission_weight_kg, admission_height_cm, expected_discharge_date, ward_id, is_dummy) \
         VALUES ($1, $2, $3, $4, $5, 'admitted'::admission_status, NOW(), \
                 $6::admission_source, $7, $8, $9, $10, $11, $12, $13, $14) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter.id)
    .bind(body.patient_id)
    .bind(body.bed_id)
    .bind(doctor_id)
    .bind(body.admission_source.as_deref().unwrap_or("direct"))
    .bind(&body.referral_from)
    .bind(&body.referral_doctor)
    .bind(&body.referral_notes)
    .bind(body.admission_weight_kg)
    .bind(body.admission_height_cm)
    .bind(body.expected_discharge_date)
    .bind(effective_ward_id)
    .bind(is_dummy)
    .fetch_one(&mut *tx)
    .await?;

    let admission_event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::IpdAdmissionCreated,
        admission.id,
        claims.sub,
        json!({
            "admission_id": admission.id,
            "patient_id": admission.patient_id,
            "encounter_id": admission.encounter_id,
            "department_id": body.department_id,
            "ward_id": admission.ward_id,
            "bed_id": admission.bed_id,
            "admission_source": admission.admission_source,
        }),
    )
    .with_patient(admission.patient_id)
    .with_admission(admission.id)
    .with_encounter(admission.encounter_id)
    .with_department(body.department_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &admission_event).await?;

    if let Some(bid) = body.bed_id {
        occupy_admission_bed(
            &mut tx,
            BedOccupancy {
                tenant_id: claims.tenant_id,
                bed_id: bid,
                patient_id: admission.patient_id,
                admission_id: admission.id,
                ward_id: effective_ward_id,
                changed_by: claims.sub,
                reason: "IPD admission",
            },
        )
        .await?;
    }

    if let Some(bed_id) = body.bed_id {
        let event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::BedAssigned,
            admission.id,
            claims.sub,
            json!({
                "bed_id": bed_id,
                "admission_id": admission.id,
                "patient_id": admission.patient_id,
                "encounter_id": admission.encounter_id,
                "ward_id": admission.ward_id,
            }),
        )
        .with_patient(admission.patient_id)
        .with_admission(admission.id)
        .with_encounter(admission.encounter_id)
        .with_department(body.department_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    tx.commit().await?;

    // Link the care team on BOTH the inline encounter and the admission so
    // per-encounter and per-admission reads resolve (ReBAC). Department viewer
    // = the whole treating department (one tuple, no per-user fan-out);
    // attending = the admitting doctor; ward_member (below) covers ward staff.
    // Mirrors create_encounter / patient registration.
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    for (object_type, object_id) in [("encounter", encounter.id), ("admission", admission.id)] {
        state
            .authz
            .grant_raw(
                &authz_ctx,
                object_type,
                object_id,
                "dept_member",
                medbrains_authz::Subject::Department(body.department_id),
                None,
                Some("admission_department".to_owned()),
            )
            .await
            .map_err(|e| {
                AppError::Internal(format!("{object_type} dept authz grant failed: {e}"))
            })?;
    }
    state
        .authz
        .write_tuple(
            &authz_ctx,
            "encounter",
            encounter.id,
            medbrains_authz::Relation::AttendingPhysician,
            medbrains_authz::Subject::User(doctor_id),
            None,
            Some("admission_encounter_attending".to_owned()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("encounter attending authz grant failed: {e}")))?;
    state
        .authz
        .write_tuple(
            &authz_ctx,
            "admission",
            admission.id,
            medbrains_authz::Relation::AttendingPhysician,
            medbrains_authz::Subject::User(admission.admitting_doctor),
            None,
            Some("admission_attending".to_owned()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("admission attending authz grant failed: {e}")))?;

    // Ward-level visibility: link the ward's department so ward staff (who may
    // sit in a different department than the admitting one) resolve on the
    // admission. Best-effort lookup; the grant itself is fatal like the others.
    if let Some(ward_id) = effective_ward_id {
        let ward_dept: Option<Uuid> =
            sqlx::query_scalar("SELECT department_id FROM wards WHERE id = $1 AND tenant_id = $2")
                .bind(ward_id)
                .bind(claims.tenant_id)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten();
        if let Some(dept) = ward_dept {
            state
                .authz
                .grant_raw(
                    &authz_ctx,
                    "admission",
                    admission.id,
                    "ward_member",
                    medbrains_authz::Subject::Department(dept),
                    None,
                    Some("admission_ward".to_owned()),
                )
                .await
                .map_err(|e| {
                    AppError::Internal(format!("admission ward authz grant failed: {e}"))
                })?;
        }
    }

    let doctor_name = sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
        .bind(admission.admitting_doctor)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "Unknown".to_owned());

    let department_name =
        sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
            .bind(body.department_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_owned());

    let (ward_name, bed_number) = if let Some(bid) = admission.bed_id {
        sqlx::query_as::<_, (Option<String>, Option<String>)>(
            "SELECT w.name, l.name \
             FROM locations l \
             LEFT JOIN wards w ON w.id = l.ward_id \
             WHERE l.id = $1",
        )
        .bind(bid)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .unwrap_or((None, None))
    } else {
        (None, None)
    };

    let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "ipd.admission.created",
        serde_json::json!({
            "admission_id": admission.id,
            "patient_id": admission.patient_id,
            "doctor_name": doctor_name,
            "department_name": department_name,
            "ward_name": ward_name,
            "bed_number": bed_number,
        }),
    )
    .await;

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;

    Ok(Json(CreateAdmissionResponse {
        encounter,
        admission: filter_admission_response(admission, &restricted_fields),
    }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AdmissionDetailResponse>, AppError> {
    require_any_permission(&claims, IPD_ADMISSION_WORKSPACE_PERMISSIONS)?;

    if claims_have_any_permission(&claims, &[permissions::ipd::admissions::VIEW]) {
        // ── ReBAC pre-check — must hold `view` on the specific admission ─
        let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
        medbrains_server_core::middleware::authorization::collapse(
            medbrains_server_core::middleware::authorization::outcome_of(
                state.authz.check(&authz_ctx, medbrains_authz::Relation::Viewer, "admission", id,).await,
                "admission",
            ),
        )?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let admission =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::NotFound)?;

    let encounter =
        sqlx::query_as::<_, Encounter>("SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2")
            .bind(admission.encounter_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let tasks = if claims_have_any_permission(&claims, IPD_ADMISSION_TASK_CONTEXT_PERMISSIONS) {
        sqlx::query_as::<_, NursingTask>(
            "SELECT * FROM nursing_tasks WHERE admission_id = $1 AND tenant_id = $2 \
             ORDER BY created_at ASC LIMIT 5000",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        Vec::new()
    };

    tx.commit().await?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;

    Ok(Json(AdmissionDetailResponse {
        admission: filter_admission_response(admission, &restricted_fields),
        encounter,
        tasks,
    }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}
// ══════════════════════════════════════════════════════════

pub async fn update_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAdmissionRequest>,
) -> Result<Json<Admission>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::UPDATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;
    if body.bed_id.is_some() {
        return Err(AppError::BadRequest(
            "Use the admission transfer endpoint to move beds so transfer reason, audit, and charge impact are recorded".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let admission = sqlx::query_as::<_, Admission>(
        "UPDATE admissions SET \
           bed_id = COALESCE($3, bed_id) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.bed_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    if let Some(ref notes) = body.notes {
        sqlx::query(
            "UPDATE encounters SET notes = $3 \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(admission.encounter_id)
        .bind(claims.tenant_id)
        .bind(notes)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(filter_admission_response(
        admission,
        &restricted_fields,
    )))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/transfer
// ══════════════════════════════════════════════════════════

pub async fn transfer_bed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<TransferBedRequest>,
) -> Result<Json<Admission>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;
    let transfer_reason = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::BadRequest("Transfer reason is required".to_owned()))?
        .to_owned();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let previous = sqlx::query_as::<_, TransferAdmissionSnapshot>(
        "SELECT patient_id, encounter_id, bed_id AS from_bed_id, ward_id AS from_ward_id \
         FROM admissions \
         WHERE id = $1 AND tenant_id = $2 AND status = 'admitted'::admission_status \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if previous.from_bed_id == Some(body.bed_id) {
        return Err(AppError::BadRequest(
            "Target bed is already assigned to this admission".to_owned(),
        ));
    }

    let target_bed = lock_available_bed_for_assignment(
        &mut tx,
        claims.tenant_id,
        body.bed_id,
        previous.patient_id,
    )
    .await?;
    let target_ward_id = target_bed.ward_id;

    if let Some(from_bed_id) = previous.from_bed_id {
        release_admission_bed(
            &mut tx,
            claims.tenant_id,
            from_bed_id,
            id,
            claims.sub,
            "IPD bed transfer",
        )
        .await?;
    }

    let admission = sqlx::query_as::<_, Admission>(
        "UPDATE admissions SET \
           bed_id = $3, \
           ward_id = COALESCE($4, ward_id), \
           updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'admitted'::admission_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.bed_id)
    .bind(target_ward_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    occupy_admission_bed(
        &mut tx,
        BedOccupancy {
            tenant_id: claims.tenant_id,
            bed_id: body.bed_id,
            patient_id: admission.patient_id,
            admission_id: admission.id,
            ward_id: target_ward_id,
            changed_by: claims.sub,
            reason: "IPD bed transfer",
        },
    )
    .await?;

    let transfer_id = sqlx::query_scalar!(
        "INSERT INTO ipd_transfer_logs \
           (tenant_id, admission_id, transfer_type, from_ward_id, to_ward_id, \
            from_bed_id, to_bed_id, reason, transferred_by, notes) \
         VALUES ($1, $2, 'inter_ward'::transfer_type, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING id",
        claims.tenant_id,
        id,
        previous.from_ward_id,
        target_ward_id,
        previous.from_bed_id,
        body.bed_id,
        &transfer_reason,
        claims.sub,
        body.notes.as_deref(),
    )
    .fetch_one(&mut *tx)
    .await?;

    if let Some(ref notes) = body.notes {
        sqlx::query(
            "INSERT INTO nursing_tasks \
               (tenant_id, admission_id, task_type, description, is_completed, completed_at, completed_by) \
             VALUES ($1, $2, 'transfer', $3, true, NOW(), $4)",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(notes)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }

    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::BedTransferred,
        transfer_id,
        claims.sub,
        json!({
            "transfer_id": transfer_id,
            "admission_id": admission.id,
            "patient_id": previous.patient_id,
            "encounter_id": previous.encounter_id,
            "from_bed_id": previous.from_bed_id,
            "to_bed_id": body.bed_id,
            "from_ward_id": previous.from_ward_id,
            "to_ward_id": admission.ward_id,
            "reason": transfer_reason,
        }),
    )
    .with_patient(previous.patient_id)
    .with_admission(admission.id)
    .with_encounter(previous.encounter_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(filter_admission_response(
        admission,
        &restricted_fields,
    )))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/discharge
// ══════════════════════════════════════════════════════════

pub async fn discharge_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DischargeRequest>,
) -> Result<Json<Admission>, AppError> {
    require_permission(&claims, permissions::ipd::discharge::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let dt: DischargeType = serde_json::from_value(serde_json::Value::String(
        body.discharge_type.clone(),
    ))
    .map_err(|_| {
        AppError::BadRequest(format!(
            "Invalid discharge_type '{}'. Valid: normal, lama, dama, absconded, referred, deceased",
            body.discharge_type
        ))
    })?;

    // Configurable settlement gate: tenants that bill before the patient
    // leaves set billing.block_discharge_unsettled = true. LAMA/absconded/
    // deceased discharges are never blocked — the patient is gone either way.
    let block_unsettled = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = 'block_discharge_unsettled'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .map(|v| v.as_bool().unwrap_or(v.as_str() == Some("true")))
    .unwrap_or(false);

    if block_unsettled && matches!(dt, DischargeType::Normal | DischargeType::Referred) {
        let outstanding = sqlx::query_scalar::<_, Decimal>(
            "SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM invoices \
             WHERE tenant_id = $1 AND encounter_id = \
               (SELECT encounter_id FROM admissions WHERE id = $2 AND tenant_id = $1) \
               AND status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status)",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

        if outstanding > Decimal::ZERO {
            return Err(AppError::Conflict(format!(
                "Outstanding balance of {outstanding} must be settled before discharge \
                 (billing.block_discharge_unsettled is enabled)"
            )));
        }
    }

    // Clinical safety gate: a patient must not be discharged with an unacknowledged critical result
    // still pending review — a critical lab value (potassium, haemoglobin) OR a critical imaging
    // finding (pneumothorax, intracranial bleed) (NABL/NABH critical-results reporting). Enabled by
    // default; a tenant may disable it via clinical.block_discharge_unacked_critical = false. As with
    // the settlement gate, LAMA/absconded/deceased discharges are never blocked.
    let block_unacked_critical = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'clinical' \
           AND key = 'block_discharge_unacked_critical'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .is_none_or(|v| v.as_bool().unwrap_or(v.as_str() != Some("false")));

    if block_unacked_critical && matches!(dt, DischargeType::Normal | DischargeType::Referred) {
        let unacked_lab: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM lab_critical_alerts \
             WHERE tenant_id = $1 AND acknowledged_at IS NULL \
               AND patient_id = \
                 (SELECT patient_id FROM admissions WHERE id = $2 AND tenant_id = $1)",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        let unacked_rad: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM radiology_critical_alerts \
             WHERE tenant_id = $1 AND acknowledged_at IS NULL \
               AND patient_id = \
                 (SELECT patient_id FROM admissions WHERE id = $2 AND tenant_id = $1)",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

        if unacked_lab > 0 || unacked_rad > 0 {
            return Err(AppError::Conflict(format!(
                "Unacknowledged critical results must be reviewed before discharge: {unacked_lab} \
                 lab, {unacked_rad} imaging (clinical.block_discharge_unacked_critical is enabled)."
            )));
        }
    }

    let admission = sqlx::query_as::<_, Admission>(
        "UPDATE admissions SET \
           status = 'discharged'::admission_status, \
           discharged_at = NOW(), \
           discharge_type = $3, \
           discharge_summary = $4 \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('admitted'::admission_status, 'transferred'::admission_status) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(dt)
    .bind(&body.discharge_summary)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // A deceased discharge is the point the patient is declared dead in the system.
    // Reflect it on the patient master so every module (appointments, orders, reports)
    // sees the patient as deceased — not just the buried admission record. COALESCE keeps
    // a precise deceased_date already set by a death summary; otherwise stamp discharge time.
    if matches!(dt, DischargeType::Deceased) {
        sqlx::query(
            "UPDATE patients SET is_deceased = true, \
               deceased_date = COALESCE(deceased_date, NOW()) \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(admission.patient_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        "UPDATE encounters SET status = 'completed'::encounter_status \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(admission.encounter_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    if let Some(bed_id) = admission.bed_id {
        release_admission_bed(
            &mut tx,
            claims.tenant_id,
            bed_id,
            admission.id,
            claims.sub,
            "IPD discharge",
        )
        .await?;
    }

    // The hourly room-rent accrual job (services::room_rent) posts one
    // ROOM_RENT line per occupied day. When it has billed this stay,
    // the legacy whole-LOS charge below would double-bill — skip it.
    let daily_rent_billed = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
           SELECT 1 FROM invoice_items it \
           JOIN invoices i ON i.id = it.invoice_id \
           WHERE i.tenant_id = $1 AND i.encounter_id = $2 \
             AND it.charge_code = 'ROOM_RENT' AND it.source = 'ipd'::charge_source)",
    )
    .bind(claims.tenant_id)
    .bind(admission.encounter_id)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-billing: charge room/bed for length of stay
    if !daily_rent_billed
        && medbrains_server_services::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "ipd_room").await?
    {
        let los_hours = (Utc::now() - admission.admitted_at).num_hours();
        #[allow(clippy::cast_precision_loss)]
        let los_days = ((los_hours as f64) / 24.0).ceil() as i32;
        let los_days = los_days.max(1);
        let ip_type = admission.ip_type.unwrap_or(IpType::General);
        let charge_code = ip_type_room_charge_code(ip_type);
        let config = sqlx::query_as::<_, IpTypeConfiguration>(
            "SELECT * FROM ip_type_configurations \
             WHERE ip_type = $1 AND tenant_id = $2 AND is_active = true \
             LIMIT 1",
        )
        .bind(ip_type)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
        let charge_master_tax = sqlx::query_scalar::<_, Decimal>(
            "SELECT tax_percent FROM charge_master \
             WHERE tenant_id = $1 AND code = $2 AND is_active = true \
             LIMIT 1",
        )
        .bind(claims.tenant_id)
        .bind(charge_code)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_default();
        let configured_rate = config
            .as_ref()
            .map(|row| row.daily_rate + row.nursing_charge)
            .filter(|rate| *rate > Decimal::ZERO);
        let tax_percent_override = configured_rate.as_ref().map(|_| charge_master_tax);
        let day_label = if los_days == 1 { "day" } else { "days" };
        let description = match config.as_ref() {
            Some(row) => format!(
                "Room and nursing charges - {} ({los_days} {day_label})",
                row.label
            ),
            None => {
                if los_days == 1 {
                    "Room charges (1 day)".to_owned()
                } else {
                    format!("Room charges ({los_days} days)")
                }
            }
        };

        let _ = medbrains_server_services::billing::auto_charge(
            &mut tx,
            &claims.tenant_id,
            medbrains_server_services::billing::AutoChargeInput {
                patient_id: admission.patient_id,
                encounter_id: Some(admission.encounter_id),
                charge_code: charge_code.to_owned(),
                source: "ipd".to_owned(),
                source_id: admission.id,
                quantity: los_days,
                description_override: Some(description),
                unit_price_override: configured_rate,
                tax_percent_override,
            },
        )
        .await;
    }

    // Finalize billing: every draft invoice for this stay becomes
    // 'issued' so discharge ends with a settled-or-collectable bill
    // instead of an editable draft nobody revisits. Opt-out via
    // billing.auto_charge_discharge_finalize = false.
    if medbrains_server_services::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "discharge_finalize")
        .await?
    {
        let finalized = sqlx::query(
            "UPDATE invoices SET status = 'issued'::invoice_status, \
             issued_at = now(), updated_at = now() \
             WHERE tenant_id = $1 AND encounter_id = $2 \
               AND status = 'draft'::invoice_status",
        )
        .bind(claims.tenant_id)
        .bind(admission.encounter_id)
        .execute(&mut *tx)
        .await?;
        if finalized.rows_affected() > 0 {
            tracing::info!(
                admission_id = %admission.id,
                count = finalized.rows_affected(),
                "discharge finalized draft invoices"
            );
        }
    }

    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::IpdDischargeCompleted,
        admission.id,
        claims.sub,
        json!({
            "admission_id": admission.id,
            "patient_id": admission.patient_id,
            "encounter_id": admission.encounter_id,
            "discharge_type": format!("{:?}", admission.discharge_type),
            "discharged_at": admission.discharged_at.as_ref().map(chrono::DateTime::to_rfc3339),
        }),
    )
    .with_patient(admission.patient_id)
    .with_admission(admission.id)
    .with_encounter(admission.encounter_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    let los_hours_total = admission
        .discharged_at
        .map(|d| (d - admission.admitted_at).num_hours())
        .unwrap_or(0);
    #[allow(clippy::cast_precision_loss)]
    let length_of_stay = ((los_hours_total as f64) / 24.0).ceil() as i64;

    let total_bill = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(total_amount), 0) FROM invoices \
         WHERE encounter_id = $1 AND tenant_id = $2",
    )
    .bind(admission.encounter_id)
    .bind(claims.tenant_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or_default();

    let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "ipd.discharge.initiated",
        serde_json::json!({
            "admission_id": admission.id,
            "patient_id": admission.patient_id,
            "encounter_id": admission.encounter_id,
            "discharge_type": format!("{:?}", admission.discharge_type),
            "total_bill": total_bill,
            "length_of_stay": length_of_stay,
        }),
    )
    .await;

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(filter_admission_response(
        admission,
        &restricted_fields,
    )))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/tasks
// ══════════════════════════════════════════════════════════

pub async fn list_nursing_tasks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<NursingTask>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let tasks = sqlx::query_as::<_, NursingTask>(
        "SELECT * FROM nursing_tasks \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at ASC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(tasks))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/tasks
// ══════════════════════════════════════════════════════════

pub async fn create_nursing_task(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateNursingTaskRequest>,
) -> Result<Json<NursingTask>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM admissions WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if !exists {
        return Err(AppError::NotFound);
    }

    if let Some(assigned_to) = body.assigned_to {
        let assigned_user_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS( \
                 SELECT 1 FROM users \
                 WHERE id = $1 AND tenant_id = $2 AND is_active = true \
             )",
        )
        .bind(assigned_to)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        if !assigned_user_exists {
            return Err(AppError::BadRequest(
                "assigned user must be an active staff user for this tenant".to_owned(),
            ));
        }
    }

    let task = sqlx::query_as::<_, NursingTask>(
        "INSERT INTO nursing_tasks \
           (tenant_id, admission_id, assigned_to, task_type, description, \
            is_completed, due_at, notes) \
         VALUES ($1, $2, $3, $4, $5, false, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.assigned_to)
    .bind(&body.task_type)
    .bind(&body.description)
    .bind(body.due_at)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(task))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/tasks/{tid}
// ══════════════════════════════════════════════════════════

pub async fn update_nursing_task(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, tid)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateNursingTaskRequest>,
) -> Result<Json<NursingTask>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let (completed_at, completed_by) = if body.is_completed == Some(true) {
        (Some(Utc::now()), Some(claims.sub))
    } else {
        (None, None)
    };

    if let Some(assigned_to) = body.assigned_to {
        let assigned_user_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS( \
                 SELECT 1 FROM users \
                 WHERE id = $1 AND tenant_id = $2 AND is_active = true \
             )",
        )
        .bind(assigned_to)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        if !assigned_user_exists {
            return Err(AppError::BadRequest(
                "assigned user must be an active staff user for this tenant".to_owned(),
            ));
        }
    }

    let task = sqlx::query_as::<_, NursingTask>(
        "UPDATE nursing_tasks SET \
           task_type = COALESCE($4, task_type), \
           description = COALESCE($5, description), \
           assigned_to = COALESCE($6, assigned_to), \
           is_completed = COALESCE($7, is_completed), \
           due_at = COALESCE($8, due_at), \
           notes = COALESCE($9, notes), \
           completed_at = COALESCE($10, completed_at), \
           completed_by = COALESCE($11, completed_by) \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(tid)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.task_type)
    .bind(&body.description)
    .bind(body.assigned_to)
    .bind(body.is_completed)
    .bind(body.due_at)
    .bind(&body.notes)
    .bind(completed_at)
    .bind(completed_by)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(task))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/progress-notes
// ══════════════════════════════════════════════════════════

pub async fn list_progress_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdProgressNote>>, AppError> {
    require_permission(&claims, permissions::ipd::progress_notes::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let notes = sqlx::query_as::<_, IpdProgressNote>(
        "SELECT * FROM ipd_progress_notes \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY note_date DESC, created_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(notes))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/progress-notes
// ══════════════════════════════════════════════════════════

pub async fn create_progress_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateProgressNoteRequest>,
) -> Result<Json<IpdProgressNote>, AppError> {
    require_permission(&claims, permissions::ipd::progress_notes::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let admission =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::NotFound)?;

    if body.note_type.trim() == "doctor_round" && admission.status != AdmissionStatus::Admitted {
        return Err(AppError::BadRequest(
            "Doctor rounds can only be recorded for active admissions".to_owned(),
        ));
    }

    let note = sqlx::query_as::<_, IpdProgressNote>(
        "INSERT INTO ipd_progress_notes \
           (tenant_id, admission_id, note_type, author_id, note_date, \
            subjective, objective, assessment, plan, is_addendum, parent_note_id) \
         VALUES ($1, $2, $3::progress_note_type, $4, $5, $6, $7, $8, $9, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&body.note_type)
    .bind(claims.sub)
    .bind(body.note_date)
    .bind(&body.subjective)
    .bind(&body.objective)
    .bind(&body.assessment)
    .bind(&body.plan)
    .bind(body.is_addendum.unwrap_or(false))
    .bind(body.parent_note_id)
    .fetch_one(&mut *tx)
    .await?;

    if note.note_type == ProgressNoteType::DoctorRound {
        best_effort_auto_bill_doctor_round_in_tx(&mut tx, &claims, &admission, &note).await?;
    }

    tx.commit().await?;

    Ok(Json(note))
}

async fn best_effort_auto_bill_doctor_round_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    admission: &Admission,
    note: &IpdProgressNote,
) -> Result<(), AppError> {
    sqlx::query("SAVEPOINT ipd_doctor_round_auto_bill")
        .execute(&mut **tx)
        .await?;

    match auto_bill_doctor_round_in_tx(tx, claims, admission, note).await {
        Ok(()) => {
            sqlx::query("RELEASE SAVEPOINT ipd_doctor_round_auto_bill")
                .execute(&mut **tx)
                .await?;
        }
        Err(error) => {
            sqlx::query("ROLLBACK TO SAVEPOINT ipd_doctor_round_auto_bill")
                .execute(&mut **tx)
                .await?;
            sqlx::query("RELEASE SAVEPOINT ipd_doctor_round_auto_bill")
                .execute(&mut **tx)
                .await?;
            tracing::warn!(
                error = %error,
                admission_id = %admission.id,
                note_id = %note.id,
                "IPD doctor-round auto-billing failed; continuing with progress-note creation"
            );
        }
    }

    Ok(())
}

async fn auto_bill_doctor_round_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    admission: &Admission,
    note: &IpdProgressNote,
) -> Result<(), AppError> {
    if !medbrains_server_services::billing::is_auto_billing_enabled(tx, &claims.tenant_id, "ipd_doctor_round").await? {
        return Ok(());
    }

    medbrains_server_services::billing::auto_charge(
        tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id: admission.patient_id,
            encounter_id: Some(admission.encounter_id),
            charge_code: "CON_SPECIALIST".to_owned(),
            source: "ipd".to_owned(),
            source_id: note.id,
            quantity: 1,
            description_override: Some(format!("IPD doctor round - {}", note.note_date)),
            unit_price_override: None,
            tax_percent_override: None,
        },
    )
    .await?;

    Ok(())
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/progress-notes/{note_id}
// ══════════════════════════════════════════════════════════

pub async fn update_progress_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, note_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateProgressNoteRequest>,
) -> Result<Json<IpdProgressNote>, AppError> {
    require_permission(&claims, permissions::ipd::progress_notes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let note = sqlx::query_as::<_, IpdProgressNote>(
        "UPDATE ipd_progress_notes SET \
           subjective = COALESCE($4, subjective), \
           objective = COALESCE($5, objective), \
           assessment = COALESCE($6, assessment), \
           plan = COALESCE($7, plan) \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(note_id)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.subjective)
    .bind(&body.objective)
    .bind(&body.assessment)
    .bind(&body.plan)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(note))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/assessments
// ══════════════════════════════════════════════════════════

pub async fn list_assessments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdClinicalAssessment>>, AppError> {
    require_permission(&claims, permissions::ipd::assessments::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdClinicalAssessment>(
        "SELECT * FROM ipd_clinical_assessments \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY assessed_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/assessments
// ══════════════════════════════════════════════════════════

pub async fn create_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateAssessmentRequest>,
) -> Result<Json<IpdClinicalAssessment>, AppError> {
    require_permission(&claims, permissions::ipd::assessments::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdClinicalAssessment>(
        "INSERT INTO ipd_clinical_assessments \
           (tenant_id, admission_id, assessment_type, score_value, risk_level, \
            score_details, assessed_by, assessed_at) \
         VALUES ($1, $2, $3::clinical_assessment_type, $4, $5, $6, $7, NOW()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&body.assessment_type)
    .bind(body.score_value)
    .bind(&body.risk_level)
    .bind(
        body.score_details
            .as_ref()
            .unwrap_or(&serde_json::json!({})),
    )
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    if body.assessment_type == "braden_scale" {
        medbrains_nabh::mirror_pressure_ulcer_from_ipd_assessment(
            &mut tx,
            claims.tenant_id,
            row.id,
        )
        .await?;
    }

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/mar
// ══════════════════════════════════════════════════════════

pub async fn list_mar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdMedicationAdministration>>, AppError> {
    require_permission(&claims, permissions::ipd::mar::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdMedicationAdministration>(
        "SELECT * FROM ipd_medication_administration \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY scheduled_at ASC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/mar
// ══════════════════════════════════════════════════════════

pub async fn create_mar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateMarRequest>,
) -> Result<Json<IpdMedicationAdministration>, AppError> {
    require_permission(&claims, permissions::ipd::mar::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdMedicationAdministration>(
        "INSERT INTO ipd_medication_administration \
           (tenant_id, admission_id, prescription_item_id, drug_name, dose, route, \
            frequency, scheduled_at, status, is_high_alert) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled'::mar_status, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.prescription_item_id)
    .bind(&body.drug_name)
    .bind(&body.dose)
    .bind(&body.route)
    .bind(&body.frequency)
    .bind(body.scheduled_at)
    .bind(body.is_high_alert.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/mar/{mar_id}
// ══════════════════════════════════════════════════════════

/// Apply a MAR dose status transition with the full IPSG.3 medication-safety gate, shared by
/// BOTH MAR update endpoints so neither can bypass the checks: an already-administered dose is
/// immutable; a high-alert `given` requires an independent second-nurse witness (different, real,
/// active) AND a server-side BCMA barcode verification; hold/refuse/miss require a reason;
/// `barcode_verified` is server-authoritative (never client-set). `admission_id` optionally scopes
/// the dose to a specific admission (the admission-nested endpoint) — `None` matches by id alone.
async fn administer_mar_dose_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    actor_sub: Uuid,
    mar_id: Uuid,
    admission_id: Option<Uuid>,
    body: &UpdateMarRequest,
) -> Result<IpdMedicationAdministration, AppError> {
    let status: MarStatus = serde_json::from_value(serde_json::Value::String(body.status.clone()))
        .map_err(|_| AppError::BadRequest(format!("Invalid MAR status '{}'", body.status)))?;

    let existing = sqlx::query_as::<_, IpdMedicationAdministration>(
        "SELECT * FROM ipd_medication_administration \
         WHERE id = $1 AND tenant_id = $2 AND ($3::uuid IS NULL OR admission_id = $3) \
         FOR UPDATE",
    )
    .bind(mar_id)
    .bind(tenant_id)
    .bind(admission_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // A dose already recorded as administered is immutable: re-marking it either double-documents
    // the administration (reads as a double dose) or silently overwrites who/when it was given.
    if matches!(existing.status, MarStatus::Given | MarStatus::SelfAdministered) {
        return Err(AppError::Conflict(
            "This dose is already recorded as administered and cannot be changed.".to_owned(),
        ));
    }

    match status {
        MarStatus::Given => {
            if existing.is_high_alert {
                let witness = body.witnessed_by.ok_or_else(|| {
                    AppError::BadRequest(
                        "A second-nurse witness is required to administer a high-alert drug."
                            .to_owned(),
                    )
                })?;
                if witness == actor_sub {
                    return Err(AppError::BadRequest(
                        "The witness must be a different nurse from the administering nurse."
                            .to_owned(),
                    ));
                }
                let witness_is_active = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS( \
                         SELECT 1 FROM users \
                         WHERE id = $1 AND tenant_id = $2 AND is_active = true \
                     )",
                )
                .bind(witness)
                .bind(tenant_id)
                .fetch_one(&mut **tx)
                .await?;
                if !witness_is_active {
                    return Err(AppError::BadRequest(
                        "The witness must be an active staff user for this tenant.".to_owned(),
                    ));
                }
                if !existing.barcode_verified {
                    return Err(AppError::BadRequest(
                        "Scan the patient wristband and the drug barcode to verify the 5 rights \
                         before administering a high-alert drug."
                            .to_owned(),
                    ));
                }
            }
        }
        MarStatus::Held if body.hold_reason.as_deref().unwrap_or("").trim().is_empty() => {
            return Err(AppError::BadRequest("A reason is required to hold a dose.".to_owned()));
        }
        MarStatus::Refused if body.refused_reason.as_deref().unwrap_or("").trim().is_empty() => {
            return Err(AppError::BadRequest("A reason is required to record a refusal.".to_owned()));
        }
        MarStatus::Missed if body.missed_reason.as_deref().unwrap_or("").trim().is_empty() => {
            return Err(AppError::BadRequest("A reason is required to record a missed dose.".to_owned()));
        }
        _ => {}
    }

    let administered_by = matches!(status, MarStatus::Given | MarStatus::SelfAdministered)
        .then_some(actor_sub);

    let row = sqlx::query_as::<_, IpdMedicationAdministration>(
        "UPDATE ipd_medication_administration SET \
           status = $3::mar_status, \
           administered_at = CASE WHEN $3::mar_status IN ('given','self_administered') \
                                  THEN COALESCE($4, now()) ELSE administered_at END, \
           administered_by = COALESCE($5, administered_by), \
           witnessed_by = COALESCE($6, witnessed_by), \
           barcode_verified = COALESCE($7, barcode_verified), \
           hold_reason = COALESCE($8, hold_reason), \
           refused_reason = COALESCE($9, refused_reason), \
           missed_reason = COALESCE($10, missed_reason), \
           notes = COALESCE($11, notes), \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(mar_id)
    .bind(tenant_id)
    .bind(&body.status)
    .bind(body.administered_at)
    .bind(administered_by)
    .bind(body.witnessed_by)
    // barcode_verified is server-authoritative (set only by verify_mar_barcode); never client-set.
    .bind(None::<bool>)
    .bind(&body.hold_reason)
    .bind(&body.refused_reason)
    .bind(&body.missed_reason)
    .bind(&body.notes)
    .fetch_one(&mut **tx)
    .await?;

    if matches!(status, MarStatus::Held | MarStatus::Refused | MarStatus::Missed) {
        notify_prescriber_dose_not_given_in_tx(tx, &tenant_id, &row, &body.status).await?;
    }

    Ok(row)
}

pub async fn update_mar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, mar_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateMarRequest>,
) -> Result<Json<IpdMedicationAdministration>, AppError> {
    require_permission(&claims, permissions::ipd::mar::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row =
        administer_mar_dose_in_tx(&mut tx, claims.tenant_id, claims.sub, mar_id, Some(id), &body)
            .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  eMAR medication round (cross-admission, ward-filtered)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct MarDueQuery {
    /// Look-ahead window in minutes (doses scheduled within now+window). Default 60.
    pub window_min: Option<i64>,
    pub ward_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
}

/// A due-now dose enriched for the nurse's round (patient + batch context).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MarDueRow {
    pub id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub bed_id: Option<Uuid>,
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub frequency: Option<String>,
    pub scheduled_at: chrono::DateTime<Utc>,
    pub status: MarStatus,
    pub is_high_alert: bool,
    pub batch_number: Option<String>,
    pub batch_expiry: Option<NaiveDate>,
}

/// `GET /api/nurse/mar/due-now` — scheduled doses due within the window across
/// the ward (optionally filtered by ward / patient). This is the nurse's
/// medication-round worklist, reading the canonical `ipd_medication_administration`.
pub async fn list_mar_due_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<MarDueQuery>,
) -> Result<Json<Vec<MarDueRow>>, AppError> {
    require_any_permission(&claims, &[permissions::ipd::mar::LIST, permissions::nurse::mar::VIEW])?;

    let window_min = params.window_min.unwrap_or(60).clamp(0, 1440);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, MarDueRow>(
        "SELECT m.id, m.admission_id, a.patient_id, \
                (p.first_name || ' ' || p.last_name) AS patient_name, a.bed_id, \
                m.drug_name, m.dose, m.route, m.frequency, m.scheduled_at, m.status, \
                m.is_high_alert, m.batch_number, m.batch_expiry \
         FROM ipd_medication_administration m \
         JOIN admissions a ON a.id = m.admission_id AND a.tenant_id = m.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = m.tenant_id \
         WHERE m.tenant_id = $1 AND m.status = 'scheduled'::mar_status \
           AND m.scheduled_at <= now() + make_interval(mins => $2::int) \
           AND ($3::uuid IS NULL OR a.ward_id = $3) \
           AND ($4::uuid IS NULL OR a.patient_id = $4) \
         ORDER BY m.scheduled_at ASC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(i32::try_from(window_min).unwrap_or(60))
    .bind(params.ward_id)
    .bind(params.patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/nurse/mar/patient/{patient_id}` — the canonical per-patient MAR
/// timeline (replaces the retired orphan nurse_mar path).
pub async fn list_mar_for_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<IpdMedicationAdministration>>, AppError> {
    require_any_permission(&claims, &[permissions::ipd::mar::LIST, permissions::nurse::mar::VIEW])?;

    // Keyed on patient_id, not admission — this is the patient's whole MAR
    // history, so the gate is patient access rather than one admission.
    medbrains_authz_gate::require_patient_access(
        &state, &claims, patient_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdMedicationAdministration>(
        "SELECT m.* FROM ipd_medication_administration m \
         JOIN admissions a ON a.id = m.admission_id AND a.tenant_id = m.tenant_id \
         WHERE m.tenant_id = $1 AND a.patient_id = $2 \
         ORDER BY m.scheduled_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `PUT /api/nurse/mar/{id}` — record an administration from the round with the
/// 5-Rights + safety rules: a high-alert drug requires a witness (≠ the giver);
/// hold/refuse/missed require a reason and notify the prescriber.
pub async fn update_mar_round(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mar_id): Path<Uuid>,
    Json(body): Json<UpdateMarRequest>,
) -> Result<Json<IpdMedicationAdministration>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::ipd::mar::UPDATE, permissions::nurse::mar::ADMINISTER],
    )?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::MAR_ENTRY,
        mar_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row =
        administer_mar_dose_in_tx(&mut tx, claims.tenant_id, claims.sub, mar_id, None, &body).await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct VerifyBarcodeRequest {
    /// Scanned patient wristband barcode (the UHID).
    pub patient_barcode: String,
    /// Scanned drug/batch barcode.
    pub drug_barcode: String,
}

#[derive(Debug, Serialize)]
pub struct BarcodeVerifyResult {
    pub verified: bool,
    pub right_patient: bool,
    pub right_drug: bool,
    pub reason: Option<String>,
}

/// `POST /api/ipd/mar/{id}/verify-barcode` — BCMA server-side 5-rights check: the scanned wristband
/// must resolve to this MAR's patient and the scanned drug barcode to this MAR's ordered drug. Only
/// on a full match is `barcode_verified` stamped (server-authoritative). Mismatches are refused with
/// the specific failure so the client blocks administration — a wrong-patient / wrong-drug guard.
pub async fn verify_mar_barcode(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mar_id): Path<Uuid>,
    Json(body): Json<VerifyBarcodeRequest>,
) -> Result<Json<BarcodeVerifyResult>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::ipd::mar::UPDATE, permissions::nurse::mar::ADMINISTER],
    )?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::MAR_ENTRY,
        mar_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mar = sqlx::query_as::<_, IpdMedicationAdministration>(
        "SELECT * FROM ipd_medication_administration WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(mar_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Right patient: scanned wristband UHID must equal the admission's patient UHID.
    let expected_uhid = sqlx::query_scalar::<_, String>(
        "SELECT p.uhid FROM admissions a JOIN patients p ON p.id = a.patient_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(mar.admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let right_patient = expected_uhid
        .as_deref()
        .is_some_and(|u| u.eq_ignore_ascii_case(body.patient_barcode.trim()));

    // Right drug: scanned batch barcode must resolve to the same catalog item the order specifies.
    let ordered_item = match mar.prescription_item_id {
        Some(pi) => sqlx::query_scalar::<_, Option<Uuid>>(
            "SELECT catalog_item_id FROM prescription_items WHERE id = $1 AND tenant_id = $2",
        )
        .bind(pi)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten(),
        None => None,
    };
    // Resolve the scanned batch: its catalog item + whether it's expired (computed in SQL).
    let scanned = sqlx::query_as::<_, (Uuid, bool)>(
        "SELECT catalog_item_id, (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE) \
         FROM batch_stock WHERE barcode = $1 AND tenant_id = $2 LIMIT 1",
    )
    .bind(body.drug_barcode.trim())
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    // Right drug = scanned batch resolves to the ordered item AND is not expired.
    let (right_drug, drug_reason) = match (ordered_item, scanned) {
        (Some(ordered), Some((scanned_item, expired))) => {
            if ordered != scanned_item {
                (false, "Wrong drug — the scanned barcode does not match the ordered medication.")
            } else if expired {
                (false, "Expired batch — do not administer; quarantine this stock.")
            } else {
                (true, "")
            }
        }
        _ => (false, "Wrong drug — the scanned barcode does not match the ordered medication."),
    };

    let verified = right_patient && right_drug;
    let reason = if verified {
        None
    } else if !right_patient {
        Some("Wrong patient — the scanned wristband does not match this order.".to_owned())
    } else {
        Some(drug_reason.to_owned())
    };

    if verified {
        sqlx::query(
            "UPDATE ipd_medication_administration SET barcode_verified = true, updated_at = now() \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(mar_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(Json(BarcodeVerifyResult { verified, right_patient, right_drug, reason }))
}

/// Notify the prescribing doctor that a scheduled dose was held/refused/missed.
async fn notify_prescriber_dose_not_given_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    mar: &IpdMedicationAdministration,
    status: &str,
) -> Result<(), AppError> {
    let Some(item_id) = mar.prescription_item_id else {
        return Ok(());
    };
    let doctor_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT p.doctor_id FROM prescription_items pi \
         JOIN prescriptions p ON p.id = pi.prescription_id AND p.tenant_id = pi.tenant_id \
         WHERE pi.id = $1 AND pi.tenant_id = $2",
    )
    .bind(item_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(doctor_id) = doctor_id else {
        return Ok(());
    };

    let title = format!("Dose {status}: {}", mar.drug_name);
    let body = format!(
        "{} {} ({}) scheduled {} was {}.",
        mar.drug_name,
        mar.dose,
        mar.route,
        mar.scheduled_at.format("%d %b %H:%M"),
        status
    );
    create_notification(
        tx,
        *tenant_id,
        NewNotification {
            user_id: doctor_id,
            kind: "mar_dose_not_given",
            title: &title,
            body: Some(&body),
            category: Some("clinical"),
            entity_type: Some("ipd_medication_administration"),
            entity_id: Some(mar.id),
            action_url: None,
        },
    )
    .await
    .map(|_| ())
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/io
// ══════════════════════════════════════════════════════════

pub async fn list_intake_output(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdIntakeOutput>>, AppError> {
    require_permission(&claims, permissions::ipd::io_chart::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdIntakeOutput>(
        "SELECT * FROM ipd_intake_output \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/io
// ══════════════════════════════════════════════════════════

pub async fn create_intake_output(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateIoRequest>,
) -> Result<Json<IpdIntakeOutput>, AppError> {
    require_permission(&claims, permissions::ipd::io_chart::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let shift: NursingShift = serde_json::from_value(serde_json::Value::String(body.shift.clone()))
        .map_err(|_| AppError::BadRequest(format!("Invalid shift '{}'", body.shift)))?;

    let row = sqlx::query_as::<_, IpdIntakeOutput>(
        "INSERT INTO ipd_intake_output \
           (tenant_id, admission_id, is_intake, category, volume_ml, \
            description, recorded_at, recorded_by, shift) \
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.is_intake)
    .bind(&body.category)
    .bind(body.volume_ml)
    .bind(&body.description)
    .bind(claims.sub)
    .bind(shift)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/io/balance
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct IoSummaryRow {
    total: Option<Decimal>,
}

pub async fn get_io_balance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<IoBalanceResponse>, AppError> {
    require_permission(&claims, permissions::ipd::io_chart::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let intake = sqlx::query_as::<_, IoSummaryRow>(
        "SELECT COALESCE(SUM(volume_ml), 0) AS total \
         FROM ipd_intake_output \
         WHERE admission_id = $1 AND tenant_id = $2 AND is_intake = true",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let output = sqlx::query_as::<_, IoSummaryRow>(
        "SELECT COALESCE(SUM(volume_ml), 0) AS total \
         FROM ipd_intake_output \
         WHERE admission_id = $1 AND tenant_id = $2 AND is_intake = false",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_intake = intake.total.unwrap_or_default();
    let total_output = output.total.unwrap_or_default();

    Ok(Json(IoBalanceResponse {
        total_intake_ml: total_intake,
        total_output_ml: total_output,
        balance_ml: total_intake - total_output,
    }))
}

// ══════════════════════════════════════════════════════════
//  IV infusions (running-infusion lifecycle)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateInfusionRequest {
    pub fluid_name: String,
    pub volume_ml: i32,
    pub rate_ml_per_hr: Option<Decimal>,
    pub site: Option<String>,
    pub pump_serial: Option<String>,
    pub additives: Option<Vec<String>>,
    pub duration_hours: Option<f64>,
    /// Nurse's reason for co-administering despite a Y-site incompatibility.
    pub ysite_override_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInfusionRequest {
    pub status: Option<String>,
    pub rate_ml_per_hr: Option<Decimal>,
    pub site: Option<String>,
    pub pump_serial: Option<String>,
    pub discontinued_reason: Option<String>,
}

const INFUSION_STATUSES: [&str; 5] = ["ordered", "running", "paused", "completed", "discontinued"];

/// `GET /api/ipd/admissions/{id}/infusions`
pub async fn list_infusions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IvFluidOrder>>, AppError> {
    require_permission(&claims, permissions::ipd::io_chart::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IvFluidOrder>(
        "SELECT * FROM iv_fluid_orders \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/ipd/admissions/{id}/infusions` — set up + start an infusion.
pub async fn create_infusion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateInfusionRequest>,
) -> Result<Json<IvFluidOrder>, AppError> {
    require_permission(&claims, permissions::ipd::io_chart::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    if body.fluid_name.trim().is_empty() {
        return Err(AppError::BadRequest("Fluid name is required.".to_owned()));
    }
    if body.volume_ml <= 0 {
        return Err(AppError::BadRequest("Volume must be greater than zero.".to_owned()));
    }

    // Setting up the pump starts the infusion; planned end = now + duration.
    let planned_end = body
        .duration_hours
        .filter(|h| *h > 0.0)
        .map(|h| Utc::now() + chrono::Duration::milliseconds((h * 3_600_000.0) as i64));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Y-site admixture guard: this infusion's own additives, plus anything
    // running on the same site, must be chemically compatible. Reuses the CDS
    // ingredient-incompatibility table. Warn & require an acknowledged reason.
    let mut new_text = body.fluid_name.to_lowercase();
    for a in body.additives.as_deref().unwrap_or_default() {
        new_text.push(' ');
        new_text.push_str(&a.to_lowercase());
    }
    let mut site_text = String::new();
    if let Some(site) = body.site.as_deref().filter(|s| !s.trim().is_empty()) {
        let running = sqlx::query_as::<_, (String, Option<Vec<String>>)>(
            "SELECT fluid_name, additives FROM iv_fluid_orders \
             WHERE tenant_id = $1 AND admission_id = $2 AND site = $3 \
               AND status IN ('running', 'paused')",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(site)
        .fetch_all(&mut *tx)
        .await?;
        for (fluid, adds) in &running {
            site_text.push_str(&fluid.to_lowercase());
            site_text.push(' ');
            for a in adds.as_deref().unwrap_or_default() {
                site_text.push_str(&a.to_lowercase());
                site_text.push(' ');
            }
        }
    }
    let combined = format!("{new_text} {site_text}");
    let incompat = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT ingredient_a, ingredient_b, mechanism FROM cds_ingredient_incompatibility",
    )
    .fetch_all(&mut *tx)
    .await?;
    let conflicts: Vec<String> = incompat
        .iter()
        .filter(|(a, b, _)| {
            combined.contains(a.as_str())
                && combined.contains(b.as_str())
                && (new_text.contains(a.as_str()) || new_text.contains(b.as_str()))
        })
        .map(|(a, b, mech)| format!("{a} + {b}{}", mech.as_deref().map_or(String::new(), |m| format!(" ({m})"))))
        .collect();
    let ysite_reason = body
        .ysite_override_reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    if !conflicts.is_empty() && ysite_reason.is_none() {
        return Err(AppError::BadRequest(format!(
            "Y-site / admixture incompatibility: {}. Provide an override reason to proceed.",
            conflicts.join("; ")
        )));
    }

    let row = sqlx::query_as::<_, IvFluidOrder>(
        "INSERT INTO iv_fluid_orders \
           (tenant_id, admission_id, fluid_name, volume_ml, additives, status, \
            rate_ml_per_hr, site, pump_serial, ordered_by, started_at, \
            duration_hours, planned_end_time) \
         VALUES ($1, $2, $3, $4, $5, 'running', $6, $7, $8, $9, now(), $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.fluid_name.trim())
    .bind(body.volume_ml)
    .bind(body.additives.as_deref())
    .bind(body.rate_ml_per_hr)
    .bind(&body.site)
    .bind(&body.pump_serial)
    .bind(claims.sub)
    .bind(body.duration_hours)
    .bind(planned_end)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/ipd/admissions/{id}/infusions/{infusion_id}` — titrate (rate/site)
/// or transition status (pause/resume/complete/discontinue).
pub async fn update_infusion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, infusion_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateInfusionRequest>,
) -> Result<Json<IvFluidOrder>, AppError> {
    require_permission(&claims, permissions::ipd::io_chart::CREATE)?;

    if let Some(status) = &body.status {
        if !INFUSION_STATUSES.contains(&status.as_str()) {
            return Err(AppError::BadRequest(format!("Invalid infusion status '{status}'.")));
        }
        if status == "discontinued" && body.discontinued_reason.as_deref().unwrap_or("").trim().is_empty() {
            return Err(AppError::BadRequest(
                "A reason is required to discontinue an infusion.".to_owned(),
            ));
        }
    }

    let discontinued_by = matches!(body.status.as_deref(), Some("discontinued")).then_some(claims.sub);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, IvFluidOrder>(
        "UPDATE iv_fluid_orders SET \
           status = COALESCE($3, status), \
           rate_ml_per_hr = COALESCE($4, rate_ml_per_hr), \
           site = COALESCE($5, site), \
           pump_serial = COALESCE($6, pump_serial), \
           started_at = CASE WHEN $3 = 'running' AND started_at IS NULL THEN now() ELSE started_at END, \
           actual_end_time = CASE WHEN $3 IN ('completed','discontinued') THEN now() ELSE actual_end_time END, \
           discontinued_reason = COALESCE($7, discontinued_reason), \
           discontinued_by = COALESCE($8, discontinued_by), \
           discontinued_at = CASE WHEN $3 = 'discontinued' THEN now() ELSE discontinued_at END, \
           updated_at = now() \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $9 \
         RETURNING *",
    )
    .bind(infusion_id)
    .bind(id)
    .bind(body.status.as_deref())
    .bind(body.rate_ml_per_hr)
    .bind(&body.site)
    .bind(&body.pump_serial)
    .bind(&body.discontinued_reason)
    .bind(discontinued_by)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/nursing-assessments
// ══════════════════════════════════════════════════════════

pub async fn list_nursing_assessments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdNursingAssessment>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdNursingAssessment>(
        "SELECT * FROM ipd_nursing_assessments \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY assessed_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/nursing-assessments
// ══════════════════════════════════════════════════════════

pub async fn create_nursing_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateNursingAssessmentRequest>,
) -> Result<Json<IpdNursingAssessment>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let empty = serde_json::json!({});
    let row = sqlx::query_as::<_, IpdNursingAssessment>(
        "INSERT INTO ipd_nursing_assessments \
           (tenant_id, admission_id, assessed_by, assessed_at, \
            general_appearance, skin_assessment, pain_assessment, \
            nutritional_status, elimination_status, respiratory_status, \
            psychosocial_status, fall_risk_assessment, allergies, \
            medications_on_admission, personal_belongings, patient_education_needs) \
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .bind(body.general_appearance.as_ref().unwrap_or(&empty))
    .bind(body.skin_assessment.as_ref().unwrap_or(&empty))
    .bind(body.pain_assessment.as_ref().unwrap_or(&empty))
    .bind(body.nutritional_status.as_ref().unwrap_or(&empty))
    .bind(body.elimination_status.as_ref().unwrap_or(&empty))
    .bind(body.respiratory_status.as_ref().unwrap_or(&empty))
    .bind(body.psychosocial_status.as_ref().unwrap_or(&empty))
    .bind(body.fall_risk_assessment.as_ref().unwrap_or(&empty))
    .bind(&body.allergies)
    .bind(&body.medications_on_admission)
    .bind(body.personal_belongings.as_ref().unwrap_or(&empty))
    .bind(&body.patient_education_needs)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/nursing-assessments/{nid}
// ══════════════════════════════════════════════════════════

pub async fn update_nursing_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, nid)): Path<(Uuid, Uuid)>,
    Json(body): Json<CreateNursingAssessmentRequest>,
) -> Result<Json<IpdNursingAssessment>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdNursingAssessment>(
        "UPDATE ipd_nursing_assessments SET \
           general_appearance = COALESCE($4, general_appearance), \
           skin_assessment = COALESCE($5, skin_assessment), \
           pain_assessment = COALESCE($6, pain_assessment), \
           nutritional_status = COALESCE($7, nutritional_status), \
           elimination_status = COALESCE($8, elimination_status), \
           respiratory_status = COALESCE($9, respiratory_status), \
           psychosocial_status = COALESCE($10, psychosocial_status), \
           fall_risk_assessment = COALESCE($11, fall_risk_assessment), \
           allergies = COALESCE($12, allergies), \
           medications_on_admission = COALESCE($13, medications_on_admission), \
           personal_belongings = COALESCE($14, personal_belongings), \
           patient_education_needs = COALESCE($15, patient_education_needs) \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(nid)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.general_appearance)
    .bind(&body.skin_assessment)
    .bind(&body.pain_assessment)
    .bind(&body.nutritional_status)
    .bind(&body.elimination_status)
    .bind(&body.respiratory_status)
    .bind(&body.psychosocial_status)
    .bind(&body.fall_risk_assessment)
    .bind(&body.allergies)
    .bind(&body.medications_on_admission)
    .bind(&body.personal_belongings)
    .bind(&body.patient_education_needs)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/care-plans
// ══════════════════════════════════════════════════════════

pub async fn list_care_plans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdCarePlan>>, AppError> {
    require_permission(&claims, permissions::ipd::care_plans::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdCarePlan>(
        "SELECT * FROM ipd_care_plans \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY initiated_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/care-plans
// ══════════════════════════════════════════════════════════

pub async fn create_care_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateCarePlanRequest>,
) -> Result<Json<IpdCarePlan>, AppError> {
    require_permission(&claims, permissions::ipd::care_plans::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdCarePlan>(
        "INSERT INTO ipd_care_plans \
           (tenant_id, admission_id, nursing_diagnosis, goals, interventions, \
            evaluation, status, initiated_by, initiated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, 'active'::care_plan_status, $7, NOW()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&body.nursing_diagnosis)
    .bind(&body.goals)
    .bind(
        body.interventions
            .as_ref()
            .unwrap_or(&serde_json::json!([])),
    )
    .bind(&body.evaluation)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/care-plans/{cid}
// ══════════════════════════════════════════════════════════

pub async fn update_care_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, cid)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateCarePlanRequest>,
) -> Result<Json<IpdCarePlan>, AppError> {
    require_permission(&claims, permissions::ipd::care_plans::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let (resolved_at, resolved_by) = if body.status.as_deref() == Some("resolved") {
        (Some(Utc::now()), Some(claims.sub))
    } else {
        (None, None)
    };

    let row = sqlx::query_as::<_, IpdCarePlan>(
        "UPDATE ipd_care_plans SET \
           goals = COALESCE($4, goals), \
           interventions = COALESCE($5, interventions), \
           evaluation = COALESCE($6, evaluation), \
           status = COALESCE($7::care_plan_status, status), \
           resolved_at = COALESCE($8, resolved_at), \
           resolved_by = COALESCE($9, resolved_by) \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(cid)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.goals)
    .bind(&body.interventions)
    .bind(&body.evaluation)
    .bind(&body.status)
    .bind(resolved_at)
    .bind(resolved_by)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/handovers
// ══════════════════════════════════════════════════════════

pub async fn list_handovers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdHandoverReport>>, AppError> {
    require_permission(&claims, permissions::ipd::handover::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdHandoverReport>(
        "SELECT * FROM ipd_handover_reports \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY handover_date DESC, created_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/handovers
// ══════════════════════════════════════════════════════════

pub async fn create_handover(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateHandoverRequest>,
) -> Result<Json<IpdHandoverReport>, AppError> {
    require_permission(&claims, permissions::ipd::handover::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdHandoverReport>(
        "INSERT INTO ipd_handover_reports \
           (tenant_id, admission_id, shift, handover_date, outgoing_nurse, incoming_nurse, \
            identification, situation, background, assessment, recommendation, pending_tasks) \
         VALUES ($1, $2, $3::nursing_shift, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(&body.shift)
    .bind(body.handover_date)
    .bind(claims.sub)
    .bind(body.incoming_nurse)
    .bind(&body.identification)
    .bind(&body.situation)
    .bind(&body.background)
    .bind(&body.assessment)
    .bind(&body.recommendation)
    .bind(
        body.pending_tasks
            .as_ref()
            .unwrap_or(&serde_json::json!([])),
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/handovers/{hid}/acknowledge
// ══════════════════════════════════════════════════════════

pub async fn acknowledge_handover(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, hid)): Path<(Uuid, Uuid)>,
) -> Result<Json<IpdHandoverReport>, AppError> {
    require_permission(&claims, permissions::ipd::handover::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdHandoverReport>(
        "UPDATE ipd_handover_reports SET \
           acknowledged_at = NOW() \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3 AND acknowledged_at IS NULL \
         RETURNING *",
    )
    .bind(hid)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/admissions/{id}/discharge-checklist
// ══════════════════════════════════════════════════════════

pub async fn list_discharge_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdDischargeChecklist>>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_checklist::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdDischargeChecklist>(
        "SELECT * FROM ipd_discharge_checklists \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY sort_order ASC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/discharge-checklist
// ══════════════════════════════════════════════════════════

pub async fn init_discharge_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<InitDischargeChecklistRequest>,
) -> Result<Json<Vec<IpdDischargeChecklist>>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_checklist::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut items = Vec::with_capacity(body.items.len());
    for item in &body.items {
        let row = sqlx::query_as::<_, IpdDischargeChecklist>(
            "INSERT INTO ipd_discharge_checklists \
               (tenant_id, admission_id, item_code, item_label, status, sort_order) \
             VALUES ($1, $2, $3, $4, 'pending', $5) \
             ON CONFLICT (tenant_id, admission_id, item_code) DO NOTHING \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(&item.item_code)
        .bind(&item.item_label)
        .bind(item.sort_order)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(r) = row {
            items.push(r);
        }
    }

    tx.commit().await?;

    Ok(Json(items))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/ipd/admissions/{id}/discharge-checklist/{cid}
// ══════════════════════════════════════════════════════════

pub async fn update_discharge_checklist_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, cid)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateChecklistItemRequest>,
) -> Result<Json<IpdDischargeChecklist>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_checklist::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let (completed_by, completed_at) = if body.status == "completed" {
        (Some(claims.sub), Some(Utc::now()))
    } else {
        (None, None)
    };

    let row = sqlx::query_as::<_, IpdDischargeChecklist>(
        "UPDATE ipd_discharge_checklists SET \
           status = $4, \
           completed_by = COALESCE($5, completed_by), \
           completed_at = COALESCE($6, completed_at) \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(cid)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(completed_by)
    .bind(completed_at)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Ward Management
// ══════════════════════════════════════════════════════════

pub async fn list_wards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<WardListRow>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::LIST,
            permissions::ipd::admissions::CREATE,
            permissions::ipd::transfers::CREATE,
            permissions::ipd::wards::MANAGE,
            permissions::ipd::beds::MANAGE,
            permissions::ipd::bed_dashboard::VIEW,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, WardListRow>(
        "SELECT w.id, w.code, w.name, w.department_id, d.name AS department_name, \
               w.ward_type, w.total_beds, w.gender_restriction, w.is_active, \
               COALESCE(( \
                   SELECT COUNT(*) FROM ward_bed_mappings wbm \
                   JOIN bed_states bs ON bs.location_id = wbm.bed_location_id AND bs.tenant_id = wbm.tenant_id \
                   WHERE wbm.ward_id = w.id AND wbm.is_active = true \
                         AND bs.status IN ('vacant_clean', 'vacant_dirty') \
               ), 0) AS vacant_beds \
         FROM wards w \
         LEFT JOIN departments d ON d.id = w.department_id \
         WHERE w.tenant_id = $1 \
         ORDER BY w.name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn get_ward(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Ward>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::LIST,
            permissions::ipd::wards::MANAGE,
            permissions::ipd::beds::MANAGE,
            permissions::ipd::bed_dashboard::VIEW,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let ward = sqlx::query_as::<_, Ward>("SELECT * FROM wards WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(ward))
}

pub async fn create_ward(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWardRequest>,
) -> Result<Json<Ward>, AppError> {
    require_permission(&claims, permissions::ipd::wards::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let ward = sqlx::query_as::<_, Ward>(
        "INSERT INTO wards (tenant_id, code, name, department_id, ward_type, gender_restriction) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(body.department_id)
    .bind(body.ward_type.as_deref().unwrap_or("general"))
    .bind(body.gender_restriction.as_deref().unwrap_or("any"))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(ward))
}

pub async fn update_ward(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWardRequest>,
) -> Result<Json<Ward>, AppError> {
    require_permission(&claims, permissions::ipd::wards::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let ward = sqlx::query_as::<_, Ward>(
        "UPDATE wards SET \
           name = COALESCE($3, name), \
           department_id = COALESCE($4, department_id), \
           ward_type = COALESCE($5, ward_type), \
           gender_restriction = COALESCE($6, gender_restriction), \
           is_active = COALESCE($7, is_active) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(body.department_id)
    .bind(&body.ward_type)
    .bind(&body.gender_restriction)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(ward))
}

pub async fn list_ward_beds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<WardBedRow>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::LIST,
            permissions::ipd::wards::MANAGE,
            permissions::ipd::beds::MANAGE,
            permissions::ipd::bed_dashboard::VIEW,
        ],
    )?;
    let can_view_patient_identity =
        claims_have_any_permission(&claims, &[permissions::patients::VIEW]);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, WardBedRow>(
        "SELECT wbm.id AS mapping_id, wbm.bed_location_id, \
               l.name AS bed_name, bt.name AS bed_type_name, \
               bs.status AS bed_status, \
               CASE WHEN $3::bool THEN CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) ELSE NULL END AS patient_name, \
               CASE WHEN $3::bool THEN p.uhid ELSE NULL END AS patient_uhid, \
               wbm.sort_order \
         FROM ward_bed_mappings wbm \
         JOIN locations l ON l.id = wbm.bed_location_id \
         LEFT JOIN bed_types bt ON bt.id = wbm.bed_type_id \
         LEFT JOIN bed_states bs ON bs.location_id = wbm.bed_location_id AND bs.tenant_id = wbm.tenant_id \
         LEFT JOIN admissions a ON a.id = bs.admission_id AND a.status = 'admitted'::admission_status \
         LEFT JOIN patients p ON p.id = a.patient_id \
         WHERE wbm.ward_id = $1 AND wbm.tenant_id = $2 AND wbm.is_active = true \
         ORDER BY wbm.sort_order, l.name LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(can_view_patient_identity)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn assign_bed_to_ward(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ward_id): Path<Uuid>,
    Json(body): Json<AssignBedToWardRequest>,
) -> Result<Json<WardBedMapping>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::wards::MANAGE,
            permissions::ipd::beds::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mapping = sqlx::query_as::<_, WardBedMapping>(
        "INSERT INTO ward_bed_mappings \
         (tenant_id, ward_id, bed_location_id, bed_type_id, sort_order) \
         SELECT $1, $2, l.id, COALESCE($4::uuid, l.bed_type_id), $5 \
         FROM locations l \
         WHERE l.id = $3 AND l.tenant_id = $1 \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(ward_id)
    .bind(body.bed_location_id)
    .bind(body.bed_type_id)
    .bind(body.sort_order.unwrap_or(0))
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    sqlx::query!(
        "INSERT INTO bed_states (tenant_id, location_id) \
         VALUES ($1, $2) \
         ON CONFLICT (tenant_id, location_id) DO NOTHING",
        claims.tenant_id,
        body.bed_location_id,
    )
    .execute(&mut *tx)
    .await?;

    // Update ward total_beds count
    sqlx::query(
        "UPDATE wards SET total_beds = ( \
             SELECT COUNT(*) FROM ward_bed_mappings WHERE ward_id = $1 AND is_active = true \
         ) WHERE id = $1 AND tenant_id = $2",
    )
    .bind(ward_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Denormalize ward_id on bed_states
    sqlx::query!(
        "UPDATE bed_states SET ward_id = $3 WHERE location_id = $1 AND tenant_id = $2",
        body.bed_location_id,
        claims.tenant_id,
        ward_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(mapping))
}

pub async fn remove_bed_from_ward(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((ward_id, mapping_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::wards::MANAGE,
            permissions::ipd::beds::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Check bed is vacant
    let bed_loc_id = sqlx::query_scalar!(
        "SELECT bed_location_id FROM ward_bed_mappings \
         WHERE id = $1 AND ward_id = $2 AND tenant_id = $3",
        mapping_id,
        ward_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let occupied = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM bed_states WHERE location_id = $1 AND tenant_id = $2 \
         AND status NOT IN ('vacant_clean', 'vacant_dirty')) AS \"occupied!\"",
        bed_loc_id,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    if occupied {
        return Err(AppError::BadRequest(
            "Cannot remove an occupied bed from ward".to_owned(),
        ));
    }

    sqlx::query!(
        "DELETE FROM ward_bed_mappings WHERE id = $1 AND tenant_id = $2",
        mapping_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    // Update ward total_beds
    sqlx::query(
        "UPDATE wards SET total_beds = ( \
             SELECT COUNT(*) FROM ward_bed_mappings WHERE ward_id = $1 AND is_active = true \
         ) WHERE id = $1 AND tenant_id = $2",
    )
    .bind(ward_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Clear ward_id on bed_states
    sqlx::query!(
        "UPDATE bed_states SET ward_id = NULL WHERE location_id = $1 AND tenant_id = $2",
        bed_loc_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "removed": true })))
}

// ══════════════════════════════════════════════════════════
//  Ward care-view — who's on duty
// ══════════════════════════════════════════════════════════

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct WardOnDutyRow {
    pub nurse_user_id: Uuid,
    pub nurse_name: String,
    pub shift_type: String,
    pub primary_assigned: bool,
    pub is_charge: bool,
    pub patient_count: i32,
}

/// `GET /api/ipd/wards/{id}/on-duty` — nurses assigned to a ward for today's shifts (the
/// care-view "who's caring for this ward now"). Pairs with the bed dashboard for the beds.
pub async fn ward_on_duty(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ward_id): Path<Uuid>,
) -> Result<Json<Vec<WardOnDutyRow>>, AppError> {
    require_permission(&claims, permissions::ipd::bed_dashboard::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, WardOnDutyRow>(
        "SELECT nsa.nurse_user_id, u.full_name AS nurse_name, nsa.shift_type, \
                nsa.primary_assigned, \
                (nsa.charge_nurse_user_id = nsa.nurse_user_id) AS is_charge, \
                COALESCE(array_length(nsa.patient_ids, 1), 0) AS patient_count \
         FROM nurse_shift_assignments nsa \
         JOIN users u ON u.id = nsa.nurse_user_id \
         WHERE nsa.tenant_id = $1 AND nsa.ward_id = $2 \
           AND nsa.shift_date = CURRENT_DATE AND nsa.deleted_at IS NULL \
         ORDER BY nsa.primary_assigned DESC, u.full_name LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(ward_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Bed Dashboard
// ══════════════════════════════════════════════════════════

pub async fn bed_dashboard_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BedDashboardSummaryRow>>, AppError> {
    require_permission(&claims, permissions::ipd::bed_dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, BedDashboardSummaryRow>(
        "SELECT bs.ward_id, w.name AS ward_name, \
               COUNT(*) AS total, \
               COUNT(*) FILTER (WHERE bs.status = 'vacant_clean') AS vacant_clean, \
               COUNT(*) FILTER (WHERE bs.status = 'vacant_dirty') AS vacant_dirty, \
               COUNT(*) FILTER (WHERE bs.status = 'occupied') AS occupied, \
               COUNT(*) FILTER (WHERE bs.status = 'reserved') AS reserved, \
               COUNT(*) FILTER (WHERE bs.status = 'maintenance') AS maintenance, \
               COUNT(*) FILTER (WHERE bs.status = 'blocked') AS blocked \
         FROM bed_states bs \
         LEFT JOIN wards w ON w.id = bs.ward_id \
         WHERE bs.tenant_id = $1 \
         GROUP BY bs.ward_id, w.name \
         ORDER BY w.name NULLS LAST LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn bed_dashboard_beds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<BedDashboardQuery>,
) -> Result<Json<Vec<BedDashboardRow>>, AppError> {
    require_permission(&claims, permissions::ipd::bed_dashboard::VIEW)?;
    let can_view_patient_identity =
        claims_have_any_permission(&claims, &[permissions::patients::VIEW]);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut conditions = vec!["bs.tenant_id = $1".to_owned()];
    let mut idx: usize = 3;

    if params.ward_id.is_some() {
        conditions.push(format!("bs.ward_id = ${idx}"));
        idx += 1;
    }
    if params.status.is_some() {
        conditions.push(format!("bs.status = ${idx}"));
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT bs.id AS bed_state_id, bs.location_id AS bed_location_id, \
               l.name AS bed_name, bs.ward_id, w.name AS ward_name, \
               bs.status AS bed_status, \
               CASE WHEN $2::bool THEN CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) ELSE NULL END AS patient_name, \
               CASE WHEN $2::bool THEN p.uhid ELSE NULL END AS patient_uhid, bs.admission_id \
         FROM bed_states bs \
         JOIN locations l ON l.id = bs.location_id \
         LEFT JOIN wards w ON w.id = bs.ward_id \
         LEFT JOIN admissions a ON a.id = bs.admission_id \
             AND a.status = 'admitted'::admission_status \
         LEFT JOIN patients p ON p.id = a.patient_id \
         WHERE {where_clause} \
         ORDER BY w.name NULLS LAST, l.name LIMIT 5000"
    );

    let mut q = sqlx::query_as::<_, BedDashboardRow>(&sql)
        .bind(claims.tenant_id)
        .bind(can_view_patient_identity);
    if let Some(wid) = params.ward_id {
        q = q.bind(wid);
    }
    if let Some(ref s) = params.status {
        q = q.bind(s.clone());
    }

    let rows = q.fetch_all(&mut *tx).await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn update_bed_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(bed_id): Path<Uuid>,
    Json(body): Json<UpdateBedStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ipd::beds::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let updated = sqlx::query_scalar::<_, bool>(
        "UPDATE bed_states SET status = $3::bed_status \
         WHERE location_id = $1 AND tenant_id = $2 RETURNING true",
    )
    .bind(bed_id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .fetch_optional(&mut *tx)
    .await?;

    if updated.is_none() {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "updated": true })))
}

// ══════════════════════════════════════════════════════════
//  Admission Attenders
// ══════════════════════════════════════════════════════════

pub async fn list_attenders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<AdmissionAttender>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::VIEW,
            permissions::ipd::attenders::MANAGE,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, AdmissionAttender>(
        "SELECT * FROM admission_attenders \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY is_primary DESC, created_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(
        rows.into_iter()
            .map(|row| filter_attender_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_attender(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateAttenderRequest>,
) -> Result<Json<AdmissionAttender>, AppError> {
    require_permission(&claims, permissions::ipd::attenders::MANAGE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    validate_attender_write_access(&body, &restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, AdmissionAttender>(
        "INSERT INTO admission_attenders \
           (tenant_id, admission_id, relationship, name, phone, alt_phone, \
            address, id_proof_type, id_proof_number, is_primary) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&body.relationship)
    .bind(&body.name)
    .bind(&body.phone)
    .bind(&body.alt_phone)
    .bind(&body.address)
    .bind(&body.id_proof_type)
    .bind(&body.id_proof_number)
    .bind(body.is_primary.unwrap_or(true))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(filter_attender_response(row, &restricted_fields)))
}

pub async fn delete_attender(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((admission_id, attender_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ipd::attenders::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    sqlx::query(
        "DELETE FROM admission_attenders \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3",
    )
    .bind(attender_id)
    .bind(admission_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Discharge Summary Templates & Summaries
// ══════════════════════════════════════════════════════════

pub async fn list_discharge_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DischargeSummaryTemplate>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, DischargeSummaryTemplate>(
        "SELECT * FROM discharge_summary_templates \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY is_default DESC, name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn create_discharge_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDischargeTemplateRequest>,
) -> Result<Json<DischargeSummaryTemplate>, AppError> {
    require_permission(&claims, permissions::ipd::wards::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let tmpl = sqlx::query_as::<_, DischargeSummaryTemplate>(
        "INSERT INTO discharge_summary_templates \
           (tenant_id, code, name, sections, is_default) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(body.sections.as_ref().unwrap_or(&serde_json::json!([])))
    .bind(body.is_default.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(tmpl))
}

pub async fn get_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Option<IpdDischargeSummary>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::VIEW,
            permissions::ipd::discharge_summary::CREATE,
            permissions::ipd::discharge_summary::FINALIZE,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdDischargeSummary>(
        "SELECT * FROM ipd_discharge_summaries \
         WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(row.map(|summary| {
        filter_discharge_summary_response(summary, &restricted_fields)
    })))
}

pub async fn create_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateDischargeSummaryRequest>,
) -> Result<Json<IpdDischargeSummary>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_summary::CREATE)?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    validate_discharge_summary_write_access(&body.final_diagnosis, &restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdDischargeSummary>(
        "INSERT INTO ipd_discharge_summaries \
           (tenant_id, admission_id, template_id, status, \
            final_diagnosis, condition_at_discharge, course_in_hospital, \
            treatment_given, procedures_performed, investigation_summary, \
            medications_on_discharge, follow_up_instructions, follow_up_date, \
            dietary_advice, activity_restrictions, warning_signs, \
            emergency_contact_info, prepared_by) \
         VALUES ($1, $2, $3, 'draft'::discharge_summary_status, \
                 $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(body.template_id)
    .bind(&body.final_diagnosis)
    .bind(&body.condition_at_discharge)
    .bind(&body.course_in_hospital)
    .bind(&body.treatment_given)
    .bind(
        body.procedures_performed
            .as_ref()
            .unwrap_or(&serde_json::json!([])),
    )
    .bind(&body.investigation_summary)
    .bind(
        body.medications_on_discharge
            .as_ref()
            .unwrap_or(&serde_json::json!([])),
    )
    .bind(&body.follow_up_instructions)
    .bind(body.follow_up_date)
    .bind(&body.dietary_advice)
    .bind(&body.activity_restrictions)
    .bind(&body.warning_signs)
    .bind(&body.emergency_contact_info)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(filter_discharge_summary_response(
        row,
        &restricted_fields,
    )))
}

pub async fn update_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<UpdateDischargeSummaryRequest>,
) -> Result<Json<IpdDischargeSummary>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_summary::CREATE)?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    validate_discharge_summary_write_access(&body.final_diagnosis, &restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Check status is draft
    let current_status = sqlx::query_scalar::<_, DischargeSummaryStatus>(
        "SELECT status FROM ipd_discharge_summaries \
         WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    if current_status == DischargeSummaryStatus::Finalized {
        return Err(AppError::BadRequest(
            "Cannot update a finalized discharge summary".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, IpdDischargeSummary>(
        "UPDATE ipd_discharge_summaries SET \
           final_diagnosis = COALESCE($3, final_diagnosis), \
           condition_at_discharge = COALESCE($4, condition_at_discharge), \
           course_in_hospital = COALESCE($5, course_in_hospital), \
           treatment_given = COALESCE($6, treatment_given), \
           procedures_performed = COALESCE($7, procedures_performed), \
           investigation_summary = COALESCE($8, investigation_summary), \
           medications_on_discharge = COALESCE($9, medications_on_discharge), \
           follow_up_instructions = COALESCE($10, follow_up_instructions), \
           follow_up_date = COALESCE($11, follow_up_date), \
           dietary_advice = COALESCE($12, dietary_advice), \
           activity_restrictions = COALESCE($13, activity_restrictions), \
           warning_signs = COALESCE($14, warning_signs), \
           emergency_contact_info = COALESCE($15, emergency_contact_info) \
         WHERE admission_id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .bind(&body.final_diagnosis)
    .bind(&body.condition_at_discharge)
    .bind(&body.course_in_hospital)
    .bind(&body.treatment_given)
    .bind(&body.procedures_performed)
    .bind(&body.investigation_summary)
    .bind(&body.medications_on_discharge)
    .bind(&body.follow_up_instructions)
    .bind(body.follow_up_date)
    .bind(&body.dietary_advice)
    .bind(&body.activity_restrictions)
    .bind(&body.warning_signs)
    .bind(&body.emergency_contact_info)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(filter_discharge_summary_response(
        row,
        &restricted_fields,
    )))
}

/// NABH-mandatory discharge-summary elements that must be present before a summary can be finalized.
/// Returns the human-readable names of the missing ones.
fn missing_discharge_summary_fields(
    final_diagnosis: Option<&str>,
    condition_at_discharge: Option<&str>,
    course_in_hospital: Option<&str>,
    follow_up_instructions: Option<&str>,
) -> Vec<&'static str> {
    let blank = |v: Option<&str>| v.is_none_or(|s| s.trim().is_empty());
    let mut missing = Vec::new();
    if blank(final_diagnosis) {
        missing.push("final diagnosis");
    }
    if blank(condition_at_discharge) {
        missing.push("condition at discharge");
    }
    if blank(course_in_hospital) {
        missing.push("course in hospital");
    }
    if blank(follow_up_instructions) {
        missing.push("follow-up instructions");
    }
    missing
}

pub async fn finalize_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<IpdDischargeSummary>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_summary::FINALIZE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Completeness gate: a discharge summary can only be finalized once its NABH-required narrative
    // elements are documented. Finalization is the clinical sign-off, so an incomplete summary must
    // not be signed off.
    #[derive(sqlx::FromRow)]
    struct DischargeSummaryDraft {
        final_diagnosis: Option<String>,
        condition_at_discharge: Option<String>,
        course_in_hospital: Option<String>,
        follow_up_instructions: Option<String>,
    }
    let draft = sqlx::query_as::<_, DischargeSummaryDraft>(
        "SELECT final_diagnosis, condition_at_discharge, course_in_hospital, \
         follow_up_instructions FROM ipd_discharge_summaries \
         WHERE admission_id = $1 AND tenant_id = $2 \
           AND status = 'draft'::discharge_summary_status",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(d) = &draft {
        let missing = missing_discharge_summary_fields(
            d.final_diagnosis.as_deref(),
            d.condition_at_discharge.as_deref(),
            d.course_in_hospital.as_deref(),
            d.follow_up_instructions.as_deref(),
        );
        if !missing.is_empty() {
            return Err(AppError::BadRequest(format!(
                "Discharge summary is incomplete — document these required elements before \
                 finalizing: {}.",
                missing.join(", ")
            )));
        }
    }

    let row = sqlx::query_as::<_, IpdDischargeSummary>(
        "UPDATE ipd_discharge_summaries SET \
           status = 'finalized'::discharge_summary_status, \
           verified_by = $3, finalized_at = NOW() \
         WHERE admission_id = $1 AND tenant_id = $2 \
           AND status = 'draft'::discharge_summary_status \
         RETURNING *",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Discharge summary not found or already finalized".to_owned())
    })?;

    #[derive(sqlx::FromRow)]
    struct DischargeFinalizedEventContext {
        patient_id: Uuid,
        encounter_id: Uuid,
        department_id: Option<Uuid>,
    }

    let event_context = sqlx::query_as::<_, DischargeFinalizedEventContext>(
        "SELECT a.patient_id, a.encounter_id, e.department_id \
         FROM admissions a \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::IpdDischargeFinalized,
        row.id,
        claims.sub,
        json!({
            "summary_id": row.id,
            "admission_id": row.admission_id,
            "patient_id": event_context.patient_id,
            "encounter_id": event_context.encounter_id,
            "finalized_at": row.finalized_at,
            "status": row.status,
        }),
    )
    .with_patient(event_context.patient_id)
    .with_admission(row.admission_id)
    .with_encounter(event_context.encounter_id);
    if let Some(department_id) = event_context.department_id {
        event = event.with_department(department_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(filter_discharge_summary_response(
        row,
        &restricted_fields,
    )))
}

// ══════════════════════════════════════════════════════════
//  No-Dues (financial clearance) certificate
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct IssueNoDuesRequest {
    pub notes: Option<String>,
}

pub async fn get_no_dues_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Option<IpdNoDuesCertificate>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdNoDuesCertificate>(
        "SELECT * FROM ipd_no_dues_certificates WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Issue (or refresh) the financial-clearance certificate for an
/// admission. Blocked while a balance remains — the certificate IS the
/// proof that billing reconciled and settled the stay. Idempotent per
/// admission so re-issuing after a late payment refreshes the snapshot.
pub async fn issue_no_dues_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<IssueNoDuesRequest>,
) -> Result<Json<IpdNoDuesCertificate>, AppError> {
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let (total_billed, total_paid) = sqlx::query_as::<_, (Decimal, Decimal)>(
        "SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(paid_amount), 0) \
         FROM invoices \
         WHERE admission_id = $1 AND tenant_id = $2 \
           AND status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status)",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let balance = total_billed - total_paid;
    if balance > Decimal::ZERO {
        return Err(AppError::Conflict(format!(
            "Cannot issue No-Dues certificate — outstanding balance of {balance} must be settled first"
        )));
    }

    let row = sqlx::query_as::<_, IpdNoDuesCertificate>(
        "INSERT INTO ipd_no_dues_certificates \
           (tenant_id, admission_id, total_billed, total_paid, balance, issued_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (admission_id) DO UPDATE SET \
           total_billed = EXCLUDED.total_billed, total_paid = EXCLUDED.total_paid, \
           balance = EXCLUDED.balance, issued_by = EXCLUDED.issued_by, \
           notes = EXCLUDED.notes, updated_at = NOW() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(total_billed)
    .bind(total_paid)
    .bind(balance)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  IPD Reports
// ══════════════════════════════════════════════════════════

pub async fn report_census(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CensusWardRow>>, AppError> {
    require_permission(&claims, permissions::ipd::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, CensusWardRow>(
        "SELECT bs.ward_id, w.name AS ward_name, \
               COUNT(*) AS total_beds, \
               COUNT(*) FILTER (WHERE bs.status = 'occupied') AS occupied, \
               COUNT(*) FILTER (WHERE bs.status IN ('vacant_clean', 'vacant_dirty')) AS vacant \
         FROM bed_states bs \
         LEFT JOIN wards w ON w.id = bs.ward_id \
         WHERE bs.tenant_id = $1 \
         GROUP BY bs.ward_id, w.name \
         ORDER BY w.name NULLS LAST LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn report_occupancy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateQuery>,
) -> Result<Json<Vec<OccupancyRow>>, AppError> {
    require_permission(&claims, permissions::ipd::reports::VIEW)?;

    let from = params
        .from
        .ok_or_else(|| AppError::BadRequest("'from' date is required".to_owned()))?;
    let to = params
        .to
        .ok_or_else(|| AppError::BadRequest("'to' date is required".to_owned()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, OccupancyRow>(
        "WITH ward_beds AS ( \
             SELECT bs.ward_id, w.name AS ward_name, COUNT(*) AS total_beds \
             FROM bed_states bs \
             LEFT JOIN wards w ON w.id = bs.ward_id \
             WHERE bs.tenant_id = $1 \
             GROUP BY bs.ward_id, w.name \
         ), occupied AS ( \
             SELECT a.ward_id, \
                    SUM(GREATEST(1, \
                        EXTRACT(DAY FROM \
                            LEAST(COALESCE(a.discharged_at, NOW()), \
                                  ($3::date + 1)::timestamptz) \
                            - GREATEST(a.admitted_at, $2::date::timestamptz) \
                        ) \
                    ))::bigint AS occupied_bed_days \
             FROM admissions a \
             WHERE a.tenant_id = $1 \
               AND a.admitted_at < ($3::date + 1)::timestamptz \
               AND (a.discharged_at IS NULL \
                    OR a.discharged_at >= $2::date::timestamptz) \
             GROUP BY a.ward_id \
         ) \
         SELECT wb.ward_id, wb.ward_name, wb.total_beds, \
                COALESCE(o.occupied_bed_days, 0) AS occupied_bed_days, \
                (wb.total_beds * ($3::date - $2::date + 1)) AS total_bed_days \
         FROM ward_beds wb \
         LEFT JOIN occupied o ON o.ward_id = wb.ward_id \
         ORDER BY wb.ward_name NULLS LAST LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn report_alos(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateQuery>,
) -> Result<Json<Vec<AlosRow>>, AppError> {
    require_permission(&claims, permissions::ipd::reports::VIEW)?;

    let from = params
        .from
        .ok_or_else(|| AppError::BadRequest("'from' date is required".to_owned()))?;
    let to = params
        .to
        .ok_or_else(|| AppError::BadRequest("'to' date is required".to_owned()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, AlosRow>(
        "SELECT d.name AS department_name, a.discharge_type, \
               AVG(EXTRACT(EPOCH FROM (a.discharged_at - a.admitted_at)) \
                   / 86400)::float8 AS avg_los_days, \
               COUNT(*)::bigint AS discharge_count \
         FROM admissions a \
         JOIN encounters e ON e.id = a.encounter_id \
         LEFT JOIN departments d ON d.id = e.department_id \
         WHERE a.tenant_id = $1 \
           AND a.status = 'discharged'::admission_status \
           AND a.discharged_at >= $2::date::timestamptz \
           AND a.discharged_at < ($3::date + 1)::timestamptz \
         GROUP BY d.name, a.discharge_type \
         ORDER BY d.name, a.discharge_type LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn report_discharge_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateQuery>,
) -> Result<Json<Vec<DischargeStatRow>>, AppError> {
    require_permission(&claims, permissions::ipd::reports::VIEW)?;

    let from = params
        .from
        .ok_or_else(|| AppError::BadRequest("'from' date is required".to_owned()))?;
    let to = params
        .to
        .ok_or_else(|| AppError::BadRequest("'to' date is required".to_owned()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, DischargeStatRow>(
        "SELECT a.discharge_type, COUNT(*)::bigint AS count \
         FROM admissions a \
         WHERE a.tenant_id = $1 \
           AND a.status = 'discharged'::admission_status \
           AND a.discharged_at >= $2::date::timestamptz \
           AND a.discharged_at < ($3::date + 1)::timestamptz \
         GROUP BY a.discharge_type \
         ORDER BY count DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateIpTypeConfigRequest {
    pub ip_type: String,
    pub label: String,
    pub daily_rate: Option<Decimal>,
    pub nursing_charge: Option<Decimal>,
    pub deposit_required: Option<Decimal>,
    pub description: Option<String>,
    pub billing_alert_threshold: Option<Decimal>,
    pub auto_billing_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIpTypeConfigRequest {
    pub label: Option<String>,
    pub daily_rate: Option<Decimal>,
    pub nursing_charge: Option<Decimal>,
    pub deposit_required: Option<Decimal>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub billing_alert_threshold: Option<Decimal>,
    pub auto_billing_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChecklistItemsRequest {
    pub items: Vec<ChecklistItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct ChecklistItemInput {
    pub item_label: String,
    pub category: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ToggleChecklistRequest {
    pub is_completed: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateBedReservationRequest {
    pub bed_id: Uuid,
    pub patient_id: Uuid,
    pub reserved_until: String,
    pub purpose: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReservationStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct ListBedReservationsQuery {
    pub status: Option<String>,
    pub bed_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBedTurnaroundRequest {
    pub bed_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CompleteTurnaroundRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListClinicalDocsQuery {
    pub doc_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClinicalDocRequest {
    pub doc_type: String,
    pub title: String,
    pub body: Option<serde_json::Value>,
    pub next_review_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClinicalDocRequest {
    pub body: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub next_review_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRestraintCheckRequest {
    pub clinical_doc_id: Uuid,
    pub status: String,
    pub circulation_status: Option<String>,
    pub skin_status: Option<String>,
    pub patient_response: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransferRequest {
    pub transfer_type: String,
    pub from_ward_id: Option<Uuid>,
    pub to_ward_id: Option<Uuid>,
    pub from_bed_id: Option<Uuid>,
    pub to_bed_id: Option<Uuid>,
    pub reason: String,
    pub clinical_summary: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDeathSummaryRequest {
    pub date_of_death: NaiveDate,
    pub time_of_death: NaiveTime,
    pub cause_of_death_primary: String,
    pub cause_of_death_secondary: Option<String>,
    pub cause_of_death_tertiary: Option<String>,
    pub cause_of_death_underlying: Option<String>,
    pub manner_of_death: Option<String>,
    pub duration_of_illness: Option<String>,
    pub autopsy_requested: Option<bool>,
    pub is_medico_legal: Option<bool>,
    pub form_type: Option<String>,
    pub certifying_doctor_id: Option<Uuid>,
    pub witness_name: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDeathSummaryRequest {
    pub cause_of_death_primary: Option<String>,
    pub cause_of_death_secondary: Option<String>,
    pub cause_of_death_tertiary: Option<String>,
    pub cause_of_death_underlying: Option<String>,
    pub manner_of_death: Option<String>,
    pub autopsy_requested: Option<bool>,
    pub is_medico_legal: Option<bool>,
    pub certifying_doctor_id: Option<Uuid>,
    pub witness_name: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBirthRecordRequest {
    pub date_of_birth: NaiveDate,
    pub time_of_birth: NaiveTime,
    pub gender: String,
    pub weight_grams: Option<Decimal>,
    pub length_cm: Option<Decimal>,
    pub head_circumference_cm: Option<Decimal>,
    pub apgar_1min: Option<i32>,
    pub apgar_5min: Option<i32>,
    pub delivery_type: Option<String>,
    pub is_live_birth: Option<bool>,
    pub birth_certificate_number: Option<String>,
    pub baby_patient_id: Option<Uuid>,
    pub complications: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBirthRecordRequest {
    pub weight_grams: Option<Decimal>,
    pub length_cm: Option<Decimal>,
    pub head_circumference_cm: Option<Decimal>,
    pub apgar_1min: Option<i32>,
    pub apgar_5min: Option<i32>,
    pub delivery_type: Option<String>,
    pub birth_certificate_number: Option<String>,
    pub baby_patient_id: Option<Uuid>,
    pub complications: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDischargeTatRequest {
    pub billing_cleared_at: Option<String>,
    pub pharmacy_cleared_at: Option<String>,
    pub nursing_cleared_at: Option<String>,
    pub doctor_cleared_at: Option<String>,
    pub discharge_completed_at: Option<String>,
    pub notes: Option<String>,
}

fn required_discharge_tat_update_permissions(
    body: &UpdateDischargeTatRequest,
) -> Result<Vec<&'static str>, AppError> {
    let mut permissions = Vec::new();
    if body.billing_cleared_at.is_some() {
        permissions.push(permissions::ipd::discharge_tat::BILLING_UPDATE);
    }
    if body.pharmacy_cleared_at.is_some() {
        permissions.push(permissions::ipd::discharge_tat::PHARMACY_UPDATE);
    }
    if body.nursing_cleared_at.is_some() {
        permissions.push(permissions::ipd::discharge_tat::NURSING_UPDATE);
    }
    if body.doctor_cleared_at.is_some() {
        permissions.push(permissions::ipd::discharge_tat::DOCTOR_UPDATE);
    }
    if body.discharge_completed_at.is_some() {
        permissions.push(permissions::ipd::discharge_tat::COMPLETE);
    }
    if body
        .notes
        .as_ref()
        .is_some_and(|notes| !notes.trim().is_empty())
    {
        permissions.push(permissions::ipd::discharge_tat::UPDATE);
    }
    if permissions.is_empty() {
        return Err(AppError::BadRequest(
            "Provide at least one discharge TAT milestone or note".to_owned(),
        ));
    }
    Ok(permissions)
}

fn parse_discharge_tat_timestamp(
    value: Option<&String>,
    field_name: &str,
) -> Result<Option<chrono::DateTime<Utc>>, AppError> {
    value.map_or(Ok(None), |raw| {
        raw.parse::<chrono::DateTime<Utc>>().map(Some).map_err(|_| {
            AppError::BadRequest(format!("{field_name} must be a valid RFC3339 timestamp"))
        })
    })
}

#[derive(Debug, Deserialize)]
pub struct ListTurnaroundQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — IP Type Configuration
// ══════════════════════════════════════════════════════════

pub async fn list_ip_types(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<IpTypeConfiguration>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::tariffs::LIST,
            permissions::ipd::tariffs::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpTypeConfiguration>(
        "SELECT * FROM ip_type_configurations \
         WHERE tenant_id = $1 \
         ORDER BY ip_type LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_ip_type_configuration_response(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_ip_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIpTypeConfigRequest>,
) -> Result<Json<IpTypeConfiguration>, AppError> {
    require_permission(&claims, permissions::ipd::tariffs::MANAGE)?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    validate_ip_type_amount_write_access(
        body.daily_rate,
        body.nursing_charge,
        body.deposit_required,
        body.billing_alert_threshold,
        &restricted_fields,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpTypeConfiguration>(
        "INSERT INTO ip_type_configurations \
           (tenant_id, ip_type, label, daily_rate, nursing_charge, deposit_required, \
            description, billing_alert_threshold, auto_billing_enabled) \
         VALUES ($1, $2::ip_type, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.ip_type)
    .bind(&body.label)
    .bind(body.daily_rate.unwrap_or_default())
    .bind(body.nursing_charge.unwrap_or_default())
    .bind(body.deposit_required.unwrap_or_default())
    .bind(&body.description)
    .bind(body.billing_alert_threshold)
    .bind(body.auto_billing_enabled.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_ip_type_configuration_response(
        row,
        &restricted_fields,
    )))
}

pub async fn update_ip_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateIpTypeConfigRequest>,
) -> Result<Json<IpTypeConfiguration>, AppError> {
    require_permission(&claims, permissions::ipd::tariffs::MANAGE)?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    validate_ip_type_amount_write_access(
        body.daily_rate,
        body.nursing_charge,
        body.deposit_required,
        body.billing_alert_threshold,
        &restricted_fields,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpTypeConfiguration>(
        "UPDATE ip_type_configurations SET \
           label = COALESCE($3, label), \
           daily_rate = COALESCE($4, daily_rate), \
           nursing_charge = COALESCE($5, nursing_charge), \
           deposit_required = COALESCE($6, deposit_required), \
           description = COALESCE($7, description), \
           is_active = COALESCE($8, is_active), \
           billing_alert_threshold = COALESCE($9, billing_alert_threshold), \
           auto_billing_enabled = COALESCE($10, auto_billing_enabled) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.label)
    .bind(body.daily_rate)
    .bind(body.nursing_charge)
    .bind(body.deposit_required)
    .bind(&body.description)
    .bind(body.is_active)
    .bind(body.billing_alert_threshold)
    .bind(body.auto_billing_enabled)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(filter_ip_type_configuration_response(
        row,
        &restricted_fields,
    )))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Admission Checklists
// ══════════════════════════════════════════════════════════

pub async fn list_admission_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<AdmissionChecklist>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::VIEW,
            permissions::ipd::discharge_checklist::LIST,
            permissions::ipd::discharge_checklist::UPDATE,
            permissions::ipd::clinical_docs::CREATE,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, AdmissionChecklist>(
        "SELECT * FROM admission_checklists \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY sort_order, created_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_admission_checklist_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateChecklistItemsRequest>,
) -> Result<Json<Vec<AdmissionChecklist>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::discharge_checklist::UPDATE,
            permissions::ipd::clinical_docs::CREATE,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut results = Vec::new();
    for (i, item) in body.items.iter().enumerate() {
        let row = sqlx::query_as::<_, AdmissionChecklist>(
            "INSERT INTO admission_checklists \
               (tenant_id, admission_id, item_label, category, sort_order) \
             VALUES ($1, $2, $3, $4, $5) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(admission_id)
        .bind(&item.item_label)
        .bind(&item.category)
        .bind(item.sort_order.unwrap_or(i as i32))
        .fetch_one(&mut *tx)
        .await?;
        results.push(row);
    }

    tx.commit().await?;
    Ok(Json(results))
}

pub async fn toggle_checklist_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((admission_id, item_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<ToggleChecklistRequest>,
) -> Result<Json<AdmissionChecklist>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::discharge_checklist::UPDATE,
            permissions::ipd::clinical_docs::CREATE,
        ],
    )?;

    // The URL names an admission; authorize it and scope the statement by it.
    // Binding the parent and discarding it let `/admissions/{A}/…/{child}` act on
    // a child belonging to admission B, and the audit row still said A.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let completed_by = if body.is_completed {
        Some(claims.sub)
    } else {
        None
    };
    let completed_at = if body.is_completed {
        Some(Utc::now())
    } else {
        None
    };

    let row = sqlx::query_as::<_, AdmissionChecklist>(
        "UPDATE admission_checklists SET \
           is_completed = $3, completed_by = $4, completed_at = $5 \
         WHERE id = $1 AND tenant_id = $2 AND admission_id = $6 RETURNING *",
    )
    .bind(item_id)
    .bind(claims.tenant_id)
    .bind(body.is_completed)
    .bind(completed_by)
    .bind(completed_at)
    .bind(admission_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Bed Reservations
// ══════════════════════════════════════════════════════════

pub async fn list_bed_reservations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBedReservationsQuery>,
) -> Result<Json<Vec<BedReservation>>, AppError> {
    require_permission(&claims, permissions::ipd::reservations::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut idx = 2u32;

    if params.status.is_some() {
        conditions.push(format!("status = ${idx}::bed_reservation_status"));
        idx += 1;
    }
    if params.bed_id.is_some() {
        conditions.push(format!("bed_id = ${idx}"));
        idx += 1;
    }
    if params.patient_id.is_some() {
        conditions.push(format!("patient_id = ${idx}"));
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT * FROM bed_reservations WHERE {where_clause} ORDER BY reserved_from DESC LIMIT 5000"
    );

    let mut q = sqlx::query_as::<_, BedReservation>(&sql).bind(claims.tenant_id);
    if let Some(ref s) = params.status {
        q = q.bind(s);
    }
    if let Some(bid) = params.bed_id {
        q = q.bind(bid);
    }
    if let Some(pid) = params.patient_id {
        q = q.bind(pid);
    }

    let rows = q.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_bed_reservation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBedReservationRequest>,
) -> Result<Json<BedReservation>, AppError> {
    require_permission(&claims, permissions::ipd::reservations::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let reserved_until: chrono::DateTime<Utc> = body
        .reserved_until
        .parse::<chrono::DateTime<Utc>>()
        .map_err(|_| AppError::BadRequest("Invalid reserved_until datetime".to_owned()))?;

    let row = sqlx::query_as::<_, BedReservation>(
        "INSERT INTO bed_reservations \
           (tenant_id, bed_id, patient_id, reserved_by, reserved_until, purpose, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.bed_id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(reserved_until)
    .bind(&body.purpose)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_reservation_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReservationStatusRequest>,
) -> Result<Json<BedReservation>, AppError> {
    require_permission(&claims, permissions::ipd::reservations::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let cancelled_by = if body.status == "cancelled" {
        Some(claims.sub)
    } else {
        None
    };
    let cancelled_at = if body.status == "cancelled" {
        Some(Utc::now())
    } else {
        None
    };

    let row = sqlx::query_as::<_, BedReservation>(
        "UPDATE bed_reservations SET \
           status = $3::bed_reservation_status, \
           cancelled_by = COALESCE($4, cancelled_by), \
           cancelled_at = COALESCE($5, cancelled_at) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(cancelled_by)
    .bind(cancelled_at)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_bed_reservations_for_bed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(bed_id): Path<Uuid>,
) -> Result<Json<Vec<BedReservation>>, AppError> {
    require_permission(&claims, permissions::ipd::reservations::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, BedReservation>(
        "SELECT * FROM bed_reservations \
         WHERE bed_id = $1 AND tenant_id = $2 \
           AND status IN ('active', 'confirmed') \
         ORDER BY reserved_from LIMIT 5000",
    )
    .bind(bed_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Bed Turnaround
// ══════════════════════════════════════════════════════════

pub async fn list_bed_turnaround(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTurnaroundQuery>,
) -> Result<Json<Vec<BedTurnaroundLog>>, AppError> {
    require_permission(&claims, permissions::ipd::beds::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = if let (Some(from), Some(to)) = (params.from, params.to) {
        sqlx::query_as::<_, BedTurnaroundLog>(
            "SELECT * FROM bed_turnaround_log \
             WHERE tenant_id = $1 \
               AND vacated_at >= $2::date::timestamptz \
               AND vacated_at < ($3::date + 1)::timestamptz \
             ORDER BY vacated_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(from)
        .bind(to)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BedTurnaroundLog>(
            "SELECT * FROM bed_turnaround_log \
             WHERE tenant_id = $1 \
             ORDER BY vacated_at DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_bed_turnaround(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBedTurnaroundRequest>,
) -> Result<Json<BedTurnaroundLog>, AppError> {
    require_permission(&claims, permissions::ipd::beds::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, BedTurnaroundLog>(
        "INSERT INTO bed_turnaround_log \
           (tenant_id, bed_id, admission_id, notes) \
         VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.bed_id)
    .bind(body.admission_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn complete_bed_turnaround(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteTurnaroundRequest>,
) -> Result<Json<BedTurnaroundLog>, AppError> {
    require_permission(&claims, permissions::ipd::beds::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let now = Utc::now();
    let row = sqlx::query_as::<_, BedTurnaroundLog>(
        "UPDATE bed_turnaround_log SET \
           cleaning_completed_at = $3, \
           ready_at = $3, \
           cleaned_by = $4, \
           turnaround_minutes = EXTRACT(EPOCH FROM ($3 - vacated_at))::int / 60, \
           notes = COALESCE($5, notes) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(now)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Clinical Documentation
// ══════════════════════════════════════════════════════════

pub async fn list_clinical_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Query(params): Query<ListClinicalDocsQuery>,
) -> Result<Json<Vec<IpdClinicalDocumentation>>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = if let Some(ref doc_type) = params.doc_type {
        sqlx::query_as::<_, IpdClinicalDocumentation>(
            "SELECT * FROM ipd_clinical_documentations \
             WHERE admission_id = $1 AND tenant_id = $2 \
               AND doc_type = $3::ipd_clinical_doc_type \
             ORDER BY recorded_at DESC LIMIT 5000",
        )
        .bind(admission_id)
        .bind(claims.tenant_id)
        .bind(doc_type)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, IpdClinicalDocumentation>(
            "SELECT * FROM ipd_clinical_documentations \
             WHERE admission_id = $1 AND tenant_id = $2 \
             ORDER BY recorded_at DESC LIMIT 5000",
        )
        .bind(admission_id)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_clinical_doc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateClinicalDocRequest>,
) -> Result<Json<IpdClinicalDocumentation>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let next_review: Option<chrono::DateTime<Utc>> = body
        .next_review_at
        .as_ref()
        .and_then(|s| s.parse::<chrono::DateTime<Utc>>().ok());

    let row = sqlx::query_as::<_, IpdClinicalDocumentation>(
        "INSERT INTO ipd_clinical_documentations \
           (tenant_id, admission_id, patient_id, doc_type, title, body, \
            recorded_by, next_review_at, notes) \
         VALUES ($1, $2, $3, $4::ipd_clinical_doc_type, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(patient_id)
    .bind(&body.doc_type)
    .bind(&body.title)
    .bind(body.body.as_ref().unwrap_or(&serde_json::json!({})))
    .bind(claims.sub)
    .bind(next_review)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_clinical_doc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((admission_id, doc_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateClinicalDocRequest>,
) -> Result<Json<IpdClinicalDocumentation>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::CREATE)?;

    // The URL names an admission; authorize it and scope the statement by it.
    // Binding the parent and discarding it let `/admissions/{A}/…/{child}` act on
    // a child belonging to admission B, and the audit row still said A.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let next_review: Option<chrono::DateTime<Utc>> = body
        .next_review_at
        .as_ref()
        .and_then(|s| s.parse::<chrono::DateTime<Utc>>().ok());

    let row = sqlx::query_as::<_, IpdClinicalDocumentation>(
        "UPDATE ipd_clinical_documentations SET \
           body = COALESCE($3, body), \
           notes = COALESCE($4, notes), \
           next_review_at = COALESCE($5, next_review_at) \
         WHERE id = $1 AND tenant_id = $2 AND admission_id = $6 RETURNING *",
    )
    .bind(doc_id)
    .bind(claims.tenant_id)
    .bind(&body.body)
    .bind(&body.notes)
    .bind(next_review)
    .bind(admission_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn resolve_clinical_doc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((admission_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<IpdClinicalDocumentation>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::CREATE)?;

    // The URL names an admission; authorize it and scope the statement by it.
    // Binding the parent and discarding it let `/admissions/{A}/…/{child}` act on
    // a child belonging to admission B, and the audit row still said A.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdClinicalDocumentation>(
        "UPDATE ipd_clinical_documentations SET \
           is_resolved = true, resolved_at = NOW(), resolved_by = $3 \
         WHERE id = $1 AND tenant_id = $2 AND admission_id = $4 AND is_resolved = false RETURNING *",
    )
    .bind(doc_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(admission_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Document not found or already resolved".to_owned()))?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Restraint Monitoring
// ══════════════════════════════════════════════════════════

pub async fn list_restraint_checks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((admission_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<RestraintMonitoringLog>>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::LIST)?;

    // The URL names an admission; authorize it and scope the statement by it.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, RestraintMonitoringLog>(
        "SELECT * FROM restraint_monitoring_logs \
         WHERE clinical_doc_id = $1 AND tenant_id = $2 \
           AND EXISTS ( \
             SELECT 1 FROM ipd_clinical_documentations d \
             WHERE d.id = $1 AND d.tenant_id = $2 AND d.admission_id = $3 \
           ) \
         ORDER BY check_time DESC LIMIT 5000",
    )
    .bind(doc_id)
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_restraint_check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateRestraintCheckRequest>,
) -> Result<Json<RestraintMonitoringLog>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, RestraintMonitoringLog>(
        "INSERT INTO restraint_monitoring_logs \
           (tenant_id, admission_id, clinical_doc_id, status, \
            circulation_status, skin_status, patient_response, checked_by, notes) \
         VALUES ($1, $2, $3, $4::restraint_check_status, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(body.clinical_doc_id)
    .bind(&body.status)
    .bind(&body.circulation_status)
    .bind(&body.skin_status)
    .bind(&body.patient_response)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Transfer Logs
// ══════════════════════════════════════════════════════════

pub async fn list_transfers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IpdTransferLog>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::VIEW,
            permissions::ipd::transfers::CREATE,
            permissions::ipd::beds::MANAGE,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdTransferLog>(
        "SELECT * FROM ipd_transfer_logs \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY transferred_at DESC LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateTransferRequest>,
) -> Result<Json<IpdTransferLog>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;
    let transfer_type = match body.transfer_type.as_str() {
        "inter_ward" | "inter_department" | "inter_hospital" => body.transfer_type,
        _ => return Err(AppError::BadRequest("Invalid transfer type".to_owned())),
    };
    let transfer_reason = body.reason.trim();
    if transfer_reason.len() < 3 {
        return Err(AppError::BadRequest(
            "Transfer reason must be at least 3 characters".to_owned(),
        ));
    }
    let transfer_reason = transfer_reason.to_owned();
    let clinical_summary = body
        .clinical_summary
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    let transfer_notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let admission_context =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(admission_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;
    if admission_context.status != AdmissionStatus::Admitted {
        return Err(AppError::BadRequest(
            "Transfers can only be logged for admitted patients".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, IpdTransferLog>(
        "INSERT INTO ipd_transfer_logs \
           (tenant_id, admission_id, transfer_type, from_ward_id, to_ward_id, \
            from_bed_id, to_bed_id, reason, clinical_summary, transferred_by, notes) \
         VALUES ($1, $2, $3::transfer_type, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&transfer_type)
    .bind(body.from_ward_id)
    .bind(body.to_ward_id)
    .bind(body.from_bed_id)
    .bind(body.to_bed_id)
    .bind(&transfer_reason)
    .bind(&clinical_summary)
    .bind(claims.sub)
    .bind(&transfer_notes)
    .fetch_one(&mut *tx)
    .await?;

    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::BedTransferred,
        row.id,
        claims.sub,
        json!({
            "transfer_id": row.id,
            "admission_id": row.admission_id,
            "patient_id": admission_context.patient_id,
            "encounter_id": admission_context.encounter_id,
            "from_bed_id": row.from_bed_id,
            "to_bed_id": row.to_bed_id,
            "from_ward_id": row.from_ward_id,
            "to_ward_id": row.to_ward_id,
            "transfer_type": format!("{:?}", row.transfer_type),
            "reason": row.reason.as_deref().unwrap_or("IPD transfer"),
        }),
    )
    .with_patient(admission_context.patient_id)
    .with_admission(row.admission_id)
    .with_encounter(admission_context.encounter_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Death Summaries
// ══════════════════════════════════════════════════════════

pub async fn get_death_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Option<IpdDeathSummary>>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdDeathSummary>(
        "SELECT * FROM ipd_death_summaries \
         WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_death_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateDeathSummaryRequest>,
) -> Result<Json<IpdDeathSummary>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let row = sqlx::query_as::<_, IpdDeathSummary>(
        "INSERT INTO ipd_death_summaries \
           (tenant_id, admission_id, patient_id, date_of_death, time_of_death, \
            cause_of_death_primary, cause_of_death_secondary, cause_of_death_tertiary, \
            cause_of_death_underlying, manner_of_death, duration_of_illness, \
            autopsy_requested, is_medico_legal, form_type, certifying_doctor_id, \
            witness_name, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, \
                 COALESCE($14, 'form_4')::death_cert_form_type, $15, $16, $17) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(patient_id)
    .bind(body.date_of_death)
    .bind(body.time_of_death)
    .bind(&body.cause_of_death_primary)
    .bind(&body.cause_of_death_secondary)
    .bind(&body.cause_of_death_tertiary)
    .bind(&body.cause_of_death_underlying)
    .bind(&body.manner_of_death)
    .bind(&body.duration_of_illness)
    .bind(body.autopsy_requested.unwrap_or(false))
    .bind(body.is_medico_legal.unwrap_or(false))
    .bind(&body.form_type)
    .bind(body.certifying_doctor_id)
    .bind(&body.witness_name)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // The death summary carries the authoritative date/time of death — mark the patient
    // deceased on the master record with that precise timestamp so downstream modules and
    // reports reflect the death, overriding any rougher discharge-time stamp.
    sqlx::query(
        "UPDATE patients SET is_deceased = true, \
           deceased_date = ($3::date + COALESCE($4::time, '00:00'::time))::timestamptz \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .bind(body.date_of_death)
    .bind(body.time_of_death)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_death_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<UpdateDeathSummaryRequest>,
) -> Result<Json<IpdDeathSummary>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdDeathSummary>(
        "UPDATE ipd_death_summaries SET \
           cause_of_death_primary = COALESCE($3, cause_of_death_primary), \
           cause_of_death_secondary = COALESCE($4, cause_of_death_secondary), \
           cause_of_death_tertiary = COALESCE($5, cause_of_death_tertiary), \
           cause_of_death_underlying = COALESCE($6, cause_of_death_underlying), \
           manner_of_death = COALESCE($7, manner_of_death), \
           autopsy_requested = COALESCE($8, autopsy_requested), \
           is_medico_legal = COALESCE($9, is_medico_legal), \
           certifying_doctor_id = COALESCE($10, certifying_doctor_id), \
           witness_name = COALESCE($11, witness_name), \
           notes = COALESCE($12, notes) \
         WHERE admission_id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .bind(&body.cause_of_death_primary)
    .bind(&body.cause_of_death_secondary)
    .bind(&body.cause_of_death_tertiary)
    .bind(&body.cause_of_death_underlying)
    .bind(&body.manner_of_death)
    .bind(body.autopsy_requested)
    .bind(body.is_medico_legal)
    .bind(body.certifying_doctor_id)
    .bind(&body.witness_name)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Birth Records
// ══════════════════════════════════════════════════════════

pub async fn list_birth_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IpdBirthRecord>>, AppError> {
    require_permission(&claims, permissions::ipd::birth_records::MANAGE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, IpdBirthRecord>(
        "SELECT * FROM ipd_birth_records \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY date_of_birth, time_of_birth LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_birth_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateBirthRecordRequest>,
) -> Result<Json<IpdBirthRecord>, AppError> {
    require_permission(&claims, permissions::ipd::birth_records::MANAGE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mother_patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let row = sqlx::query_as::<_, IpdBirthRecord>(
        "INSERT INTO ipd_birth_records \
           (tenant_id, admission_id, mother_patient_id, baby_patient_id, \
            date_of_birth, time_of_birth, gender, weight_grams, length_cm, \
            head_circumference_cm, apgar_1min, apgar_5min, delivery_type, \
            is_live_birth, birth_certificate_number, complications, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(mother_patient_id)
    .bind(body.baby_patient_id)
    .bind(body.date_of_birth)
    .bind(body.time_of_birth)
    .bind(&body.gender)
    .bind(body.weight_grams)
    .bind(body.length_cm)
    .bind(body.head_circumference_cm)
    .bind(body.apgar_1min)
    .bind(body.apgar_5min)
    .bind(&body.delivery_type)
    .bind(body.is_live_birth.unwrap_or(true))
    .bind(&body.birth_certificate_number)
    .bind(&body.complications)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_birth_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((admission_id, rec_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateBirthRecordRequest>,
) -> Result<Json<IpdBirthRecord>, AppError> {
    require_permission(&claims, permissions::ipd::birth_records::MANAGE)?;

    // The URL names an admission; authorize it and scope the statement by it.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdBirthRecord>(
        "UPDATE ipd_birth_records SET \
           weight_grams = COALESCE($3, weight_grams), \
           length_cm = COALESCE($4, length_cm), \
           head_circumference_cm = COALESCE($5, head_circumference_cm), \
           apgar_1min = COALESCE($6, apgar_1min), \
           apgar_5min = COALESCE($7, apgar_5min), \
           delivery_type = COALESCE($8, delivery_type), \
           birth_certificate_number = COALESCE($9, birth_certificate_number), \
           baby_patient_id = COALESCE($10, baby_patient_id), \
           complications = COALESCE($11, complications), \
           notes = COALESCE($12, notes) \
         WHERE id = $1 AND tenant_id = $2 AND admission_id = $13 RETURNING *",
    )
    .bind(rec_id)
    .bind(claims.tenant_id)
    .bind(body.weight_grams)
    .bind(body.length_cm)
    .bind(body.head_circumference_cm)
    .bind(body.apgar_1min)
    .bind(body.apgar_5min)
    .bind(&body.delivery_type)
    .bind(&body.birth_certificate_number)
    .bind(body.baby_patient_id)
    .bind(&body.complications)
    .bind(&body.notes)
    .bind(admission_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Discharge TAT
// ══════════════════════════════════════════════════════════

pub async fn get_discharge_tat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Option<IpdDischargeTatLog>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::discharge_tat::VIEW,
            permissions::ipd::discharge_tat::UPDATE,
            permissions::ipd::discharge_tat::BILLING_UPDATE,
            permissions::ipd::discharge_tat::PHARMACY_UPDATE,
            permissions::ipd::discharge_tat::NURSING_UPDATE,
            permissions::ipd::discharge_tat::DOCTOR_UPDATE,
            permissions::ipd::discharge_tat::COMPLETE,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdDischargeTatLog>(
        "SELECT * FROM ipd_discharge_tat_log \
         WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn initiate_discharge_tat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<IpdDischargeTatLog>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_tat::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdDischargeTatLog>(
        "INSERT INTO ipd_discharge_tat_log \
           (tenant_id, admission_id, discharge_initiated_at) \
         VALUES ($1, $2, NOW()) \
         ON CONFLICT (admission_id) DO UPDATE SET \
           discharge_initiated_at = COALESCE(ipd_discharge_tat_log.discharge_initiated_at, NOW()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_discharge_tat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<UpdateDischargeTatRequest>,
) -> Result<Json<IpdDischargeTatLog>, AppError> {
    let required_permissions = required_discharge_tat_update_permissions(&body)?;
    for permission in required_permissions {
        require_permission(&claims, permission)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let billing_ts =
        parse_discharge_tat_timestamp(body.billing_cleared_at.as_ref(), "billing_cleared_at")?;
    let pharmacy_ts =
        parse_discharge_tat_timestamp(body.pharmacy_cleared_at.as_ref(), "pharmacy_cleared_at")?;
    let nursing_ts =
        parse_discharge_tat_timestamp(body.nursing_cleared_at.as_ref(), "nursing_cleared_at")?;
    let doctor_ts =
        parse_discharge_tat_timestamp(body.doctor_cleared_at.as_ref(), "doctor_cleared_at")?;
    let completed_ts = parse_discharge_tat_timestamp(
        body.discharge_completed_at.as_ref(),
        "discharge_completed_at",
    )?;

    if completed_ts.is_some() {
        let existing_clearances = sqlx::query_as::<
            _,
            (
                Option<chrono::DateTime<Utc>>,
                Option<chrono::DateTime<Utc>>,
                Option<chrono::DateTime<Utc>>,
                Option<chrono::DateTime<Utc>>,
            ),
        >(
            "SELECT billing_cleared_at, pharmacy_cleared_at, nursing_cleared_at, doctor_cleared_at \
             FROM ipd_discharge_tat_log WHERE admission_id = $1 AND tenant_id = $2 FOR UPDATE",
        )
        .bind(admission_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound)?;

        let missing_clearances = [
            (
                "billing",
                billing_ts.as_ref().or(existing_clearances.0.as_ref()),
            ),
            (
                "pharmacy",
                pharmacy_ts.as_ref().or(existing_clearances.1.as_ref()),
            ),
            (
                "nursing",
                nursing_ts.as_ref().or(existing_clearances.2.as_ref()),
            ),
            (
                "doctor",
                doctor_ts.as_ref().or(existing_clearances.3.as_ref()),
            ),
        ]
        .into_iter()
        .filter_map(|(label, value)| value.is_none().then_some(label))
        .collect::<Vec<_>>();

        if !missing_clearances.is_empty() {
            return Err(AppError::BadRequest(format!(
                "Cannot complete discharge TAT before {} clearance",
                missing_clearances.join(", ")
            )));
        }
    }

    let row = sqlx::query_as::<_, IpdDischargeTatLog>(
        "UPDATE ipd_discharge_tat_log SET \
           billing_cleared_at = COALESCE($3, billing_cleared_at), \
           pharmacy_cleared_at = COALESCE($4, pharmacy_cleared_at), \
           nursing_cleared_at = COALESCE($5, nursing_cleared_at), \
           doctor_cleared_at = COALESCE($6, doctor_cleared_at), \
           discharge_completed_at = COALESCE($7, discharge_completed_at), \
           total_tat_minutes = CASE WHEN COALESCE($7, discharge_completed_at) IS NOT NULL \
             THEN EXTRACT(EPOCH FROM (COALESCE($7, discharge_completed_at) \
                  - discharge_initiated_at))::int / 60 \
             ELSE total_tat_minutes END, \
           notes = COALESCE($8, notes) \
         WHERE admission_id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .bind(billing_ts)
    .bind(pharmacy_ts)
    .bind(nursing_ts)
    .bind(doctor_ts)
    .bind(completed_ts)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Available Beds (for OPD → IPD bed selection)
// ══════════════════════════════════════════════════════════

use medbrains_core::ipd::AvailableBed;

#[derive(Debug, Deserialize)]
pub struct AvailableBedsQuery {
    pub ward_id: Option<Uuid>,
}

pub async fn list_available_beds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<AvailableBedsQuery>,
) -> Result<Json<Vec<AvailableBed>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::VIEW,
            permissions::ipd::admissions::CREATE,
            permissions::ipd::transfers::CREATE,
            permissions::ipd::wards::MANAGE,
            permissions::ipd::beds::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, AvailableBed>(
        "SELECT \
           bs.location_id AS bed_id, \
           l.name AS bed_number, \
           w.id AS ward_id, \
           w.name AS ward_name, \
           parent_l.name AS room_number, \
           bt.name AS bed_type, \
           COALESCE(bs.is_isolation, false) AS is_isolation \
         FROM bed_states bs \
         JOIN locations l ON l.id = bs.location_id AND l.tenant_id = bs.tenant_id \
         LEFT JOIN wards w ON w.id = bs.ward_id AND w.tenant_id = bs.tenant_id \
         LEFT JOIN locations parent_l ON parent_l.id = l.parent_id AND parent_l.tenant_id = bs.tenant_id \
         LEFT JOIN bed_types bt ON bt.id = l.bed_type_id AND bt.tenant_id = bs.tenant_id \
         WHERE bs.tenant_id = $1 \
           AND bs.admission_id IS NULL \
           AND bs.status = 'vacant_clean'::bed_status \
           AND ($2::uuid IS NULL OR bs.ward_id = $2) \
           AND NOT EXISTS ( \
             SELECT 1 FROM bed_reservations br \
             WHERE br.bed_id = bs.location_id AND br.tenant_id = bs.tenant_id \
               AND br.status IN ('active', 'confirmed') \
               AND br.reserved_until > NOW() \
           ) \
         ORDER BY w.name, l.name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(q.ward_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3a — Cross-module read endpoints
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct LinkMlcRequest {
    pub mlc_case_id: Uuid,
}

/// GET /api/ipd/admissions/{id}/investigations
pub async fn get_investigations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<InvestigationsResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::ipd::admissions::VIEW,
            permissions::lab::orders::LIST,
            permissions::lab::orders::VIEW,
            permissions::lab::reports::VIEW,
            permissions::radiology::orders::LIST,
            permissions::radiology::orders::VIEW,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let lab_orders = sqlx::query_as::<_, LabOrderSummary>(
        "SELECT lo.id, ltc.name AS test_name, lo.created_at AS ordered_at, \
               lo.status::text AS status \
         FROM lab_orders lo \
         JOIN lab_test_catalog ltc ON ltc.id = lo.test_id AND ltc.tenant_id = lo.tenant_id \
         WHERE lo.patient_id = $1 AND lo.tenant_id = $2 \
           AND lo.created_at >= $3 \
         ORDER BY lo.created_at DESC LIMIT 5000",
    )
    .bind(adm.patient_id)
    .bind(claims.tenant_id)
    .bind(adm.admitted_at)
    .fetch_all(&mut *tx)
    .await?;

    let lab_results = sqlx::query_as::<_, LabResultSummary>(
        "SELECT lr.id, lr.order_id, lr.parameter_name, lr.value, \
               lr.unit, lr.normal_range AS reference_range, \
               CASE WHEN lr.flag IS NOT NULL AND lr.flag::text != 'normal' \
                    THEN true ELSE false END AS is_abnormal \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lo.patient_id = $1 AND lr.tenant_id = $2 \
           AND lo.created_at >= $3 \
         ORDER BY lr.created_at DESC LIMIT 5000",
    )
    .bind(adm.patient_id)
    .bind(claims.tenant_id)
    .bind(adm.admitted_at)
    .fetch_all(&mut *tx)
    .await?;

    let radiology_orders = sqlx::query_as::<_, RadiologyOrderSummary>(
        "SELECT ro.id, rm.name AS modality, ro.body_part, \
               ro.created_at AS ordered_at, ro.status::text AS status, \
               rr.findings \
         FROM radiology_orders ro \
         JOIN radiology_modalities rm ON rm.id = ro.modality_id \
              AND rm.tenant_id = ro.tenant_id \
         LEFT JOIN radiology_reports rr ON rr.order_id = ro.id \
              AND rr.tenant_id = ro.tenant_id \
         WHERE ro.patient_id = $1 AND ro.tenant_id = $2 \
           AND ro.created_at >= $3 \
         ORDER BY ro.created_at DESC LIMIT 5000",
    )
    .bind(adm.patient_id)
    .bind(claims.tenant_id)
    .bind(adm.admitted_at)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(InvestigationsResponse {
        lab_orders,
        lab_results,
        radiology_orders,
    }))
}

/// GET /api/ipd/admissions/{id}/estimated-cost
pub async fn get_estimated_cost(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EstimatedCostResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::invoices::VIEW,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let ip_type_val = adm.ip_type.unwrap_or(IpType::General);
    let config = sqlx::query_as::<_, IpTypeConfiguration>(
        "SELECT * FROM ip_type_configurations \
         WHERE ip_type = $1 AND tenant_id = $2 AND is_active = true \
         LIMIT 1",
    )
    .bind(ip_type_val)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let estimated_days = adm.estimated_los_days.unwrap_or(5);
    let days_dec = Decimal::from(estimated_days);

    let (daily_rate, nursing_charge, deposit_required) = match config {
        Some(c) => (c.daily_rate, c.nursing_charge, c.deposit_required),
        None => (Decimal::ZERO, Decimal::ZERO, Decimal::ZERO),
    };

    let room_total = daily_rate * days_dec;
    let nursing_total = nursing_charge * days_dec;
    let total_estimated = room_total + nursing_total;

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    let estimate = EstimatedCostResponse {
        daily_rate,
        nursing_charge,
        estimated_days,
        room_total,
        nursing_total,
        deposit_required,
        total_estimated,
    };
    Ok(Json(filter_estimated_cost_response(
        estimate,
        &restricted_fields,
    )))
}

/// GET /api/ipd/admissions/{id}/advances
pub async fn get_admission_advances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<medbrains_core::billing::Receipt>>, AppError> {
    require_permission(&claims, permissions::billing::advances::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let rows = sqlx::query_as::<_, medbrains_core::billing::Receipt>(
        "SELECT r.* FROM receipts r \
         JOIN invoices i ON i.id = r.invoice_id AND i.tenant_id = r.tenant_id \
         WHERE i.encounter_id = $1 AND r.tenant_id = $2 \
         ORDER BY r.receipt_date DESC LIMIT 5000",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_receipt_amount_response(row, &restricted_fields))
            .collect(),
    ))
}

/// GET /api/ipd/admissions/{id}/prior-auth
pub async fn get_admission_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<medbrains_core::insurance::PriorAuthRequest>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let rows = sqlx::query_as::<_, medbrains_core::insurance::PriorAuthRequest>(
        "SELECT * FROM prior_auth_requests \
         WHERE patient_id = $1 AND tenant_id = $2 \
           AND created_at >= $3 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(adm.patient_id)
    .bind(claims.tenant_id)
    .bind(adm.admitted_at)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// PUT /api/ipd/admissions/{id}/link-mlc
pub async fn link_mlc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LinkMlcRequest>,
) -> Result<Json<Admission>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::UPDATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;
    require_permission(&claims, permissions::emergency::mlc::LIST)?;
    require_permission(&claims, permissions::emergency::mlc::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let mlc_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM mlc_cases WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(body.mlc_case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !mlc_exists {
        return Err(AppError::NotFound);
    }

    let adm = sqlx::query_as::<_, Admission>(
        "UPDATE admissions SET mlc_case_id = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 RETURNING *",
    )
    .bind(body.mlc_case_id)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    Ok(Json(filter_admission_response(adm, &restricted_fields)))
}

/// GET /api/ipd/admissions/{id}/mlc
pub async fn get_admission_mlc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<medbrains_core::emergency::MlcCase>>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;
    let restricted_fields = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let mlc = match adm.mlc_case_id {
        Some(mlc_id) => {
            sqlx::query_as::<_, medbrains_core::emergency::MlcCase>(
                "SELECT * FROM mlc_cases WHERE id = $1 AND tenant_id = $2",
            )
            .bind(mlc_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
        }
        None => None,
    };

    tx.commit().await?;
    Ok(Json(mlc.map(|row| {
        filter_ipd_mlc_case_response(row, &restricted_fields)
    })))
}

/// GET /api/ipd/admissions/{id}/billing-summary
pub async fn get_billing_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BillingSummaryResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::invoices::VIEW,
        ],
    )?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let charges_by_dept = sqlx::query_as::<_, DeptChargeGroup>(
        "SELECT COALESCE(ii.description, 'Other') AS department_name, \
               COALESCE(SUM(ii.total_price), 0) AS total \
         FROM invoice_items ii \
         JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
         WHERE i.encounter_id = $1 AND ii.tenant_id = $2 \
         GROUP BY ii.description \
         ORDER BY total DESC LIMIT 5000",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    #[derive(sqlx::FromRow)]
    struct Totals {
        total_charges: Option<Decimal>,
        total_payments: Option<Decimal>,
    }

    let totals = sqlx::query_as::<_, Totals>(
        "SELECT \
           COALESCE(SUM(total_amount), 0) AS total_charges, \
           COALESCE(SUM(paid_amount), 0) AS total_payments \
         FROM invoices \
         WHERE encounter_id = $1 AND tenant_id = $2",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_charges = totals.total_charges.unwrap_or(Decimal::ZERO);
    let total_payments = totals.total_payments.unwrap_or(Decimal::ZERO);

    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    let summary = BillingSummaryResponse {
        charges_by_dept,
        total_charges,
        total_payments,
        outstanding_balance: total_charges - total_payments,
    };
    Ok(Json(filter_billing_summary_response(
        summary,
        &restricted_fields,
    )))
}

/// GET /api/ipd/admissions/{id}/print
pub async fn get_admission_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(query): Query<AdmissionPrintQuery>,
) -> Result<Json<AdmissionPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::PRINT)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let prior_print_count: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(print_count), 0)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND module_code = 'ipd' \
           AND source_table = 'admissions' \
           AND source_id = $2 \
           AND title = 'IPD Admission Slip' \
           AND status <> 'voided'::document_output_status",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(&claims, permissions::ipd::admissions::REPRINT)?;
        if reprint_reason.is_none_or(|value| value.len() < 5) {
            return Err(AppError::BadRequest(
                "reprint reason is required after the first admission slip print".to_owned(),
            ));
        }
    } else if reprint_reason.is_some() {
        return Err(AppError::BadRequest(
            "admission slip has not been printed yet".to_owned(),
        ));
    }

    #[derive(sqlx::FromRow)]
    struct AdmissionPrintRow {
        patient_id: Uuid,
        encounter_id: Uuid,
        patient_name: String,
        uhid: String,
        age: Option<i32>,
        gender: Option<String>,
        admission_date: chrono::DateTime<Utc>,
        bed_number: Option<String>,
        ward_name: Option<String>,
        department_name: Option<String>,
        doctor_name: Option<String>,
        ip_type: Option<String>,
        provisional_diagnosis: Option<String>,
    }

    let row = sqlx::query_as::<_, AdmissionPrintRow>(
        "SELECT \
           a.patient_id, \
           a.encounter_id, \
           p.first_name || ' ' || p.last_name AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age, \
           p.gender::text AS gender, \
           a.admitted_at AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           d.name AS department_name, \
           u.full_name AS doctor_name, \
           a.ip_type::text AS ip_type, \
           a.provisional_diagnosis \
         FROM admissions a \
         JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = a.tenant_id \
         LEFT JOIN users u ON u.id = a.admitting_doctor AND u.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let today = Utc::now().format("%Y%m%d").to_string();
    let document_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND document_number LIKE 'IPD-ADM-' || $2 || '-%'",
    )
    .bind(claims.tenant_id)
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;
    let document_number = format!("IPD-ADM-{today}-{:04}", document_count + 1);
    let print_action = if is_reprint { "reprint" } else { "print" };
    let context_snapshot = json!({
        "document_type": "ipd_admission_slip",
        "action": print_action,
        "admission_id": id,
        "patient_id": row.patient_id,
        "encounter_id": row.encounter_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'ipd', 'admissions', $2, $3, $4, $2, \
          $5, 'IPD Admission Slip', 'custom'::document_template_category, \
          'printed'::document_output_status, 1, 1, now(), now(), \
          CASE WHEN $6::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(row.patient_id)
    .bind(row.encounter_id)
    .bind(&document_number)
    .bind(is_reprint)
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let audit_values = json!({
        "document_output_id": document_output_id,
        "document_number": document_number,
        "document_type": "ipd_admission_slip",
        "action": print_action,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if is_reprint {
                "ipd.admission_slip.reprint"
            } else {
                "ipd.admission_slip.print"
            },
            entity_type: "admission",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_ipd_restricted_fields(&state, &claims).await?;
    let print_data = AdmissionPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age,
        gender: row.gender,
        admission_date: row.admission_date,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        department_name: row.department_name,
        doctor_name: row.doctor_name,
        ip_type: row.ip_type,
        provisional_diagnosis: row.provisional_diagnosis,
    };
    Ok(Json(filter_admission_print_data_response(
        print_data,
        &restricted_fields,
    )))
}

/// GET /api/ipd/admissions/{id}/diet-orders
pub async fn get_admission_diet_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<medbrains_core::diet::DietOrder>>, AppError> {
    require_permission(&claims, permissions::diet::orders::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, medbrains_core::diet::DietOrder>(
        "SELECT * FROM diet_orders \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/ipd/admissions/{id}/consents
pub async fn get_admission_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<medbrains_core::consultation::ProcedureConsent>>, AppError> {
    require_permission(&claims, permissions::consent::signatures::LIST)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let rows = sqlx::query_as::<_, medbrains_core::consultation::ProcedureConsent>(
        "SELECT * FROM procedure_consents \
         WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/discharge-summary/generate
// ══════════════════════════════════════════════════════════

pub async fn generate_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_summary::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Fetch admission
    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(admission_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    // Fetch diagnoses
    let diagnoses = sqlx::query_as::<_, medbrains_core::consultation::Diagnosis>(
        "SELECT * FROM diagnoses \
         WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY is_primary DESC, created_at LIMIT 5000",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Fetch prescriptions
    let prescriptions = sqlx::query_as::<_, medbrains_core::consultation::Prescription>(
        "SELECT * FROM prescriptions \
         WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Fetch nursing tasks
    let nursing_tasks = sqlx::query_as::<_, NursingTask>(
        "SELECT * FROM nursing_tasks \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Fetch progress notes
    let progress_notes = sqlx::query_as::<_, IpdProgressNote>(
        "SELECT * FROM ipd_progress_notes \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY note_date DESC LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "admission_id": admission_id,
        "patient_id": adm.patient_id,
        "encounter_id": adm.encounter_id,
        "admitted_at": adm.admitted_at,
        "attending_doctor_id": adm.admitting_doctor,
        "diagnoses": diagnoses.iter().map(|d| json!({
            "id": d.id,
            "icd_code": d.icd_code,
            "description": d.description,
            "is_primary": d.is_primary,
        })).collect::<Vec<_>>(),
        "prescriptions": prescriptions.iter().map(|p| json!({
            "id": p.id,
            "doctor_id": p.doctor_id,
            "notes": p.notes,
            "created_at": p.created_at,
        })).collect::<Vec<_>>(),
        "nursing_tasks_count": nursing_tasks.len(),
        "progress_notes_count": progress_notes.len(),
        "generated_at": Utc::now(),
        "generated_by": claims.sub,
    })))
}

// ══════════════════════════════════════════════════════════
//  POST /api/ipd/admissions/{id}/transfer
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct StructuredBedTransferRequest {
    pub to_bed_id: Uuid,
    pub transfer_type: Option<String>,
    pub reason: String,
    pub notes: Option<String>,
}

pub async fn bed_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<StructuredBedTransferRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;

    // The route names an admission; holding the module permission is not the
    // same as being on this patient's care team. Without this, any holder of
    // the code could read or write any admission in the tenant — RLS scopes
    // by tenant only.
    medbrains_authz_gate::require_admission_access(
        &state, &claims, admission_id,
    )
    .await?;
    let transfer_type = match body.transfer_type.as_deref().unwrap_or("inter_ward") {
        "inter_ward" | "inter_department" | "inter_hospital" => body
            .transfer_type
            .as_deref()
            .unwrap_or("inter_ward")
            .to_owned(),
        _ => return Err(AppError::BadRequest("Invalid transfer type".to_owned())),
    };
    let transfer_reason = body.reason.trim();
    if transfer_reason.len() < 3 {
        return Err(AppError::BadRequest(
            "Transfer reason must be at least 3 characters".to_owned(),
        ));
    }
    let transfer_reason = transfer_reason.to_owned();
    let transfer_notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Get current admission with current bed
    let adm = sqlx::query_as::<_, Admission>(
        "SELECT * FROM admissions \
         WHERE id = $1 AND tenant_id = $2 AND status = 'admitted'::admission_status \
         FOR UPDATE",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let from_bed_id = adm.bed_id;
    if from_bed_id == Some(body.to_bed_id) {
        return Err(AppError::BadRequest(
            "Target bed is already assigned to this admission".to_owned(),
        ));
    }
    let target_bed = lock_available_bed_for_assignment(
        &mut tx,
        claims.tenant_id,
        body.to_bed_id,
        adm.patient_id,
    )
    .await?;
    let target_ward_id = target_bed.ward_id;

    // Log the transfer in the canonical IPD transfer table.
    let transfer_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO ipd_transfer_logs \
         (tenant_id, admission_id, transfer_type, from_ward_id, to_ward_id, \
          from_bed_id, to_bed_id, reason, transferred_by, notes) \
         VALUES ($1, $2, $3::transfer_type, \
                 $4, $5, $6, $7, $8, $9, $10) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&transfer_type)
    .bind(adm.ward_id)
    .bind(target_ward_id)
    .bind(from_bed_id)
    .bind(body.to_bed_id)
    .bind(&transfer_reason)
    .bind(claims.sub)
    .bind(transfer_notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    if let Some(old_bed_id) = from_bed_id {
        release_admission_bed(
            &mut tx,
            claims.tenant_id,
            old_bed_id,
            admission_id,
            claims.sub,
            "IPD bed transfer",
        )
        .await?;
    }

    // Update admission bed
    let updated = sqlx::query_as::<_, Admission>(
        "UPDATE admissions SET \
           bed_id = $3, \
           ward_id = COALESCE($4, ward_id), \
           updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .bind(body.to_bed_id)
    .bind(target_ward_id)
    .fetch_one(&mut *tx)
    .await?;

    occupy_admission_bed(
        &mut tx,
        BedOccupancy {
            tenant_id: claims.tenant_id,
            bed_id: body.to_bed_id,
            patient_id: updated.patient_id,
            admission_id: updated.id,
            ward_id: target_ward_id,
            changed_by: claims.sub,
            reason: "IPD bed transfer",
        },
    )
    .await?;

    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::BedTransferred,
        transfer_id,
        claims.sub,
        json!({
            "transfer_id": transfer_id,
            "admission_id": updated.id,
            "patient_id": adm.patient_id,
            "encounter_id": adm.encounter_id,
            "from_bed_id": from_bed_id,
            "to_bed_id": body.to_bed_id,
            "from_ward_id": adm.ward_id,
            "to_ward_id": updated.ward_id,
            "transfer_type": transfer_type.as_str(),
            "reason": transfer_reason.as_str(),
        }),
    )
    .with_patient(adm.patient_id)
    .with_admission(updated.id)
    .with_encounter(adm.encounter_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "admission_id": updated.id,
        "transfer_id": transfer_id,
        "from_bed_id": from_bed_id,
        "to_bed_id": body.to_bed_id,
        "transfer_type": transfer_type,
        "reason": transfer_reason,
        "transferred_by": claims.sub,
        "transferred_at": Utc::now(),
    })))
}

// ══════════════════════════════════════════════════════════
//  GET /api/ipd/discharges/expected
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExpectedDischargeRow {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub ward: Option<String>,
    pub bed_number: Option<String>,
    pub expected_discharge_date: NaiveDate,
    pub attending_doctor: Option<String>,
    pub days_admitted: i32,
}

pub async fn expected_discharges(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ExpectedDischargeRow>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::LIST)?;
    let can_view_patient_identity =
        claims_have_any_permission(&claims, &[permissions::patients::VIEW]);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let today = medbrains_server_core::hospital_time::tenant_local_today(&mut *tx, claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ExpectedDischargeRow>(
        "SELECT a.id AS admission_id, a.patient_id, \
         CASE WHEN $3::bool THEN (p.first_name || ' ' || p.last_name) ELSE NULL END AS patient_name, \
         CASE WHEN $3::bool THEN p.uhid ELSE NULL END AS uhid, \
         w.name AS ward, \
         l.name AS bed_number, \
         a.expected_discharge_date, \
         u.full_name AS attending_doctor, \
         ($2::date - a.admitted_at::date)::int AS days_admitted \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users u ON u.id = a.admitting_doctor AND u.tenant_id = a.tenant_id \
         WHERE a.tenant_id = $1 \
           AND a.status = 'admitted'::admission_status \
           AND a.expected_discharge_date IS NOT NULL \
           AND a.expected_discharge_date BETWEEN $2 AND $2 + INTEGER '2' \
         ORDER BY a.expected_discharge_date ASC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(today)
    .bind(can_view_patient_identity)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod discharge_summary_tests {
    use super::missing_discharge_summary_fields;

    #[test]
    fn complete_summary_has_no_missing() {
        let missing = missing_discharge_summary_fields(
            Some("Community-acquired pneumonia"),
            Some("Stable, afebrile"),
            Some("IV antibiotics, improved"),
            Some("Review in 1 week"),
        );
        assert!(missing.is_empty());
    }

    #[test]
    fn blank_and_missing_fields_are_reported() {
        let missing = missing_discharge_summary_fields(Some("Sepsis"), Some("   "), None, Some(""));
        assert_eq!(missing, vec!["condition at discharge", "course in hospital", "follow-up instructions"]);
    }
}

/// Inpatient department (admissions, wards, MAR, rounds, discharge, nursing) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/nurse/mar/due-now", get(list_mar_due_now))
        .route("/api/nurse/mar/{id}", put(update_mar_round))
        .route("/api/nurse/mar/{id}/verify-barcode", post(verify_mar_barcode))
        .route(
            "/api/nurse/mar/patient/{patient_id}",
            get(list_mar_for_patient),
        )
        .route(
            "/api/ipd/wards",
            get(list_wards).post(create_ward),
        )
        .route(
            "/api/ipd/wards/{id}",
            get(get_ward).put(update_ward),
        )
        .route(
            "/api/ipd/wards/{id}/beds",
            get(list_ward_beds).post(assign_bed_to_ward),
        )
        .route("/api/ipd/wards/{id}/on-duty", get(ward_on_duty))
        .route(
            "/api/ipd/wards/{wid}/beds/{mid}",
            delete(remove_bed_from_ward),
        )
        .route(
            "/api/ipd/bed-dashboard",
            get(bed_dashboard_summary),
        )
        .route(
            "/api/ipd/bed-dashboard/beds",
            get(bed_dashboard_beds),
        )
        .route(
            "/api/ipd/bed-dashboard/beds/{bed_id}/status",
            put(update_bed_status),
        )
        .route(
            "/api/ipd/discharge-templates",
            get(list_discharge_templates).post(create_discharge_template),
        )
        .route(
            "/api/ipd/reports/census",
            get(report_census),
        )
        .route(
            "/api/ipd/reports/occupancy",
            get(report_occupancy),
        )
        .route(
            "/api/ipd/reports/alos",
            get(report_alos),
        )
        .route(
            "/api/ipd/reports/discharge-stats",
            get(report_discharge_stats),
        )
        .route(
            "/api/ipd/beds/available",
            get(list_available_beds),
        )
        .route(
            "/api/ipd/admissions",
            get(list_admissions).post(create_admission),
        )
        .route(
            "/api/ipd/admissions/{id}",
            get(get_admission).put(update_admission),
        )
        .route(
            "/api/ipd/admissions/{id}/transfer",
            put(transfer_bed).post(bed_transfer),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge",
            put(discharge_patient),
        )
        .route(
            "/api/ipd/admissions/{id}/tasks",
            get(list_nursing_tasks).post(create_nursing_task),
        )
        .route(
            "/api/ipd/admissions/{id}/tasks/{tid}",
            put(update_nursing_task),
        )
        .route(
            "/api/ipd/admissions/{id}/attenders",
            get(list_attenders).post(create_attender),
        )
        .route(
            "/api/ipd/admissions/{id}/attenders/{aid}",
            delete(delete_attender),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge-summary",
            get(get_discharge_summary)
                .post(create_discharge_summary)
                .put(update_discharge_summary),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge-summary/finalize",
            post(finalize_discharge_summary),
        )
        .route(
            "/api/ipd/admissions/{id}/no-dues-certificate",
            get(get_no_dues_certificate).post(issue_no_dues_certificate),
        )
        .route(
            "/api/ipd/admissions/{id}/progress-notes",
            get(list_progress_notes).post(create_progress_note),
        )
        .route(
            "/api/ipd/admissions/{id}/progress-notes/{note_id}",
            put(update_progress_note),
        )
        .route(
            "/api/ipd/admissions/{id}/assessments",
            get(list_assessments).post(create_assessment),
        )
        .route(
            "/api/ipd/admissions/{id}/mar",
            get(list_mar).post(create_mar),
        )
        .route(
            "/api/ipd/admissions/{id}/mar/{mar_id}",
            put(update_mar),
        )
        .route(
            "/api/ipd/admissions/{id}/io",
            get(list_intake_output).post(create_intake_output),
        )
        .route(
            "/api/ipd/admissions/{id}/io/balance",
            get(get_io_balance),
        )
        .route(
            "/api/ipd/admissions/{id}/infusions",
            get(list_infusions).post(create_infusion),
        )
        .route(
            "/api/ipd/admissions/{id}/infusions/{infusion_id}",
            put(update_infusion),
        )
        .route(
            "/api/ipd/admissions/{id}/nursing-assessments",
            get(list_nursing_assessments).post(create_nursing_assessment),
        )
        .route(
            "/api/ipd/admissions/{id}/nursing-assessments/{nid}",
            put(update_nursing_assessment),
        )
        .route(
            "/api/ipd/admissions/{id}/care-plans",
            get(list_care_plans).post(create_care_plan),
        )
        .route(
            "/api/ipd/admissions/{id}/care-plans/{cid}",
            put(update_care_plan),
        )
        .route(
            "/api/ipd/admissions/{id}/handovers",
            get(list_handovers).post(create_handover),
        )
        .route(
            "/api/ipd/admissions/{id}/handovers/{hid}/acknowledge",
            put(acknowledge_handover),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge-checklist",
            get(list_discharge_checklist).post(init_discharge_checklist),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge-checklist/{cid}",
            put(update_discharge_checklist_item),
        )
        .route(
            "/api/ipd/ip-types",
            get(list_ip_types).post(create_ip_type),
        )
        .route(
            "/api/ipd/ip-types/{id}",
            put(update_ip_type),
        )
        .route(
            "/api/ipd/bed-reservations",
            get(list_bed_reservations).post(create_bed_reservation),
        )
        .route(
            "/api/ipd/bed-reservations/{id}/status",
            put(update_reservation_status),
        )
        .route(
            "/api/ipd/beds/{bed_id}/reservations",
            get(list_bed_reservations_for_bed),
        )
        .route(
            "/api/ipd/bed-turnaround",
            get(list_bed_turnaround).post(create_bed_turnaround),
        )
        .route(
            "/api/ipd/bed-turnaround/{id}/complete",
            post(complete_bed_turnaround),
        )
        .route(
            "/api/ipd/admissions/{id}/checklist",
            get(list_admission_checklist).post(create_admission_checklist_items),
        )
        .route(
            "/api/ipd/admissions/{id}/checklist/{item_id}",
            put(toggle_checklist_item),
        )
        .route(
            "/api/ipd/admissions/{id}/clinical-docs",
            get(list_clinical_docs).post(create_clinical_doc),
        )
        .route(
            "/api/ipd/admissions/{id}/clinical-docs/{doc_id}",
            put(update_clinical_doc),
        )
        .route(
            "/api/ipd/admissions/{id}/clinical-docs/{doc_id}/resolve",
            post(resolve_clinical_doc),
        )
        .route(
            "/api/ipd/admissions/{id}/restraint-checks/{doc_id}",
            get(list_restraint_checks),
        )
        .route(
            "/api/ipd/admissions/{id}/restraint-checks",
            post(create_restraint_check),
        )
        .route(
            "/api/ipd/admissions/{id}/transfers",
            get(list_transfers).post(create_transfer),
        )
        .route(
            "/api/ipd/admissions/{id}/death-summary",
            get(get_death_summary)
                .post(create_death_summary)
                .put(update_death_summary),
        )
        .route(
            "/api/ipd/admissions/{id}/birth-records",
            get(list_birth_records).post(create_birth_record),
        )
        .route(
            "/api/ipd/admissions/{id}/birth-records/{rec_id}",
            put(update_birth_record),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge-tat",
            get(get_discharge_tat)
                .post(initiate_discharge_tat)
                .put(update_discharge_tat),
        )
        .route(
            "/api/ipd/admissions/{id}/investigations",
            get(get_investigations),
        )
        .route(
            "/api/ipd/admissions/{id}/estimated-cost",
            get(get_estimated_cost),
        )
        .route(
            "/api/ipd/admissions/{id}/advances",
            get(get_admission_advances),
        )
        .route(
            "/api/ipd/admissions/{id}/prior-auth",
            get(get_admission_prior_auth),
        )
        .route(
            "/api/ipd/admissions/{id}/mlc",
            get(get_admission_mlc).put(link_mlc),
        )
        .route(
            "/api/ipd/admissions/{id}/billing-summary",
            get(get_billing_summary),
        )
        .route(
            "/api/ipd/admissions/{id}/print",
            get(get_admission_print_data),
        )
        .route(
            "/api/ipd/admissions/{id}/diet-orders",
            get(get_admission_diet_orders),
        )
        .route(
            "/api/ipd/admissions/{id}/consents",
            get(get_admission_consents),
        )
        .route(
            "/api/ipd/discharges/expected",
            get(expected_discharges),
        )
}
