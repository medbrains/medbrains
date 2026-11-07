//! `GET /api/pharmacy/dispense-witnesses` — who may countersign a controlled
//! dispense.
//!
//! A Schedule X or NDPS dispense needs a second person who may dispense. The
//! dispense screen asked the user directory for them, which only an
//! administrator may read, so a pharmacist saw an empty list and a controlled
//! drug could not be dispensed at all. This answers with names only, to anyone
//! who may dispense.

use axum::Extension;
use axum::{Json, extract::State};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use uuid::Uuid;

/// The most names the picker offers.
const WITNESS_LIMIT: i64 = 200;

/// A colleague who may witness a controlled dispense.
#[derive(Debug, Serialize)]
pub struct DispenseWitness {
    pub id: Uuid,
    pub full_name: String,
}

/// Lists active colleagues whose role may dispense, excluding the caller (a
/// witness is a second person). Grants given to one user on top of their
/// role are not read.
///
/// ponytail: role grants only; add `access_matrix` extras if a hospital
/// witnesses that way.
pub async fn list_dispense_witnesses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DispenseWitness>>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query_as!(
        DispenseWitness,
        "SELECT u.id, u.full_name \
           FROM users u \
           JOIN roles r ON r.code = u.role::text AND r.tenant_id = u.tenant_id \
                       AND r.deleted_at IS NULL \
          WHERE u.tenant_id = $1 AND u.is_active AND u.deleted_at IS NULL \
            AND u.id <> $2 \
            AND r.permissions ? $3 \
          ORDER BY u.full_name \
          LIMIT $4",
        claims.tenant_id,
        claims.sub,
        permissions::pharmacy::dispensing::CREATE,
        WITNESS_LIMIT,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
