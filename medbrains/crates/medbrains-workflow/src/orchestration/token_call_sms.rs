//! The text a patient gets when their token is called.
//!
//! Every queue that calls patients — registration, OPD, lab, pharmacy,
//! billing, radiology — calls through the one `tokens` model, so this is
//! queued from the one place a call happens (`medbrains-tokens`), not per
//! module. It used to hang off `opd.queue.called` and so only OPD ever sent.
//!
//! India: a transactional SMS must match a DLT-registered template (TRAI
//! TCCCPR 2018). The payload names `template_scope` = [`SMS_EVENT`]; the SMS
//! handler renders the tenant's registered template for it and, with
//! `DLT_ENFORCE` on, refuses with the reason — a dead-letter row the token
//! settings screen reads back. Without a scope the handler refused every send
//! and nobody saw why.
//!
//! Privacy (DPDP Act 2023): the token number, where to go and the hospital's
//! name — never the patient's name, UHID or why they are here. Anyone can read
//! a lock screen.

use chrono::{DateTime, Utc};
use medbrains_outbox::OutboxError;
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::default_pipelines::{e164, enqueue};

/// Outbox event and DLT template scope — one name, so a template registered
/// against the event the operator sees in the dead-letter queue matches.
pub const SMS_EVENT: &str = "sms.token_called";

/// The wording to register with the DLT operator. `{#token#}`, `{#room#}` and
/// `{#hospital#}` are filled by the SMS handler from the payload's variables.
pub const TEMPLATE_PATTERN: &str =
    "Token {#token#} has been called. Please come to {#room#}. - {#hospital#}";

/// Where a patient with no room on the token is sent.
const NO_ROOM: &str = "the counter";

/// The token being called, as the caller already has it.
#[derive(Debug)]
pub struct TokenCall<'a> {
    pub token_id: Uuid,
    pub patient_id: Uuid,
    pub number: &'a str,
    /// The room, else the counter; `None` sends them to the counter.
    pub room: Option<&'a str>,
    pub called_at: Option<DateTime<Utc>>,
}

/// The message without a DLT template (outside India), identical to
/// [`TEMPLATE_PATTERN`] rendered — a test holds the two together.
#[must_use]
pub fn body(number: &str, room: &str, hospital: &str) -> String {
    format!("Token {number} has been called. Please come to {room}. - {hospital}")
}

/// Queue the SMS inside the call's transaction, when the hospital has it on,
/// the patient has a dialable mobile, and they have not withdrawn SMS consent.
///
/// # Errors
/// A database fault — the caller's transaction is lost with it anyway.
pub async fn queue_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    call: &TokenCall<'_>,
) -> Result<(), OutboxError> {
    let enabled: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'notifications' AND key = 'token_call_sms' \
           AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if enabled.and_then(|v| v.as_bool()) != Some(true) {
        return Ok(());
    }

    // SMS needs no opt-in for a service message, but a patient who said
    // "don't text me" is honoured: the newest `sms` answer, absent = allowed.
    let row: Option<(Option<String>, Option<bool>, String)> = sqlx::query_as(
        "SELECT p.phone, \
                (SELECT c.granted FROM patient_contact_consents c \
                  WHERE c.tenant_id = p.tenant_id AND c.patient_id = p.id AND c.channel = 'sms' \
                  ORDER BY c.recorded_at DESC LIMIT 1), \
                t.name \
           FROM patients p JOIN tenants t ON t.id = p.tenant_id \
          WHERE p.tenant_id = $1 AND p.id = $2",
    )
    .bind(tenant_id)
    .bind(call.patient_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((phone, sms_consent, hospital)) = row else {
        return Ok(());
    };
    if sms_consent == Some(false) {
        tracing::debug!(patient_id = %call.patient_id, "token-call SMS skipped — SMS withdrawn");
        return Ok(());
    }
    let Some(to) = phone.as_deref().and_then(e164) else {
        tracing::debug!(patient_id = %call.patient_id, "token-call SMS skipped — no mobile");
        return Ok(());
    };

    let room = call.room.unwrap_or(NO_ROOM);
    // A re-call of the same token is a new call and texts again; the same call
    // replayed is not.
    let call_key = call.called_at.map_or_else(
        || call.number.to_owned(),
        |at| at.timestamp_millis().to_string(),
    );
    enqueue(
        tx,
        tenant_id,
        "token",
        Some(call.token_id),
        SMS_EVENT,
        json!({
            "to": to,
            "token_id": call.token_id,
            "template_scope": SMS_EVENT,
            "variables": { "token": call.number, "room": room, "hospital": hospital },
            "body": body(call.number, room, &hospital),
        }),
        Some(format!("tokencall:{}:{call_key}", call.token_id)),
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{TEMPLATE_PATTERN, body};

    /// The fallback text and the registered wording say the same thing, so a
    /// hospital that registers the suggested pattern is not refused by the
    /// operator for a mismatch.
    #[test]
    fn the_fallback_body_is_the_template_rendered() {
        let rendered = TEMPLATE_PATTERN
            .replace("{#token#}", "A-42")
            .replace("{#room#}", "Room 3")
            .replace("{#hospital#}", "City Hospital");
        assert_eq!(body("A-42", "Room 3", "City Hospital"), rendered);
    }

    /// Only the number, the room and the hospital — nothing a lock screen
    /// should not show.
    #[test]
    fn the_template_carries_no_patient_detail() {
        let vars: Vec<&str> = TEMPLATE_PATTERN
            .split("{#")
            .skip(1)
            .filter_map(|s| s.split("#}").next())
            .collect();
        assert_eq!(vars, ["token", "room", "hospital"]);
    }
}
