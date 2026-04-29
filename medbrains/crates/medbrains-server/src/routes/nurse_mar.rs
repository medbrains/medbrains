//! Nurse MAR (Medication Administration Record) endpoints.
//!
//! Per RFCs/sprints/SPRINT-nurse-activities.md §3.3.
//! Foundation slice: list-due-now, administer, hold, refuse.
//! Full MAR generation cron + CDS composer in follow-up sprint.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MarEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub prescription_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub scheduled_at: DateTime<Utc>,
    pub administered_at: Option<DateTime<Utc>>,
    pub administered_by: Option<Uuid>,
    pub dose_index: i32,
    pub status: String,
    pub dose_administered: Option<String>,
    pub route: Option<String>,
    pub hold_reason: Option<String>,
    pub refusal_reason: Option<String>,
    pub wristband_scan_at: Option<DateTime<Utc>>,
    pub drug_scan_at: Option<DateTime<Utc>>,
    pub witness_user_id: Option<Uuid>,
    pub is_prn: bool,
    pub prn_indication: Option<String>,
    pub prn_requested_at: Option<DateTime<Utc>>,
    pub signed_record_id: Option<Uuid>,
    pub late_minutes: Option<i32>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct DueNowQuery {
    /// Look-ahead window in minutes (default 30).
    pub window_min: Option<i64>,
    pub patient_id: Option<Uuid>,
}

pub async fn list_due_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DueNowQuery>,
) -> Result<Json<Vec<MarEntry>>, AppError> {
    require_permission(&claims, permissions::nurse::mar::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let window = q.window_min.unwrap_or(30);

    let rows = sqlx::query_as::<_, MarEntry>(
        "SELECT * FROM medication_administration_records \
         WHERE tenant_id = $1 \
           AND status = 'pending' \
           AND scheduled_at <= now() + ($2 || ' minutes')::interval \
           AND ($3::uuid IS NULL OR patient_id = $3) \
         ORDER BY scheduled_at \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(window.to_string())
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AdministerRequest {
    pub dose_administered: Option<String>,
    pub route: Option<String>,
    pub wristband_scanned: Option<bool>,
    pub drug_scanned: Option<bool>,
    pub witness_user_id: Option<Uuid>,
    pub notes: Option<String>,
}

pub async fn administer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdministerRequest>,
) -> Result<Json<MarEntry>, AppError> {
    require_permission(&claims, permissions::nurse::mar::ADMINISTER)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let wristband_at = if body.wristband_scanned.unwrap_or(false) {
        Some(now)
    } else {
        None
    };
    let drug_at = if body.drug_scanned.unwrap_or(false) {
        Some(now)
    } else {
        None
    };

    let row = sqlx::query_as::<_, MarEntry>(
        "UPDATE medication_administration_records SET \
           status = 'administered', \
           administered_at = now(), \
           administered_by = $3, \
           dose_administered = COALESCE($4, dose_administered), \
           route = COALESCE($5, route), \
           wristband_scan_at = COALESCE($6, wristband_scan_at), \
           drug_scan_at = COALESCE($7, drug_scan_at), \
           witness_user_id = COALESCE($8, witness_user_id), \
           late_minutes = GREATEST(0, EXTRACT(EPOCH FROM (now() - scheduled_at)) / 60)::int, \
           notes = COALESCE($9, notes), \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&body.dose_administered)
    .bind(&body.route)
    .bind(wristband_at)
    .bind(drug_at)
    .bind(body.witness_user_id)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct HoldRequest {
    pub reason: String,
}

pub async fn hold(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<HoldRequest>,
) -> Result<Json<MarEntry>, AppError> {
    require_permission(&claims, permissions::nurse::mar::HOLD)?;
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest("reason required".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MarEntry>(
        "UPDATE medication_administration_records SET \
           status = 'held', hold_reason = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.reason)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct RefuseRequest {
    pub reason: String,
}

pub async fn refuse(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RefuseRequest>,
) -> Result<Json<MarEntry>, AppError> {
    require_permission(&claims, permissions::nurse::mar::REFUSE)?;
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest("reason required".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MarEntry>(
        "UPDATE medication_administration_records SET \
           status = 'refused', refusal_reason = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.reason)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_for_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<MarEntry>>, AppError> {
    require_permission(&claims, permissions::nurse::mar::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MarEntry>(
        "SELECT * FROM medication_administration_records \
         WHERE tenant_id = $1 AND patient_id = $2 \
         ORDER BY scheduled_at DESC \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
