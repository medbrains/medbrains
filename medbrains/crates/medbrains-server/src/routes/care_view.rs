#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Query / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct WardGridQuery {
    pub ward_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct MyTasksQuery {
    pub ward_id: Option<Uuid>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VitalsChecklistQuery {
    pub ward_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct HandoverQuery {
    pub ward_id: Uuid,
    pub shift: String,
}

#[derive(Debug, Deserialize)]
pub struct DischargeQuery {
    pub ward_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrimaryNurseRequest {
    pub primary_nurse_id: Option<Uuid>,
}

// ── Ward Patient Grid ────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PatientCardRow {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub bed_id: Option<Uuid>,
    pub bed_name: Option<String>,
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub is_critical: bool,
    pub isolation_required: bool,
    pub ip_type: Option<String>,
    pub admitting_doctor_name: Option<String>,
    pub primary_nurse_name: Option<String>,
    pub pending_tasks: i64,
    pub overdue_tasks: i64,
    pub pending_meds: i64,
    pub overdue_meds: i64,
    pub vitals_due: bool,
    pub fall_risk_level: Option<String>,
    pub latest_news2_score: Option<Decimal>,
    pub active_clinical_docs: i64,
    pub expected_discharge_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WardSummary {
    pub total_beds: i64,
    pub occupied: i64,
    pub critical_count: i64,
    pub isolation_count: i64,
    pub pending_discharges: i64,
    pub overdue_tasks_total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WardGridResponse {
    pub patients: Vec<PatientCardRow>,
    pub summary: WardSummary,
}

// ── My Tasks ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct NurseTaskItem {
    pub task_id: Uuid,
    pub admission_id: Uuid,
    pub patient_name: String,
    pub bed_name: Option<String>,
    pub description: String,
    pub category: Option<String>,
    pub priority: String,
    pub due_at: Option<DateTime<Utc>>,
    pub is_overdue: bool,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MedAdminItem {
    pub mar_id: Uuid,
    pub admission_id: Uuid,
    pub patient_name: String,
    pub bed_name: Option<String>,
    pub drug_name: String,
    pub dose: String,
    pub route: String,
    pub scheduled_at: DateTime<Utc>,
    pub is_overdue: bool,
    pub is_high_alert: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct MyTasksResponse {
    pub nursing_tasks: Vec<NurseTaskItem>,
    pub medication_tasks: Vec<MedAdminItem>,
}

// ── Vitals Checklist ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VitalsChecklistRow {
    pub admission_id: Uuid,
    pub patient_name: String,
    pub bed_name: Option<String>,
    pub last_vitals_at: Option<DateTime<Utc>>,
    pub hours_since_last: Option<f64>,
    pub vitals_due: bool,
}

// ── Handover Summary ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
struct HandoverPatientBase {
    pub admission_id: Uuid,
    pub patient_name: String,
    pub bed_name: Option<String>,
    pub is_critical: bool,
    pub isolation_required: bool,
    pub provisional_diagnosis: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HandoverSummaryPatient {
    pub admission_id: Uuid,
    pub patient_name: String,
    pub bed_name: Option<String>,
    pub is_critical: bool,
    pub isolation_required: bool,
    pub provisional_diagnosis: Option<String>,
    pub pending_tasks: Vec<String>,
    pub pending_meds: Vec<String>,
    pub active_clinical_docs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HandoverSummaryResponse {
    pub ward_name: String,
    pub shift: String,
    pub patients: Vec<HandoverSummaryPatient>,
    pub total_patients: usize,
    pub critical_count: usize,
}

// ── Discharge Readiness ──────────────────────────────────

#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DischargeReadinessRow {
    pub admission_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub bed_name: Option<String>,
    pub ward_name: Option<String>,
    pub expected_discharge_date: Option<NaiveDate>,
    pub billing_cleared: bool,
    pub pharmacy_cleared: bool,
    pub nursing_cleared: bool,
    pub doctor_cleared: bool,
    pub pending_lab_count: i64,
    pub readiness_pct: i32,
}

// ══════════════════════════════════════════════════════════
//  Handlers
// ══════════════════════════════════════════════════════════

/// GET /api/care-view/ward-grid — Ward-level patient grid with summary stats
pub async fn ward_patient_grid(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<WardGridQuery>,
) -> Result<Json<WardGridResponse>, AppError> {
    require_permission(&claims, permissions::care_view::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let patients = sqlx::query_as::<_, PatientCardRow>(
        "WITH admitted AS (
            SELECT a.id AS admission_id, a.patient_id, a.encounter_id,
                   p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
                   p.uhid,
                   a.bed_id,
                   bl.name AS bed_name,
                   a.ward_id,
                   w.name AS ward_name,
                   a.is_critical,
                   a.isolation_required,
                   a.ip_type::text AS ip_type,
                   doc.full_name AS admitting_doctor_name,
                   nurse.full_name AS primary_nurse_name,
                   a.expected_discharge_date
            FROM admissions a
            JOIN patients p ON p.id = a.patient_id
            LEFT JOIN bed_locations bl ON bl.id = a.bed_id
            LEFT JOIN wards w ON w.id = a.ward_id
            LEFT JOIN users doc ON doc.id = a.admitting_doctor
            LEFT JOIN users nurse ON nurse.id = a.primary_nurse_id
            WHERE a.status = 'admitted'
              AND ($1::uuid IS NULL OR a.ward_id = $1)
        )
        SELECT ad.*,
            COALESCE((SELECT COUNT(*) FROM nursing_tasks nt
                WHERE nt.admission_id = ad.admission_id AND NOT nt.is_completed), 0) AS pending_tasks,
            COALESCE((SELECT COUNT(*) FROM nursing_tasks nt
                WHERE nt.admission_id = ad.admission_id AND NOT nt.is_completed
                AND nt.due_at < NOW()), 0) AS overdue_tasks,
            COALESCE((SELECT COUNT(*) FROM ipd_medication_administration m
                WHERE m.admission_id = ad.admission_id AND m.status = 'scheduled'), 0) AS pending_meds,
            COALESCE((SELECT COUNT(*) FROM ipd_medication_administration m
                WHERE m.admission_id = ad.admission_id AND m.status = 'scheduled'
                AND m.scheduled_at < NOW()), 0) AS overdue_meds,
            COALESCE((SELECT EXTRACT(EPOCH FROM (NOW() - MAX(v.recorded_at))) / 3600 > 4
                FROM vitals v WHERE v.encounter_id = ad.encounter_id), true) AS vitals_due,
            (SELECT ca.risk_level FROM ipd_clinical_assessments ca
                WHERE ca.admission_id = ad.admission_id
                AND ca.assessment_type = 'morse_fall_scale'
                ORDER BY ca.assessed_at DESC LIMIT 1) AS fall_risk_level,
            (SELECT ca.score_value FROM ipd_clinical_assessments ca
                WHERE ca.admission_id = ad.admission_id
                AND ca.assessment_type = 'news2'
                ORDER BY ca.assessed_at DESC LIMIT 1) AS latest_news2_score,
            COALESCE((SELECT COUNT(*) FROM ipd_clinical_documentations cd
                WHERE cd.admission_id = ad.admission_id AND NOT cd.is_resolved), 0) AS active_clinical_docs
        FROM admitted ad
        ORDER BY ad.is_critical DESC, ad.ward_name, ad.bed_name"
    )
    .bind(params.ward_id)
    .fetch_all(&mut *tx)
    .await?;

    // Build summary
    let total_beds: i64 = if let Some(ward_id) = params.ward_id {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM ward_bed_mappings WHERE ward_id = $1 AND is_active = true",
        )
        .bind(ward_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0)
    } else {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM ward_bed_mappings WHERE is_active = true",
        )
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0)
    };

    let occupied = i64::try_from(patients.len()).unwrap_or(0);
    let critical_count =
        i64::try_from(patients.iter().filter(|p| p.is_critical).count()).unwrap_or(0);
    let isolation_count =
        i64::try_from(patients.iter().filter(|p| p.isolation_required).count()).unwrap_or(0);
    let pending_discharges = i64::try_from(
        patients
            .iter()
            .filter(|p| {
                p.expected_discharge_date
                    .is_some_and(|d| d <= chrono::Local::now().date_naive())
            })
            .count(),
    )
    .unwrap_or(0);
    let overdue_tasks_total: i64 = patients.iter().map(|p| p.overdue_tasks).sum();

    tx.commit().await?;

    Ok(Json(WardGridResponse {
        patients,
        summary: WardSummary {
            total_beds,
            occupied,
            critical_count,
            isolation_count,
            pending_discharges,
            overdue_tasks_total,
        },
    }))
}

/// GET /api/care-view/my-tasks — Personal task queue for the logged-in nurse
pub async fn my_tasks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<MyTasksQuery>,
) -> Result<Json<MyTasksResponse>, AppError> {
    require_permission(&claims, permissions::care_view::MY_TASKS)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let nursing_tasks = sqlx::query_as::<_, NurseTaskItem>(
        "SELECT nt.id AS task_id,
                nt.admission_id,
                p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
                bl.name AS bed_name,
                nt.description,
                nt.category::text AS category,
                nt.priority::text AS priority,
                nt.due_at,
                CASE WHEN nt.due_at < NOW() THEN true ELSE false END AS is_overdue
         FROM nursing_tasks nt
         JOIN admissions a ON a.id = nt.admission_id
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN bed_locations bl ON bl.id = a.bed_id
         WHERE nt.assigned_to = $1
           AND NOT nt.is_completed
           AND a.status = 'admitted'
           AND ($2::uuid IS NULL OR a.ward_id = $2)
           AND ($3::text IS NULL OR nt.category::text = $3)
         ORDER BY nt.priority = 'stat' DESC,
                  nt.priority = 'urgent' DESC,
                  nt.due_at ASC NULLS LAST
         LIMIT 200",
    )
    .bind(claims.sub)
    .bind(params.ward_id)
    .bind(params.category)
    .fetch_all(&mut *tx)
    .await?;

    let medication_tasks = sqlx::query_as::<_, MedAdminItem>(
        "SELECT m.id AS mar_id,
                m.admission_id,
                p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
                bl.name AS bed_name,
                m.drug_name,
                m.dose,
                m.route,
                m.scheduled_at,
                CASE WHEN m.scheduled_at < NOW() THEN true ELSE false END AS is_overdue,
                m.is_high_alert
         FROM ipd_medication_administration m
         JOIN admissions a ON a.id = m.admission_id
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN bed_locations bl ON bl.id = a.bed_id
         WHERE m.status = 'scheduled'
           AND a.status = 'admitted'
           AND (a.primary_nurse_id = $1 OR EXISTS (
                SELECT 1 FROM nursing_tasks nt2
                WHERE nt2.admission_id = a.id AND nt2.assigned_to = $1 AND NOT nt2.is_completed
           ))
           AND ($2::uuid IS NULL OR a.ward_id = $2)
         ORDER BY m.is_high_alert DESC, m.scheduled_at ASC
         LIMIT 200",
    )
    .bind(claims.sub)
    .bind(params.ward_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(MyTasksResponse {
        nursing_tasks,
        medication_tasks,
    }))
}

/// GET /api/care-view/vitals-checklist — Patients needing vitals collection
pub async fn vitals_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<VitalsChecklistQuery>,
) -> Result<Json<Vec<VitalsChecklistRow>>, AppError> {
    require_permission(&claims, permissions::care_view::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VitalsChecklistRow>(
        "SELECT a.id AS admission_id,
                p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
                bl.name AS bed_name,
                lv.last_vitals_at,
                EXTRACT(EPOCH FROM (NOW() - lv.last_vitals_at)) / 3600 AS hours_since_last,
                CASE WHEN lv.last_vitals_at IS NULL
                     OR EXTRACT(EPOCH FROM (NOW() - lv.last_vitals_at)) / 3600 > 4
                     THEN true ELSE false END AS vitals_due
         FROM admissions a
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN bed_locations bl ON bl.id = a.bed_id
         LEFT JOIN LATERAL (
             SELECT MAX(v.recorded_at) AS last_vitals_at
             FROM vitals v WHERE v.encounter_id = a.encounter_id
         ) lv ON true
         WHERE a.status = 'admitted'
           AND ($1::uuid IS NULL OR a.ward_id = $1)
         ORDER BY lv.last_vitals_at ASC NULLS FIRST
         LIMIT 200",
    )
    .bind(params.ward_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/care-view/handover — Shift handover summary for a ward
pub async fn handover_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<HandoverQuery>,
) -> Result<Json<HandoverSummaryResponse>, AppError> {
    require_permission(&claims, permissions::care_view::HANDOVER)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get ward name
    let ward_name = sqlx::query_scalar::<_, String>("SELECT name FROM wards WHERE id = $1")
        .bind(params.ward_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Unknown Ward".to_owned());

    // Get admitted patients in ward
    let base_patients = sqlx::query_as::<_, HandoverPatientBase>(
        "SELECT a.id AS admission_id,
                p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
                bl.name AS bed_name,
                a.is_critical,
                a.isolation_required,
                a.provisional_diagnosis
         FROM admissions a
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN bed_locations bl ON bl.id = a.bed_id
         WHERE a.status = 'admitted' AND a.ward_id = $1
         ORDER BY a.is_critical DESC, bl.name",
    )
    .bind(params.ward_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut patients = Vec::with_capacity(base_patients.len());
    let critical_count = base_patients.iter().filter(|p| p.is_critical).count();

    for bp in &base_patients {
        // Pending tasks
        let pending_tasks: Vec<String> = sqlx::query_scalar(
            "SELECT description FROM nursing_tasks \
             WHERE admission_id = $1 AND NOT is_completed \
             ORDER BY priority = 'stat' DESC, due_at ASC NULLS LAST LIMIT 10",
        )
        .bind(bp.admission_id)
        .fetch_all(&mut *tx)
        .await
        .unwrap_or_default();

        // Pending meds
        let pending_meds: Vec<String> = sqlx::query_scalar(
            "SELECT drug_name || ' ' || dose || ' (' || route || ')' \
             FROM ipd_medication_administration \
             WHERE admission_id = $1 AND status = 'scheduled' \
             ORDER BY scheduled_at ASC LIMIT 10",
        )
        .bind(bp.admission_id)
        .fetch_all(&mut *tx)
        .await
        .unwrap_or_default();

        // Active clinical docs
        let active_docs: Vec<String> = sqlx::query_scalar(
            "SELECT title FROM ipd_clinical_documentations \
             WHERE admission_id = $1 AND NOT is_resolved \
             ORDER BY recorded_at DESC LIMIT 5",
        )
        .bind(bp.admission_id)
        .fetch_all(&mut *tx)
        .await
        .unwrap_or_default();

        patients.push(HandoverSummaryPatient {
            admission_id: bp.admission_id,
            patient_name: bp.patient_name.clone(),
            bed_name: bp.bed_name.clone(),
            is_critical: bp.is_critical,
            isolation_required: bp.isolation_required,
            provisional_diagnosis: bp.provisional_diagnosis.clone(),
            pending_tasks,
            pending_meds,
            active_clinical_docs: active_docs,
        });
    }

    let total_patients = patients.len();

    tx.commit().await?;

    Ok(Json(HandoverSummaryResponse {
        ward_name,
        shift: params.shift.clone(),
        patients,
        total_patients,
        critical_count,
    }))
}

/// GET /api/care-view/discharge-tracker — Discharge readiness dashboard
pub async fn discharge_readiness(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DischargeQuery>,
) -> Result<Json<Vec<DischargeReadinessRow>>, AppError> {
    require_permission(&claims, permissions::care_view::DISCHARGE_TRACKER)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DischargeReadinessRow>(
        "SELECT a.id AS admission_id,
                p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
                p.uhid,
                bl.name AS bed_name,
                w.name AS ward_name,
                a.expected_discharge_date,
                COALESCE(tat.billing_cleared_at IS NOT NULL, false) AS billing_cleared,
                COALESCE(tat.pharmacy_cleared_at IS NOT NULL, false) AS pharmacy_cleared,
                COALESCE(tat.nursing_cleared_at IS NOT NULL, false) AS nursing_cleared,
                COALESCE(tat.doctor_cleared_at IS NOT NULL, false) AS doctor_cleared,
                COALESCE((SELECT COUNT(*) FROM lab_orders lo
                    WHERE lo.encounter_id = a.encounter_id
                    AND lo.status NOT IN ('completed', 'cancelled')), 0) AS pending_lab_count,
                CASE
                    WHEN tat.id IS NULL THEN 0
                    ELSE (
                        (CASE WHEN tat.billing_cleared_at IS NOT NULL THEN 25 ELSE 0 END) +
                        (CASE WHEN tat.pharmacy_cleared_at IS NOT NULL THEN 25 ELSE 0 END) +
                        (CASE WHEN tat.nursing_cleared_at IS NOT NULL THEN 25 ELSE 0 END) +
                        (CASE WHEN tat.doctor_cleared_at IS NOT NULL THEN 25 ELSE 0 END)
                    )
                END AS readiness_pct
         FROM admissions a
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN bed_locations bl ON bl.id = a.bed_id
         LEFT JOIN wards w ON w.id = a.ward_id
         LEFT JOIN ipd_discharge_tat_logs tat ON tat.admission_id = a.id
         WHERE a.status = 'admitted'
           AND (
               a.expected_discharge_date <= CURRENT_DATE + INTERVAL '7 days'
               OR tat.discharge_initiated_at IS NOT NULL
           )
           AND ($1::uuid IS NULL OR a.ward_id = $1)
         ORDER BY a.expected_discharge_date ASC NULLS LAST",
    )
    .bind(params.ward_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/care-view/tasks/{task_id}/complete — Complete a nursing task
pub async fn complete_task(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(task_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::care_view::MANAGE_TASKS)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE nursing_tasks SET is_completed = true, completed_at = NOW(), completed_by = $1 \
         WHERE id = $2",
    )
    .bind(claims.sub)
    .bind(task_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "completed": true })))
}

/// PUT /api/care-view/admissions/{id}/primary-nurse — Assign primary nurse
pub async fn update_primary_nurse(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<UpdatePrimaryNurseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::care_view::MANAGE_TASKS)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("UPDATE admissions SET primary_nurse_id = $1 WHERE id = $2")
        .bind(body.primary_nurse_id)
        .bind(admission_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "updated": true })))
}
