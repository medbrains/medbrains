//! The link token's life on our side (ABDM v3 HIP-initiated linking,
//! NHA `HIP_INTI_LINK_504`/`505`, #5711):
//!
//! - **One request per patient.** Two records finalised together queue two
//!   link events that run at once. The first locks the patient's ABHA link,
//!   records the token request it is about to send, and marks every pending
//!   care context as waiting on it; the second finds that request in flight
//!   and joins it. When the token arrives, `on-generate-token` links all of
//!   them in one call.
//! - **A rejected token is forgotten.** ABDM-1026 (invalid or expired) and
//!   ABDM-1038 (issued for another ABHA address) mean the stored token is
//!   useless; ABDM says never to resend it. It is cleared and a new one asked
//!   for once. A second rejection within the hour is left on screen rather
//!   than looping.
//! - **Out of order is resumed, not dropped.** ABDM-2406 means the gateway
//!   thinks we are on another step. The link is queued again a minute later,
//!   once per batch: it runs from the top, reusing a live token or asking for
//!   one, so the steps go in order.

use chrono::Datelike;
use medbrains_abdm::errors::{OUT_OF_SEQUENCE, code_of, is_link_token_rejected, normalize};
use medbrains_abdm::gateway::GENERATE_LINK_TOKEN_PATH;
use serde_json::{Value, json};
use uuid::Uuid;

use super::gateway::Hip;
use super::linking::{
    LINK_BATCH, PatientAbdm, abha_number_value, load_patient, mark, message, send_links,
};
use crate::error::AppError;

/// A token request with no answer after this long is taken as lost.
const TOKEN_REQUEST_MINUTES: i32 = 10;
/// Wait before linking again after ABDM-2406.
const OUT_OF_SEQUENCE_RETRY_SECONDS: f64 = 60.0;
/// Shown when ABDM refuses a token we had only just been given.
const TOKEN_REJECTED_AGAIN: &str = "ABDM refused the linking permission again. Verify the patient's \
     ABHA, then link the records again (code ABDM-1026)";
/// Shown while an out-of-order link waits to be sent again.
const RELINKING: &str = "ABDM took the linking steps out of order; linking again in a minute";
/// Shown when an out-of-order link was already sent again once.
const OUT_OF_ORDER_AGAIN: &str = "ABDM took the linking steps out of order again. Link the \
     records again from the chart (code ABDM-2406)";

/// What became of a token request.
#[derive(Debug, Eq, PartialEq)]
pub(super) enum TokenAsk {
    /// We asked ABDM; the token arrives at `on-generate-token`.
    Sent,
    /// Another record's request for this patient is in flight; ours joined it.
    Joined,
    /// A token was stored meanwhile: link with it instead.
    Stored,
}

/// The body of `generate-token`: who the token is for.
fn token_body(p: &PatientAbdm) -> Value {
    json!({
        "abhaNumber": abha_number_value(p.abha_number.as_deref()),
        "abhaAddress": p.abha_address,
        "name": p.name,
        "gender": p.gender_code(),
        "yearOfBirth": p.date_of_birth.map(|d| d.year()),
    })
}

