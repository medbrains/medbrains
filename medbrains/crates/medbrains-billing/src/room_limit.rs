//! A policy's eligible room rent, and the staff who may witness a room
//! consent (revenue integrity RFC wave 1.4).
//!
//! The insurance desk records the limit from the policy schedule or e-card,
//! so the room check at admission and transfer has something to compare
//! with. Until it is set the check says "no limit recorded", never "within".

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
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

/// The figures as they will be stored (two places), or 400 unless each given
/// figure is in range once rounded: above zero, a percentage at most 100. A
/// figure too small to survive rounding is refused here, not by the database.
fn validated(body: &RoomRentLimitBody) -> Result<(Option<Decimal>, Option<Decimal>), AppError> {
    let per_day = body.room_rent_limit_per_day.map(|v| v.round_dp(2));
    let percent = body.room_rent_limit_percent.map(|v| v.round_dp(2));
    let bad_amount = per_day.is_some_and(|v| v <= Decimal::ZERO);
    let bad_percent = percent.is_some_and(|v| v <= Decimal::ZERO || v > Decimal::ONE_HUNDRED);
    if bad_amount || bad_percent {
        return Err(AppError::BadRequest(
            "billing.roomLimit.outOfRange".to_owned(),
        ));
    }
    Ok((per_day, percent))
}

/// `PUT /api/billing/policies/{id}/room-rent-limit` — set the eligible room
/// rent on a patient's policy, on the audit chain with the old and new figures.
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
    let (per_day, percent) = validated(&body)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let (patient, old_day, old_pct): (Uuid, Option<Decimal>, Option<Decimal>) = sqlx::query_as(
        "SELECT patient_id, room_rent_limit_per_day, room_rent_limit_percent \
           FROM patient_insurance \
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
    .bind(per_day)
    .bind(percent)
    .fetch_one(&mut *tx)
    .await?;
    let old = serde_json::json!({ "per_day": old_day, "percent": old_pct });
    let new = serde_json::json!({ "per_day": per_day, "percent": percent });
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "insurance.room_rent_limit.set",
            entity_type: "patient_insurance",
            entity_id: Some(id),
            old_values: Some(&old),
            new_values: Some(&new),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(saved))
}

#[derive(Debug, Deserialize)]
pub struct WitnessQuery {
    pub search: Option<String>,
}

/// A member of staff who may witness a room consent.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Witness {
    pub id: Uuid,
    pub full_name: String,
    pub role: String,
}

/// `GET /api/billing/room-consent/witnesses?search=` — who may witness.
///
/// Active staff of this hospital other than the caller, by name, at most 20: the people who can
/// witness a family agreeing to a room above the policy limit.
///
/// # Errors
/// 403 without `insurance.room_eligibility.resolve`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_room_consent_witnesses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<WitnessQuery>,
) -> Result<Json<Vec<Witness>>, AppError> {
    require_permission(&claims, permissions::insurance::room_eligibility::RESOLVE)?;
    let needle = q.search.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query_as::<_, Witness>(
        "SELECT id, full_name, role::text AS role FROM users \
          WHERE tenant_id = $1 AND id <> $2 AND is_active AND deleted_at IS NULL \
            AND ($3::text IS NULL OR full_name ILIKE '%' || $3 || '%') \
          ORDER BY full_name LIMIT 20",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(needle)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
