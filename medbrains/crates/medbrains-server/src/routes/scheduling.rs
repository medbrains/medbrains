#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::scheduling::{
    NoshowPredictionScore, SchedulingOverbookingRule, SchedulingWaitlistEntry,
};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct AutoFillResult {
    pub waiting_count: i64,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct OverbookingRecommendation {
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub date: String,
    pub day_of_week: i32,
    pub max_overbook_slots: i32,
    pub threshold_probability: f64,
    pub recommendation: String,
}

#[derive(Debug, Serialize)]
pub struct PredictionAccuracyReport {
    pub model_version: String,
    pub total_predictions: i64,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct WaitlistStatsResponse {
    pub total_waiting: i64,
    pub total_offered: i64,
    pub total_booked: i64,
    pub avg_wait_days: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NoshowRateRow {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub total_appointments: i64,
    pub noshow_count: i64,
    pub noshow_rate: Option<f64>,
}

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Predictions ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPredictionsQuery {
    pub patient_id: Option<Uuid>,
    pub risk_level: Option<String>,
    pub appointment_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ScoreAppointmentRequest {
    pub appointment_id: Uuid,
    pub patient_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct ScoreBatchRequest {
    pub appointment_ids: Vec<Uuid>,
    pub patient_id: Uuid,
}

// ── Waitlist ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListWaitlistQuery {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWaitlistEntryRequest {
    pub patient_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub preferred_date_from: Option<chrono::NaiveDate>,
    pub preferred_date_to: Option<chrono::NaiveDate>,
    pub preferred_time_from: Option<chrono::NaiveTime>,
    pub preferred_time_to: Option<chrono::NaiveTime>,
    pub priority: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWaitlistEntryRequest {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub preferred_date_from: Option<chrono::NaiveDate>,
    pub preferred_date_to: Option<chrono::NaiveDate>,
    pub preferred_time_from: Option<chrono::NaiveTime>,
    pub preferred_time_to: Option<chrono::NaiveTime>,
    pub priority: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OfferSlotRequest {
    pub offered_appointment_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct RespondToOfferRequest {
    pub accept: bool,
}

// ── Overbooking ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListOverbookingRulesQuery {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOverbookingRuleRequest {
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub day_of_week: i32,
    pub max_overbook_slots: i32,
    pub overbook_threshold_probability: rust_decimal::Decimal,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOverbookingRuleRequest {
    pub day_of_week: Option<i32>,
    pub max_overbook_slots: Option<i32>,
    pub overbook_threshold_probability: Option<rust_decimal::Decimal>,
    pub is_active: Option<bool>,
}

// ── Analytics ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct OverbookingRecommendationQuery {
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub date: String,
}

#[derive(Debug, Deserialize)]
pub struct NoshowRatesQuery {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Predictions
// ══════════════════════════════════════════════════════════

pub async fn list_predictions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPredictionsQuery>,
) -> Result<Json<Vec<NoshowPredictionScore>>, AppError> {
    require_permission(&claims, permissions::scheduling::predictions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut sql = String::from("SELECT * FROM noshow_prediction_scores WHERE tenant_id = $1");
    let mut param_idx = 2u32;

    if params.patient_id.is_some() {
        sql.push_str(&format!(" AND patient_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.risk_level.is_some() {
        sql.push_str(&format!(" AND risk_level = ${param_idx}"));
        param_idx += 1;
    }
    if params.appointment_id.is_some() {
        sql.push_str(&format!(" AND appointment_id = ${param_idx}"));
        param_idx += 1;
    }

    // Suppress unused assignment warning
    let _ = param_idx;

    sql.push_str(" ORDER BY scored_at DESC LIMIT 200");

    let mut query = sqlx::query_as::<_, NoshowPredictionScore>(&sql).bind(claims.tenant_id);

    if let Some(pid) = params.patient_id {
        query = query.bind(pid);
    }
    if let Some(ref rl) = params.risk_level {
        query = query.bind(rl);
    }
    if let Some(aid) = params.appointment_id {
        query = query.bind(aid);
    }

    let rows = query.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn score_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ScoreAppointmentRequest>,
) -> Result<(StatusCode, Json<NoshowPredictionScore>), AppError> {
    require_permission(&claims, permissions::scheduling::predictions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Simple stub: hash appointment_id bytes to get a deterministic "probability"
    let bytes = body.appointment_id.as_bytes();
    let hash_val = bytes.iter().fold(0u32, |acc, &b| {
        acc.wrapping_mul(31).wrapping_add(u32::from(b))
    });
    let probability = f64::from(hash_val % 1000) / 1000.0;
    let probability_decimal =
        rust_decimal::Decimal::from_f64_retain(probability).unwrap_or(rust_decimal::Decimal::ZERO);

    let risk_level = if probability > 0.7 {
        "high"
    } else if probability > 0.4 {
        "medium"
    } else {
        "low"
    };

    let id = Uuid::new_v4();

    let row: NoshowPredictionScore = sqlx::query_as(
        "INSERT INTO noshow_prediction_scores \
         (id, tenant_id, appointment_id, patient_id, predicted_noshow_probability, \
          risk_level, features_used, model_version, scored_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.appointment_id)
    .bind(body.patient_id)
    .bind(probability_decimal)
    .bind(risk_level)
    .bind(serde_json::json!({"stub": true, "hash_based": true}))
    .bind("stub-v1.0")
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn score_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ScoreBatchRequest>,
) -> Result<(StatusCode, Json<Vec<NoshowPredictionScore>>), AppError> {
    require_permission(&claims, permissions::scheduling::predictions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut results = Vec::with_capacity(body.appointment_ids.len());

    for appointment_id in &body.appointment_ids {
        let bytes = appointment_id.as_bytes();
        let hash_val = bytes.iter().fold(0u32, |acc, &b| {
            acc.wrapping_mul(31).wrapping_add(u32::from(b))
        });
        let probability = f64::from(hash_val % 1000) / 1000.0;
        let probability_decimal = rust_decimal::Decimal::from_f64_retain(probability)
            .unwrap_or(rust_decimal::Decimal::ZERO);

        let risk_level = if probability > 0.7 {
            "high"
        } else if probability > 0.4 {
            "medium"
        } else {
            "low"
        };

        let id = Uuid::new_v4();

        let row: NoshowPredictionScore = sqlx::query_as(
            "INSERT INTO noshow_prediction_scores \
             (id, tenant_id, appointment_id, patient_id, predicted_noshow_probability, \
              risk_level, features_used, model_version, scored_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) \
             RETURNING *",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .bind(appointment_id)
        .bind(body.patient_id)
        .bind(probability_decimal)
        .bind(risk_level)
        .bind(serde_json::json!({"stub": true, "hash_based": true, "batch": true}))
        .bind("stub-v1.0")
        .fetch_one(&mut *tx)
        .await?;

        results.push(row);
    }

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(results)))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Waitlist
// ══════════════════════════════════════════════════════════

pub async fn list_waitlist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListWaitlistQuery>,
) -> Result<Json<Vec<SchedulingWaitlistEntry>>, AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut sql = String::from("SELECT * FROM scheduling_waitlist WHERE tenant_id = $1");
    let mut param_idx = 2u32;

    if params.doctor_id.is_some() {
        sql.push_str(&format!(" AND doctor_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.department_id.is_some() {
        sql.push_str(&format!(" AND department_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.status.is_some() {
        sql.push_str(&format!(" AND status = ${param_idx}"));
        param_idx += 1;
    }
    if params.priority.is_some() {
        sql.push_str(&format!(" AND priority = ${param_idx}"));
        param_idx += 1;
    }

    let _ = param_idx;

    sql.push_str(" ORDER BY created_at DESC LIMIT 200");

    let mut query = sqlx::query_as::<_, SchedulingWaitlistEntry>(&sql).bind(claims.tenant_id);

    if let Some(did) = params.doctor_id {
        query = query.bind(did);
    }
    if let Some(dept_id) = params.department_id {
        query = query.bind(dept_id);
    }
    if let Some(ref s) = params.status {
        query = query.bind(s);
    }
    if let Some(ref p) = params.priority {
        query = query.bind(p);
    }

    let rows = query.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_waitlist_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWaitlistEntryRequest>,
) -> Result<(StatusCode, Json<SchedulingWaitlistEntry>), AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let id = Uuid::new_v4();

    let row: SchedulingWaitlistEntry = sqlx::query_as(
        "INSERT INTO scheduling_waitlist \
         (id, tenant_id, patient_id, doctor_id, department_id, \
          preferred_date_from, preferred_date_to, preferred_time_from, preferred_time_to, \
          priority, status, reason, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'waiting', $11, $12) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.doctor_id)
    .bind(body.department_id)
    .bind(body.preferred_date_from)
    .bind(body.preferred_date_to)
    .bind(body.preferred_time_from)
    .bind(body.preferred_time_to)
    .bind(&body.priority)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn update_waitlist_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWaitlistEntryRequest>,
) -> Result<Json<SchedulingWaitlistEntry>, AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row: SchedulingWaitlistEntry = sqlx::query_as(
        "UPDATE scheduling_waitlist SET \
         doctor_id = COALESCE($3, doctor_id), \
         department_id = COALESCE($4, department_id), \
         preferred_date_from = COALESCE($5, preferred_date_from), \
         preferred_date_to = COALESCE($6, preferred_date_to), \
         preferred_time_from = COALESCE($7, preferred_time_from), \
         preferred_time_to = COALESCE($8, preferred_time_to), \
         priority = COALESCE($9, priority), \
         reason = COALESCE($10, reason), \
         updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.doctor_id)
    .bind(body.department_id)
    .bind(body.preferred_date_from)
    .bind(body.preferred_date_to)
    .bind(body.preferred_time_from)
    .bind(body.preferred_time_to)
    .bind(&body.priority)
    .bind(&body.reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn offer_slot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<OfferSlotRequest>,
) -> Result<Json<SchedulingWaitlistEntry>, AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row: SchedulingWaitlistEntry = sqlx::query_as(
        "UPDATE scheduling_waitlist SET \
         status = 'offered', \
         offered_appointment_id = $3, \
         updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.offered_appointment_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn respond_to_offer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RespondToOfferRequest>,
) -> Result<Json<SchedulingWaitlistEntry>, AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row: SchedulingWaitlistEntry = if body.accept {
        sqlx::query_as(
            "UPDATE scheduling_waitlist SET \
             status = 'booked', \
             updated_at = NOW() \
             WHERE id = $1 AND tenant_id = $2 \
             RETURNING *",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_as(
            "UPDATE scheduling_waitlist SET \
             status = 'waiting', \
             offered_appointment_id = NULL, \
             updated_at = NOW() \
             WHERE id = $1 AND tenant_id = $2 \
             RETURNING *",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn auto_fill_slots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AutoFillResult>, AppError> {
    require_permission(&claims, permissions::scheduling::AUTO_FILL_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Stub: count waiting entries that could be processed
    let (waiting_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scheduling_waitlist \
         WHERE tenant_id = $1 AND status = 'waiting'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(AutoFillResult {
        waiting_count,
        message: format!(
            "Found {waiting_count} waiting entries. Auto-fill is a stub — \
             real slot matching will be implemented with the AI prediction engine."
        ),
    }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Overbooking Rules
// ══════════════════════════════════════════════════════════

pub async fn list_overbooking_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOverbookingRulesQuery>,
) -> Result<Json<Vec<SchedulingOverbookingRule>>, AppError> {
    require_permission(&claims, permissions::scheduling::overbooking::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut sql = String::from("SELECT * FROM scheduling_overbooking_rules WHERE tenant_id = $1");
    let mut param_idx = 2u32;

    if params.doctor_id.is_some() {
        sql.push_str(&format!(" AND doctor_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.department_id.is_some() {
        sql.push_str(&format!(" AND department_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.is_active.is_some() {
        sql.push_str(&format!(" AND is_active = ${param_idx}"));
        param_idx += 1;
    }

    let _ = param_idx;

    sql.push_str(" ORDER BY doctor_id, day_of_week");

    let mut query = sqlx::query_as::<_, SchedulingOverbookingRule>(&sql).bind(claims.tenant_id);

    if let Some(did) = params.doctor_id {
        query = query.bind(did);
    }
    if let Some(dept_id) = params.department_id {
        query = query.bind(dept_id);
    }
    if let Some(active) = params.is_active {
        query = query.bind(active);
    }

    let rows = query.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_overbooking_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOverbookingRuleRequest>,
) -> Result<(StatusCode, Json<SchedulingOverbookingRule>), AppError> {
    require_permission(&claims, permissions::scheduling::overbooking::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let id = Uuid::new_v4();
    let is_active = body.is_active.unwrap_or(true);

    let row: SchedulingOverbookingRule = sqlx::query_as(
        "INSERT INTO scheduling_overbooking_rules \
         (id, tenant_id, doctor_id, department_id, day_of_week, \
          max_overbook_slots, overbook_threshold_probability, is_active) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.doctor_id)
    .bind(body.department_id)
    .bind(body.day_of_week)
    .bind(body.max_overbook_slots)
    .bind(body.overbook_threshold_probability)
    .bind(is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn update_overbooking_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOverbookingRuleRequest>,
) -> Result<Json<SchedulingOverbookingRule>, AppError> {
    require_permission(&claims, permissions::scheduling::overbooking::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row: SchedulingOverbookingRule = sqlx::query_as(
        "UPDATE scheduling_overbooking_rules SET \
         day_of_week = COALESCE($3, day_of_week), \
         max_overbook_slots = COALESCE($4, max_overbook_slots), \
         overbook_threshold_probability = COALESCE($5, overbook_threshold_probability), \
         is_active = COALESCE($6, is_active), \
         updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.day_of_week)
    .bind(body.max_overbook_slots)
    .bind(body.overbook_threshold_probability)
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_overbooking_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::scheduling::overbooking::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM scheduling_overbooking_rules WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_overbooking_recommendation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<OverbookingRecommendationQuery>,
) -> Result<Json<OverbookingRecommendation>, AppError> {
    require_permission(&claims, permissions::scheduling::overbooking::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Parse the date to determine day_of_week (0=Sunday .. 6=Saturday in chrono)
    let parsed_date = chrono::NaiveDate::parse_from_str(&params.date, "%Y-%m-%d")
        .map_err(|e| AppError::BadRequest(format!("Invalid date format: {e}")))?;
    let day_of_week = parsed_date
        .format("%w")
        .to_string()
        .parse::<i32>()
        .unwrap_or(0);

    let rule: Option<SchedulingOverbookingRule> = sqlx::query_as(
        "SELECT * FROM scheduling_overbooking_rules \
         WHERE tenant_id = $1 AND doctor_id = $2 AND department_id = $3 \
           AND day_of_week = $4 AND is_active = true \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(params.doctor_id)
    .bind(params.department_id)
    .bind(day_of_week)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let recommendation = match rule {
        Some(r) => {
            let threshold: f64 = r
                .overbook_threshold_probability
                .to_string()
                .parse()
                .unwrap_or(0.0);
            OverbookingRecommendation {
                doctor_id: params.doctor_id,
                department_id: params.department_id,
                date: params.date,
                day_of_week,
                max_overbook_slots: r.max_overbook_slots,
                threshold_probability: threshold,
                recommendation: format!(
                    "Overbooking allowed: up to {} extra slots when no-show probability \
                     exceeds {:.0}%.",
                    r.max_overbook_slots,
                    threshold * 100.0,
                ),
            }
        }
        None => OverbookingRecommendation {
            doctor_id: params.doctor_id,
            department_id: params.department_id,
            date: params.date,
            day_of_week,
            max_overbook_slots: 0,
            threshold_probability: 0.0,
            recommendation: "No overbooking rule configured for this doctor/department/day."
                .to_string(),
        },
    };

    Ok(Json(recommendation))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Analytics
// ══════════════════════════════════════════════════════════

pub async fn noshow_rates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<NoshowRatesQuery>,
) -> Result<Json<Vec<NoshowRateRow>>, AppError> {
    require_permission(&claims, permissions::scheduling::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut sql = String::from(
        "SELECT \
           a.doctor_id, \
           a.department_id, \
           COUNT(*)::bigint AS total_appointments, \
           COUNT(*) FILTER (WHERE a.status = 'no_show')::bigint AS noshow_count, \
           CASE WHEN COUNT(*) > 0 \
                THEN (COUNT(*) FILTER (WHERE a.status = 'no_show'))::float8 / COUNT(*)::float8 \
                ELSE NULL END AS noshow_rate \
         FROM appointments a \
         WHERE a.tenant_id = $1",
    );
    let mut param_idx = 2u32;

    if params.doctor_id.is_some() {
        sql.push_str(&format!(" AND a.doctor_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.department_id.is_some() {
        sql.push_str(&format!(" AND a.department_id = ${param_idx}"));
        param_idx += 1;
    }

    let _ = param_idx;

    sql.push_str(" GROUP BY a.doctor_id, a.department_id ORDER BY noshow_count DESC");

    let mut query = sqlx::query_as::<_, NoshowRateRow>(&sql).bind(claims.tenant_id);

    if let Some(did) = params.doctor_id {
        query = query.bind(did);
    }
    if let Some(dept_id) = params.department_id {
        query = query.bind(dept_id);
    }

    let rows = query.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn prediction_accuracy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PredictionAccuracyReport>, AppError> {
    require_permission(&claims, permissions::scheduling::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let (total_predictions,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM noshow_prediction_scores WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(Json(PredictionAccuracyReport {
        model_version: "stub-v1.0".to_string(),
        total_predictions,
        message: "Accuracy metrics are a placeholder — real accuracy tracking will compare \
                  predicted probabilities against actual appointment outcomes once the ML \
                  pipeline is integrated."
            .to_string(),
    }))
}

pub async fn waitlist_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<WaitlistStatsResponse>, AppError> {
    require_permission(&claims, permissions::scheduling::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let (total_waiting,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scheduling_waitlist \
         WHERE tenant_id = $1 AND status = 'waiting'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let (total_offered,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scheduling_waitlist \
         WHERE tenant_id = $1 AND status = 'offered'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let (total_booked,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scheduling_waitlist \
         WHERE tenant_id = $1 AND status = 'booked'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let avg_wait: Option<(Option<f64>,)> = sqlx::query_as(
        "SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0)::float8 \
         FROM scheduling_waitlist \
         WHERE tenant_id = $1 AND status = 'booked'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let avg_wait_days = avg_wait.and_then(|r| r.0);

    tx.commit().await?;

    Ok(Json(WaitlistStatsResponse {
        total_waiting,
        total_offered,
        total_booked,
        avg_wait_days,
    }))
}

// ══════════════════════════════════════════════════════════
//  Conflict detection, waitlist promotion, analytics,
//  recurring slots, and time blocks
// ══════════════════════════════════════════════════════════

// ── GET /api/scheduling/conflicts ───────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConflictRow {
    pub appointment_id_a: Uuid,
    pub appointment_id_b: Uuid,
    pub doctor_id: Uuid,
    pub appointment_date: chrono::NaiveDate,
    pub slot_start_a: chrono::NaiveTime,
    pub slot_end_a: chrono::NaiveTime,
    pub slot_start_b: chrono::NaiveTime,
    pub slot_end_b: chrono::NaiveTime,
}

pub async fn detect_conflicts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ConflictRow>>, AppError> {
    require_permission(&claims, permissions::scheduling::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, ConflictRow>(
        "SELECT \
             a.id AS appointment_id_a, \
             b.id AS appointment_id_b, \
             a.doctor_id, \
             a.appointment_date, \
             a.slot_start AS slot_start_a, \
             a.slot_end AS slot_end_a, \
             b.slot_start AS slot_start_b, \
             b.slot_end AS slot_end_b \
         FROM appointments a \
         JOIN appointments b \
             ON a.tenant_id = b.tenant_id \
             AND a.doctor_id = b.doctor_id \
             AND a.appointment_date = b.appointment_date \
             AND a.id < b.id \
             AND a.slot_start < b.slot_end \
             AND a.slot_end > b.slot_start \
         WHERE a.tenant_id = $1 \
         AND a.status NOT IN ('cancelled', 'no_show') \
         AND b.status NOT IN ('cancelled', 'no_show') \
         AND a.appointment_date >= CURRENT_DATE \
         ORDER BY a.appointment_date, a.doctor_id, a.slot_start \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── POST /api/scheduling/waitlist/promote ────────────────────

#[derive(Debug, Deserialize)]
pub struct PromoteWaitlistRequest {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

pub async fn promote_waitlist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PromoteWaitlistRequest>,
) -> Result<Json<SchedulingWaitlistEntry>, AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Find the first waiting entry matching doctor/department criteria
    let mut sql = String::from(
        "SELECT * FROM scheduling_waitlist \
         WHERE tenant_id = $1 AND status = 'waiting'",
    );
    let mut param_idx = 2u32;

    if body.doctor_id.is_some() {
        sql.push_str(&format!(" AND doctor_id = ${param_idx}"));
        param_idx += 1;
    }
    if body.department_id.is_some() {
        sql.push_str(&format!(" AND department_id = ${param_idx}"));
        param_idx += 1;
    }

    let _ = param_idx;
    sql.push_str(" ORDER BY created_at ASC LIMIT 1");

    let mut query = sqlx::query_as::<_, SchedulingWaitlistEntry>(&sql).bind(claims.tenant_id);

    if let Some(did) = body.doctor_id {
        query = query.bind(did);
    }
    if let Some(dept_id) = body.department_id {
        query = query.bind(dept_id);
    }

    let entry = query.fetch_optional(&mut *tx).await?;

    let entry = entry.ok_or(AppError::NotFound)?;

    // Promote to scheduled
    let promoted: SchedulingWaitlistEntry = sqlx::query_as(
        "UPDATE scheduling_waitlist SET \
         status = 'booked', \
         updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(entry.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(promoted))
}

// ── GET /api/scheduling/analytics ───────────────────────────

#[derive(Debug, Serialize)]
pub struct ScheduleAnalyticsResponse {
    pub total_appointments: i64,
    pub completed_count: i64,
    pub noshow_count: i64,
    pub cancelled_count: i64,
    pub utilization_pct: f64,
    pub noshow_rate_pct: f64,
    pub avg_wait_minutes: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleAnalyticsQuery {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

pub async fn schedule_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ScheduleAnalyticsQuery>,
) -> Result<Json<ScheduleAnalyticsResponse>, AppError> {
    require_permission(&claims, permissions::scheduling::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let date_from = params.date_from.as_deref().unwrap_or("2000-01-01");
    let date_to = params.date_to.as_deref().unwrap_or("2099-12-31");

    // Base stats
    let (total,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM appointments \
         WHERE tenant_id = $1 \
         AND appointment_date BETWEEN $2::date AND $3::date \
         AND ($4::uuid IS NULL OR doctor_id = $4) \
         AND ($5::uuid IS NULL OR department_id = $5)",
    )
    .bind(claims.tenant_id)
    .bind(date_from)
    .bind(date_to)
    .bind(params.doctor_id)
    .bind(params.department_id)
    .fetch_one(&mut *tx)
    .await?;

    let (completed,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM appointments \
         WHERE tenant_id = $1 \
         AND appointment_date BETWEEN $2::date AND $3::date \
         AND ($4::uuid IS NULL OR doctor_id = $4) \
         AND ($5::uuid IS NULL OR department_id = $5) \
         AND status = 'completed'",
    )
    .bind(claims.tenant_id)
    .bind(date_from)
    .bind(date_to)
    .bind(params.doctor_id)
    .bind(params.department_id)
    .fetch_one(&mut *tx)
    .await?;

    let (noshow,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM appointments \
         WHERE tenant_id = $1 \
         AND appointment_date BETWEEN $2::date AND $3::date \
         AND ($4::uuid IS NULL OR doctor_id = $4) \
         AND ($5::uuid IS NULL OR department_id = $5) \
         AND status = 'no_show'",
    )
    .bind(claims.tenant_id)
    .bind(date_from)
    .bind(date_to)
    .bind(params.doctor_id)
    .bind(params.department_id)
    .fetch_one(&mut *tx)
    .await?;

    let (cancelled,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM appointments \
         WHERE tenant_id = $1 \
         AND appointment_date BETWEEN $2::date AND $3::date \
         AND ($4::uuid IS NULL OR doctor_id = $4) \
         AND ($5::uuid IS NULL OR department_id = $5) \
         AND status = 'cancelled'",
    )
    .bind(claims.tenant_id)
    .bind(date_from)
    .bind(date_to)
    .bind(params.doctor_id)
    .bind(params.department_id)
    .fetch_one(&mut *tx)
    .await?;

    // Average wait time (checked_in_at minus slot_start, in minutes)
    let avg_wait: Option<(Option<f64>,)> = sqlx::query_as(
        "SELECT AVG(EXTRACT(EPOCH FROM (checked_in_at - \
         (appointment_date + slot_start))) / 60.0)::float8 \
         FROM appointments \
         WHERE tenant_id = $1 \
         AND appointment_date BETWEEN $2::date AND $3::date \
         AND ($4::uuid IS NULL OR doctor_id = $4) \
         AND ($5::uuid IS NULL OR department_id = $5) \
         AND checked_in_at IS NOT NULL",
    )
    .bind(claims.tenant_id)
    .bind(date_from)
    .bind(date_to)
    .bind(params.doctor_id)
    .bind(params.department_id)
    .fetch_optional(&mut *tx)
    .await?;

    let utilization_pct = if total > 0 {
        (completed as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    let noshow_rate_pct = if total > 0 {
        (noshow as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    tx.commit().await?;

    Ok(Json(ScheduleAnalyticsResponse {
        total_appointments: total,
        completed_count: completed,
        noshow_count: noshow,
        cancelled_count: cancelled,
        utilization_pct,
        noshow_rate_pct,
        avg_wait_minutes: avg_wait.and_then(|r| r.0),
    }))
}

// ── POST /api/scheduling/recurring ──────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateRecurringRequest {
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub patient_id: Uuid,
    pub day_of_week: i32,
    pub slot_start: String,
    pub slot_end: String,
    pub repeat_count: i32,
    pub start_date: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RecurringResult {
    pub created: i64,
    pub appointment_ids: Vec<Uuid>,
}

pub async fn create_recurring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRecurringRequest>,
) -> Result<(StatusCode, Json<RecurringResult>), AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut appointment_ids = Vec::new();
    let mut created: i64 = 0;

    // Parse start_date, find first matching day_of_week
    let start = chrono::NaiveDate::parse_from_str(&body.start_date, "%Y-%m-%d")
        .map_err(|e| AppError::Internal(format!("Invalid start_date: {e}")))?;

    // Find the first date >= start_date that matches day_of_week
    let target_weekday = match body.day_of_week {
        0 => chrono::Weekday::Sun,
        1 => chrono::Weekday::Mon,
        2 => chrono::Weekday::Tue,
        3 => chrono::Weekday::Wed,
        4 => chrono::Weekday::Thu,
        5 => chrono::Weekday::Fri,
        6 => chrono::Weekday::Sat,
        _ => return Err(AppError::Internal("day_of_week must be 0-6".to_string())),
    };

    let mut current_date = start;
    while current_date.weekday() != target_weekday {
        current_date += chrono::Duration::days(1);
    }

    for _ in 0..body.repeat_count {
        let date_str = current_date.format("%Y-%m-%d").to_string();

        let row: (Uuid,) = sqlx::query_as(
            "INSERT INTO appointments \
             (tenant_id, patient_id, doctor_id, department_id, \
              appointment_date, slot_start, slot_end, \
              status, reason, created_by) \
             VALUES ($1, $2, $3, $4, $5::date, $6::time, $7::time, \
             'scheduled', $8, $9) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(body.patient_id)
        .bind(body.doctor_id)
        .bind(body.department_id)
        .bind(&date_str)
        .bind(&body.slot_start)
        .bind(&body.slot_end)
        .bind(&body.reason)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

        appointment_ids.push(row.0);
        created += 1;
        current_date += chrono::Duration::weeks(1);
    }

    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(RecurringResult {
            created,
            appointment_ids,
        }),
    ))
}

// ── POST /api/scheduling/blocks ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateBlockRequest {
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub block_date: String,
    pub slot_start: String,
    pub slot_end: String,
    pub block_reason: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BlockRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub appointment_date: chrono::NaiveDate,
    pub slot_start: chrono::NaiveTime,
    pub slot_end: chrono::NaiveTime,
    pub status: String,
    pub reason: Option<String>,
}

pub async fn create_block(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBlockRequest>,
) -> Result<(StatusCode, Json<BlockRow>), AppError> {
    require_permission(&claims, permissions::scheduling::waitlist::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Insert as a cancelled appointment with reason = "BLOCK: <reason>".
    // The appointments table requires a patient_id, so we use the current
    // user's id as a placeholder. Status is set to 'cancelled' immediately
    // since this is a time-block, not a real appointment.
    let block_reason = format!(
        "BLOCK: {}",
        body.block_reason.as_deref().unwrap_or("Time block")
    );

    let row = sqlx::query_as::<_, BlockRow>(
        "INSERT INTO appointments \
         (tenant_id, patient_id, doctor_id, department_id, \
          appointment_date, slot_start, slot_end, \
          status, reason, cancel_reason, cancelled_at, created_by) \
         VALUES ($1, $2, $3, $4, $5::date, $6::time, $7::time, \
         'cancelled', $8, $8, NOW(), $2) \
         RETURNING id, tenant_id, doctor_id, department_id, \
         appointment_date, slot_start, slot_end, status::text, reason",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub) // patient_id placeholder (current user)
    .bind(body.doctor_id)
    .bind(body.department_id)
    .bind(&body.block_date)
    .bind(&body.slot_start)
    .bind(&body.slot_end)
    .bind(&block_reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}
