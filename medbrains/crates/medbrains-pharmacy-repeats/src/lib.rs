//! Refills: a patient comes back for the same prescription without a new
//! visit, within the refills, interval and validity the doctor wrote.
//!
//! A refill is issued as a new entry in the pharmacy's prescription queue for
//! the same prescription. From there it is reviewed, billed and dispensed like
//! any prescription — the same stock, safety and billing path, with its own
//! order and its own bill.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_core::rx_refills::RefillState;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RepeatRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub prescription_id: Uuid,
    pub pharmacy_order_id: Option<Uuid>,
    pub rx_queue_id: Option<Uuid>,
    pub repeat_index: i32,
    pub dispensed_at: DateTime<Utc>,
    pub dispensed_by: Uuid,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RepeatEligibility {
    pub prescription_id: Uuid,
    pub repeats_allowed: i32,
    pub repeats_used: i32,
    pub remaining: i32,
    pub repeat_interval_days: Option<i32>,
    pub valid_until: Option<NaiveDate>,
    pub last_dispense_at: Option<DateTime<Utc>>,
    pub next_eligible_at: Option<DateTime<Utc>>,
    pub is_eligible_now: bool,
    /// Why a refill can't be issued now, in words for the counter.
    pub reason: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RxTerms {
    repeats_allowed: i32,
    repeats_used: i32,
    repeat_interval_days: Option<i32>,
    valid_until: Option<NaiveDate>,
    created_at: DateTime<Utc>,
}

/// The prescription's refill state, locked when `lock` — issuing a refill
/// must not race another counter issuing the same one.
async fn refill_state(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    prescription_id: Uuid,
    lock: bool,
) -> Result<(RefillState, Option<DateTime<Utc>>), AppError> {
    let sql = if lock {
        "SELECT repeats_allowed, repeats_used, repeat_interval_days, valid_until, created_at \
         FROM prescriptions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE"
    } else {
        "SELECT repeats_allowed, repeats_used, repeat_interval_days, valid_until, created_at \
         FROM prescriptions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
    };
    let rx = sqlx::query_as::<_, RxTerms>(sql)
        .bind(prescription_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let last: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT MAX(dispensed_at) FROM pharmacy_repeats \
         WHERE tenant_id = $1 AND prescription_id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .fetch_one(&mut **tx)
    .await?;
    let state = RefillState {
        refills: rx.repeats_allowed,
        used: rx.repeats_used,
        interval_days: rx.repeat_interval_days,
        valid_until: rx.valid_until,
        issued_at: rx.created_at,
        last_refill_at: last,
    };
    Ok((state, last))
}

pub async fn check_eligibility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(prescription_id): Path<Uuid>,
) -> Result<Json<RepeatEligibility>, AppError> {
    require_permission(&claims, permissions::pharmacy_improvements::repeats::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (refill, last) = refill_state(&mut tx, claims.tenant_id, prescription_id, false).await?;
    tx.commit().await?;

    let reason = refill.refusal(Utc::now());
    Ok(Json(RepeatEligibility {
        prescription_id,
        repeats_allowed: refill.refills,
        repeats_used: refill.used,
        remaining: refill.remaining(),
        repeat_interval_days: refill.interval_days,
        valid_until: refill.valid_until,
        last_dispense_at: last,
        next_eligible_at: refill.next_eligible_at(),
        is_eligible_now: reason.is_none(),
        reason,
    }))
}

#[derive(Debug, Deserialize)]
pub struct DispenseRepeatRequest {
    pub notes: Option<String>,
}

/// `POST /api/pharmacy/prescriptions/{id}/repeats` — issue the next refill
/// into the pharmacy's prescription queue.
pub async fn dispense_repeat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(prescription_id): Path<Uuid>,
    Json(body): Json<DispenseRepeatRequest>,
) -> Result<Json<RepeatRow>, AppError> {
    require_permission(
        &claims,
        permissions::pharmacy_improvements::repeats::DISPENSE,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (refill, _) = refill_state(&mut tx, claims.tenant_id, prescription_id, true).await?;
    if let Some(reason) = refill.refusal(Utc::now()) {
        return Err(AppError::Conflict(reason));
    }
    let index = refill.used + 1;

    // The refill joins the queue as the prescription did, for the same
    // patient, visit and prescriber.
    let rx_queue_id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_prescriptions \
           (tenant_id, prescription_id, patient_id, encounter_id, doctor_id, source, \
            status, priority, store_location_id, repeat_index) \
         SELECT tenant_id, prescription_id, patient_id, encounter_id, doctor_id, source, \
                'pending_review', 'normal', store_location_id, $3 \
           FROM pharmacy_prescriptions \
          WHERE tenant_id = $1 AND prescription_id = $2 AND repeat_index IS NULL \
            AND deleted_at IS NULL \
          ORDER BY created_at LIMIT 1 \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(prescription_id)
    .bind(index)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("This prescription never reached the pharmacy".to_owned()))?;

    let row = sqlx::query_as::<_, RepeatRow>(
        "INSERT INTO pharmacy_repeats \
         (tenant_id, prescription_id, rx_queue_id, repeat_index, dispensed_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, tenant_id, prescription_id, pharmacy_order_id, rx_queue_id, \
                   repeat_index, dispensed_at, dispensed_by, notes",
    )
    .bind(claims.tenant_id)
    .bind(prescription_id)
    .bind(rx_queue_id)
    .bind(index)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE prescriptions SET repeats_used = $3 WHERE id = $1 AND tenant_id = $2")
        .bind(prescription_id)
        .bind(claims.tenant_id)
        .bind(index)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_repeats_for_rx(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(prescription_id): Path<Uuid>,
) -> Result<Json<Vec<RepeatRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy_improvements::repeats::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RepeatRow>(
        "SELECT id, tenant_id, prescription_id, pharmacy_order_id, rx_queue_id, repeat_index, \
                dispensed_at, dispensed_by, notes \
           FROM pharmacy_repeats \
         WHERE tenant_id = $1 AND prescription_id = $2 AND deleted_at IS NULL \
         ORDER BY dispensed_at LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(prescription_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Refill routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/pharmacy/prescriptions/{prescription_id}/repeat-eligibility",
            get(check_eligibility),
        )
        .route(
            "/api/pharmacy/prescriptions/{prescription_id}/repeats",
            get(list_repeats_for_rx).post(dispense_repeat),
        )
}
