//! The second pharmacist on a controlled dispense: who may be picked, and the
//! server's check that the person picked really is that person.
//!
//! `GET /api/pharmacy/dispense-witnesses` lists, by name only, active
//! colleagues in the caller's own departments who may dispense — after any
//! permission taken away from them personally. The dispense screen asked the
//! administrator's user directory before, so a pharmacist saw nobody.
//!
//! `verify_witness` is what the dispense runs: a second person, still allowed
//! to dispense, who has typed their own password at this screen.

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

/// Lists active colleagues in the caller's departments who may dispense,
/// excluding the caller (a witness is a second person).
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
            AND u.department_ids && $4::uuid[] \
            AND (r.permissions ? $3 OR COALESCE(u.access_matrix->'extra' ? $3, false)) \
            AND NOT COALESCE(u.access_matrix->'denied' ? $3, false) \
          ORDER BY u.full_name \
          LIMIT $5",
        claims.tenant_id,
        claims.sub,
        permissions::pharmacy::dispensing::CREATE,
        &claims.department_ids,
        WITNESS_LIMIT,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Checks the witness to a controlled dispense and returns their name.
///
/// Refuses the dispenser as their own witness, anyone who is not an active
/// colleague still allowed to dispense (role grant, personal grant, minus a
/// personal denial), and a password that is not the witness's own. Each
/// refusal is a 400 the dispense screen shows; none of them logs anybody out.
// ponytail: no per-witness attempt limit yet; add one if guessing at the counter is a risk
pub async fn verify_witness(
    state: &AppState,
    claims: &Claims,
    witness_id: Uuid,
    password: Option<&str>,
) -> Result<String, AppError> {
    if witness_id == claims.sub {
        return Err(AppError::BadRequest(
            "The witness must be a second person, not the pharmacist dispensing.".to_owned(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(claims)).await?;
    let witness = sqlx::query_scalar!(
        "SELECT u.full_name \
           FROM users u \
           JOIN roles r ON r.code = u.role::text AND r.tenant_id = u.tenant_id \
                       AND r.deleted_at IS NULL \
          WHERE u.id = $1 AND u.tenant_id = $2 AND u.is_active AND u.deleted_at IS NULL \
            AND (r.permissions ? $3 OR COALESCE(u.access_matrix->'extra' ? $3, false)) \
            AND NOT COALESCE(u.access_matrix->'denied' ? $3, false)",
        witness_id,
        claims.tenant_id,
        permissions::pharmacy::dispensing::CREATE,
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let Some(name) = witness else {
        return Err(AppError::BadRequest(
            "The witness is not an active colleague who may dispense.".to_owned(),
        ));
    };
    let password = password.map(str::trim).filter(|p| !p.is_empty()).ok_or_else(|| {
        AppError::BadRequest("The witness must confirm with their own password.".to_owned())
    })?;
    if !medbrains_server_core::step_up::verify_user_password(
        state,
        claims.tenant_id,
        witness_id,
        password,
    )
    .await?
    {
        return Err(AppError::BadRequest(
            "That is not the witness's password. Ask them to type it again.".to_owned(),
        ));
    }
    Ok(name)
}
