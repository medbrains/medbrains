//! WhatsApp and SMS ingestion.
//!
//! The same shape as [`crate::telephony`]: a provider-agnostic event, an
//! adapter at the edge, and nothing in this crate that talks to a vendor. A
//! WhatsApp business solution provider and an SMS gateway both translate into
//! [`MessageEvent`] and post it.
//!
//! # Why an inbound message does not grant consent
//!
//! It is tempting to set `consent_whatsapp` when somebody messages the
//! hospital — they started the conversation, so replying is obviously fine.
//! Replying **is** fine, and the session window the platforms give you exists
//! for exactly that.
//!
//! But consent under the DPDP Act is consent to a stated purpose, and
//! "answering the question I asked" is not "sending me campaigns". A person
//! who asks about visiting hours has not agreed to a reactivation drive six
//! months later, and a system that quietly converts one into the other builds
//! a marketing list out of people who never opted into one.
//!
//! So ingestion records the message and leaves the consent flags alone. They
//! are set where consent is actually captured, with a source and a timestamp.
//!
//! # Idempotency
//!
//! Providers retry, so the provider's own message id becomes `external_ref`
//! and the unique partial index from `0977` does the rest — the same mechanism
//! that stops a replayed call booking a second callback.

use axum::{Extension, Json, extract::State, http::StatusCode};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::contacts::{CHANNEL_PHONE, CHANNEL_WHATSAPP, resolve_or_create};
use crate::telephony::CallDirection;

/// Which messaging channel carried it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageChannel {
    Whatsapp,
    Sms,
}

impl MessageChannel {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Whatsapp => "whatsapp",
            Self::Sms => "sms",
        }
    }

    /// The identity channel this message resolves a contact through.
    ///
    /// A WhatsApp number and a phone number are the same digits and different
    /// identities: somebody can be reachable on one and not the other, and
    /// collapsing them would silently claim WhatsApp reachability the hospital
    /// has never verified.
    #[must_use]
    pub const fn identity_channel(self) -> &'static str {
        match self {
            Self::Whatsapp => CHANNEL_WHATSAPP,
            Self::Sms => CHANNEL_PHONE,
        }
    }
}

/// One message, inbound or outbound.
#[derive(Debug, Clone)]
pub struct MessageEvent {
    /// The provider's message id — what makes a retry idempotent.
    pub external_ref: String,
    pub channel: MessageChannel,
    pub direction: CallDirection,
    /// Raw, as the provider sent it. Normalised at ingestion, not by the
    /// adapter.
    pub counterparty: String,
    pub body: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub agent_id: Option<Uuid>,
}

/// Record a message against the contact it came from, creating the contact if
/// the number is new.
///
/// Unlike a missed call this raises no task. A message sits in a thread the
/// agent can see; a call that rang out leaves no trace anywhere else, which is
/// why only the call path books a callback.
///
/// # Errors
/// Propagates database errors, or `AppError::BadRequest` if the number cannot
/// be normalised.
pub async fn ingest_message(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    event: &MessageEvent,
) -> Result<Uuid, AppError> {
    let contact = resolve_or_create(
        tx,
        tenant_id,
        event.channel.identity_channel(),
        &event.counterparty,
        event.channel.as_str(),
    )
    .await?;

    let inserted: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO mkt_interactions \
            (tenant_id, contact_id, kind, channel, direction, occurred_at, \
             agent_id, note, external_ref) \
         VALUES ($1, $2, 'message', $3, $4, $5, $6, $7, $8) \
         ON CONFLICT (tenant_id, external_ref) WHERE external_ref IS NOT NULL \
         DO NOTHING \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(contact.id)
    .bind(event.channel.as_str())
    .bind(event.direction.as_str())
    .bind(event.occurred_at)
    .bind(event.agent_id)
    .bind(event.body.as_deref())
    .bind(&event.external_ref)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(interaction_id) = inserted else {
        let existing: Uuid = sqlx::query_scalar(
            "SELECT id FROM mkt_interactions WHERE tenant_id = $1 AND external_ref = $2",
        )
        .bind(tenant_id)
        .bind(&event.external_ref)
        .fetch_one(&mut **tx)
        .await?;
        return Ok(existing);
    };

    // Both directions count as contact: an agent replying is contact, and so
    // is the patient writing in — the desk has heard from them and the
    // worklist should order accordingly. Consent flags are deliberately
    // untouched; see the module note.
    sqlx::query(
        "UPDATE mkt_contacts SET last_contacted_at = GREATEST( \
            COALESCE(last_contacted_at, $3), $3), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact.id)
    .bind(tenant_id)
    .bind(event.occurred_at)
    .execute(&mut **tx)
    .await?;

    Ok(interaction_id)
}

#[derive(Debug, Deserialize)]
pub struct MessageWebhook {
    pub message_id: String,
    /// `whatsapp` or `sms`.
    pub channel: String,
    /// `inbound` or `outbound`.
    pub direction: String,
    /// The patient's number, whichever way the message went.
    pub counterparty: String,
    pub body: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub agent_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct MessageAccepted {
    pub interaction_id: Uuid,
}

/// Parse a channel, refusing anything unrecognised.
fn parse_channel(raw: &str) -> Result<MessageChannel, AppError> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "whatsapp" | "wa" => Ok(MessageChannel::Whatsapp),
        "sms" | "text" => Ok(MessageChannel::Sms),
        other => Err(AppError::BadRequest(format!(
            "unknown message channel '{other}' — expected whatsapp or sms"
        ))),
    }
}

