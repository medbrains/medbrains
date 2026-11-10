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
//!
//! Wrong witness passwords have their own counter, kept in the audit chain as
//! `witness_password_failed` (dispenser as the actor, witness as the entity,
//! the dispenser's address): five in fifteen minutes stops that dispenser, and
//! five against one witness pauses that witness's confirmations. Neither
//! touches the sign-in lockout, so a dispenser mistyping cannot lock a
//! colleague out of the hospital system. The witness still confirms at the
//! dispenser's screen; confirming from their own session is a follow-up.

use axum::Extension;
use axum::{
    Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use medbrains_server_core::step_up::password_matches;
use serde::{Deserialize, Serialize};
use std::fmt;
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
    let name = medbrains_server_core::search::contains_pattern(query.q.as_deref());
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

/// How many wrong witness passwords one dispenser, or one witness, may have
/// in the window.
const WITNESS_FAILURES: i64 = 5;
/// The window those failures are counted over, in minutes.
const WITNESS_WINDOW_MINUTES: i32 = 15;
/// The audit action a wrong witness password is filed under.
const WITNESS_FAILED_ACTION: &str = "witness_password_failed";

/// The witness's password exactly as typed. Never printed, never trimmed.
#[derive(Deserialize)]
#[serde(transparent)]
pub struct WitnessPassword(String);

impl WitnessPassword {
    /// The password, for the hash comparison only.
    fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for WitnessPassword {
    /// Redacted: a request body logged with `{:?}` must not carry it.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("WitnessPassword(<redacted>)")
    }
}

/// One attempt to confirm a witness: who, with what, on which order, from where.
#[derive(Debug, Clone, Copy)]
pub struct WitnessAttempt<'a> {
    pub witness_id: Uuid,
    pub password: Option<&'a WitnessPassword>,
    pub order_id: Uuid,
    /// The dispenser's address, filed with a wrong password.
    pub ip: Option<&'a str>,
}

/// Checks the witness to a controlled dispense and returns their name.
///
/// Refuses the dispenser as their own witness; a dispenser, or a witness, with
/// five wrong witness passwords in fifteen minutes; anyone who is not an
/// active colleague in one of the dispenser's departments still allowed to
/// dispense (role grant, personal grant, minus a personal denial); a witness
/// whose sign-in is locked; and a password that is not the witness's own. A
/// wrong password is written to the audit chain before the refusal is
/// answered: if it cannot be written, the
/// dispense fails rather than letting an uncounted guess through. Each refusal
/// is a 400 (429 for the limits) the dispense screen shows, never a 401.
pub async fn verify_witness(
    state: &AppState,
    claims: &Claims,
    attempt: &WitnessAttempt<'_>,
) -> Result<String, AppError> {
    if attempt.witness_id == claims.sub {
        return Err(AppError::BadRequest(
            "The witness must be a second person, not the pharmacist dispensing.".to_owned(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(claims)).await?;
    let failures = sqlx::query!(
        "SELECT COUNT(*) FILTER (WHERE user_id = $2) AS \"by_dispenser!\", \
                COUNT(*) FILTER (WHERE entity_id = $3) AS \"against_witness!\" \
           FROM audit_log \
          WHERE tenant_id = $1 AND action = $4 \
            AND created_at > now() - make_interval(mins => $5)",
        claims.tenant_id,
        claims.sub,
        attempt.witness_id,
        WITNESS_FAILED_ACTION,
        WITNESS_WINDOW_MINUTES,
    )
    .fetch_one(&mut *tx)
    .await?;
    if failures.by_dispenser >= WITNESS_FAILURES {
        return Err(AppError::TooManyRequests(format!(
            "Too many failed witness confirmations. Try again in {WITNESS_WINDOW_MINUTES} minutes."
        )));
    }
    if failures.against_witness >= WITNESS_FAILURES {
        return Err(AppError::TooManyRequests(format!(
            "This colleague's witness confirmations are paused for {WITNESS_WINDOW_MINUTES} \
             minutes after repeated wrong passwords. Ask another colleague to witness. Their \
             sign-in is not affected."
        )));
    }
    let witness = sqlx::query!(
        "SELECT u.full_name, u.password_hash \
           FROM users u \
           JOIN roles r ON r.code = u.role::text AND r.tenant_id = u.tenant_id \
                       AND r.deleted_at IS NULL \
          WHERE u.id = $1 AND u.tenant_id = $2 AND u.is_active AND u.deleted_at IS NULL \
            AND u.department_ids && $4::uuid[] \
            AND (r.permissions ? $3 OR COALESCE(u.access_matrix->'extra' ? $3, false)) \
            AND NOT COALESCE(u.access_matrix->'denied' ? $3, false)",
        attempt.witness_id,
        claims.tenant_id,
        permissions::pharmacy::dispensing::CREATE,
        &claims.department_ids,
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let Some(witness) = witness else {
        return Err(AppError::BadRequest(
            "The witness is not an active colleague in your department who may dispense."
                .to_owned(),
        ));
    };
    // A colleague locked out of signing in is not confirming anything here
    // either; disabled accounts never reach this point (`is_active` above).
    if medbrains_server_core::lockout::is_locked(state, (attempt.witness_id, claims.tenant_id))
        .await?
    {
        return Err(AppError::BadRequest(
            "This colleague's sign-in is locked after repeated wrong passwords, so they cannot \
             witness until it unlocks. Ask another colleague."
                .to_owned(),
        ));
    }
    let password = attempt
        .password
        .map(WitnessPassword::expose)
        .filter(|p| !p.is_empty())
        .ok_or_else(|| {
            AppError::BadRequest("The witness must confirm with their own password.".to_owned())
        })?;
    if password_matches(witness.password_hash.as_deref(), password) {
        return Ok(witness.full_name);
    }
    file_wrong_password(state, claims, attempt).await?;
    Err(AppError::BadRequest(
        "That is not the witness's password. Ask them to type it again.".to_owned(),
    ))
}

/// Writes a wrong witness password to the audit chain, in its own unit of
/// work (the dispense rolls back with the refusal). Not best-effort: this row
/// is the counter that bounds guessing.
async fn file_wrong_password(
    state: &AppState,
    claims: &Claims,
    attempt: &WitnessAttempt<'_>,
) -> Result<(), AppError> {
    let detail = serde_json::json!({ "order_id": attempt.order_id });
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(claims)).await?;
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: WITNESS_FAILED_ACTION,
            entity_type: "user",
            entity_id: Some(attempt.witness_id),
            old_values: None,
            new_values: Some(&detail),
            ip_address: attempt.ip,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::WitnessPassword;

    #[test]
    fn a_witness_password_never_prints_and_keeps_its_spaces() -> Result<(), serde_json::Error> {
        let typed: WitnessPassword = serde_json::from_str("\" secret \"")?;
        assert_eq!(format!("{typed:?}"), "WitnessPassword(<redacted>)");
        assert_eq!(typed.expose(), " secret ");
        Ok(())
    }
}
