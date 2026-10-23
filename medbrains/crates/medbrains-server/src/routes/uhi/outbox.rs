//! `uhi.callback` — our signed `on_*` answer to a patient app (or, for a
//! search that came through the gateway, to the gateway).
//!
//! A UHI call is answered in two steps: ACK at once, then the answer as a
//! call of our own. The answer is written to the outbox in the same
//! transaction as whatever it reports (a booking, a decision), so it is sent
//! exactly when that commits, and retried until the other side takes it.
//!
//! Every send goes to one of two places only: the gateway's `on_search`, or
//! under the subscriber URL the UHI registry has for the app, looked up again
//! here with the key the app signed with. Anything else is refused and
//! logged — the answers carry patients' names, phones and ABHA numbers.
//! "Taken" means a 2xx *and* an ACK: a 200 carrying a NACK is a failure.

use async_trait::async_trait;
use medbrains_outbox::{
    OutboxRow,
    handler::{Handler, HandlerCtx, HandlerError},
    queue_in_tx,
};
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_core::secrets::SecretResolver;

use super::{
    auth,
    inbound::{Reply, answer_body},
    protocol::Context,
    settings::{self, Subscription},
};
use crate::error::AppError;

pub const EVENT: &str = "uhi.callback";

/// One answer to send.
#[derive(Debug)]
pub struct Callback {
    pub transaction_row: Uuid,
    /// The full URL: `{consumer_uri}/on_{action}` or the gateway's `on_search`.
    pub url: String,
    /// The registry key the app signed with; `None` for a gateway search.
    pub app_key_id: Option<String>,
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
            payload: json!({ "url": callback.url, "body": callback.body,
                             "app_key_id": callback.app_key_id }),
            idempotency_key: Some(callback.idempotency_key),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue uhi callback: {e}")))?;
    Ok(())
}

/// An answer the hospital sends of its own accord — staff accepted a
/// request, a payment came in, a hold ran out.
#[derive(Debug)]
pub struct Tell<'a> {
    pub transaction_row: Uuid,
    /// The last message the app sent in the transaction (its `payload`):
    /// it names the app and the transaction.
    pub request: &'a Value,
    /// `confirm` or `status` — we send `on_confirm` / `on_status`.
    pub action: &'a str,
    pub order: Value,
    /// One answer per (row, what happened).
    pub idempotency_key: String,
}

/// Queue `tell` inside the caller's transaction.
///
/// # Errors
/// A database fault, or a stored request with no context.
pub async fn tell(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    tell: Tell<'_>,
) -> Result<(), AppError> {
    let mut ctx = Context::parse(tell.request)
        .map_err(|f| AppError::Internal(format!("uhi context: {f}")))?;
    tell.action.clone_into(&mut ctx.action);
    ctx.message_id = Uuid::new_v4().to_string();
    let url = format!(
        "{}/on_{}",
        ctx.consumer_uri.trim_end_matches('/'),
        tell.action
    );
    let reply = Reply::message(json!({ "order": tell.order }));
    let body = answer_body(secrets, sub, &ctx, reply).await;
    let app_key_id: Option<String> =
        sqlx::query_scalar("SELECT bap_key_id FROM uhi_transactions WHERE id = $1")
            .bind(tell.transaction_row)
            .fetch_optional(&mut **tx)
            .await?
            .flatten();
    queue(
        tx,
        sub.tenant_id,
        Callback {
            transaction_row: tell.transaction_row,
            url,
            app_key_id,
            body,
            idempotency_key: tell.idempotency_key,
        },
    )
    .await
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
        destination_allowed(ctx.secret_resolver.as_ref(), &sub, url, payload).await?;
        let response = auth::signed_post(&sub, &private, url.to_owned(), body)
            .map_err(|_| HandlerError::Permanent("the UHI key cannot sign".to_owned()))?
            .send()
            .await
            .map_err(|e| HandlerError::Transient(format!("uhi callback: {e}")))?;
        let status = response.status();
        if status.is_success() {
            let answer: Value = response.json().await.unwrap_or(Value::Null);
            refused_inside_200(&answer, &payload["body"]["context"])?;
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

/// Refuse to send anywhere but the gateway's `on_search` or under the app's
/// registered subscriber URL.
async fn destination_allowed(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    url: &str,
    payload: &Value,
) -> Result<(), HandlerError> {
    if url == auth::gateway_on_search(secrets, sub).await {
        return Ok(());
    }
    let refuse = |why: &str| {
        tracing::error!(
            alert = "uhi.callback_destination",
            url,
            why,
            "uhi callback refused: not the app's registered address"
        );
        HandlerError::Permanent(format!("uhi callback not sent: {why}"))
    };
    if sub.environment == "production" && !url.starts_with("https://") {
        return Err(refuse("production callbacks go over https only"));
    }
    let key_id = payload["app_key_id"]
        .as_str()
        .ok_or_else(|| refuse("no registry key names the app"))?;
    let ctx =
        Context::parse(&payload["body"]).map_err(|f| refuse(&format!("context.{f} is missing")))?;
    match auth::app_record(secrets, sub, &ctx, key_id).await {
        Ok(app) => auth::callback_allowed(&app, url).map_err(|n| refuse(&n.message)),
        Err(n) if n.status.is_server_error() => Err(HandlerError::Transient(n.message)),
        Err(n) => Err(refuse(&n.message)),
    }
}

/// A 200 whose body says NACK, or carries an error, was not taken.
fn refused_inside_200(answer: &Value, context: &Value) -> Result<(), HandlerError> {
    let nacked = answer
        .pointer("/message/ack/status")
        .and_then(Value::as_str)
        == Some("NACK");
    let error = answer
        .get("error")
        .filter(|e| e.as_object().is_some_and(|o| !o.is_empty()));
    if !nacked && error.is_none() {
        return Ok(());
    }
    let field = |k: &str| error.and_then(|e| e[k].as_str()).unwrap_or_default();
    tracing::error!(
        transaction_id = context["transaction_id"].as_str().unwrap_or_default(),
        message_id = context["message_id"].as_str().unwrap_or_default(),
        error_type = field("type"),
        error_code = field("code"),
        error_path = field("path"),
        error_message = field("message"),
        "uhi callback NACKed inside a 200"
    );
    Err(HandlerError::Permanent(format!(
        "uhi callback NACKed: {} {}",
        field("code"),
        field("message")
    )))
}
