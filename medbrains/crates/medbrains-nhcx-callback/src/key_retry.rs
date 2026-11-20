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

/// When the callback is a key refusal ([`is_key_refusal`]), re-arm the
/// refused message's outbox event, once: the event goes back to pending with
/// `key_retry` set, which makes the handler fetch the certificate again. An
/// event already re-armed, or any other callback, is left alone.
///
/// # Errors
/// Database errors only.
pub(crate) async fn resend(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<bool, AppError> {
    if !is_key_refusal(m.status, m.response) {
        return Ok(false);
    }
    let armed = sqlx::query!(
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
          RETURNING payload->>'record' AS record, (payload->>'record_id')::uuid AS record_id",
        m.tenant_id,
        m.correlation_id.to_string(),
        m.sender,
        RESENDING,
    )
    .fetch_optional(&mut **tx)
    .await?;
    let Some((Some(record), Some(record_id))) = armed.map(|r| (r.record, r.record_id)) else {
        return Ok(false);
    };
    if let Ok(record) = serde_json::from_value::<NhcxRecord>(Value::String(record)) {
        mark_queued(tx, record, record_id, m.tenant_id).await?;
    }
    Ok(true)
}

/// Show the record as waiting to send again, with why. One statement per
/// table, so each is checked at compile time.
async fn mark_queued(
    tx: &mut Tx<'_>,
    record: NhcxRecord,
    id: Uuid,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    let done =
        match record {
            NhcxRecord::InsuranceClaim => {
                sqlx::query!(
                    "UPDATE insurance_claims SET nhcx_status = 'queued', nhcx_disposition = $1 \
              WHERE id = $2 AND tenant_id = $3",
                    RESENDING,
                    id,
                    tenant_id
                )
                .execute(&mut **tx)
                .await
            }
            NhcxRecord::PriorAuth => {
                sqlx::query!(
                    "UPDATE prior_auth_requests SET nhcx_status = 'queued', nhcx_disposition = $1 \
              WHERE id = $2 AND tenant_id = $3",
                    RESENDING,
                    id,
                    tenant_id
                )
                .execute(&mut **tx)
                .await
            }
            NhcxRecord::Verification => sqlx::query!(
                "UPDATE insurance_verifications SET nhcx_status = 'queued', nhcx_disposition = $1 \
              WHERE id = $2 AND tenant_id = $3",
                RESENDING,
                id,
                tenant_id
            )
            .execute(&mut **tx)
            .await,
            NhcxRecord::PayerQuery | NhcxRecord::Task | NhcxRecord::PaymentNotice => {
                return mark_exchange_queued(tx, record, id, tenant_id).await;
            }
        };
    done?;
    Ok(())
}

/// [`mark_queued`] for the records of an exchange already under way: a payer
/// query, a task and a payment notice.
async fn mark_exchange_queued(
    tx: &mut Tx<'_>,
    record: NhcxRecord,
    id: Uuid,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    let done = match record {
        NhcxRecord::PayerQuery => {
            sqlx::query!(
                "UPDATE nhcx_payer_queries SET nhcx_status = 'queued', nhcx_disposition = $1 \
              WHERE id = $2 AND tenant_id = $3",
                RESENDING,
                id,
                tenant_id
            )
            .execute(&mut **tx)
            .await
        }
        NhcxRecord::Task => {
            sqlx::query!(
                "UPDATE nhcx_tasks SET nhcx_status = 'queued', nhcx_disposition = $1 \
              WHERE id = $2 AND tenant_id = $3",
                RESENDING,
                id,
                tenant_id
            )
            .execute(&mut **tx)
            .await
        }
        NhcxRecord::PaymentNotice => {
            sqlx::query!(
                "UPDATE nhcx_payment_notices SET nhcx_status = 'queued', nhcx_disposition = $1 \
              WHERE id = $2 AND tenant_id = $3",
                RESENDING,
                id,
                tenant_id
            )
            .execute(&mut **tx)
            .await
        }
        // The request records are marked by `mark_queued` itself.
        NhcxRecord::InsuranceClaim | NhcxRecord::PriorAuth | NhcxRecord::Verification => {
            return Ok(());
        }
    };
    done?;
    Ok(())
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
