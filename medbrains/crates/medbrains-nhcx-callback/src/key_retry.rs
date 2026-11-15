//! A payer that could not open a message because of the key (T-SES-02,
//! NHA provider checklist): `PAYR-1001` "Error while decrypting request …
//! reprocess the request encrypting with valid certificate of the payer", or
//! `PAYR-1002` on its encryption side. The message is sent again once, with
//! the certificate fetched fresh from the registry; a second key refusal is
//! shown to the desk as it came.

use medbrains_core::nhcx::NhcxRecord;
use serde_json::Value;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::apply::{Inbound, Tx};

/// The two payer codes every payer space agrees on, both about keys
/// (docs.abdm.gov.in "Error codes": the `PAYR-` spaces collide elsewhere).
const KEY_REFUSALS: [&str; 2] = ["PAYR-1001", "PAYR-1002"];

/// What the desk reads while the message goes again.
const RESENDING: &str =
    "The payer could not open it with the certificate on file; sending again with a fresh one";

/// Whether a protocol error is a key refusal, by its `x-hcx-error_details`
/// code.
pub(crate) fn is_key_refusal(status: &str, response: &Value) -> bool {
    status == "response.error"
        && response
            .pointer("/x-hcx-error_details/code")
            .and_then(Value::as_str)
            .is_some_and(|c| KEY_REFUSALS.contains(&c.trim()))
}

/// Re-arm the refused message's outbox event, once: the event goes back to
/// pending with `key_retry` set, which makes the handler fetch the
/// certificate again. An event already re-armed is left alone.
///
/// # Errors
/// Database errors only.
pub(crate) async fn resend(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<bool, AppError> {
    let armed: Option<(Option<String>, Option<Uuid>)> = sqlx::query_as(
        "UPDATE outbox_events SET status = 'pending', attempts = 1, next_retry_at = now(), \
                claimed_at = NULL, claimed_by = NULL, last_error = $4, \
                payload = payload || '{\"key_retry\": true}'::jsonb \
          WHERE id = (SELECT id FROM outbox_events \
                       WHERE tenant_id = $1 AND event_type LIKE 'nhcx.%' \
                         AND payload->>'correlation_id' = $2 \
                         AND payload->>'recipient_code' = $3 \
                         AND status = 'sent' AND NOT (payload ? 'key_retry') \
                         AND deleted_at IS NULL \
                       ORDER BY created_at DESC LIMIT 1 FOR UPDATE) \
          RETURNING payload->>'record', (payload->>'record_id')::uuid",
    )
    .bind(m.tenant_id)
    .bind(m.correlation_id.to_string())
    .bind(m.sender)
    .bind(RESENDING)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((Some(record), Some(record_id))) = armed else {
        return Ok(false);
    };
    let Ok(record) = serde_json::from_value::<NhcxRecord>(Value::String(record)) else {
        return Ok(true);
    };
    // The table name comes from a closed enum, never from the payload text.
    let sql = format!(
        "UPDATE {} SET nhcx_status = 'queued', nhcx_disposition = $1 \
          WHERE id = $2 AND tenant_id = $3",
        record.table()
    );
    sqlx::query(&sql)
        .bind(RESENDING)
        .bind(record_id)
        .bind(m.tenant_id)
        .execute(&mut **tx)
        .await?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_a_key_error_on_an_error_response_is_resent() {
        let decrypt = json!({ "x-hcx-error_details": { "code": "PAYR-1001",
            "message": "Error while decrypting request." } });
        let other = json!({ "x-hcx-error_details": { "code": "PAYR-1321" } });
        assert!(is_key_refusal("response.error", &decrypt));
        assert!(is_key_refusal(
            "response.error",
            &json!({ "x-hcx-error_details": { "code": " PAYR-1002 " } })
        ));
        assert!(!is_key_refusal("response.complete", &decrypt));
        assert!(!is_key_refusal("response.error", &other));
        assert!(!is_key_refusal("response.error", &json!({})));
    }
}
