//! Pharmacy dispense-time operations: substitutions, counseling, coverage checks.
//!
//! Per RFCs/sprints/SPRINT-pharmacy-improvements.md items #3, #5, #7.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

// ── pharmacy_substitutions ──────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Substitution {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub pharmacy_order_item_id: Uuid,
    pub original_drug_id: Uuid,
    pub substituted_drug_id: Uuid,
    pub reason: String,
    pub inn_match: bool,
    pub patient_consent_obtained: bool,
    pub substituted_by: Uuid,
    pub substituted_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSubstitutionRequest {
    pub pharmacy_order_item_id: Uuid,
    pub original_drug_id: Uuid,
    pub substituted_drug_id: Uuid,
    pub reason: String,
    pub inn_match: bool,
    pub patient_consent_obtained: Option<bool>,
}

pub async fn create_substitution(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSubstitutionRequest>,
) -> Result<Json<Substitution>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_improvements::substitution::RECORD,
    )?;
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest("reason required".to_owned()));
    }
    if body.original_drug_id == body.substituted_drug_id {
        return Err(AppError::BadRequest(
            "substituted drug must differ from original".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Substitution>(
        "INSERT INTO pharmacy_substitutions \
         (tenant_id, pharmacy_order_item_id, original_drug_id, substituted_drug_id, \
          reason, inn_match, patient_consent_obtained, substituted_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_order_item_id)
    .bind(body.original_drug_id)
    .bind(body.substituted_drug_id)
    .bind(&body.reason)
    .bind(body.inn_match)
    .bind(body.patient_consent_obtained.unwrap_or(false))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_substitutions_for_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<Uuid>,
) -> Result<Json<Vec<Substitution>>, AppError> {
    require_permission(&claims, permissions::pharmacy_improvements::substitution::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Substitution>(
        "SELECT * FROM pharmacy_substitutions \
         WHERE tenant_id = $1 AND pharmacy_order_item_id = $2 \
         ORDER BY substituted_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(item_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── pharmacy_counseling ─────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Counseling {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub pharmacy_order_id: Uuid,
    pub food_timing_explained: bool,
    pub dose_timing_explained: bool,
    pub side_effects_explained: bool,
    pub missed_dose_explained: bool,
    pub storage_explained: bool,
    pub notes: Option<String>,
    pub counselled_by: Uuid,
    pub counselled_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCounselingRequest {
    pub pharmacy_order_id: Uuid,
    pub food_timing_explained: Option<bool>,
    pub dose_timing_explained: Option<bool>,
    pub side_effects_explained: Option<bool>,
    pub missed_dose_explained: Option<bool>,
    pub storage_explained: Option<bool>,
    pub notes: Option<String>,
}

pub async fn create_counseling(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCounselingRequest>,
) -> Result<Json<Counseling>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_improvements::counseling::RECORD,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Counseling>(
        "INSERT INTO pharmacy_counseling \
         (tenant_id, pharmacy_order_id, food_timing_explained, dose_timing_explained, \
          side_effects_explained, missed_dose_explained, storage_explained, notes, counselled_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_order_id)
    .bind(body.food_timing_explained.unwrap_or(false))
    .bind(body.dose_timing_explained.unwrap_or(false))
    .bind(body.side_effects_explained.unwrap_or(false))
    .bind(body.missed_dose_explained.unwrap_or(false))
    .bind(body.storage_explained.unwrap_or(false))
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_counseling_for_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Vec<Counseling>>, AppError> {
    require_permission(&claims, permissions::pharmacy_improvements::counseling::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Counseling>(
        "SELECT * FROM pharmacy_counseling \
         WHERE tenant_id = $1 AND pharmacy_order_id = $2 \
         ORDER BY counselled_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(order_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── pharmacy_coverage_checks ────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CoverageCheck {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub pharmacy_order_id: Uuid,
    pub insurance_subscription_id: Option<Uuid>,
    pub package_subscription_id: Option<Uuid>,
    pub covered_amount: Decimal,
    pub cash_amount: Decimal,
    pub total_amount: Decimal,
    pub decision: String,
    pub decided_by: Option<Uuid>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCoverageCheckRequest {
    pub pharmacy_order_id: Uuid,
    pub insurance_subscription_id: Option<Uuid>,
    pub package_subscription_id: Option<Uuid>,
    pub covered_amount: Decimal,
    pub cash_amount: Decimal,
    pub total_amount: Decimal,
    pub decision: String,
}

pub async fn create_coverage_check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCoverageCheckRequest>,
) -> Result<Json<CoverageCheck>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_improvements::coverage::CHECK,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CoverageCheck>(
        "INSERT INTO pharmacy_coverage_checks \
         (tenant_id, pharmacy_order_id, insurance_subscription_id, package_subscription_id, \
          covered_amount, cash_amount, total_amount, decision, decided_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_order_id)
    .bind(body.insurance_subscription_id)
    .bind(body.package_subscription_id)
    .bind(body.covered_amount)
    .bind(body.cash_amount)
    .bind(body.total_amount)
    .bind(&body.decision)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_coverage_for_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Vec<CoverageCheck>>, AppError> {
    require_permission(&claims, permissions::pharmacy_improvements::coverage::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CoverageCheck>(
        "SELECT * FROM pharmacy_coverage_checks \
         WHERE tenant_id = $1 AND pharmacy_order_id = $2 \
         ORDER BY checked_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(order_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
