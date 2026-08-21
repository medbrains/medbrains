//! Call-event ingestion from the phone system.
//!
//! One endpoint, one canonical payload. Whichever switch a hospital runs —
//! FreePBX over AMI, Exotel, MyOperator — an adapter at the edge translates
//! into the shape below and posts it. Translation lives outside this crate on
//! purpose: a provider that renames `CallSid` should not reach the pipeline.
//!
//! ## Why this is a machine endpoint
//!
//! `marketing.telephony.ingest` is held by no built-in role. Call history is
//! what the missed-call rate and every conversion report are computed from, so
//! the ability to write it is machine identity — an API key with an explicit
//! permission list — and not something any human's role carries.
//!
//! ## Why it is idempotent
//!
//! Providers retry anything that did not return 2xx, and an AMI reconnect
//! replays events across the gap. `external_ref` is the switch's own call id
//! and carries a unique index, so a replayed event returns the interaction it
//! already created rather than booking a second callback for the same patient.
//!
//! ## What the adapter must not do
//!
//! Normalise the number. `phone::normalise` runs once, at ingestion, so that
//! the write and the screen-pop read agree; an adapter that helpfully cleans
//! the number first is how the two drift apart.

use axum::{Extension, Json, extract::State, http::StatusCode};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::interactions::ingest_call;
use crate::telephony::{CallDirection, CallEvent, CallOutcome};

/// The canonical call payload.
///
/// Deliberately close to `CallEvent` rather than to any provider's schema. The
/// mapping from a provider lives in its adapter, and the shape a provider
/// happens to use this quarter never becomes this module's problem.
#[derive(Debug, Deserialize)]
pub struct CallWebhook {
    /// The switch's own call id. Required: without it the endpoint cannot be
    /// idempotent, and a retry would double-count.
    pub call_id: String,
    /// `inbound` or `outbound`.
    pub direction: String,
    /// Raw, as the carrier delivered it.
    pub from: String,
    /// The DID or queue dialled — how a call maps to a specialty.
    pub to: Option<String>,
    /// `answered`, `no_answer`, `abandoned` or `rejected`.
    pub outcome: String,
    pub started_at: DateTime<Utc>,
    pub duration_secs: Option<i32>,
    pub agent_id: Option<Uuid>,
    pub recording_ref: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CallWebhookAccepted {
    pub interaction_id: Uuid,
}

/// Parse a direction, refusing anything unrecognised.
///
/// A provider that sends a third word gets a 400 rather than a silent default.
/// Guessing here would mis-sort the call out of the inbound index, which is
/// where the missed-call number comes from.
fn parse_direction(raw: &str) -> Result<CallDirection, AppError> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "inbound" | "incoming" => Ok(CallDirection::Inbound),
        "outbound" | "outgoing" => Ok(CallDirection::Outbound),
        other => Err(AppError::BadRequest(format!(
            "unknown call direction '{other}' — expected inbound or outbound"
        ))),
    }
}

/// Parse an outcome, refusing anything unrecognised.
///
/// Notably there is no "assume answered" branch. An unknown outcome silently
/// treated as answered would erase exactly the calls this product exists to
/// count.
fn parse_outcome(raw: &str) -> Result<CallOutcome, AppError> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "answered" | "completed" | "bridged" => Ok(CallOutcome::Answered),
        "no_answer" | "noanswer" | "no-answer" | "missed" => Ok(CallOutcome::NoAnswer),
        "abandoned" | "cancelled" | "canceled" => Ok(CallOutcome::Abandoned),
        "rejected" | "busy" | "failed" | "congestion" => Ok(CallOutcome::Rejected),
        other => Err(AppError::BadRequest(format!(
            "unknown call outcome '{other}' — expected answered, no_answer, \
             abandoned or rejected"
        ))),
    }
}

impl CallWebhook {
    /// Translate into the crate's own vocabulary.
    ///
    /// # Errors
    /// Returns `AppError::BadRequest` for an unrecognised direction or outcome.
    pub fn into_event(self) -> Result<CallEvent, AppError> {
        Ok(CallEvent {
            external_ref: self.call_id,
            direction: parse_direction(&self.direction)?,
            caller_number: self.from,
            dialled_number: self.to,
            outcome: parse_outcome(&self.outcome)?,
            started_at: self.started_at,
            duration_secs: self.duration_secs,
            agent_id: self.agent_id,
            recording_ref: self.recording_ref,
        })
    }
}

/// `POST /api/marketing/telephony/calls`
///
/// # Errors
/// Returns 403 without `marketing.telephony.ingest`, 400 for an unparseable
/// direction, outcome or caller number.
pub async fn ingest_call_webhook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CallWebhook>,
) -> Result<(StatusCode, Json<CallWebhookAccepted>), AppError> {
    require_permission(&claims, permissions::marketing::telephony::INGEST)?;

    let event = body.into_event()?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let interaction_id = ingest_call(&mut tx, claims.tenant_id, &event).await?;
    tx.commit().await?;

    Ok((
        StatusCode::ACCEPTED,
        Json(CallWebhookAccepted { interaction_id }),
    ))
}

#[cfg(test)]
mod tests {
    use super::{parse_direction, parse_outcome};
    use crate::telephony::{CallDirection, CallOutcome};

    #[test]
    fn an_unknown_outcome_is_refused_rather_than_assumed_answered() {
        // The whole product is a missed-call count. A provider word this
        // module does not know must not quietly become "answered", because
        // that erases the calls it exists to find.
        assert!(parse_outcome("voicemail").is_err());
        assert!(parse_outcome("").is_err());
    }

    #[test]
    fn the_words_providers_actually_send_all_map() {
        for answered in ["answered", "Completed", "BRIDGED"] {
            assert_eq!(parse_outcome(answered).ok(), Some(CallOutcome::Answered), "{answered}");
        }
        for missed in ["no_answer", "no-answer", "NoAnswer", "missed"] {
            assert_eq!(parse_outcome(missed).ok(), Some(CallOutcome::NoAnswer), "{missed}");
        }
        for busy in ["busy", "failed", "congestion", "rejected"] {
            assert_eq!(parse_outcome(busy).ok(), Some(CallOutcome::Rejected), "{busy}");
        }
    }

    #[test]
    fn direction_is_refused_rather_than_defaulted() {
        // Guessing sorts the call out of the inbound partial index, which is
        // where the missed-call number is computed.
        assert_eq!(parse_direction("incoming").ok(), Some(CallDirection::Inbound));
        assert_eq!(parse_direction("Outgoing").ok(), Some(CallDirection::Outbound));
        assert!(parse_direction("internal").is_err());
    }
}
