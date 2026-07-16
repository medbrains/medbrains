//! Nurse vitals + I/O handlers.
//!
//! Per RFCs/sprints/SPRINT-nurse-activities.md §3.4 + §3.5.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::consultation::Vital;
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Per-encounter access gate (ReBAC): the caller must be linked to the
/// encounter (its treating department, attending, or an explicit grant) to
/// read or write its nursing data. Returns `NotFound` (not `Forbidden`) so the
/// endpoint isn't an existence oracle. Composes on top of `require_permission`
/// (role authority) + tenant RLS. See RFC-PATIENT-ACCESS-CONTROL.
async fn require_encounter_access(
    state: &AppState,
    claims: &Claims,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(claims);
    let allowed = state
        .authz
        .check(&authz_ctx, medbrains_authz::Relation::Viewer, "encounter", encounter_id)
        .await
        .unwrap_or(false);
    if allowed {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

// ── vitals readings ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateVitalsReadingRequest {
    pub encounter_id: Uuid,
    pub temperature: Option<Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub notes: Option<String>,
}

pub async fn create_vitals_reading(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVitalsReadingRequest>,
) -> Result<Json<Vital>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::RECORD)?;
    require_encounter_access(&state, &claims, body.encounter_id).await?;

    let bmi = match (body.weight_kg, body.height_cm) {
        (Some(weight), Some(height)) if height > Decimal::ZERO => {
            let height_m = height / Decimal::from(100);
            Some(weight / (height_m * height_m))
        }
        _ => None,
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Vital>(
        "INSERT INTO vitals \
         (tenant_id, encounter_id, recorded_by, temperature, pulse, \
          systolic_bp, diastolic_bp, respiratory_rate, spo2, \
          weight_kg, height_cm, bmi, notes, recorded_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(body.temperature)
    .bind(body.pulse)
    .bind(body.systolic_bp)
    .bind(body.diastolic_bp)
    .bind(body.respiratory_rate)
    .bind(body.spo2)
    .bind(body.weight_kg)
    .bind(body.height_cm)
    .bind(bmi)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE vitals_capture_schedules SET last_captured_at = now(), \
           next_due_at = now() + (frequency_minutes::text || ' minutes')::interval \
         WHERE tenant_id = $1 AND encounter_id = $2 AND ended_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_vitals_for_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<Vital>>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::VIEW)?;
    require_encounter_access(&state, &claims, encounter_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Vital>(
        "SELECT * FROM vitals WHERE tenant_id = $1 AND encounter_id = $2 \
         ORDER BY recorded_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── vitals_capture_schedules ────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VitalsSchedule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub frequency_minutes: i32,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub next_due_at: DateTime<Utc>,
    pub last_captured_at: Option<DateTime<Utc>>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVitalsScheduleRequest {
    pub encounter_id: Uuid,
    pub frequency_minutes: i32,
}

pub async fn create_vitals_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVitalsScheduleRequest>,
) -> Result<Json<VitalsSchedule>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::RECORD)?;
    require_encounter_access(&state, &claims, body.encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let next_due = Utc::now() + Duration::minutes(i64::from(body.frequency_minutes));
    let row = sqlx::query_as::<_, VitalsSchedule>(
        "INSERT INTO vitals_capture_schedules \
         (tenant_id, encounter_id, frequency_minutes, next_due_at, created_by) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(body.frequency_minutes)
    .bind(next_due)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListVitalsSchedulesQuery {
    pub encounter_id: Option<Uuid>,
    pub due_only: Option<bool>,
}

pub async fn list_vitals_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListVitalsSchedulesQuery>,
) -> Result<Json<Vec<VitalsSchedule>>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::VIEW)?;
    if let Some(eid) = q.encounter_id {
        require_encounter_access(&state, &claims, eid).await?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let due_only = q.due_only.unwrap_or(false);
    let rows = sqlx::query_as::<_, VitalsSchedule>(
        "SELECT * FROM vitals_capture_schedules \
         WHERE tenant_id = $1 \
           AND ended_at IS NULL \
           AND ($2::uuid IS NULL OR encounter_id = $2) \
           AND ($3::bool = false OR next_due_at <= now() + interval '15 minutes') \
         ORDER BY next_due_at LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.encounter_id)
    .bind(due_only)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn end_vitals_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<VitalsSchedule>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Resolve the schedule's encounter, then gate on encounter access.
    let encounter_id: Uuid = sqlx::query_scalar(
        "SELECT encounter_id FROM vitals_capture_schedules WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    require_encounter_access(&state, &claims, encounter_id).await?;

    let row = sqlx::query_as::<_, VitalsSchedule>(
        "UPDATE vitals_capture_schedules SET ended_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND ended_at IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── intake_output_entries ───────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IoEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub category: String,
    pub direction: String,
    pub volume_ml: i32,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIoEntryRequest {
    pub encounter_id: Uuid,
    pub category: String,
    pub direction: String,
    pub volume_ml: i32,
    pub notes: Option<String>,
}

pub async fn create_io_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIoEntryRequest>,
) -> Result<Json<IoEntry>, AppError> {
    require_permission(&claims, permissions::nurse::intake_output::RECORD)?;
    require_encounter_access(&state, &claims, body.encounter_id).await?;
    if body.volume_ml <= 0 {
        return Err(AppError::BadRequest("volume_ml must be > 0".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IoEntry>(
        "INSERT INTO intake_output_entries \
         (tenant_id, encounter_id, recorded_by, category, direction, volume_ml, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(&body.category)
    .bind(&body.direction)
    .bind(body.volume_ml)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_io_for_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<IoEntry>>, AppError> {
    require_permission(&claims, permissions::nurse::intake_output::VIEW)?;
    require_encounter_access(&state, &claims, encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IoEntry>(
        "SELECT * FROM intake_output_entries \
         WHERE tenant_id = $1 AND encounter_id = $2 \
         ORDER BY recorded_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IoBalance {
    pub encounter_id: Uuid,
    pub intake_total: i64,
    pub output_total: i64,
    pub balance: i64,
    pub since: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct IoBalanceQuery {
    pub since_hours: Option<i64>,
}

pub async fn io_balance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Query(q): Query<IoBalanceQuery>,
) -> Result<Json<IoBalance>, AppError> {
    require_permission(&claims, permissions::nurse::intake_output::VIEW)?;
    require_encounter_access(&state, &claims, encounter_id).await?;
    let hours = q.since_hours.unwrap_or(24).clamp(1, 720);
    let since = Utc::now() - Duration::hours(hours);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: (Option<i64>, Option<i64>) = sqlx::query_as(
        "SELECT \
           COALESCE(SUM(CASE WHEN direction='intake' THEN volume_ml ELSE 0 END), 0)::bigint, \
           COALESCE(SUM(CASE WHEN direction='output' THEN volume_ml ELSE 0 END), 0)::bigint \
         FROM intake_output_entries \
         WHERE tenant_id = $1 AND encounter_id = $2 AND recorded_at >= $3",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(since)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    let intake = row.0.unwrap_or(0);
    let output = row.1.unwrap_or(0);
    Ok(Json(IoBalance {
        encounter_id,
        intake_total: intake,
        output_total: output,
        balance: intake - output,
        since,
    }))
}

// ── pain_score_entries ──────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PainEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub scale: String,
    pub score: i32,
    pub location: Option<String>,
    pub character: Option<String>,
    pub intervention_taken: Option<String>,
    pub recheck_due_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePainEntryRequest {
    pub encounter_id: Uuid,
    pub scale: String,
    pub score: i32,
    pub location: Option<String>,
    pub character: Option<String>,
    pub intervention_taken: Option<String>,
    pub recheck_due_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

pub async fn create_pain_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePainEntryRequest>,
) -> Result<Json<PainEntry>, AppError> {
    require_permission(&claims, permissions::nurse::pain::RECORD)?;
    require_encounter_access(&state, &claims, body.encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PainEntry>(
        "INSERT INTO pain_score_entries \
         (tenant_id, encounter_id, recorded_by, scale, score, location, character, \
          intervention_taken, recheck_due_at, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(&body.scale)
    .bind(body.score)
    .bind(&body.location)
    .bind(&body.character)
    .bind(&body.intervention_taken)
    .bind(body.recheck_due_at)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_pain_for_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<PainEntry>>, AppError> {
    require_permission(&claims, permissions::nurse::pain::VIEW)?;
    require_encounter_access(&state, &claims, encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PainEntry>(
        "SELECT * FROM pain_score_entries \
         WHERE tenant_id = $1 AND encounter_id = $2 \
         ORDER BY recorded_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── fall_risk_assessments ───────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FallRiskRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub scale: String,
    pub score: i32,
    pub risk_level: String,
    pub interventions: serde_json::Value,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateFallRiskRequest {
    pub encounter_id: Uuid,
    pub scale: String,
    pub score: i32,
    pub risk_level: String,
    pub interventions: Option<serde_json::Value>,
}

pub async fn create_fall_risk(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFallRiskRequest>,
) -> Result<Json<FallRiskRow>, AppError> {
    require_permission(&claims, permissions::nurse::fall_risk::RECORD)?;
    require_encounter_access(&state, &claims, body.encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let interventions = body.interventions.unwrap_or_else(|| serde_json::json!([]));

    let row = sqlx::query_as::<_, FallRiskRow>(
        "INSERT INTO fall_risk_assessments \
         (tenant_id, encounter_id, scale, score, risk_level, interventions, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(&body.scale)
    .bind(body.score)
    .bind(&body.risk_level)
    .bind(interventions)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_fall_risk_for_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<FallRiskRow>>, AppError> {
    require_permission(&claims, permissions::nurse::fall_risk::VIEW)?;
    require_encounter_access(&state, &claims, encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FallRiskRow>(
        "SELECT * FROM fall_risk_assessments \
         WHERE tenant_id = $1 AND encounter_id = $2 \
         ORDER BY recorded_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