fn parse_direction(raw: &str) -> Result<CallDirection, AppError> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "inbound" | "incoming" | "received" => Ok(CallDirection::Inbound),
        "outbound" | "outgoing" | "sent" => Ok(CallDirection::Outbound),
        other => Err(AppError::BadRequest(format!(
            "unknown message direction '{other}' — expected inbound or outbound"
        ))),
    }
}

/// `POST /api/marketing/messaging/messages`
///
/// # Errors
/// Returns 403 without `marketing.messaging.ingest`, 400 for an unparseable
/// channel, direction or number.
pub async fn ingest_message_webhook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MessageWebhook>,
) -> Result<(StatusCode, Json<MessageAccepted>), AppError> {
    require_permission(&claims, permissions::marketing::messaging::INGEST)?;

    let event = MessageEvent {
        external_ref: body.message_id,
        channel: parse_channel(&body.channel)?,
        direction: parse_direction(&body.direction)?,
        counterparty: body.counterparty,
        body: body.body,
        occurred_at: body.occurred_at,
        agent_id: body.agent_id,
    };

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let interaction_id = ingest_message(&mut tx, claims.tenant_id, &event).await?;
    tx.commit().await?;

    Ok((StatusCode::ACCEPTED, Json(MessageAccepted { interaction_id })))
}

#[cfg(test)]
mod tests {
    use super::{MessageChannel, parse_channel, parse_direction};
    use crate::contacts::{CHANNEL_PHONE, CHANNEL_WHATSAPP};
    use crate::telephony::CallDirection;

    #[test]
    fn whatsapp_and_sms_resolve_through_different_identities() {
        // Same digits, different identity. Somebody reachable by SMS is not
        // thereby reachable on WhatsApp, and collapsing the two would claim a
        // reachability the hospital has never verified.
        assert_eq!(MessageChannel::Whatsapp.identity_channel(), CHANNEL_WHATSAPP);
        assert_eq!(MessageChannel::Sms.identity_channel(), CHANNEL_PHONE);
        assert_ne!(
            MessageChannel::Whatsapp.identity_channel(),
            MessageChannel::Sms.identity_channel()
        );
    }

    #[test]
    fn an_unknown_channel_is_refused_rather_than_defaulted() {
        // Defaulting to SMS would send a WhatsApp thread down a DLT-registered
        // template path and silently drop it at the carrier.
        assert!(parse_channel("telegram").is_err());
        assert!(parse_channel("").is_err());
        assert_eq!(parse_channel("WA").ok(), Some(MessageChannel::Whatsapp));
    }

    #[test]
    fn the_words_providers_send_for_direction_all_map() {
        for inbound in ["inbound", "Incoming", "received"] {
            assert_eq!(parse_direction(inbound).ok(), Some(CallDirection::Inbound), "{inbound}");
        }
        for outbound in ["outbound", "Outgoing", "sent"] {
            assert_eq!(parse_direction(outbound).ok(), Some(CallDirection::Outbound), "{outbound}");
        }
        assert!(parse_direction("internal").is_err());
    }
}
