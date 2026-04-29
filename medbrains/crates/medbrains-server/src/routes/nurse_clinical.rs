//! Nurse restraint + wound assessments.

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

// ── restraint_monitoring_events ─────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RestraintEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub restraint_order_id: Uuid,
    pub encounter_id: Uuid,
    pub monitored_at: DateTime<Utc>,
    pub monitored_by: Uuid,
    pub skin_intact: bool,
    pub circulation_normal: bool,
    pub distress_observed: bool,
    pub continue_restraint: bool,
    pub witness_user_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRestraintEventRequest {
    pub restraint_order_id: Uuid,
    pub encounter_id: Uuid,
    pub skin_intact: bool,
    pub circulation_normal: bool,
    pub distress_observed: Option<bool>,
    pub continue_restraint: bool,
    pub witness_user_id: Option<Uuid>,
    pub notes: Option<String>,
}

pub async fn create_restraint_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRestraintEventRequest>,
) -> Result<Json<RestraintEvent>, AppError> {
    require_permission(&claims, permissions::nurse::restraint::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RestraintEvent>(
        "INSERT INTO restraint_monitoring_events \
         (tenant_id, restraint_order_id, encounter_id, monitored_by, \
          skin_intact, circulation_normal, distress_observed, \
          continue_restraint, witness_user_id, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.restraint_order_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .bind(body.skin_intact)
    .bind(body.circulation_normal)
    .bind(body.distress_observed.unwrap_or(false))
    .bind(body.continue_restraint)
    .bind(body.witness_user_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_restraint_for_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(restraint_order_id): Path<Uuid>,
) -> Result<Json<Vec<RestraintEvent>>, AppError> {
    require_permission(&claims, permissions::nurse::restraint::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RestraintEvent>(
        "SELECT * FROM restraint_monitoring_events \
         WHERE tenant_id = $1 AND restraint_order_id = $2 \
         ORDER BY monitored_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(restraint_order_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── wound_assessments ───────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WoundAssessment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub body_site: String,
    pub classification: Option<String>,
    pub stage: Option<String>,
    pub length_cm: Option<Decimal>,
    pub width_cm: Option<Decimal>,
    pub depth_cm: Option<Decimal>,
    pub exudate: Option<String>,
    pub odor: Option<String>,
    pub photo_urls: serde_json::Value,
    pub dressing_type: Option<String>,
    pub dressing_changed_at: Option<DateTime<Utc>>,
    pub dressing_change_due_at: Option<DateTime<Utc>>,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Uuid,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWoundRequest {
    pub encounter_id: Uuid,
    pub body_site: String,
    pub classification: Option<String>,
    pub stage: Option<String>,
    pub length_cm: Option<Decimal>,
    pub width_cm: Option<Decimal>,
    pub depth_cm: Option<Decimal>,
    pub exudate: Option<String>,
    pub odor: Option<String>,
    pub photo_urls: Option<serde_json::Value>,
    pub dressing_type: Option<String>,
    pub dressing_changed_at: Option<DateTime<Utc>>,
    pub dressing_change_due_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

pub async fn create_wound(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWoundRequest>,
) -> Result<Json<WoundAssessment>, AppError> {
    require_permission(&claims, permissions::nurse::wound::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let photos = body.photo_urls.unwrap_or_else(|| serde_json::json!([]));

    let row = sqlx::query_as::<_, WoundAssessment>(
        "INSERT INTO wound_assessments \
         (tenant_id, encounter_id, body_site, classification, stage, \
          length_cm, width_cm, depth_cm, exudate, odor, photo_urls, \
          dressing_type, dressing_changed_at, dressing_change_due_at, \
          recorded_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(&body.body_site)
    .bind(&body.classification)
    .bind(&body.stage)
    .bind(body.length_cm)
    .bind(body.width_cm)
    .bind(body.depth_cm)
    .bind(&body.exudate)
    .bind(&body.odor)
    .bind(photos)
    .bind(&body.dressing_type)
    .bind(body.dressing_changed_at)
    .bind(body.dressing_change_due_at)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_wounds_for_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<WoundAssessment>>, AppError> {
    require_permission(&claims, permissions::nurse::wound::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, WoundAssessment>(
        "SELECT * FROM wound_assessments \
         WHERE tenant_id = $1 AND encounter_id = $2 \
         ORDER BY recorded_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
