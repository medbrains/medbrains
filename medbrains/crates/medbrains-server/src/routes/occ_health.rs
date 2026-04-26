#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use medbrains_core::occ_health::{
    OccHealthDrugScreen, OccHealthInjuryReport, OccHealthScreening, OccHealthVaccination,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Screenings ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListScreeningsQuery {
    pub employee_id: Option<Uuid>,
    pub screening_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScreeningRequest {
    pub employee_id: Uuid,
    pub examiner_id: Option<Uuid>,
    pub screening_type: String,
    pub screening_date: String,
    pub fitness_status: String,
    pub findings: Option<serde_json::Value>,
    pub restrictions: Option<serde_json::Value>,
    pub next_due_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScreeningRequest {
    pub examiner_id: Option<Uuid>,
    pub screening_type: Option<String>,
    pub screening_date: Option<String>,
    pub fitness_status: Option<String>,
    pub findings: Option<serde_json::Value>,
    pub restrictions: Option<serde_json::Value>,
    pub next_due_date: Option<String>,
    pub notes: Option<String>,
}

// ── Drug Screens ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListDrugScreensQuery {
    pub employee_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDrugScreenRequest {
    pub employee_id: Uuid,
    pub screening_id: Option<Uuid>,
    pub panel: String,
    pub chain_of_custody: Option<serde_json::Value>,
    pub collected_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDrugScreenRequest {
    pub status: Option<String>,
    pub results: Option<serde_json::Value>,
    pub chain_of_custody: Option<serde_json::Value>,
    pub mro_reviewer_id: Option<Uuid>,
    pub mro_decision: Option<String>,
    pub collected_at: Option<String>,
}

// ── Vaccinations ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListVaccinationsQuery {
    pub employee_id: Option<Uuid>,
    pub vaccine_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVaccinationRequest {
    pub employee_id: Uuid,
    pub vaccine_name: String,
    pub dose_number: i32,
    pub administered_date: String,
    pub batch_number: Option<String>,
    pub administered_by: Option<Uuid>,
    pub next_due_date: Option<String>,
    pub is_compliant: Option<bool>,
    pub exemption_type: Option<String>,
    pub exemption_reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVaccinationRequest {
    pub vaccine_name: Option<String>,
    pub dose_number: Option<i32>,
    pub administered_date: Option<String>,
    pub batch_number: Option<String>,
    pub administered_by: Option<Uuid>,
    pub next_due_date: Option<String>,
    pub is_compliant: Option<bool>,
    pub exemption_type: Option<String>,
    pub exemption_reason: Option<String>,
    pub notes: Option<String>,
}

// ── Injuries ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListInjuriesQuery {
    pub employee_id: Option<Uuid>,
    pub rtw_status: Option<String>,
    pub is_osha_recordable: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInjuryRequest {
    pub employee_id: Uuid,
    pub injury_date: String,
    pub injury_type: String,
    pub injury_description: Option<String>,
    pub body_part_affected: Option<String>,
    pub location_of_incident: Option<String>,
    pub is_osha_recordable: Option<bool>,
    pub lost_work_days: Option<i32>,
    pub restricted_days: Option<i32>,
    pub workers_comp_claim_number: Option<String>,
    pub workers_comp_status: Option<String>,
    pub rtw_restrictions: Option<serde_json::Value>,
    pub employer_access_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInjuryRequest {
    pub injury_type: Option<String>,
    pub injury_description: Option<String>,
    pub body_part_affected: Option<String>,
    pub location_of_incident: Option<String>,
    pub is_osha_recordable: Option<bool>,
    pub lost_work_days: Option<i32>,
    pub restricted_days: Option<i32>,
    pub workers_comp_claim_number: Option<String>,
    pub workers_comp_status: Option<String>,
    pub rtw_status: Option<String>,
    pub rtw_restrictions: Option<serde_json::Value>,
    pub rtw_cleared_date: Option<String>,
    pub rtw_cleared_by: Option<Uuid>,
    pub employer_access_notes: Option<String>,
}

// ── Response-only types ──────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VaccinationComplianceRow {
    pub vaccine_name: String,
    pub total_employees: i64,
    pub compliant_count: i64,
    pub compliance_pct: f64,
}

#[derive(Debug, Serialize)]
pub struct EmployerViewResponse {
    pub id: Uuid,
    pub employee_id: Uuid,
    pub report_number: String,
    pub injury_date: chrono::NaiveDate,
    pub injury_type: String,
    pub is_osha_recordable: bool,
    pub lost_work_days: i32,
    pub restricted_days: i32,
    pub rtw_status: medbrains_core::occ_health::RtwClearanceStatus,
    pub rtw_restrictions: serde_json::Value,
    pub employer_access_notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Screening handlers
// ══════════════════════════════════════════════════════════

pub async fn list_screenings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListScreeningsQuery>,
) -> Result<Json<Vec<OccHealthScreening>>, AppError> {
    require_permission(&claims, permissions::occ_health::screenings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(emp_id) = params.employee_id {
        sqlx::query_as::<_, OccHealthScreening>(
            "SELECT * FROM occ_health_screenings \
             WHERE tenant_id = $1 AND employee_id = $2 \
             ORDER BY screening_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(emp_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref stype) = params.screening_type {
        sqlx::query_as::<_, OccHealthScreening>(
            "SELECT * FROM occ_health_screenings \
             WHERE tenant_id = $1 AND screening_type = $2 \
             ORDER BY screening_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(stype)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OccHealthScreening>(
            "SELECT * FROM occ_health_screenings \
             WHERE tenant_id = $1 \
             ORDER BY screening_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScreeningRequest>,
) -> Result<(StatusCode, Json<OccHealthScreening>), AppError> {
    require_permission(&claims, permissions::occ_health::screenings::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthScreening>(
        "INSERT INTO occ_health_screenings \
         (tenant_id, employee_id, examiner_id, screening_type, screening_date, \
          fitness_status, findings, restrictions, next_due_date, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5::date, $6, \
         COALESCE($7, '{}'::jsonb), COALESCE($8, '[]'::jsonb), \
         $9::date, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.examiner_id)
    .bind(&body.screening_type)
    .bind(&body.screening_date)
    .bind(&body.fitness_status)
    .bind(&body.findings)
    .bind(&body.restrictions)
    .bind(&body.next_due_date)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn list_due_screenings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OccHealthScreening>>, AppError> {
    require_permission(&claims, permissions::occ_health::screenings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OccHealthScreening>(
        "SELECT * FROM occ_health_screenings \
         WHERE tenant_id = $1 \
         AND next_due_date <= CURRENT_DATE + interval '30 days' \
         ORDER BY next_due_date ASC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OccHealthScreening>, AppError> {
    require_permission(&claims, permissions::occ_health::screenings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthScreening>(
        "SELECT * FROM occ_health_screenings \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateScreeningRequest>,
) -> Result<Json<OccHealthScreening>, AppError> {
    require_permission(&claims, permissions::occ_health::screenings::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthScreening>(
        "UPDATE occ_health_screenings SET \
         examiner_id = COALESCE($3, examiner_id), \
         screening_type = COALESCE($4, screening_type), \
         screening_date = COALESCE($5::date, screening_date), \
         fitness_status = COALESCE($6, fitness_status), \
         findings = COALESCE($7, findings), \
         restrictions = COALESCE($8, restrictions), \
         next_due_date = COALESCE($9::date, next_due_date), \
         notes = COALESCE($10, notes) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.examiner_id)
    .bind(&body.screening_type)
    .bind(&body.screening_date)
    .bind(&body.fitness_status)
    .bind(&body.findings)
    .bind(&body.restrictions)
    .bind(&body.next_due_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Drug Screen handlers
// ══════════════════════════════════════════════════════════

pub async fn list_drug_screens(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDrugScreensQuery>,
) -> Result<Json<Vec<OccHealthDrugScreen>>, AppError> {
    require_permission(&claims, permissions::occ_health::drug_screens::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(emp_id) = params.employee_id {
        sqlx::query_as::<_, OccHealthDrugScreen>(
            "SELECT * FROM occ_health_drug_screens \
             WHERE tenant_id = $1 AND employee_id = $2 \
             ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(emp_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref status) = params.status {
        sqlx::query_as::<_, OccHealthDrugScreen>(
            "SELECT * FROM occ_health_drug_screens \
             WHERE tenant_id = $1 AND status = $2::drug_screen_status \
             ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OccHealthDrugScreen>(
            "SELECT * FROM occ_health_drug_screens \
             WHERE tenant_id = $1 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_drug_screen(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDrugScreenRequest>,
) -> Result<(StatusCode, Json<OccHealthDrugScreen>), AppError> {
    require_permission(&claims, permissions::occ_health::drug_screens::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let specimen_id = format!("DS-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));

    let row = sqlx::query_as::<_, OccHealthDrugScreen>(
        "INSERT INTO occ_health_drug_screens \
         (tenant_id, employee_id, screening_id, specimen_id, \
          panel, chain_of_custody, collected_at) \
         VALUES ($1, $2, $3, $4, $5, \
         COALESCE($6, '{}'::jsonb), $7::timestamptz) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.screening_id)
    .bind(&specimen_id)
    .bind(&body.panel)
    .bind(&body.chain_of_custody)
    .bind(&body.collected_at)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn update_drug_screen(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDrugScreenRequest>,
) -> Result<Json<OccHealthDrugScreen>, AppError> {
    require_permission(&claims, permissions::occ_health::drug_screens::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthDrugScreen>(
        "UPDATE occ_health_drug_screens SET \
         status = COALESCE($3::drug_screen_status, status), \
         results = COALESCE($4, results), \
         chain_of_custody = COALESCE($5, chain_of_custody), \
         mro_reviewer_id = COALESCE($6, mro_reviewer_id), \
         mro_decision = COALESCE($7, mro_decision), \
         mro_reviewed_at = CASE WHEN $6 IS NOT NULL THEN now() \
                           ELSE mro_reviewed_at END, \
         collected_at = COALESCE($8::timestamptz, collected_at) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.results)
    .bind(&body.chain_of_custody)
    .bind(body.mro_reviewer_id)
    .bind(&body.mro_decision)
    .bind(&body.collected_at)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Vaccination handlers
// ══════════════════════════════════════════════════════════

pub async fn list_vaccinations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListVaccinationsQuery>,
) -> Result<Json<Vec<OccHealthVaccination>>, AppError> {
    require_permission(&claims, permissions::occ_health::vaccinations::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(emp_id) = params.employee_id {
        sqlx::query_as::<_, OccHealthVaccination>(
            "SELECT * FROM occ_health_vaccinations \
             WHERE tenant_id = $1 AND employee_id = $2 \
             ORDER BY administered_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(emp_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref vname) = params.vaccine_name {
        sqlx::query_as::<_, OccHealthVaccination>(
            "SELECT * FROM occ_health_vaccinations \
             WHERE tenant_id = $1 AND vaccine_name = $2 \
             ORDER BY administered_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(vname)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OccHealthVaccination>(
            "SELECT * FROM occ_health_vaccinations \
             WHERE tenant_id = $1 \
             ORDER BY administered_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_vaccination(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVaccinationRequest>,
) -> Result<(StatusCode, Json<OccHealthVaccination>), AppError> {
    require_permission(&claims, permissions::occ_health::vaccinations::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthVaccination>(
        "INSERT INTO occ_health_vaccinations \
         (tenant_id, employee_id, vaccine_name, dose_number, \
          administered_date, batch_number, administered_by, \
          next_due_date, is_compliant, exemption_type, \
          exemption_reason, notes) \
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, \
         $8::date, COALESCE($9, true), $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(&body.vaccine_name)
    .bind(body.dose_number)
    .bind(&body.administered_date)
    .bind(&body.batch_number)
    .bind(body.administered_by)
    .bind(&body.next_due_date)
    .bind(body.is_compliant)
    .bind(&body.exemption_type)
    .bind(&body.exemption_reason)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn update_vaccination(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateVaccinationRequest>,
) -> Result<Json<OccHealthVaccination>, AppError> {
    require_permission(&claims, permissions::occ_health::vaccinations::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthVaccination>(
        "UPDATE occ_health_vaccinations SET \
         vaccine_name = COALESCE($3, vaccine_name), \
         dose_number = COALESCE($4, dose_number), \
         administered_date = COALESCE($5::date, administered_date), \
         batch_number = COALESCE($6, batch_number), \
         administered_by = COALESCE($7, administered_by), \
         next_due_date = COALESCE($8::date, next_due_date), \
         is_compliant = COALESCE($9, is_compliant), \
         exemption_type = COALESCE($10, exemption_type), \
         exemption_reason = COALESCE($11, exemption_reason), \
         notes = COALESCE($12, notes) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.vaccine_name)
    .bind(body.dose_number)
    .bind(&body.administered_date)
    .bind(&body.batch_number)
    .bind(body.administered_by)
    .bind(&body.next_due_date)
    .bind(body.is_compliant)
    .bind(&body.exemption_type)
    .bind(&body.exemption_reason)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn vaccination_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<VaccinationComplianceRow>>, AppError> {
    require_permission(&claims, permissions::occ_health::vaccinations::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VaccinationComplianceRow>(
        "SELECT \
             vaccine_name, \
             COUNT(DISTINCT employee_id)::bigint AS total_employees, \
             COUNT(DISTINCT employee_id) FILTER (WHERE is_compliant = true)::bigint \
                 AS compliant_count, \
             CASE WHEN COUNT(DISTINCT employee_id) > 0 \
                 THEN ROUND( \
                     (COUNT(DISTINCT employee_id) FILTER (WHERE is_compliant = true)::numeric \
                      / COUNT(DISTINCT employee_id)::numeric) * 100, 2 \
                 )::float8 \
                 ELSE 0.0 \
             END AS compliance_pct \
         FROM occ_health_vaccinations \
         WHERE tenant_id = $1 \
         GROUP BY vaccine_name \
         ORDER BY vaccine_name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Injury Report handlers
// ══════════════════════════════════════════════════════════

pub async fn list_injuries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListInjuriesQuery>,
) -> Result<Json<Vec<OccHealthInjuryReport>>, AppError> {
    require_permission(&claims, permissions::occ_health::injuries::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(emp_id) = params.employee_id {
        sqlx::query_as::<_, OccHealthInjuryReport>(
            "SELECT * FROM occ_health_injury_reports \
             WHERE tenant_id = $1 AND employee_id = $2 \
             ORDER BY injury_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(emp_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref rtw) = params.rtw_status {
        sqlx::query_as::<_, OccHealthInjuryReport>(
            "SELECT * FROM occ_health_injury_reports \
             WHERE tenant_id = $1 AND rtw_status = $2::rtw_clearance_status \
             ORDER BY injury_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(rtw)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(osha) = params.is_osha_recordable {
        sqlx::query_as::<_, OccHealthInjuryReport>(
            "SELECT * FROM occ_health_injury_reports \
             WHERE tenant_id = $1 AND is_osha_recordable = $2 \
             ORDER BY injury_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(osha)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OccHealthInjuryReport>(
            "SELECT * FROM occ_health_injury_reports \
             WHERE tenant_id = $1 \
             ORDER BY injury_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_injury(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInjuryRequest>,
) -> Result<(StatusCode, Json<OccHealthInjuryReport>), AppError> {
    require_permission(&claims, permissions::occ_health::injuries::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = chrono::Utc::now();
    let short_uuid = &Uuid::new_v4().to_string()[..8];
    let report_number = format!("INJ-{}-{}", now.format("%Y%m%d%H%M%S"), short_uuid);

    let row = sqlx::query_as::<_, OccHealthInjuryReport>(
        "INSERT INTO occ_health_injury_reports \
         (tenant_id, employee_id, report_number, injury_date, injury_type, \
          injury_description, body_part_affected, location_of_incident, \
          is_osha_recordable, lost_work_days, restricted_days, \
          workers_comp_claim_number, workers_comp_status, \
          rtw_restrictions, employer_access_notes, reported_by) \
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, \
         COALESCE($9, false), COALESCE($10, 0), COALESCE($11, 0), \
         $12, $13, COALESCE($14, '[]'::jsonb), $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(&report_number)
    .bind(&body.injury_date)
    .bind(&body.injury_type)
    .bind(&body.injury_description)
    .bind(&body.body_part_affected)
    .bind(&body.location_of_incident)
    .bind(body.is_osha_recordable)
    .bind(body.lost_work_days)
    .bind(body.restricted_days)
    .bind(&body.workers_comp_claim_number)
    .bind(&body.workers_comp_status)
    .bind(&body.rtw_restrictions)
    .bind(&body.employer_access_notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn update_injury(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInjuryRequest>,
) -> Result<Json<OccHealthInjuryReport>, AppError> {
    require_permission(&claims, permissions::occ_health::injuries::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthInjuryReport>(
        "UPDATE occ_health_injury_reports SET \
         injury_type = COALESCE($3, injury_type), \
         injury_description = COALESCE($4, injury_description), \
         body_part_affected = COALESCE($5, body_part_affected), \
         location_of_incident = COALESCE($6, location_of_incident), \
         is_osha_recordable = COALESCE($7, is_osha_recordable), \
         lost_work_days = COALESCE($8, lost_work_days), \
         restricted_days = COALESCE($9, restricted_days), \
         workers_comp_claim_number = COALESCE($10, workers_comp_claim_number), \
         workers_comp_status = COALESCE($11, workers_comp_status), \
         rtw_status = COALESCE($12::rtw_clearance_status, rtw_status), \
         rtw_restrictions = COALESCE($13, rtw_restrictions), \
         rtw_cleared_date = COALESCE($14::date, rtw_cleared_date), \
         rtw_cleared_by = COALESCE($15, rtw_cleared_by), \
         employer_access_notes = COALESCE($16, employer_access_notes) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.injury_type)
    .bind(&body.injury_description)
    .bind(&body.body_part_affected)
    .bind(&body.location_of_incident)
    .bind(body.is_osha_recordable)
    .bind(body.lost_work_days)
    .bind(body.restricted_days)
    .bind(&body.workers_comp_claim_number)
    .bind(&body.workers_comp_status)
    .bind(&body.rtw_status)
    .bind(&body.rtw_restrictions)
    .bind(&body.rtw_cleared_date)
    .bind(body.rtw_cleared_by)
    .bind(&body.employer_access_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_employer_view(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EmployerViewResponse>, AppError> {
    require_permission(&claims, permissions::occ_health::injuries::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthInjuryReport>(
        "SELECT * FROM occ_health_injury_reports \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let response = EmployerViewResponse {
        id: row.id,
        employee_id: row.employee_id,
        report_number: row.report_number,
        injury_date: row.injury_date,
        injury_type: row.injury_type,
        is_osha_recordable: row.is_osha_recordable,
        lost_work_days: row.lost_work_days,
        restricted_days: row.restricted_days,
        rtw_status: row.rtw_status,
        rtw_restrictions: row.rtw_restrictions,
        employer_access_notes: row.employer_access_notes,
    };

    Ok(Json(response))
}

// ══════════════════════════════════════════════════════════
//  Hazards, Analytics, Return-to-Work Clearance
// ══════════════════════════════════════════════════════════

// ── GET /api/occ-health/hazards ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListHazardsQuery {
    pub department_id: Option<Uuid>,
}

pub async fn list_hazards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListHazardsQuery>,
) -> Result<Json<Vec<OccHealthScreening>>, AppError> {
    require_permission(&claims, permissions::occ_health::screenings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, OccHealthScreening>(
            "SELECT s.* FROM occ_health_screenings s \
             JOIN employees e ON e.id = s.employee_id AND e.tenant_id = s.tenant_id \
             WHERE s.tenant_id = $1 \
             AND s.screening_type = 'hazard_assessment' \
             AND e.department_id = $2 \
             ORDER BY s.screening_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OccHealthScreening>(
            "SELECT * FROM occ_health_screenings \
             WHERE tenant_id = $1 \
             AND screening_type = 'hazard_assessment' \
             ORDER BY screening_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

// ── POST /api/occ-health/hazards ────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateHazardRequest {
    pub employee_id: Uuid,
    pub examiner_id: Option<Uuid>,
    pub screening_date: String,
    pub fitness_status: String,
    pub findings: Option<serde_json::Value>,
    pub restrictions: Option<serde_json::Value>,
    pub next_due_date: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_hazard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHazardRequest>,
) -> Result<(StatusCode, Json<OccHealthScreening>), AppError> {
    require_permission(&claims, permissions::occ_health::screenings::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthScreening>(
        "INSERT INTO occ_health_screenings \
         (tenant_id, employee_id, examiner_id, screening_type, screening_date, \
          fitness_status, findings, restrictions, next_due_date, notes, created_by) \
         VALUES ($1, $2, $3, 'hazard_assessment', $4::date, $5, \
         COALESCE($6, '{}'::jsonb), COALESCE($7, '[]'::jsonb), \
         $8::date, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.examiner_id)
    .bind(&body.screening_date)
    .bind(&body.fitness_status)
    .bind(&body.findings)
    .bind(&body.restrictions)
    .bind(&body.next_due_date)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

// ── GET /api/occ-health/analytics ───────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DiseasePrevalenceRow {
    pub screening_type: String,
    pub department_name: Option<String>,
    pub screening_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExposureTrendRow {
    pub month: String,
    pub screening_type: String,
    pub screening_count: i64,
}

#[derive(Debug, Serialize)]
pub struct OccHealthAnalyticsResponse {
    pub disease_prevalence: Vec<DiseasePrevalenceRow>,
    pub exposure_trends: Vec<ExposureTrendRow>,
}

pub async fn health_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OccHealthAnalyticsResponse>, AppError> {
    require_permission(&claims, permissions::occ_health::screenings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Disease prevalence by department
    let disease_prevalence = sqlx::query_as::<_, DiseasePrevalenceRow>(
        "SELECT \
             s.screening_type, \
             d.name AS department_name, \
             COUNT(*)::bigint AS screening_count \
         FROM occ_health_screenings s \
         JOIN employees e ON e.id = s.employee_id AND e.tenant_id = s.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         WHERE s.tenant_id = $1 \
         AND s.fitness_status NOT IN ('fit', 'pending') \
         GROUP BY s.screening_type, d.name \
         ORDER BY screening_count DESC \
         LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Exposure trends by month (last 12 months)
    let exposure_trends = sqlx::query_as::<_, ExposureTrendRow>(
        "SELECT \
             TO_CHAR(screening_date, 'YYYY-MM') AS month, \
             screening_type, \
             COUNT(*)::bigint AS screening_count \
         FROM occ_health_screenings \
         WHERE tenant_id = $1 \
         AND screening_date >= CURRENT_DATE - interval '12 months' \
         GROUP BY TO_CHAR(screening_date, 'YYYY-MM'), screening_type \
         ORDER BY month DESC, screening_count DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(OccHealthAnalyticsResponse {
        disease_prevalence,
        exposure_trends,
    }))
}

// ── POST /api/occ-health/clearance ──────────────────────────

#[derive(Debug, Deserialize)]
pub struct ReturnToWorkClearanceRequest {
    pub employee_id: Uuid,
    pub examiner_id: Option<Uuid>,
    pub screening_date: String,
    pub fitness_status: String,
    pub findings: Option<serde_json::Value>,
    pub restrictions: Option<serde_json::Value>,
    pub notes: Option<String>,
}

pub async fn return_to_work_clearance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReturnToWorkClearanceRequest>,
) -> Result<(StatusCode, Json<OccHealthScreening>), AppError> {
    require_permission(&claims, permissions::occ_health::screenings::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OccHealthScreening>(
        "INSERT INTO occ_health_screenings \
         (tenant_id, employee_id, examiner_id, screening_type, screening_date, \
          fitness_status, findings, restrictions, notes, created_by) \
         VALUES ($1, $2, $3, 'return_to_work', $4::date, $5, \
         COALESCE($6, '{}'::jsonb), COALESCE($7, '[]'::jsonb), \
         $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.examiner_id)
    .bind(&body.screening_date)
    .bind(&body.fitness_status)
    .bind(&body.findings)
    .bind(&body.restrictions)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}