/// Ask ABDM for a link token for `p`, unless a request for them is already
/// in flight (then join it) or a token has been stored meanwhile. Every
/// pending care context of the patient is marked as waiting on the request
/// before it is sent, since the gateway can answer before the call returns.
///
/// # Errors
/// Database faults; ABDM refusals and outages as from [`Hip`] (recorded on
/// the care contexts first).
pub(super) async fn request_token(
    db: &sqlx::PgPool,
    hip: &Hip,
    p: &PatientAbdm,
) -> Result<TokenAsk, AppError> {
    let Some(link_id) = p.link_id else {
        return Err(AppError::NotFound);
    };
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &hip.tenant_id).await?;
    // The lock makes "is a request in flight?" and "record ours" one step.
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let held = sqlx::query!(
        r#"SELECT token_request_id,
                  COALESCE(token_requested_at > now() - make_interval(mins => $3), false)
                      AS "in_flight!",
                  COALESCE(linking_token IS NOT NULL AND token_expiry > now() + interval '1 minute',
                           false) AS "stored!"
             FROM patient_abha_links WHERE tenant_id = $1 AND id = $2 FOR UPDATE"#,
        hip.tenant_id,
        link_id,
        TOKEN_REQUEST_MINUTES,
    )
    .fetch_one(&mut *tx)
    .await?;
    if held.stored {
        tx.commit().await?;
        return Ok(TokenAsk::Stored);
    }
    let (request_id, ask) = match held.token_request_id {
        Some(id) if held.in_flight => (id, TokenAsk::Joined),
        _ => (Uuid::new_v4(), TokenAsk::Sent),
    };
    if ask == TokenAsk::Sent {
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        sqlx::query!(
            "UPDATE patient_abha_links SET token_request_id = $3, token_requested_at = now() \
              WHERE tenant_id = $1 AND id = $2",
            hip.tenant_id,
            link_id,
            request_id,
        )
        .execute(&mut *tx)
        .await?;
    }
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query!(
        "UPDATE abdm_care_contexts SET link_status = 'linking', last_error = NULL, \
                abdm_request_id = $3 \
          WHERE tenant_id = $1 AND id IN (SELECT id FROM abdm_care_contexts \
                WHERE tenant_id = $1 AND patient_id = $2 AND link_status <> 'linked' \
                  AND deleted_at IS NULL \
                  AND public.abdm_mental_health_shareable(tenant_id, patient_id, encounter_id) \
                ORDER BY record_date DESC LIMIT $4)",
        hip.tenant_id,
        p.patient_id,
        request_id,
        LINK_BATCH,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    if ask == TokenAsk::Joined {
        return Ok(ask);
    }
    let sent = hip
        .send_with_id(GENERATE_LINK_TOKEN_PATH, request_id, &token_body(p))
        .await;
    if let Err(e) = sent {
        let waiting = waiting_ids(db, hip.tenant_id, request_id).await?;
        clear_token_request(db, hip.tenant_id, p.patient_id).await?;
        mark(
            db,
            hip.tenant_id,
            &waiting,
            "failed",
            Some(message(&e).as_str()),
            None,
        )
        .await?;
        return Err(e);
    }
    Ok(ask)
}

/// The care contexts waiting on `request_id`.
async fn waiting_ids(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    request_id: Uuid,
) -> Result<Vec<Uuid>, AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let ids = sqlx::query_scalar!(
        "SELECT id FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND abdm_request_id = $2 AND deleted_at IS NULL LIMIT $3",
        tenant_id,
        request_id,
        LINK_BATCH,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(ids)
}

