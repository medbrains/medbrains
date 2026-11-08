//! The second pharmacist on a controlled dispense: who may be picked, and the
//! server's check that the person picked really is that person.
//!
//! `GET /api/pharmacy/dispense-witnesses` lists, by name only, active
//! colleagues in the caller's own departments who may dispense — after any
//! permission taken away from them personally, narrowed by `?q=` (part of the
//! name). The dispense screen asked the administrator's user directory before,
//! so a pharmacist saw nobody; and the list is capped, so the picker searches
//! the server rather than filtering a page that may not hold the colleague.
//!
//! `verify_witness` is what the dispense runs: a second person, still allowed
//! to dispense, who has typed their own password at this screen.

use axum::Extension;
use axum::{
    Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::step_up::{PasswordCheck, check_user_password};
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The most names the picker offers.
const WITNESS_LIMIT: i64 = 200;

/// A colleague who may witness a controlled dispense.
#[derive(Debug, Serialize)]
pub struct DispenseWitness {
    pub id: Uuid,
    pub full_name: String,
}

/// `?q=`: part of the witness's name.
#[derive(Debug, Deserialize)]
pub struct WitnessQuery {
    pub q: Option<String>,
}

/// Lists active colleagues in the caller's departments who may dispense,
/// excluding the caller (a witness is a second person), whose name contains
/// `q` when given.
pub async fn list_dispense_witnesses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<WitnessQuery>,
) -> Result<Json<Vec<DispenseWitness>>, AppError> {
    let name = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|q| !q.is_empty())
        .map(|q| format!("%{}%", q.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")));
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
            AND ($6::text IS NULL OR u.full_name ILIKE $6) \
          ORDER BY u.full_name \
          LIMIT $5",
        claims.tenant_id,
        claims.sub,
        permissions::pharmacy::dispensing::CREATE,
        &claims.department_ids,
        WITNESS_LIMIT,
        name,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// How many failed witness confirmations one dispenser may make in the window.
const DISPENSER_FAILURES: i64 = 5;
/// The window those failures are counted over, in minutes.
const DISPENSER_WINDOW_MINUTES: i32 = 15;

/// Checks the witness to a controlled dispense and returns their name.
///
/// Refuses the dispenser as their own witness; a dispenser with five failed
/// confirmations in fifteen minutes; anyone who is not an active colleague in
/// one of the dispenser's departments still allowed to dispense (role grant,
/// personal grant, minus a personal denial); and a password that is not the
/// witness's own. The password is checked under the shared sign-in lockout:
/// a locked witness is refused before the password is tried, a wrong one
/// counts towards their lock, a right one clears it. Each refusal is a 400
/// (429 for the dispenser limit) the dispense screen shows, never a 401.
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
    // Failed confirmations are filed on the orders (`WITNESS_CONFIRMED`,
    // blocked): the same record bounds how often one dispenser may try.
    let recent_failures = sqlx::query_scalar!(
        "SELECT COUNT(*) AS \"n!\" FROM cpoe_safety_audit \
          WHERE tenant_id = $1 AND checked_by = $2 AND source_module = 'pharmacy' \
            AND warning_code = 'WITNESS_CONFIRMED' AND action_taken = 'blocked' \
            AND checked_at > now() - make_interval(mins => $3)",
        claims.tenant_id,
        claims.sub,
        DISPENSER_WINDOW_MINUTES,
    )
    .fetch_one(&mut *tx)
    .await?;
    if recent_failures >= DISPENSER_FAILURES {
        return Err(AppError::TooManyRequests(format!(
            "Too many failed witness confirmations. Try again in {DISPENSER_WINDOW_MINUTES} minutes."
        )));
    }
    let witness = sqlx::query_scalar!(
        "SELECT u.full_name \
           FROM users u \
           JOIN roles r ON r.code = u.role::text AND r.tenant_id = u.tenant_id \
                       AND r.deleted_at IS NULL \
          WHERE u.id = $1 AND u.tenant_id = $2 AND u.is_active AND u.deleted_at IS NULL \
            AND u.department_ids && $4::uuid[] \
            AND (r.permissions ? $3 OR COALESCE(u.access_matrix->'extra' ? $3, false)) \
            AND NOT COALESCE(u.access_matrix->'denied' ? $3, false)",
        witness_id,
        claims.tenant_id,
        permissions::pharmacy::dispensing::CREATE,
        &claims.department_ids,
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let Some(name) = witness else {
        return Err(AppError::BadRequest(
            "The witness is not an active colleague in your department who may dispense."
                .to_owned(),
        ));
    };
    let password = password.map(str::trim).filter(|p| !p.is_empty()).ok_or_else(|| {
        AppError::BadRequest("The witness must confirm with their own password.".to_owned())
    })?;
    match check_user_password(
        state,
        (witness_id, claims.tenant_id),
        password,
        "witness_password_failed",
    )
    .await?
    {
        PasswordCheck::Right => Ok(name),
        PasswordCheck::Wrong => Err(AppError::BadRequest(
            "That is not the witness's password. Ask them to type it again.".to_owned(),
        )),
        PasswordCheck::Locked => Err(AppError::BadRequest(
            "The witness's account is locked after repeated wrong passwords. Ask another \
             colleague to witness, or wait 15 minutes."
                .to_owned(),
        )),
    }
}
