#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::icu::{
    IcuBundleCheck, IcuDevice, IcuFlowsheet, IcuNeonatalRecord, IcuNutrition, IcuScore,
    IcuVentilatorRecord,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateFlowsheetRequest {
    pub heart_rate: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub mean_arterial_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<f64>,
    pub temperature: Option<f64>,
    pub cvp: Option<f64>,
    pub intake_ml: Option<i32>,
    pub output_ml: Option<i32>,
    pub urine_ml: Option<i32>,
    pub drain_ml: Option<i32>,
    pub infusions: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVentilatorRequest {
    pub mode: String,
    pub fio2: Option<f64>,
    pub peep: Option<f64>,
    pub tidal_volume: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub pip: Option<f64>,
    pub plateau_pressure: Option<f64>,
    pub ph: Option<f64>,
    pub pao2: Option<f64>,
    pub paco2: Option<f64>,
    pub hco3: Option<f64>,
    pub sao2: Option<f64>,
    pub lactate: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScoreRequest {
    pub score_type: String,
    pub score_value: i32,
    pub score_details: Option<serde_json::Value>,
    pub predicted_mortality: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDeviceRequest {
    pub device_type: String,
    pub site: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBundleCheckRequest {
    pub is_compliant: bool,
    pub still_needed: bool,
    pub checklist: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNutritionRequest {
    pub route: String,
    pub formula_name: Option<String>,
    pub rate_ml_hr: Option<f64>,
    pub calories_kcal: Option<f64>,
    pub protein_gm: Option<f64>,
    pub volume_ml: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNeonatalRequest {
    pub gestational_age_weeks: Option<i32>,
    pub birth_weight_gm: Option<i32>,
    pub current_weight_gm: Option<i32>,
    pub bilirubin_total: Option<f64>,
    pub bilirubin_direct: Option<f64>,
    pub phototherapy_active: Option<bool>,
    pub phototherapy_hours: Option<f64>,
    pub breast_milk_type: Option<String>,
    pub breast_milk_volume_ml: Option<f64>,
    pub hearing_screen_result: Option<String>,
    pub sepsis_screen_result: Option<String>,
    pub mother_patient_id: Option<Uuid>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Flowsheets
// ══════════════════════════════════════════════════════════

pub async fn list_flowsheets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IcuFlowsheet>>, AppError> {
    require_permission(&claims, permissions::icu::flowsheets::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IcuFlowsheet>(
        "SELECT * FROM icu_flowsheets WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_flowsheet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateFlowsheetRequest>,
) -> Result<Json<IcuFlowsheet>, AppError> {
    require_permission(&claims, permissions::icu::flowsheets::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuFlowsheet>(
        "INSERT INTO icu_flowsheets \
         (tenant_id, admission_id, recorded_by, heart_rate, systolic_bp, diastolic_bp, \
          mean_arterial_bp, respiratory_rate, spo2, temperature, cvp, \
          intake_ml, output_ml, urine_ml, drain_ml, infusions, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(claims.sub)
    .bind(body.heart_rate)
    .bind(body.systolic_bp)
    .bind(body.diastolic_bp)
    .bind(body.mean_arterial_bp)
    .bind(body.respiratory_rate)
    .bind(body.spo2)
    .bind(body.temperature)
    .bind(body.cvp)
    .bind(body.intake_ml)
    .bind(body.output_ml)
    .bind(body.urine_ml)
    .bind(body.drain_ml)
    .bind(&body.infusions)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Ventilator Records
// ══════════════════════════════════════════════════════════

pub async fn list_ventilator_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IcuVentilatorRecord>>, AppError> {
    require_permission(&claims, permissions::icu::ventilator::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IcuVentilatorRecord>(
        "SELECT * FROM icu_ventilator_records WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_ventilator_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateVentilatorRequest>,
) -> Result<Json<IcuVentilatorRecord>, AppError> {
    require_permission(&claims, permissions::icu::ventilator::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuVentilatorRecord>(
        "INSERT INTO icu_ventilator_records \
         (tenant_id, admission_id, recorded_by, mode, fio2, peep, tidal_volume, \
          respiratory_rate, pip, plateau_pressure, ph, pao2, paco2, hco3, sao2, lactate, notes) \
         VALUES ($1, $2, $3, $4::ventilator_mode, $5, $6, $7, $8, $9, $10, \
                 $11, $12, $13, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(claims.sub)
    .bind(&body.mode)
    .bind(body.fio2)
    .bind(body.peep)
    .bind(body.tidal_volume)
    .bind(body.respiratory_rate)
    .bind(body.pip)
    .bind(body.plateau_pressure)
    .bind(body.ph)
    .bind(body.pao2)
    .bind(body.paco2)
    .bind(body.hco3)
    .bind(body.sao2)
    .bind(body.lactate)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Critical Care Scores
// ══════════════════════════════════════════════════════════

pub async fn list_scores(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IcuScore>>, AppError> {
    require_permission(&claims, permissions::icu::scores::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IcuScore>(
        "SELECT * FROM icu_scores WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY scored_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_score(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateScoreRequest>,
) -> Result<Json<IcuScore>, AppError> {
    require_permission(&claims, permissions::icu::scores::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuScore>(
        "INSERT INTO icu_scores \
         (tenant_id, admission_id, score_type, score_value, score_details, \
          predicted_mortality, scored_by, notes) \
         VALUES ($1, $2, $3::icu_score_type, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&body.score_type)
    .bind(body.score_value)
    .bind(&body.score_details)
    .bind(body.predicted_mortality)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Device / Bundle Tracking
// ══════════════════════════════════════════════════════════

pub async fn list_devices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IcuDevice>>, AppError> {
    require_permission(&claims, permissions::icu::devices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IcuDevice>(
        "SELECT * FROM icu_devices WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY inserted_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_device(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateDeviceRequest>,
) -> Result<Json<IcuDevice>, AppError> {
    require_permission(&claims, permissions::icu::devices::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuDevice>(
        "INSERT INTO icu_devices \
         (tenant_id, admission_id, device_type, inserted_by, site, notes) \
         VALUES ($1, $2, $3::device_type, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(&body.device_type)
    .bind(claims.sub)
    .bind(&body.site)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn remove_device(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_admission_id, device_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<IcuDevice>, AppError> {
    require_permission(&claims, permissions::icu::devices::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuDevice>(
        "UPDATE icu_devices SET \
         is_active = false, removed_at = now(), removed_by = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(device_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_bundle_checks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_admission_id, device_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<IcuBundleCheck>>, AppError> {
    require_permission(&claims, permissions::icu::devices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IcuBundleCheck>(
        "SELECT * FROM icu_bundle_checks WHERE device_id = $1 AND tenant_id = $2 \
         ORDER BY checked_at DESC",
    )
    .bind(device_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_bundle_check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_admission_id, device_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<CreateBundleCheckRequest>,
) -> Result<Json<IcuBundleCheck>, AppError> {
    require_permission(&claims, permissions::icu::devices::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuBundleCheck>(
        "INSERT INTO icu_bundle_checks \
         (tenant_id, device_id, checked_by, is_compliant, still_needed, checklist, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(device_id)
    .bind(claims.sub)
    .bind(body.is_compliant)
    .bind(body.still_needed)
    .bind(&body.checklist)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Nutrition Tracking
// ══════════════════════════════════════════════════════════

pub async fn list_nutrition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IcuNutrition>>, AppError> {
    require_permission(&claims, permissions::icu::nutrition::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IcuNutrition>(
        "SELECT * FROM icu_nutrition WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_nutrition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateNutritionRequest>,
) -> Result<Json<IcuNutrition>, AppError> {
    require_permission(&claims, permissions::icu::nutrition::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuNutrition>(
        "INSERT INTO icu_nutrition \
         (tenant_id, admission_id, recorded_by, route, formula_name, \
          rate_ml_hr, calories_kcal, protein_gm, volume_ml, notes) \
         VALUES ($1, $2, $3, $4::nutrition_route, $5, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(claims.sub)
    .bind(&body.route)
    .bind(&body.formula_name)
    .bind(body.rate_ml_hr)
    .bind(body.calories_kcal)
    .bind(body.protein_gm)
    .bind(body.volume_ml)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  NICU Records
// ══════════════════════════════════════════════════════════

pub async fn list_neonatal_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<IcuNeonatalRecord>>, AppError> {
    require_permission(&claims, permissions::icu::neonatal::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IcuNeonatalRecord>(
        "SELECT * FROM icu_neonatal_records WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at DESC",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_neonatal_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Json(body): Json<CreateNeonatalRequest>,
) -> Result<Json<IcuNeonatalRecord>, AppError> {
    require_permission(&claims, permissions::icu::neonatal::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcuNeonatalRecord>(
        "INSERT INTO icu_neonatal_records \
         (tenant_id, admission_id, recorded_by, gestational_age_weeks, birth_weight_gm, \
          current_weight_gm, bilirubin_total, bilirubin_direct, phototherapy_active, \
          phototherapy_hours, breast_milk_type, breast_milk_volume_ml, \
          hearing_screen_result, sepsis_screen_result, mother_patient_id, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(claims.sub)
    .bind(body.gestational_age_weeks)
    .bind(body.birth_weight_gm)
    .bind(body.current_weight_gm)
    .bind(body.bilirubin_total)
    .bind(body.bilirubin_direct)
    .bind(body.phototherapy_active.unwrap_or(false))
    .bind(body.phototherapy_hours)
    .bind(&body.breast_milk_type)
    .bind(body.breast_milk_volume_ml)
    .bind(&body.hearing_screen_result)
    .bind(&body.sepsis_screen_result)
    .bind(body.mother_patient_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  LOS & Readmission Analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LosAnalytics {
    pub total_admissions: i64,
    pub avg_los_days: Option<f64>,
    pub median_los_days: Option<f64>,
    pub readmission_count: i64,
    pub readmission_rate: Option<f64>,
}

pub async fn get_los_analytics(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<LosAnalytics>, AppError> {
    require_permission(&claims, permissions::icu::flowsheets::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LosAnalytics>(
        "WITH icu_stays AS ( \
            SELECT a.patient_id, \
                   a.admitted_at, \
                   a.discharged_at, \
                   EXTRACT(EPOCH FROM (COALESCE(a.discharged_at, NOW()) - a.admitted_at)) \
                       / 86400.0 AS los_days \
            FROM admissions a \
            WHERE EXISTS (SELECT 1 FROM icu_flowsheets f WHERE f.admission_id = a.id) \
              AND a.admitted_at >= CURRENT_DATE - INTERVAL '90 days' \
        ), \
        readmissions AS ( \
            SELECT COUNT(*)::bigint AS cnt FROM ( \
                SELECT patient_id FROM icu_stays \
                GROUP BY patient_id HAVING COUNT(*) > 1 \
            ) sub \
        ) \
        SELECT \
            COUNT(*)::bigint AS total_admissions, \
            AVG(los_days) AS avg_los_days, \
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY los_days) AS median_los_days, \
            (SELECT cnt FROM readmissions) AS readmission_count, \
            CASE WHEN COUNT(*) > 0 \
                 THEN (SELECT cnt FROM readmissions)::float / COUNT(*)::float * 100.0 \
                 ELSE 0.0 END AS readmission_rate \
        FROM icu_stays",
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Device Infection Rates
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeviceInfectionRate {
    pub device_type: String,
    pub total_device_days: i64,
    pub infection_count: i64,
    pub rate_per_1000: Option<f64>,
}

pub async fn get_device_infection_rates(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<DeviceInfectionRate>>, AppError> {
    require_permission(&claims, permissions::icu::devices::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DeviceInfectionRate>(
        "SELECT \
            d.device_type::text AS device_type, \
            SUM(EXTRACT(EPOCH FROM (COALESCE(d.removed_at, NOW()) - d.inserted_at)) \
                / 86400.0)::bigint AS total_device_days, \
            COALESCE(( \
                SELECT COUNT(*)::bigint FROM infection_surveillance_events ise \
                WHERE ise.device_type = d.device_type::text \
                  AND ise.created_at >= CURRENT_DATE - INTERVAL '90 days' \
            ), 0) AS infection_count, \
            CASE WHEN SUM(EXTRACT(EPOCH FROM (COALESCE(d.removed_at, NOW()) - d.inserted_at)) \
                / 86400.0) > 0 \
                 THEN COALESCE(( \
                    SELECT COUNT(*)::float FROM infection_surveillance_events ise \
                    WHERE ise.device_type = d.device_type::text \
                      AND ise.created_at >= CURRENT_DATE - INTERVAL '90 days' \
                 ), 0) / SUM(EXTRACT(EPOCH FROM (COALESCE(d.removed_at, NOW()) - d.inserted_at)) \
                    / 86400.0)::float * 1000.0 \
                 ELSE 0.0 END AS rate_per_1000 \
        FROM icu_devices d \
        WHERE d.inserted_at >= CURRENT_DATE - INTERVAL '90 days' \
        GROUP BY d.device_type \
        ORDER BY total_device_days DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
