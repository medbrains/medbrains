//! Bedside monitor readings waiting for a nurse.
//!
//! A monitor's reading is a draft (`device_vital_readings`) until a nurse
//! confirms it -- adding what a monitor cannot see, ACVPU and oxygen -- and
//! only then is it charted, through `record_reading`, the same path a typed
//! reading takes, so it is scored and can escalate. A reading the nurse
//! knows is wrong (the probe was off, the cuff on the wrong limb) is
//! discarded with a reason.

use axum::extract::{Path, State};
use axum::{Extension, Json};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::nurse_ews::{CreatedVital, ScoringInputs};
use crate::nurse_vitals::{CreateVitalsReadingRequest, Origin, record_reading};

/// Drafts older than this are not offered: a stale reading is not charted.
const OFFER_HOURS: i64 = 12;
const LIST_LIMIT: i64 = 100;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MonitorReading {
    pub id: Uuid,
    pub device_name: String,
    pub observed_at: DateTime<Utc>,
    pub temperature: Option<Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub is_abnormal: bool,
}

/// `GET /api/nurse/encounters/{encounter_id}/monitor-readings`
pub async fn list_drafts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<MonitorReading>>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::VIEW)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MonitorReading>(
        "SELECT r.id, d.name AS device_name, r.observed_at, r.temperature, r.pulse, r.systolic_bp, \
                r.diastolic_bp, r.respiratory_rate, r.spo2, r.is_abnormal \
           FROM device_vital_readings r JOIN device_instances d ON d.id = r.device_instance_id \
          WHERE r.tenant_id = $1 AND r.encounter_id = $2 AND r.status = 'draft' \
            AND r.deleted_at IS NULL AND r.observed_at > $3 \
          ORDER BY r.observed_at DESC LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(Utc::now() - Duration::hours(OFFER_HOURS))
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(sqlx::FromRow)]
struct Draft {
    encounter_id: Uuid,
    observed_at: DateTime<Utc>,
    temperature: Option<Decimal>,
    pulse: Option<i32>,
    systolic_bp: Option<i32>,
    diastolic_bp: Option<i32>,
    respiratory_rate: Option<i32>,
    spo2: Option<i32>,
}

/// The draft, locked, after checking the caller may chart for its patient;
/// `fresh_only` refuses one too old to chart.
async fn draft(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    state: &AppState,
    claims: &Claims,
    (id, fresh_only): (Uuid, bool),
) -> Result<Draft, AppError> {
    let d = sqlx::query_as::<_, Draft>(
        "SELECT encounter_id, observed_at, temperature, pulse, systolic_bp, diastolic_bp, \
                respiratory_rate, spo2 \
           FROM device_vital_readings \
          WHERE id = $1 AND tenant_id = $2 AND status = 'draft' AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_encounter_access(state, claims, d.encounter_id).await?;
    if fresh_only && d.observed_at < Utc::now() - Duration::hours(OFFER_HOURS) {
        return Err(AppError::Conflict(format!(
            "This reading is more than {OFFER_HOURS} hours old; chart a fresh set instead."
        )));
    }
    Ok(d)
}

#[derive(Debug, Deserialize)]
pub struct ConfirmRequest {
    #[serde(flatten)]
    pub scoring: ScoringInputs,
    pub notes: Option<String>,
}

/// `POST /api/nurse/monitor-readings/{id}/confirm`
pub async fn confirm(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ConfirmRequest>,
) -> Result<Json<CreatedVital>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let d = draft(&mut tx, &state, &claims, (id, true)).await?;
    let reading = CreateVitalsReadingRequest {
        encounter_id: d.encounter_id,
        temperature: d.temperature,
        pulse: d.pulse,
        systolic_bp: d.systolic_bp,
        diastolic_bp: d.diastolic_bp,
        respiratory_rate: d.respiratory_rate,
        spo2: d.spo2,
        weight_kg: None,
        height_cm: None,
        head_circumference_cm: None,
        notes: body.notes.filter(|n| !n.trim().is_empty()),
        scoring: body.scoring,
    };
    let (vital, ews, outgoing) = record_reading(
        &mut tx,
        (claims.tenant_id, claims.sub),
        &reading,
        Origin::Monitor(d.observed_at),
    )
    .await?;
    sqlx::query(
        "UPDATE device_vital_readings SET status = 'confirmed', vital_id = $3, \
                reviewed_by = $4, reviewed_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(vital.id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    for (uid, n) in &outgoing {
        medbrains_notifications::publish_notification(&state, claims.tenant_id, *uid, &n.borrow());
    }
    Ok(Json(CreatedVital { vital, ews }))
}

#[derive(Debug, Deserialize)]
pub struct DiscardRequest {
    pub reason: String,
}

/// `POST /api/nurse/monitor-readings/{id}/discard`
pub async fn discard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DiscardRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::nurse::vitals::RECORD)?;
    let reason = body.reason.trim();
    if reason.len() < 3 {
        return Err(AppError::BadRequest(
            "Say why this reading is not charted.".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    draft(&mut tx, &state, &claims, (id, false)).await?;
    sqlx::query(
        "UPDATE device_vital_readings SET status = 'discarded', discard_reason = $3, \
                reviewed_by = $4, reviewed_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "discarded" })))
}
