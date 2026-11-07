//! The lab-to-clinician phone call for a critical value, documented.
//!
//! NABL (and NABH's critical-results standard) ask for more than an
//! acknowledgement in the software: the laboratory telephones the treating
//! clinician, and the record names who called, who took the call, when, how
//! many attempts it took, and what value was read back. Until now the only
//! place for that was a paper register beside the analyser.
//!
//! Each call is its own row of `lab_critical_calls`, append-only (a trigger
//! refuses updates and deletes): a second call is a second row, never an
//! overwrite of the first. Whether the read-back matched is decided here,
//! against the reported value, not claimed by the client.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::lab::LabCriticalCall;
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct RecordCriticalCallRequest {
    /// Name and role of the person who took the call ("Dr Rao, ward 4 SR").
    pub received_by: String,
    /// When the call connected; defaults to now.
    pub called_at: Option<DateTime<Utc>>,
    /// Calls made before somebody answered, this one included.
    pub attempts: i16,
    /// The value the receiver read back, as they said it.
    pub readback_value: String,
}

/// Check a call record before it is written: a name, a read-back, a sane
/// attempt count, and a time neither in the future nor before the alert.
fn validate(body: &RecordCriticalCallRequest, alert_created: DateTime<Utc>) -> Result<(), String> {
    if body.received_by.trim().len() < 2 {
        return Err("Say who took the call.".to_owned());
    }
    if body.readback_value.trim().is_empty() {
        return Err("Record the value the receiver read back.".to_owned());
    }
    if !(1..=20).contains(&body.attempts) {
        return Err("Attempts must be between 1 and 20.".to_owned());
    }
    if let Some(at) = body.called_at
        && (at > Utc::now() + Duration::minutes(5) || at < alert_created - Duration::minutes(5))
    {
        return Err("The call time must be after the alert and not in the future.".to_owned());
    }
    Ok(())
}

/// Whether a read-back matches the reported value: the same text, ignoring
/// case and surrounding space ("6.9" = " 6.9 ", "Positive" = "positive").
fn matches_reported(readback: &str, reported: &str) -> bool {
    readback.trim().eq_ignore_ascii_case(reported.trim())
}

/// `POST /api/lab/critical-alerts/{id}/phone-call` — document one call.
///
/// The caller is the signed-in technologist, never a typed name. Recording
/// the call does not acknowledge the alert: acknowledgement is the
/// clinician's read-back in the software, and stays theirs.
pub async fn record_critical_call(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(alert_id): Path<Uuid>,
    Json(body): Json<RecordCriticalCallRequest>,
) -> Result<Json<LabCriticalCall>, AppError> {
    require_permission(&claims, permissions::lab::results::CRITICAL_CALL)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_CRITICAL_ALERT,
        alert_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (created, reported): (DateTime<Utc>, String) = sqlx::query_as(
        "SELECT created_at, value FROM lab_critical_alerts \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(alert_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    validate(&body, created).map_err(AppError::BadRequest)?;

    let call = sqlx::query_as::<_, LabCriticalCall>(
        "INSERT INTO lab_critical_calls \
           (tenant_id, alert_id, called_by, received_by, called_at, attempts, \
            readback_value, readback_confirmed) \
         VALUES ($1, $2, $3, $4, COALESCE($5, now()), $6, $7, $8) \
         RETURNING id, alert_id, called_by, received_by, called_at, attempts, \
                   readback_value, readback_confirmed",
    )
    .bind(claims.tenant_id)
    .bind(alert_id)
    .bind(claims.sub)
    .bind(body.received_by.trim())
    .bind(body.called_at)
    .bind(body.attempts)
    .bind(body.readback_value.trim())
    .bind(matches_reported(&body.readback_value, &reported))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(call))
}

#[cfg(test)]
mod tests {
    use super::{RecordCriticalCallRequest, matches_reported, validate};
    use chrono::{Duration, Utc};

    fn call(received_by: &str, attempts: i16) -> RecordCriticalCallRequest {
        RecordCriticalCallRequest {
            received_by: received_by.to_owned(),
            called_at: None,
            attempts,
            readback_value: "6.9".to_owned(),
        }
    }

    #[test]
    fn a_call_needs_a_receiver_a_readback_and_a_sane_attempt_count() {
        let created = Utc::now() - Duration::minutes(10);
        assert!(validate(&call("Dr Rao", 2), created).is_ok());
        assert!(validate(&call(" ", 1), created).is_err());
        assert!(validate(&call("Dr Rao", 0), created).is_err());
        let mut silent = call("Dr Rao", 1);
        silent.readback_value = " ".to_owned();
        assert!(validate(&silent, created).is_err());
        let mut early = call("Dr Rao", 1);
        early.called_at = Some(created - Duration::hours(1));
        assert!(
            validate(&early, created).is_err(),
            "a call before the alert is not this call"
        );
    }

    #[test]
    fn the_server_decides_whether_the_readback_matched() {
        assert!(matches_reported(" 6.9 ", "6.9"));
        assert!(matches_reported("positive", "Positive"));
        assert!(!matches_reported("9.6", "6.9"));
    }
}
