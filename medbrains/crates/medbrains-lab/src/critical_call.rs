//! The lab-to-clinician phone call for a critical value, documented.
//!
//! NABL (and NABH's critical-results standard) ask for more than an
//! acknowledgement in the software: the laboratory telephones the treating
//! clinician, and the record names who called, who took the call, when, how
//! many attempts it took, and that the value was read back. Until now the
//! only place for that was a paper register beside the analyser.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::lab::LabCriticalAlert;
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
    /// The receiver read the value back and it matched.
    pub readback_confirmed: bool,
}

/// Check a call record before it is written: a name, a sane attempt count,
/// and a time that is neither in the future nor before the alert.
fn validate(body: &RecordCriticalCallRequest, alert_created: DateTime<Utc>) -> Result<(), String> {
    if body.received_by.trim().len() < 2 {
        return Err("Say who took the call.".to_owned());
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

/// `POST /api/lab/critical-alerts/{id}/phone-call` — document the call.
///
/// The caller is the signed-in technologist, never a typed name. Recording
/// the call does not acknowledge the alert: acknowledgement is the
/// clinician's read-back in the software, and stays theirs.
pub async fn record_critical_call(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(alert_id): Path<Uuid>,
    Json(body): Json<RecordCriticalCallRequest>,
) -> Result<Json<LabCriticalAlert>, AppError> {
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
    let created: DateTime<Utc> = sqlx::query_scalar(
        "SELECT created_at FROM lab_critical_alerts \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(alert_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    validate(&body, created).map_err(AppError::BadRequest)?;

    let alert = sqlx::query_as::<_, LabCriticalAlert>(
        "UPDATE lab_critical_alerts \
            SET phone_called_by = $3, phone_received_by = $4, \
                phone_called_at = COALESCE($5, now()), phone_attempts = $6, \
                phone_readback_confirmed = $7 \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(alert_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(body.received_by.trim())
    .bind(body.called_at)
    .bind(body.attempts)
    .bind(body.readback_confirmed)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(alert))
}

#[cfg(test)]
mod tests {
    use super::{RecordCriticalCallRequest, validate};
    use chrono::{Duration, Utc};

    fn call(received_by: &str, attempts: i16) -> RecordCriticalCallRequest {
        RecordCriticalCallRequest {
            received_by: received_by.to_owned(),
            called_at: None,
            attempts,
            readback_confirmed: true,
        }
    }

    #[test]
    fn a_call_needs_a_receiver_and_a_sane_attempt_count() {
        let created = Utc::now() - Duration::minutes(10);
        assert!(validate(&call("Dr Rao", 2), created).is_ok());
        assert!(validate(&call(" ", 1), created).is_err());
        assert!(validate(&call("Dr Rao", 0), created).is_err());
        let mut early = call("Dr Rao", 1);
        early.called_at = Some(created - Duration::hours(1));
        assert!(
            validate(&early, created).is_err(),
            "a call before the alert is not this call"
        );
    }
}
