#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, NaiveTime, Utc};
use medbrains_core::encounter::Encounter;
use medbrains_core::ipd::{
    Admission, AdmissionAttender, AdmissionChecklist, AdmissionPrintData, AdmissionStatus,
    BedReservation, BedTurnaroundLog, BillingSummaryResponse, DeptChargeGroup,
    DischargeSummaryStatus, DischargeSummaryTemplate, DischargeType, EstimatedCostResponse,
    InvestigationsResponse, IpType, IpTypeConfiguration, IpdBirthRecord, IpdCarePlan,
    IpdClinicalAssessment, IpdClinicalDocumentation, IpdDeathSummary, IpdDischargeChecklist,
    IpdDischargeSummary, IpdDischargeTatLog, IpdHandoverReport, IpdIntakeOutput,
    IpdMedicationAdministration, IpdNursingAssessment, IpdProgressNote, IpdTransferLog,
    LabOrderSummary, LabResultSummary, MarStatus, NursingShift, NursingTask, RadiologyOrderSummary,
    RestraintMonitoringLog, Ward, WardBedMapping,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

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

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // ── ReBAC scope — only admissions caller has `view` on ────
    let authz_ctx = crate::middleware::authorization::authz_context(&claims);
    let visible_ids: Option<Vec<uuid::Uuid>> = if authz_ctx.is_bypass {
        None
    } else {
        Some(
            state
                .authz
                .list_accessible(
                    &authz_ctx,
                    "admission",
                    medbrains_authz::Relation::Viewer,
                )
                .await
                .unwrap_or_default(),
        )
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
        .await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let today = Utc::now().date_naive();
    let doctor_id = body.doctor_id.unwrap_or(claims.sub);

    let encounter = sqlx::query_as::<_, Encounter>(
        "INSERT INTO encounters \
           (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
            encounter_date, notes, attributes) \
         VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, $4, $5, $6, '{}') \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(doctor_id)
    .bind(today)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    let admission = sqlx::query_as::<_, Admission>(
        "INSERT INTO admissions \
           (tenant_id, encounter_id, patient_id, bed_id, admitting_doctor, status, admitted_at, \
            admission_source, referral_from, referral_doctor, referral_notes, \
            admission_weight_kg, admission_height_cm, expected_discharge_date, ward_id) \
         VALUES ($1, $2, $3, $4, $5, 'admitted'::admission_status, NOW(), \
                 $6::admission_source, $7, $8, $9, $10, $11, $12, $13) \
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
    .bind(body.ward_id)
    .fetch_one(&mut *tx)
    .await?;

    // Update bed_states with ward_id and admission_id
    if let Some(bid) = body.bed_id {
        sqlx::query(
            "UPDATE bed_states SET ward_id = $3, admission_id = $4 \
             WHERE bed_id = $1 AND tenant_id = $2",
        )
        .bind(bid)
        .bind(claims.tenant_id)
        .bind(body.ward_id)
        .bind(admission.id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Enrich payload with names for orchestration
    let patient_info = sqlx::query_as::<_, (String, String)>(
        "SELECT first_name || ' ' || last_name, uhid FROM patients WHERE id = $1",
    )
    .bind(admission.patient_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let (patient_name, uhid) = patient_info
        .unwrap_or_else(|| ("Unknown".to_owned(), "N/A".to_owned()));

    let doctor_name = sqlx::query_scalar::<_, String>(
        "SELECT full_name FROM users WHERE id = $1",
    )
    .bind(admission.admitting_doctor)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let department_name = sqlx::query_scalar::<_, String>(
        "SELECT name FROM departments WHERE id = $1",
    )
    .bind(body.department_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let (ward_name, bed_number) = if let Some(bid) = admission.bed_id {
        let info = sqlx::query_as::<_, (Option<String>, Option<String>)>(
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
        .unwrap_or((None, None));
        info
    } else {
        (None, None)
    };

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "ipd.admission.created",
        serde_json::json!({
            "admission_id": admission.id,
            "patient_id": admission.patient_id,
            "patient_name": patient_name,
            "uhid": uhid,
            "doctor_name": doctor_name,
            "department_name": department_name,
            "ward_name": ward_name,
            "bed_number": bed_number,
        }),
    )
    .await;

    Ok(Json(CreateAdmissionResponse {
        encounter,
        admission,
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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    // ── ReBAC pre-check — must hold `view` on the specific admission ─
    let authz_ctx = crate::middleware::authorization::authz_context(&claims);
    let allowed = state
        .authz
        .check(&authz_ctx, medbrains_authz::Relation::Viewer, "admission", id)
        .await
        .unwrap_or(false);
    if !allowed {
        return Err(AppError::NotFound);
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let tasks = sqlx::query_as::<_, NursingTask>(
        "SELECT * FROM nursing_tasks WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at ASC",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AdmissionDetailResponse {
        admission,
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
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    Ok(Json(admission))
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
    require_permission(&claims, permissions::ipd::beds::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let admission = sqlx::query_as::<_, Admission>(
        "UPDATE admissions SET \
           bed_id = $3, \
           status = 'transferred'::admission_status \
         WHERE id = $1 AND tenant_id = $2 AND status = 'admitted'::admission_status \
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

    tx.commit().await?;

    Ok(Json(admission))
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let dt: DischargeType = serde_json::from_value(serde_json::Value::String(
        body.discharge_type.clone(),
    ))
    .map_err(|_| {
        AppError::BadRequest(format!(
            "Invalid discharge_type '{}'. Valid: normal, lama, dama, absconded, referred, deceased",
            body.discharge_type
        ))
    })?;

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

    sqlx::query(
        "UPDATE encounters SET status = 'completed'::encounter_status \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(admission.encounter_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Auto-billing: charge room/bed for length of stay
    if super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "ipd_room").await? {
        if let Some(bed_id) = admission.bed_id {
            let los_hours = (Utc::now() - admission.admitted_at).num_hours();
            #[allow(clippy::cast_precision_loss)]
            let los_days = ((los_hours as f64) / 24.0).ceil() as i32;
            let los_days = los_days.max(1);

            let bed_type = sqlx::query_scalar::<_, String>(
                "SELECT COALESCE(l.location_type, 'general') \
                 FROM locations l WHERE l.id = $1 AND l.tenant_id = $2",
            )
            .bind(bed_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;

            let charge_code = bed_type.map_or_else(
                || "ROOM-GENERAL".to_owned(),
                |t| format!("ROOM-{}", t.to_uppercase()),
            );

            let desc = if los_days == 1 {
                "Room charges (1 day)".to_owned()
            } else {
                format!("Room charges ({los_days} days)")
            };

            let _ = super::billing::auto_charge(
                &mut tx,
                &claims.tenant_id,
                super::billing::AutoChargeInput {
                    patient_id: admission.patient_id,
                    encounter_id: admission.encounter_id,
                    charge_code,
                    source: "ipd".to_owned(),
                    source_id: admission.id,
                    quantity: los_days,
                    description_override: Some(desc),
                    unit_price_override: None,
                    tax_percent_override: None,
                },
            )
            .await;
        }
    }

    tx.commit().await?;

    // Enrich payload with patient details for orchestration
    let patient_info = sqlx::query_as::<_, (String, String)>(
        "SELECT first_name || ' ' || last_name, uhid FROM patients WHERE id = $1",
    )
    .bind(admission.patient_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let (patient_name, uhid) = patient_info
        .unwrap_or_else(|| ("Unknown".to_owned(), "N/A".to_owned()));

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

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "ipd.discharge.initiated",
        serde_json::json!({
            "admission_id": admission.id,
            "patient_id": admission.patient_id,
            "encounter_id": admission.encounter_id,
            "patient_name": patient_name,
            "uhid": uhid,
            "discharge_type": format!("{:?}", admission.discharge_type),
            "total_bill": total_bill,
            "length_of_stay": length_of_stay,
        }),
    )
    .await;

    Ok(Json(admission))
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let tasks = sqlx::query_as::<_, NursingTask>(
        "SELECT * FROM nursing_tasks \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at ASC",
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
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let (completed_at, completed_by) = if body.is_completed == Some(true) {
        (Some(Utc::now()), Some(claims.sub))
    } else {
        (None, None)
    };

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let notes = sqlx::query_as::<_, IpdProgressNote>(
        "SELECT * FROM ipd_progress_notes \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY note_date DESC, created_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    tx.commit().await?;

    Ok(Json(note))
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdClinicalAssessment>(
        "SELECT * FROM ipd_clinical_assessments \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY assessed_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdMedicationAdministration>(
        "SELECT * FROM ipd_medication_administration \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY scheduled_at ASC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

pub async fn update_mar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, mar_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateMarRequest>,
) -> Result<Json<IpdMedicationAdministration>, AppError> {
    require_permission(&claims, permissions::ipd::mar::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let status: MarStatus = serde_json::from_value(serde_json::Value::String(body.status.clone()))
        .map_err(|_| AppError::BadRequest(format!("Invalid MAR status '{}'", body.status)))?;

    let administered_by = if status == MarStatus::Given {
        Some(claims.sub)
    } else {
        None
    };

    let row = sqlx::query_as::<_, IpdMedicationAdministration>(
        "UPDATE ipd_medication_administration SET \
           status = $4::mar_status, \
           administered_at = COALESCE($5, administered_at), \
           administered_by = COALESCE($6, administered_by), \
           witnessed_by = COALESCE($7, witnessed_by), \
           barcode_verified = COALESCE($8, barcode_verified), \
           hold_reason = COALESCE($9, hold_reason), \
           refused_reason = COALESCE($10, refused_reason), \
           notes = COALESCE($11, notes) \
         WHERE id = $1 AND admission_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(mar_id)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(body.administered_at)
    .bind(administered_by)
    .bind(body.witnessed_by)
    .bind(body.barcode_verified)
    .bind(&body.hold_reason)
    .bind(&body.refused_reason)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(row))
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdIntakeOutput>(
        "SELECT * FROM ipd_intake_output \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
//  GET /api/ipd/admissions/{id}/nursing-assessments
// ══════════════════════════════════════════════════════════

pub async fn list_nursing_assessments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IpdNursingAssessment>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdNursingAssessment>(
        "SELECT * FROM ipd_nursing_assessments \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY assessed_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdCarePlan>(
        "SELECT * FROM ipd_care_plans \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY initiated_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdHandoverReport>(
        "SELECT * FROM ipd_handover_reports \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY handover_date DESC, created_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdDischargeChecklist>(
        "SELECT * FROM ipd_discharge_checklists \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY sort_order ASC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    require_permission(&claims, permissions::ipd::admissions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY w.name",
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
    require_permission(&claims, permissions::ipd::admissions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    require_permission(&claims, permissions::ipd::admissions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, WardBedRow>(
        "SELECT wbm.id AS mapping_id, wbm.bed_location_id, \
               l.name AS bed_name, bt.name AS bed_type_name, \
               bs.status AS bed_status, \
               CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) AS patient_name, \
               p.uhid AS patient_uhid, \
               wbm.sort_order \
         FROM ward_bed_mappings wbm \
         JOIN locations l ON l.id = wbm.bed_location_id \
         LEFT JOIN bed_types bt ON bt.id = wbm.bed_type_id \
         LEFT JOIN bed_states bs ON bs.location_id = wbm.bed_location_id AND bs.tenant_id = wbm.tenant_id \
         LEFT JOIN admissions a ON a.id = bs.admission_id AND a.status = 'admitted'::admission_status \
         LEFT JOIN patients p ON p.id = a.patient_id \
         WHERE wbm.ward_id = $1 AND wbm.tenant_id = $2 AND wbm.is_active = true \
         ORDER BY wbm.sort_order, l.name",
    )
    .bind(id)
    .bind(claims.tenant_id)
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
    require_permission(&claims, permissions::ipd::wards::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mapping = sqlx::query_as::<_, WardBedMapping>(
        "INSERT INTO ward_bed_mappings (tenant_id, ward_id, bed_location_id, bed_type_id, sort_order) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(ward_id)
    .bind(body.bed_location_id)
    .bind(body.bed_type_id)
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&mut *tx)
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
    sqlx::query("UPDATE bed_states SET ward_id = $3 WHERE bed_id = $1 AND tenant_id = $2")
        .bind(body.bed_location_id)
        .bind(claims.tenant_id)
        .bind(ward_id)
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
    require_permission(&claims, permissions::ipd::wards::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Check bed is vacant
    let bed_loc_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT bed_location_id FROM ward_bed_mappings \
         WHERE id = $1 AND ward_id = $2 AND tenant_id = $3",
    )
    .bind(mapping_id)
    .bind(ward_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let occupied = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM bed_states WHERE bed_id = $1 AND tenant_id = $2 \
         AND status NOT IN ('vacant_clean', 'vacant_dirty'))",
    )
    .bind(bed_loc_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if occupied {
        return Err(AppError::BadRequest(
            "Cannot remove an occupied bed from ward".to_owned(),
        ));
    }

    sqlx::query("DELETE FROM ward_bed_mappings WHERE id = $1 AND tenant_id = $2")
        .bind(mapping_id)
        .bind(claims.tenant_id)
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
    sqlx::query("UPDATE bed_states SET ward_id = NULL WHERE bed_id = $1 AND tenant_id = $2")
        .bind(bed_loc_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "removed": true })))
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY w.name NULLS LAST",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut conditions = vec!["bs.tenant_id = $1".to_owned()];
    let mut idx: usize = 2;

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
               CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) AS patient_name, \
               p.uhid AS patient_uhid, bs.admission_id \
         FROM bed_states bs \
         JOIN locations l ON l.id = bs.location_id \
         LEFT JOIN wards w ON w.id = bs.ward_id \
         LEFT JOIN admissions a ON a.id = bs.admission_id \
             AND a.status = 'admitted'::admission_status \
         LEFT JOIN patients p ON p.id = a.patient_id \
         WHERE {where_clause} \
         ORDER BY w.name NULLS LAST, l.name"
    );

    let mut q = sqlx::query_as::<_, BedDashboardRow>(&sql).bind(claims.tenant_id);
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let updated = sqlx::query_scalar::<_, bool>(
        "UPDATE bed_states SET status = $3::bed_status \
         WHERE bed_id = $1 AND tenant_id = $2 RETURNING true",
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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, AdmissionAttender>(
        "SELECT * FROM admission_attenders \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY is_primary DESC, created_at",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

pub async fn create_attender(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateAttenderRequest>,
) -> Result<Json<AdmissionAttender>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    Ok(Json(row))
}

pub async fn delete_attender(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((admission_id, attender_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, DischargeSummaryTemplate>(
        "SELECT * FROM discharge_summary_templates \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY is_default DESC, name",
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, IpdDischargeSummary>(
        "SELECT * FROM ipd_discharge_summaries \
         WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn create_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateDischargeSummaryRequest>,
) -> Result<Json<IpdDischargeSummary>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_summary::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    Ok(Json(row))
}

pub async fn update_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<UpdateDischargeSummaryRequest>,
) -> Result<Json<IpdDischargeSummary>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_summary::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    Ok(Json(row))
}

pub async fn finalize_discharge_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<IpdDischargeSummary>, AppError> {
    require_permission(&claims, permissions::ipd::discharge_summary::FINALIZE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, CensusWardRow>(
        "SELECT bs.ward_id, w.name AS ward_name, \
               COUNT(*) AS total_beds, \
               COUNT(*) FILTER (WHERE bs.status = 'occupied') AS occupied, \
               COUNT(*) FILTER (WHERE bs.status IN ('vacant_clean', 'vacant_dirty')) AS vacant \
         FROM bed_states bs \
         LEFT JOIN wards w ON w.id = bs.ward_id \
         WHERE bs.tenant_id = $1 \
         GROUP BY bs.ward_id, w.name \
         ORDER BY w.name NULLS LAST",
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY wb.ward_name NULLS LAST",
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY d.name, a.discharge_type",
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, DischargeStatRow>(
        "SELECT a.discharge_type, COUNT(*)::bigint AS count \
         FROM admissions a \
         WHERE a.tenant_id = $1 \
           AND a.status = 'discharged'::admission_status \
           AND a.discharged_at >= $2::date::timestamptz \
           AND a.discharged_at < ($3::date + 1)::timestamptz \
         GROUP BY a.discharge_type \
         ORDER BY count DESC",
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
    pub reason: Option<String>,
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
    require_permission(&claims, permissions::ipd::admissions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpTypeConfiguration>(
        "SELECT * FROM ip_type_configurations \
         WHERE tenant_id = $1 \
         ORDER BY ip_type",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_ip_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIpTypeConfigRequest>,
) -> Result<Json<IpTypeConfiguration>, AppError> {
    require_permission(&claims, permissions::ipd::wards::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    Ok(Json(row))
}

pub async fn update_ip_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateIpTypeConfigRequest>,
) -> Result<Json<IpTypeConfiguration>, AppError> {
    require_permission(&claims, permissions::ipd::wards::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2b — Admission Checklists
// ══════════════════════════════════════════════════════════

pub async fn list_admission_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<AdmissionChecklist>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, AdmissionChecklist>(
        "SELECT * FROM admission_checklists \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY sort_order, created_at",
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
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    Path((_admission_id, item_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<ToggleChecklistRequest>,
) -> Result<Json<AdmissionChecklist>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(item_id)
    .bind(claims.tenant_id)
    .bind(body.is_completed)
    .bind(completed_by)
    .bind(completed_at)
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    let sql =
        format!("SELECT * FROM bed_reservations WHERE {where_clause} ORDER BY reserved_from DESC");

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, BedReservation>(
        "SELECT * FROM bed_reservations \
         WHERE bed_id = $1 AND tenant_id = $2 \
           AND status IN ('active', 'confirmed') \
         ORDER BY reserved_from",
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = if let (Some(from), Some(to)) = (params.from, params.to) {
        sqlx::query_as::<_, BedTurnaroundLog>(
            "SELECT * FROM bed_turnaround_log \
             WHERE tenant_id = $1 \
               AND vacated_at >= $2::date::timestamptz \
               AND vacated_at < ($3::date + 1)::timestamptz \
             ORDER BY vacated_at DESC",
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = if let Some(ref doc_type) = params.doc_type {
        sqlx::query_as::<_, IpdClinicalDocumentation>(
            "SELECT * FROM ipd_clinical_documentations \
             WHERE admission_id = $1 AND tenant_id = $2 \
               AND doc_type = $3::ipd_clinical_doc_type \
             ORDER BY recorded_at DESC",
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
             ORDER BY recorded_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    Path((_admission_id, doc_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateClinicalDocRequest>,
) -> Result<Json<IpdClinicalDocumentation>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let next_review: Option<chrono::DateTime<Utc>> = body
        .next_review_at
        .as_ref()
        .and_then(|s| s.parse::<chrono::DateTime<Utc>>().ok());

    let row = sqlx::query_as::<_, IpdClinicalDocumentation>(
        "UPDATE ipd_clinical_documentations SET \
           body = COALESCE($3, body), \
           notes = COALESCE($4, notes), \
           next_review_at = COALESCE($5, next_review_at) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(doc_id)
    .bind(claims.tenant_id)
    .bind(&body.body)
    .bind(&body.notes)
    .bind(next_review)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn resolve_clinical_doc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_admission_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<IpdClinicalDocumentation>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, IpdClinicalDocumentation>(
        "UPDATE ipd_clinical_documentations SET \
           is_resolved = true, resolved_at = NOW(), resolved_by = $3 \
         WHERE id = $1 AND tenant_id = $2 AND is_resolved = false RETURNING *",
    )
    .bind(doc_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
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
    Path((_admission_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<RestraintMonitoringLog>>, AppError> {
    require_permission(&claims, permissions::ipd::clinical_docs::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, RestraintMonitoringLog>(
        "SELECT * FROM restraint_monitoring_logs \
         WHERE clinical_doc_id = $1 AND tenant_id = $2 \
         ORDER BY check_time DESC",
    )
    .bind(doc_id)
    .bind(claims.tenant_id)
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdTransferLog>(
        "SELECT * FROM ipd_transfer_logs \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY transferred_at DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, IpdTransferLog>(
        "INSERT INTO ipd_transfer_logs \
           (tenant_id, admission_id, transfer_type, from_ward_id, to_ward_id, \
            from_bed_id, to_bed_id, reason, clinical_summary, transferred_by, notes) \
         VALUES ($1, $2, $3::transfer_type, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&body.transfer_type)
    .bind(body.from_ward_id)
    .bind(body.to_ward_id)
    .bind(body.from_bed_id)
    .bind(body.to_bed_id)
    .bind(&body.reason)
    .bind(&body.clinical_summary)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, IpdBirthRecord>(
        "SELECT * FROM ipd_birth_records \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY date_of_birth, time_of_birth",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    Path((_admission_id, rec_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateBirthRecordRequest>,
) -> Result<Json<IpdBirthRecord>, AppError> {
    require_permission(&claims, permissions::ipd::birth_records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
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
    require_permission(&claims, permissions::ipd::discharge_tat::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    require_permission(&claims, permissions::ipd::discharge::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    require_permission(&claims, permissions::ipd::discharge_tat::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let billing_ts: Option<chrono::DateTime<Utc>> = body
        .billing_cleared_at
        .as_ref()
        .and_then(|s| s.parse().ok());
    let pharmacy_ts: Option<chrono::DateTime<Utc>> = body
        .pharmacy_cleared_at
        .as_ref()
        .and_then(|s| s.parse().ok());
    let nursing_ts: Option<chrono::DateTime<Utc>> = body
        .nursing_cleared_at
        .as_ref()
        .and_then(|s| s.parse().ok());
    let doctor_ts: Option<chrono::DateTime<Utc>> =
        body.doctor_cleared_at.as_ref().and_then(|s| s.parse().ok());
    let completed_ts: Option<chrono::DateTime<Utc>> = body
        .discharge_completed_at
        .as_ref()
        .and_then(|s| s.parse().ok());

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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY w.name, l.name",
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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY lo.created_at DESC",
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
         ORDER BY lr.created_at DESC",
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
         ORDER BY ro.created_at DESC",
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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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

    Ok(Json(EstimatedCostResponse {
        daily_rate,
        nursing_charge,
        estimated_days,
        room_total,
        nursing_total,
        deposit_required,
        total_estimated,
    }))
}

/// GET /api/ipd/admissions/{id}/advances
pub async fn get_admission_advances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<medbrains_core::billing::Receipt>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY r.receipt_date DESC",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/ipd/admissions/{id}/prior-auth
pub async fn get_admission_prior_auth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<medbrains_core::insurance::PriorAuthRequest>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY created_at DESC",
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
    require_permission(&claims, permissions::ipd::admissions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    Ok(Json(adm))
}

/// GET /api/ipd/admissions/{id}/mlc
pub async fn get_admission_mlc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<medbrains_core::emergency::MlcCase>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
    Ok(Json(mlc))
}

/// GET /api/ipd/admissions/{id}/billing-summary
pub async fn get_billing_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BillingSummaryResponse>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY total DESC",
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

    Ok(Json(BillingSummaryResponse {
        charges_by_dept,
        total_charges,
        total_payments,
        outstanding_balance: total_charges - total_payments,
    }))
}

/// GET /api/ipd/admissions/{id}/print
pub async fn get_admission_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AdmissionPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let data = sqlx::query_as::<_, AdmissionPrintData>(
        "SELECT \
           p.first_name || ' ' || p.last_name AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age, \
           p.gender, \
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

    tx.commit().await?;
    Ok(Json(data))
}

/// GET /api/ipd/admissions/{id}/diet-orders
pub async fn get_admission_diet_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<medbrains_core::diet::DietOrder>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, medbrains_core::diet::DietOrder>(
        "SELECT * FROM diet_orders \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
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
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let adm =
        sqlx::query_as::<_, Admission>("SELECT * FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let rows = sqlx::query_as::<_, medbrains_core::consultation::ProcedureConsent>(
        "SELECT * FROM procedure_consents \
         WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
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
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

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
         ORDER BY is_primary DESC, created_at",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Fetch prescriptions
    let prescriptions = sqlx::query_as::<_, medbrains_core::consultation::Prescription>(
        "SELECT * FROM prescriptions \
         WHERE encounter_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(adm.encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Fetch nursing tasks
    let nursing_tasks = sqlx::query_as::<_, NursingTask>(
        "SELECT * FROM nursing_tasks \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Fetch progress notes
    let progress_notes = sqlx::query_as::<_, IpdProgressNote>(
        "SELECT * FROM ipd_progress_notes \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY note_date DESC",
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Get current admission with current bed
    let adm = sqlx::query_as::<_, Admission>(
        "SELECT * FROM admissions \
         WHERE id = $1 AND tenant_id = $2 AND status = 'admitted'::admission_status",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let from_bed_id = adm.bed_id;

    // Log the transfer
    sqlx::query(
        "INSERT INTO ip_bed_transfers \
         (tenant_id, admission_id, from_bed_id, to_bed_id, transfer_type, \
          reason, notes, transferred_by) \
         VALUES ($1, $2, $3, $4, \
                 COALESCE($5::transfer_type, 'internal'::transfer_type), \
                 $6, $7, $8)",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(from_bed_id)
    .bind(body.to_bed_id)
    .bind(&body.transfer_type)
    .bind(&body.reason)
    .bind(&body.notes)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    // Update admission bed
    let updated = sqlx::query_as::<_, Admission>(
        "UPDATE admissions SET bed_id = $3, updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .bind(body.to_bed_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "admission_id": updated.id,
        "from_bed_id": from_bed_id,
        "to_bed_id": body.to_bed_id,
        "transfer_type": body.transfer_type.as_deref().unwrap_or("internal"),
        "reason": body.reason,
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
    pub bed_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub attending_doctor_id: Option<Uuid>,
    pub admitted_at: chrono::DateTime<Utc>,
    pub expected_discharge_date: Option<NaiveDate>,
    pub days_until_discharge: Option<i32>,
}

pub async fn expected_discharges(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ExpectedDischargeRow>>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, ExpectedDischargeRow>(
        "SELECT a.id AS admission_id, a.patient_id, \
         (p.first_name || ' ' || p.last_name) AS patient_name, p.uhid, \
         a.bed_id, e.department_id, a.admitting_doctor AS attending_doctor_id, \
         a.admitted_at, a.expected_discharge_date, \
         (a.expected_discharge_date - CURRENT_DATE)::int AS days_until_discharge \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN encounters e ON e.id = a.encounter_id AND e.tenant_id = a.tenant_id \
         WHERE a.tenant_id = $1 \
           AND a.status = 'admitted'::admission_status \
           AND a.expected_discharge_date IS NOT NULL \
           AND a.expected_discharge_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTEGER '2' \
         ORDER BY a.expected_discharge_date ASC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
