#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::specialty::cath_lab::{
    CathDevice, CathHemodynamic, CathPostMonitoring, CathProcedure, CathStemiTimeline,
};
use medbrains_core::specialty::endoscopy::{
    EndoscopyBiopsySpecimen, EndoscopyProcedure, EndoscopyReprocessing, EndoscopyScope,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Cath Lab ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCathProceduresQuery {
    pub status: Option<String>,
    pub procedure_type: Option<String>,
    pub is_stemi: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCathProcedureRequest {
    pub patient_id: Uuid,
    pub procedure_type: String,
    pub operator_id: Uuid,
    pub assistant_ids: Option<Vec<Uuid>>,
    pub is_stemi: Option<bool>,
    pub access_site: Option<String>,
    pub contrast_type: Option<String>,
    pub scheduled_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCathProcedureRequest {
    pub status: Option<String>,
    pub fluoroscopy_time_seconds: Option<i32>,
    pub total_dap: Option<f64>,
    pub total_air_kerma: Option<f64>,
    pub contrast_volume_ml: Option<f64>,
    pub findings: Option<serde_json::Value>,
    pub complications: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHemodynamicRequest {
    pub site: String,
    pub systolic_mmhg: Option<f64>,
    pub diastolic_mmhg: Option<f64>,
    pub mean_mmhg: Option<f64>,
    pub saturation_pct: Option<f64>,
    pub gradient_mmhg: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCathDeviceRequest {
    pub device_type: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub lot_number: Option<String>,
    pub barcode: Option<String>,
    pub size: Option<String>,
    pub is_consignment: Option<bool>,
    pub vendor_id: Option<Uuid>,
    pub unit_cost: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStemiTimelineRequest {
    pub event: String,
    pub event_time: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostMonitoringRequest {
    pub sheath_status: Option<String>,
    pub access_site_status: Option<String>,
    pub vitals: Option<serde_json::Value>,
    pub ambulation_started: Option<bool>,
    pub notes: Option<String>,
}

// ── Endoscopy ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEndoscopyProceduresQuery {
    pub status: Option<String>,
    pub procedure_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEndoscopyProcedureRequest {
    pub patient_id: Uuid,
    pub scope_id: Option<Uuid>,
    pub procedure_type: String,
    pub operator_id: Uuid,
    pub sedation_type: Option<String>,
    pub scheduled_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEndoscopyProcedureRequest {
    pub status: Option<String>,
    pub sedation_drugs: Option<serde_json::Value>,
    pub findings: Option<serde_json::Value>,
    pub biopsy_taken: Option<bool>,
    pub aldrete_score_pre: Option<i32>,
    pub aldrete_score_post: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListScopesQuery {
    pub status: Option<String>,
    pub scope_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScopeRequest {
    pub serial_number: String,
    pub model: String,
    pub scope_type: String,
    pub manufacturer: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScopeRequest {
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReprocessingRequest {
    pub scope_id: Uuid,
    pub procedure_id: Option<Uuid>,
    pub leak_test_passed: Option<bool>,
    pub hld_chemical: String,
    pub hld_concentration: Option<f64>,
    pub hld_soak_minutes: i32,
    pub hld_temperature: Option<f64>,
    pub hld_result: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBiopsySpecimenRequest {
    pub site: String,
    pub container_label: String,
    pub fixative: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Cath Lab Procedures
// ══════════════════════════════════════════════════════════

pub async fn list_cath_procedures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCathProceduresQuery>,
) -> Result<Json<Vec<CathProcedure>>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::procedures::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, CathProcedure>(
        "SELECT * FROM cath_procedures \
         WHERE ($1::text IS NULL OR status = $1) \
         AND ($2::text IS NULL OR procedure_type::text = $2) \
         AND ($3::bool IS NULL OR is_stemi = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.procedure_type)
    .bind(params.is_stemi)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_cath_procedure(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CathProcedure>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::procedures::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CathProcedure>("SELECT * FROM cath_procedures WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_cath_procedure(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCathProcedureRequest>,
) -> Result<Json<CathProcedure>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::cath_lab::procedures::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CathProcedure>(
        "INSERT INTO cath_procedures \
         (tenant_id, patient_id, procedure_type, operator_id, assistant_ids, \
          is_stemi, access_site, contrast_type, scheduled_at, notes) \
         VALUES ($1, $2, $3::cath_procedure_type, $4, COALESCE($5, '{}'), \
                 COALESCE($6, false), $7, $8, $9::timestamptz, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.procedure_type)
    .bind(body.operator_id)
    .bind(body.assistant_ids.unwrap_or_default())
    .bind(body.is_stemi)
    .bind(&body.access_site)
    .bind(&body.contrast_type)
    .bind(&body.scheduled_at)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_cath_procedure(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCathProcedureRequest>,
) -> Result<Json<CathProcedure>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::cath_lab::procedures::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CathProcedure>(
        "UPDATE cath_procedures SET \
         status = COALESCE($2, status), \
         fluoroscopy_time_seconds = COALESCE($3, fluoroscopy_time_seconds), \
         total_dap = COALESCE($4, total_dap), \
         total_air_kerma = COALESCE($5, total_air_kerma), \
         contrast_volume_ml = COALESCE($6, contrast_volume_ml), \
         findings = COALESCE($7, findings), \
         complications = COALESCE($8, complications), \
         notes = COALESCE($9, notes), \
         started_at = CASE WHEN $2 = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END, \
         completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE completed_at END \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(body.fluoroscopy_time_seconds)
    .bind(body.total_dap)
    .bind(body.total_air_kerma)
    .bind(body.contrast_volume_ml)
    .bind(&body.findings)
    .bind(&body.complications)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Hemodynamics ─────────────────────────────────────────

pub async fn list_hemodynamics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
) -> Result<Json<Vec<CathHemodynamic>>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::procedures::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, CathHemodynamic>(
        "SELECT * FROM cath_hemodynamics WHERE procedure_id = $1 ORDER BY recorded_at",
    )
    .bind(procedure_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_hemodynamic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
    Json(body): Json<CreateHemodynamicRequest>,
) -> Result<Json<CathHemodynamic>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::cath_lab::procedures::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CathHemodynamic>(
        "INSERT INTO cath_hemodynamics \
         (tenant_id, procedure_id, site, systolic_mmhg, diastolic_mmhg, \
          mean_mmhg, saturation_pct, gradient_mmhg) \
         VALUES ($1, $2, $3::hemodynamic_site, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(procedure_id)
    .bind(&body.site)
    .bind(body.systolic_mmhg)
    .bind(body.diastolic_mmhg)
    .bind(body.mean_mmhg)
    .bind(body.saturation_pct)
    .bind(body.gradient_mmhg)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Devices ──────────────────────────────────────────────

pub async fn list_cath_devices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
) -> Result<Json<Vec<CathDevice>>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::devices::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, CathDevice>(
        "SELECT * FROM cath_devices WHERE procedure_id = $1 ORDER BY created_at",
    )
    .bind(procedure_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_cath_device(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
    Json(body): Json<CreateCathDeviceRequest>,
) -> Result<Json<CathDevice>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::devices::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CathDevice>(
        "INSERT INTO cath_devices \
         (tenant_id, procedure_id, device_type, manufacturer, model, \
          lot_number, barcode, size, is_consignment, vendor_id, unit_cost) \
         VALUES ($1, $2, $3::cath_device_type, $4, $5, $6, $7, $8, \
                 COALESCE($9, false), $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(procedure_id)
    .bind(&body.device_type)
    .bind(&body.manufacturer)
    .bind(&body.model)
    .bind(&body.lot_number)
    .bind(&body.barcode)
    .bind(&body.size)
    .bind(body.is_consignment)
    .bind(body.vendor_id)
    .bind(body.unit_cost)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── STEMI Timeline ───────────────────────────────────────

pub async fn list_stemi_timeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
) -> Result<Json<Vec<CathStemiTimeline>>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::stemi::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, CathStemiTimeline>(
        "SELECT * FROM cath_stemi_timeline WHERE procedure_id = $1 ORDER BY event_time",
    )
    .bind(procedure_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_stemi_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
    Json(body): Json<CreateStemiTimelineRequest>,
) -> Result<Json<CathStemiTimeline>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::stemi::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CathStemiTimeline>(
        "INSERT INTO cath_stemi_timeline \
         (tenant_id, procedure_id, event, event_time, recorded_by, notes) \
         VALUES ($1, $2, $3::stemi_pathway_status, $4::timestamptz, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(procedure_id)
    .bind(&body.event)
    .bind(&body.event_time)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-calculate door-to-balloon time if balloon_inflation event
    if body.event == "balloon_inflation" {
        let _ = sqlx::query(
            "UPDATE cath_procedures SET \
             balloon_time = $2::timestamptz, \
             door_to_balloon_minutes = EXTRACT(EPOCH FROM ($2::timestamptz - door_time)) / 60 \
             WHERE id = $1 AND door_time IS NOT NULL",
        )
        .bind(procedure_id)
        .bind(&body.event_time)
        .execute(&mut *tx)
        .await;
    }

    if body.event == "door" {
        let _ = sqlx::query("UPDATE cath_procedures SET door_time = $2::timestamptz WHERE id = $1")
            .bind(procedure_id)
            .bind(&body.event_time)
            .execute(&mut *tx)
            .await;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ── Post-Procedure Monitoring ────────────────────────────

pub async fn list_post_monitoring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
) -> Result<Json<Vec<CathPostMonitoring>>, AppError> {
    require_permission(&claims, permissions::specialty::cath_lab::monitoring::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, CathPostMonitoring>(
        "SELECT * FROM cath_post_monitoring WHERE procedure_id = $1 ORDER BY monitored_at",
    )
    .bind(procedure_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_post_monitoring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
    Json(body): Json<CreatePostMonitoringRequest>,
) -> Result<Json<CathPostMonitoring>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::cath_lab::monitoring::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CathPostMonitoring>(
        "INSERT INTO cath_post_monitoring \
         (tenant_id, procedure_id, sheath_status, access_site_status, \
          vitals, ambulation_started, monitored_by, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, '{}'::jsonb), \
                 COALESCE($6, false), $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(procedure_id)
    .bind(&body.sheath_status)
    .bind(&body.access_site_status)
    .bind(&body.vitals)
    .bind(body.ambulation_started)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Endoscopy
// ══════════════════════════════════════════════════════════

pub async fn list_endoscopy_procedures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEndoscopyProceduresQuery>,
) -> Result<Json<Vec<EndoscopyProcedure>>, AppError> {
    require_permission(&claims, permissions::specialty::endoscopy::procedures::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, EndoscopyProcedure>(
        "SELECT * FROM endoscopy_procedures \
         WHERE ($1::text IS NULL OR status = $1) \
         AND ($2::text IS NULL OR procedure_type = $2) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.procedure_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_endoscopy_procedure(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEndoscopyProcedureRequest>,
) -> Result<Json<EndoscopyProcedure>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::endoscopy::procedures::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, EndoscopyProcedure>(
        "INSERT INTO endoscopy_procedures \
         (tenant_id, patient_id, scope_id, procedure_type, operator_id, \
          sedation_type, scheduled_at, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.scope_id)
    .bind(&body.procedure_type)
    .bind(body.operator_id)
    .bind(&body.sedation_type)
    .bind(&body.scheduled_at)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_endoscopy_procedure(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEndoscopyProcedureRequest>,
) -> Result<Json<EndoscopyProcedure>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::endoscopy::procedures::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, EndoscopyProcedure>(
        "UPDATE endoscopy_procedures SET \
         status = COALESCE($2, status), \
         sedation_drugs = COALESCE($3, sedation_drugs), \
         findings = COALESCE($4, findings), \
         biopsy_taken = COALESCE($5, biopsy_taken), \
         aldrete_score_pre = COALESCE($6, aldrete_score_pre), \
         aldrete_score_post = COALESCE($7, aldrete_score_post), \
         notes = COALESCE($8, notes), \
         started_at = CASE WHEN $2 = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END, \
         completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE completed_at END \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.sedation_drugs)
    .bind(&body.findings)
    .bind(body.biopsy_taken)
    .bind(body.aldrete_score_pre)
    .bind(body.aldrete_score_post)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Scopes ───────────────────────────────────────────────

pub async fn list_scopes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListScopesQuery>,
) -> Result<Json<Vec<EndoscopyScope>>, AppError> {
    require_permission(&claims, permissions::specialty::endoscopy::scopes::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, EndoscopyScope>(
        "SELECT * FROM endoscopy_scopes \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR scope_type = $2) \
         ORDER BY serial_number",
    )
    .bind(&params.status)
    .bind(&params.scope_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_scope(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScopeRequest>,
) -> Result<Json<EndoscopyScope>, AppError> {
    require_permission(&claims, permissions::specialty::endoscopy::scopes::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, EndoscopyScope>(
        "INSERT INTO endoscopy_scopes \
         (tenant_id, serial_number, model, scope_type, manufacturer, notes) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.serial_number)
    .bind(&body.model)
    .bind(&body.scope_type)
    .bind(&body.manufacturer)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_scope(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateScopeRequest>,
) -> Result<Json<EndoscopyScope>, AppError> {
    require_permission(&claims, permissions::specialty::endoscopy::scopes::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, EndoscopyScope>(
        "UPDATE endoscopy_scopes SET \
         status = COALESCE($2::scope_status, status), \
         notes = COALESCE($3, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Reprocessing ─────────────────────────────────────────

pub async fn list_reprocessing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<EndoscopyReprocessing>>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::endoscopy::reprocessing::LIST,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, EndoscopyReprocessing>(
        "SELECT * FROM endoscopy_reprocessing ORDER BY reprocessed_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_reprocessing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReprocessingRequest>,
) -> Result<Json<EndoscopyReprocessing>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::endoscopy::reprocessing::MANAGE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, EndoscopyReprocessing>(
        "INSERT INTO endoscopy_reprocessing \
         (tenant_id, scope_id, procedure_id, leak_test_passed, hld_chemical, \
          hld_concentration, hld_soak_minutes, hld_temperature, hld_result, \
          reprocessed_by, notes) \
         VALUES ($1, $2, $3, COALESCE($4, true), $5, $6, $7, $8, \
                 COALESCE($9::hld_result, 'pending'), $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.scope_id)
    .bind(body.procedure_id)
    .bind(body.leak_test_passed)
    .bind(&body.hld_chemical)
    .bind(body.hld_concentration)
    .bind(body.hld_soak_minutes)
    .bind(body.hld_temperature)
    .bind(&body.hld_result)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Update scope status and usage count
    let _ = sqlx::query(
        "UPDATE endoscopy_scopes SET \
         last_hld_at = now(), \
         total_uses = total_uses + 1, \
         status = 'available' \
         WHERE id = $1",
    )
    .bind(body.scope_id)
    .execute(&mut *tx)
    .await;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Biopsy Specimens ─────────────────────────────────────

pub async fn list_biopsy_specimens(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
) -> Result<Json<Vec<EndoscopyBiopsySpecimen>>, AppError> {
    require_permission(&claims, permissions::specialty::endoscopy::procedures::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, EndoscopyBiopsySpecimen>(
        "SELECT * FROM endoscopy_biopsy_specimens WHERE procedure_id = $1 ORDER BY created_at",
    )
    .bind(procedure_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_biopsy_specimen(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(procedure_id): Path<Uuid>,
    Json(body): Json<CreateBiopsySpecimenRequest>,
) -> Result<Json<EndoscopyBiopsySpecimen>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::endoscopy::procedures::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, EndoscopyBiopsySpecimen>(
        "INSERT INTO endoscopy_biopsy_specimens \
         (tenant_id, procedure_id, site, container_label, fixative) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(procedure_id)
    .bind(&body.site)
    .bind(&body.container_label)
    .bind(&body.fixative)
    .fetch_one(&mut *tx)
    .await?;

    // Mark procedure as having biopsy
    let _ = sqlx::query("UPDATE endoscopy_procedures SET biopsy_taken = true WHERE id = $1")
        .bind(procedure_id)
        .execute(&mut *tx)
        .await;

    tx.commit().await?;
    Ok(Json(row))
}
