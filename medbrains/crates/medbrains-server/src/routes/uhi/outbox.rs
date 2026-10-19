//! `uhi.callback` — our signed `on_*` answer to a patient app (or, for a
//! search that came through the gateway, to the gateway).
//!
//! A UHI call is answered in two steps: ACK at once, then the answer as a
//! call of our own. The answer is written to the outbox in the same
//! transaction as whatever it reports (a booking, a decision), so it is sent
//! exactly when that commits, and retried until the other side takes it.

use async_trait::async_trait;
use medbrains_outbox::{
    OutboxRow,
    handler::{Handler, HandlerCtx, HandlerError},
    queue_in_tx,
};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{auth, settings};
use crate::error::AppError;

pub const EVENT: &str = "uhi.callback";

/// One answer to send.
#[derive(Debug)]
pub struct Callback {
    pub transaction_row: Uuid,
    /// The full URL: `{consumer_uri}/on_{action}` or `{gateway}/on_search`.
    pub url: String,
    pub body: Value,
    /// Dedupes a redelivered request: `{bap}|{transaction}|{message}|{action}`.
    pub idempotency_key: String,
}

/// Queue `callback` inside the caller's transaction.
///
/// # Errors
/// A database fault.
pub async fn queue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    callback: Callback,
) -> Result<(), AppError> {
    queue_in_tx(
        tx,
        OutboxRow {
            tenant_id,
            aggregate_type: "uhi_transaction",
            aggregate_id: Some(callback.transaction_row),
            event_type: EVENT,
            payload: json!({ "url": callback.url, "body": callback.body }),
            idempotency_key: Some(callback.idempotency_key),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue uhi callback: {e}")))?;
    Ok(())
}

#[derive(Debug)]
pub struct UhiCallbackHandler;

#[async_trait]
impl Handler for UhiCallbackHandler {
    fn event_type(&self) -> &'static str {
        EVENT
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let url = payload["url"]
            .as_str()
            .filter(|u| u.starts_with("http"))
            .ok_or_else(|| HandlerError::Permanent("payload.url missing".to_owned()))?;
        let body = serde_json::to_vec(&payload["body"])
            .map_err(|e| HandlerError::Permanent(format!("payload.body: {e}")))?;
        let transient = |e: AppError| HandlerError::Transient(e.to_string());
        let mut tx = ctx.pool.begin().await.map_err(|e| transient(e.into()))?;
        medbrains_db::pool::set_tenant_context(&mut tx, &ctx.tenant_id)
            .await
            .map_err(|e| transient(e.into()))?;
        let sub = settings::load(&mut tx, ctx.tenant_id)
            .await
            .map_err(transient)?
            .ok_or_else(|| HandlerError::Permanent("UHI is no longer set up".to_owned()))?;
        tx.commit().await.map_err(|e| transient(e.into()))?;
        // The key may be re-generated while this waits; a sealed key that no
        // longer opens is the operator's to fix, and retrying will not.
        let private = sub
            .private_key(ctx.secret_resolver.as_ref())
            .await
            .map_err(|e| HandlerError::Permanent(e.to_string()))?;
        let signature = auth::sign_now(&sub, &private, &body)
            .map_err(|_| HandlerError::Permanent("the UHI key cannot sign".to_owned()))?;
        let response = auth::HTTP
            .post(url)
            .header("content-type", "application/json")
            .header("authorization", signature)
            .body(body)
            .send()
            .await
            .map_err(|e| HandlerError::Transient(format!("uhi callback: {e}")))?;
        let status = response.status();
        if status.is_success() {
            Ok(json!({ "status": status.as_u16() }))
        } else if status.is_client_error() && status.as_u16() != 429 {
            Err(HandlerError::Permanent(format!(
                "uhi callback refused: {status}"
            )))
        } else {
            Err(HandlerError::Transient(format!("uhi callback: {status}")))
        }
    }
}