/// The token request for the patient is answered (or failed): the next
/// record asks afresh rather than joining it.
///
/// # Errors
/// A database fault.
pub(super) async fn clear_token_request(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query!(
        "UPDATE patient_abha_links SET token_request_id = NULL, token_requested_at = NULL \
          WHERE tenant_id = $1 AND patient_id = $2 AND token_request_id IS NOT NULL",
        tenant_id,
        patient_id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Forget the patient's stored link token after ABDM rejected it. Returns
/// whether a new one may be asked for: not when the last rejection was
/// within the hour, so a token ABDM keeps refusing cannot loop.
///
/// # Errors
/// A database fault.
pub(super) async fn forget_token(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<bool, AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let may_retry = sqlx::query_scalar!(
        r#"WITH old AS (
             SELECT id, token_rejected_at FROM patient_abha_links
              WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL
                AND unlinked_at IS NULL
              LIMIT 10 FOR UPDATE)
           UPDATE patient_abha_links l
              SET linking_token = NULL, token_expiry = NULL, token_request_id = NULL,
                  token_requested_at = NULL, token_rejected_at = now()
             FROM old WHERE l.tenant_id = $1 AND l.id = old.id
           RETURNING (old.token_rejected_at IS NULL
                      OR old.token_rejected_at < now() - interval '1 hour') AS "may_retry!""#,
        tenant_id,
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    tracing::warn!("abdm: ABDM rejected the stored link token; it was cleared");
    Ok(may_retry.contains(&true))
}

/// Queue the link again after ABDM-2406, once per batch (keyed by its first
/// care context), and mark the batch as waiting for it. Returns whether it
/// was queued; `false` when this batch was already sent again once.
async fn requeue_link(db: &sqlx::PgPool, tenant_id: Uuid, ids: &[Uuid]) -> Result<bool, AppError> {
    let Some(first) = ids.first() else {
        return Ok(false);
    };
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let queued = sqlx::query!(
        "INSERT INTO outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload, \
                idempotency_key, next_retry_at) \
         VALUES ($1, 'abdm_care_context', $2, 'abdm.care_context.link', \
                jsonb_build_object('care_context_id', $2::uuid), 'ccl-2406:' || $2::text, \
                now() + make_interval(secs => $3)) \
         ON CONFLICT (tenant_id, event_type, idempotency_key) \
            WHERE idempotency_key IS NOT NULL DO NOTHING",
        tenant_id,
        *first,
        OUT_OF_SEQUENCE_RETRY_SECONDS,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected()
        > 0;
    if queued {
        // No longer waiting on the refused request: a redelivery of the same
        // refusal finds nothing to change.
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        sqlx::query!(
            "UPDATE abdm_care_contexts SET link_status = 'not_linked', last_error = $3, \
                    abdm_request_id = NULL \
              WHERE tenant_id = $1 AND id = ANY($2) AND link_status <> 'linked'",
            tenant_id,
            ids,
            RELINKING,
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(queued)
}

/// Whether a link refusal with `code` is one [`recover`] acts on.
#[must_use]
pub(super) fn recoverable(code: &str) -> bool {
    is_link_token_rejected(code) || normalize(code) == OUT_OF_SEQUENCE
}

/// What a link refusal with `code` asks of us, done: a rejected token is
/// cleared and a new one asked for (once); an out-of-order link is queued
/// again (once). Returns `None` when the refusal was recovered from, or the
/// words to leave on the care contexts; `Some` unchanged for other codes.
///
/// # Errors
/// Database faults; ABDM outages while asking for the new token.
pub(super) async fn recover(
    db: &sqlx::PgPool,
    hip: &Hip,
    (patient_id, ids): (Uuid, &[Uuid]),
    (code, words): (&str, String),
) -> Result<Option<String>, AppError> {
    if is_link_token_rejected(code) {
        if !forget_token(db, hip.tenant_id, patient_id).await? {
            return Ok(Some(TOKEN_REJECTED_AGAIN.to_owned()));
        }
        let mut tx = db.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &hip.tenant_id).await?;
        let patient = load_patient(&mut tx, hip.tenant_id, patient_id).await?;
        tx.commit().await?;
        return request_token(db, hip, &patient).await.map(|_| None);
    }
    if normalize(code) == OUT_OF_SEQUENCE {
        if requeue_link(db, hip.tenant_id, ids).await? {
            return Ok(None);
        }
        return Ok(Some(OUT_OF_ORDER_AGAIN.to_owned()));
    }
    Ok(Some(words))
}

/// [`send_links`] with the stored or fresh `token`, recovering from a
/// rejected token or an out-of-order refusal as [`recover`] does.
///
/// # Errors
/// As [`send_links`], for refusals that cannot be recovered from.
pub(super) async fn link_with(
    db: &sqlx::PgPool,
    hip: &Hip,
    p: &PatientAbdm,
    token: &str,
) -> Result<(), AppError> {
    let Err((e, ids)) = send_links(db, hip, hip.tenant_id, p, token).await? else {
        return Ok(());
    };
    let words = message(&e);
    let Some(code) = code_of(&words).map(str::to_owned) else {
        return Err(e);
    };
    match recover(db, hip, (p.patient_id, &ids), (&code, words)).await? {
        None => Ok(()),
        Some(why) => {
            mark(db, hip.tenant_id, &ids, "failed", Some(why.as_str()), None).await?;
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use medbrains_abdm::errors::{OUT_OF_SEQUENCE, code_of, is_link_token_rejected, normalize};

    /// A refusal already worded for staff still names its code, so a 1026 or
    /// 1038 from the link call is recognised and the token cleared.
    #[test]
    fn a_worded_refusal_still_names_a_rejected_token() {
        let words = medbrains_abdm::errors::describe(Some("ABDM-1026"), None, "x");
        assert_eq!(code_of(&words), Some("ABDM-1026"));
        assert!(is_link_token_rejected("ABDM-1026"));
        assert!(is_link_token_rejected("abdm-1038: "));
        assert!(!is_link_token_rejected("ABDM-1027"));
        assert!(!is_link_token_rejected("ABDM-1056"));
        assert_eq!(normalize("ABDM-2406 :"), OUT_OF_SEQUENCE);
    }

    /// Only a rejected token and an out-of-order call are recovered from;
    /// a block, a deactivated ABHA or "already linked" are not.
    #[test]
    fn only_token_and_sequence_refusals_are_recoverable() {
        for code in ["ABDM-1026", "ABDM-1038", "ABDM-2406"] {
            assert!(super::recoverable(code), "{code}");
        }
        for code in ["ABDM-1027", "ABDM-1031", "ABDM-1056", "ABDM-1006", ""] {
            assert!(!super::recoverable(code), "{code}");
        }
    }
}
