//! Pharmacy refill / repeat dispensing — patient comes back for the
//! same Rx without doctor re-issue, within `repeats_allowed` count and
//! `repeat_interval_days` cadence.
//!
//! Per RFCs/sprints/SPRINT-pharmacy-improvements.md item #4.

use axum::{
    Extension, Json,
    extract::{Path, State},
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
pub struct RepeatRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub prescription_id: Uuid,
    pub pharmacy_order_id: Uuid,
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
    pub last_dispense_at: Option<DateTime<Utc>>,
    pub next_eligible_at: Option<DateTime<Utc>>,
    pub is_eligible_now: bool,
}

pub async fn check_eligibility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(prescription_id): Path<Uuid>,
) -> Result<Json<RepeatEligibility>, AppError> {
    require_permission(&claims, permissions::pharmacy_improvements::repeats::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rx: (i32, i32, Option<i32>) = sqlx::query_as(
        "SELECT repeats_allowed, repeats_used, repeat_interval_days \
         FROM prescriptions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(prescription_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let (allowed, used, interval) = rx;

    let last: Option<(DateTime<Utc>,)> = sqlx::query_as(
        "SELECT MAX(dispensed_at) FROM pharmacy_repeats \
         WHERE tenant_id = $1 AND prescription_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(prescription_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let last_at = last.map(|t| t.0);
    let remaining = (allowed - used).max(0);

    let next_eligible_at = match (last_at, interval) {
        (Some(last), Some(days)) => Some(last + chrono::Duration::days(i64::from(days))),
        _ => None,
    };

    let is_eligible_now = remaining > 0
        && next_eligible_at
            .map(|t| t <= Utc::now())
            .unwrap_or(true);

    Ok(Json(RepeatEligibility {
        prescription_id,
        repeats_allowed: allowed,
        repeats_used: used,
        remaining,
        last_dispense_at: last_at,
        next_eligible_at,
        is_eligible_now,
    }))
}

#[derive(Debug, Deserialize)]
pub struct DispenseRepeatRequest {
    pub pharmacy_order_id: Uuid,
    pub notes: Option<String>,
}

pub async fn dispense_repeat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(prescription_id): Path<Uuid>,
    Json(body): Json<DispenseRepeatRequest>,
) -> Result<Json<RepeatRow>, AppError> {
    require_permission(&claims, permissions::pharmacy_improvements::repeats::DISPENSE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Lock + read Rx
    let rx: (i32, i32, Option<i32>) = sqlx::query_as(
        "SELECT repeats_allowed, repeats_used, repeat_interval_days \
         FROM prescriptions WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(prescription_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let (allowed, used, interval) = rx;

    if used >= allowed {
        return Err(AppError::BadRequest(format!(
            "all {allowed} repeats already used"
        )));
    }

    // Check interval since last dispense
    if let Some(days) = interval {
        let last: Option<(DateTime<Utc>,)> = sqlx::query_as(
            "SELECT MAX(dispensed_at) FROM pharmacy_repeats \
             WHERE tenant_id = $1 AND prescription_id = $2",
        )
        .bind(claims.tenant_id)
        .bind(prescription_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some((last_at,)) = last {
            let next_eligible = last_at + chrono::Duration::days(i64::from(days));
            if next_eligible > Utc::now() {
                return Err(AppError::BadRequest(format!(
                    "next repeat eligible at {next_eligible}"
                )));
            }
        }
    }

    let new_index = used + 1;

    // Insert repeat row
    let row = sqlx::query_as::<_, RepeatRow>(
        "INSERT INTO pharmacy_repeats \
         (tenant_id, prescription_id, pharmacy_order_id, repeat_index, dispensed_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(prescription_id)
    .bind(body.pharmacy_order_id)
    .bind(new_index)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Bump repeats_used on prescription
    sqlx::query(
        "UPDATE prescriptions SET repeats_used = $3 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(prescription_id)
    .bind(claims.tenant_id)
    .bind(new_index)
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
        "SELECT * FROM pharmacy_repeats \
         WHERE tenant_id = $1 AND prescription_id = $2 \
         ORDER BY dispensed_at",
    )
    .bind(claims.tenant_id)
    .bind(prescription_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
