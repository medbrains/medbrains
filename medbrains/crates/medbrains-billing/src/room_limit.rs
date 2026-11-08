//! A policy's eligible room rent (revenue integrity RFC wave 1.4).
//!
//! The insurance desk records it from the policy schedule or e-card, so the
//! room check at admission and transfer has something to compare with. Until
//! it is set the check says "no limit recorded", never "within".

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

#[derive(Debug, Deserialize)]
pub struct RoomRentLimitBody {
    /// Rupees a day; wins over the percentage when both are given.
    pub room_rent_limit_per_day: Option<Decimal>,
    /// Percentage of the sum insured a day (often 1).
    pub room_rent_limit_percent: Option<Decimal>,
}

/// The policy's limit as saved.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RoomRentLimit {
    pub id: Uuid,
    pub room_rent_limit_per_day: Option<Decimal>,
    pub room_rent_limit_percent: Option<Decimal>,
}

/// 400 unless each given figure is in range: above zero, a percentage at
/// most 100. Both empty clears the limit.
fn validate(body: &RoomRentLimitBody) -> Result<(), AppError> {
    let bad_amount = body
        .room_rent_limit_per_day
        .is_some_and(|v| v <= Decimal::ZERO);
    let bad_percent = body
        .room_rent_limit_percent
        .is_some_and(|v| v <= Decimal::ZERO || v > Decimal::ONE_HUNDRED);
    if bad_amount || bad_percent {
        return Err(AppError::BadRequest(
            "billing.roomLimit.outOfRange".to_owned(),
        ));
    }
    Ok(())
}

/// `PUT /api/billing/policies/{id}/room-rent-limit` — set the eligible room
/// rent on a patient's policy.
///
/// # Errors
/// 403 without `insurance.room_eligibility.configure` or billing access to
/// the policy's patient; 404 for an unknown policy; 400 out of range.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn set_room_rent_limit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RoomRentLimitBody>,
) -> Result<Json<RoomRentLimit>, AppError> {
    require_permission(&claims, permissions::insurance::room_eligibility::CONFIGURE)?;
    validate(&body)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let patient: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM patient_insurance \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient).await?;
    let saved = sqlx::query_as::<_, RoomRentLimit>(
        "UPDATE patient_insurance SET room_rent_limit_per_day = $3, \
                room_rent_limit_percent = $4, updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 \
          RETURNING id, room_rent_limit_per_day, room_rent_limit_percent",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.room_rent_limit_per_day.map(|v| v.round_dp(2)))
    .bind(body.room_rent_limit_percent.map(|v| v.round_dp(2)))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(saved))
}
