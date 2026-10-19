//! NHCX (National Health Claims Exchange) outbound — coverage eligibility,
//! pre-authorisation, claim submission and answers to payer queries, one
//! handler per operation: `nhcx.coverage_eligibility_check`,
//! `nhcx.preauth_submit`, `nhcx.claim_submit`, `nhcx.communication`.
//!
//! Each message follows the HCX open protocol (v0.7.1): the FHIR bundle is
//! the plaintext of a JWE encrypted for the payer's certificate (from the
//! payer directory), the `x-hcx-*` routing headers ride in the JWE protected
//! header, and the HTTP body is `{"payload": "<compact JWE>"}`, posted with a
//! gateway session token. The payer answers later, at the callback receiver.
//!
//! The queueing route records the correlation, api-call and workflow ids on
//! the record the message belongs to (a claim, pre-authorisation,
//! eligibility check or payer query) in the same transaction; this handler
//! marks that record `sent` when the gateway accepts, or `send_failed` (with
//! the reason) when it refuses for good.
//!
//! Status mapping: 2xx → sent; 401 → drop the session, retry; 400/403/404/422
//! → permanent; 429/5xx/network → retry with backoff.

pub mod config;
pub mod session;

use async_trait::async_trait;
use medbrains_core::nhcx::{NhcxOperation, NhcxRecord};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};
use config::ConfigError;
use session::{Endpoints, SessionError};

/// One handler per HCX operation.
#[derive(Debug)]
pub struct NhcxHandler {
    operation: NhcxOperation,
}

impl NhcxHandler {
    #[must_use]
    pub const fn new(operation: NhcxOperation) -> Self {
        Self { operation }
    }
}

/// What the queueing route puts in the outbox payload.
#[derive(Debug, Deserialize)]
struct Message {
    /// Which table the message belongs to.
    record: NhcxRecord,
    record_id: Uuid,
    recipient_code: String,
    correlation_id: Uuid,
    api_call_id: Uuid,
    workflow_id: Uuid,
    bundle: Value,
    /// `x-hcx-status` — set on replies (`on_*`), absent on requests.
    #[serde(default)]
    hcx_status: Option<String>,
}

#[async_trait]
impl Handler for NhcxHandler {
    fn event_type(&self) -> &'static str {
        self.operation.event_type()
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let msg: Message = serde_json::from_value(payload.clone())
            .map_err(|e| HandlerError::Permanent(format!("nhcx payload: {e}")))?;
        let result = self.send(ctx, &msg).await;
        let outcome = match &result {
            Ok(_) => Some(("sent", None)),
            Err(HandlerError::Permanent(reason)) => Some(("send_failed", Some(reason.as_str()))),
            Err(HandlerError::Transient(_)) => None,
        };
        // The send already happened (or never will); failing the event here
        // would retry it and reach the payer twice. The claim's status is the
        // casualty, and the log says so.
        let marked = match outcome {
            Some((status, reason)) => mark_record(ctx, &msg, status, reason).await,
            None => Ok(()),
        };
        if let Err(e) = marked {
            tracing::error!(
                tenant_id = %ctx.tenant_id,
                record_id = %msg.record_id,
                error = %e,
                "nhcx: could not record the send outcome"
            );
        }
        result
    }
}

impl NhcxHandler {
    async fn send(&self, ctx: &HandlerCtx, msg: &Message) -> Result<Value, HandlerError> {
        let mut tx = tenant_tx(ctx).await?;
        let stored = config::stored(&mut tx, ctx.tenant_id)
            .await
            .map_err(from_config)?;
        let cert = sqlx::query_scalar::<_, Option<String>>(
            "SELECT encryption_cert FROM nhcx_participants \
             WHERE tenant_id = $1 AND participant_code = $2 AND is_active",
        )
        .bind(ctx.tenant_id)
        .bind(&msg.recipient_code)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| transient(&e))?;
        tx.commit().await.map_err(|e| transient(&e))?;

        let sender = stored.participant_code().ok_or_else(|| {
            HandlerError::Permanent("this hospital has no NHCX participant code".to_owned())
        })?;
        let cert = cert
            .flatten()
            .filter(|c| !c.trim().is_empty())
            .ok_or_else(|| {
                HandlerError::Permanent(format!(
                    "payer {} has no encryption certificate in the NHCX payer directory",
                    msg.recipient_code
                ))
            })?;
        let creds = config::credentials(&stored, ctx.secret_resolver.as_ref())
            .await
            .map_err(from_config)?;
        let base = config::base_url_override(ctx.secret_resolver.as_ref()).await;
        let endpoints = Endpoints::new(creds.environment, base.as_deref());
        let token = session::token(&ctx.http_client, ctx.tenant_id, &creds, &endpoints)
            .await
            .map_err(|e| match e {
                SessionError::Refused(_) => HandlerError::Permanent(e.to_string()),
                SessionError::Unavailable(_) => HandlerError::Transient(e.to_string()),
            })?;

        let jwe = medbrains_crypto::jwe::encrypt_hcx(
            &msg.bundle,
            &protected_headers(sender, msg),
            cert.as_bytes(),
        )
        .map_err(|e| {
            HandlerError::Permanent(format!("nhcx encrypt for {}: {e}", msg.recipient_code))
        })?;

        let url = format!("{}{}", endpoints.gateway, self.operation.path());
        let resp = ctx
            .http_client
            .post(&url)
            .bearer_auth(&token)
            .json(&json!({ "payload": jwe }))
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if status.is_success() {
            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                correlation_id = %msg.correlation_id,
                operation = self.operation.event_type(),
                "nhcx message accepted by the gateway"
            );
            return Ok(json!({
                "correlation_id": msg.correlation_id,
                "api_call_id": msg.api_call_id,
                "gateway": serde_json::from_str::<Value>(&body).unwrap_or(Value::Null),
            }));
        }
        if status == reqwest::StatusCode::UNAUTHORIZED {
            session::forget(ctx.tenant_id);
        }
        Err(classify_status(status, &body))
    }
}

/// The HCX protocol headers, carried in the JWE protected header.
fn protected_headers(sender: &str, msg: &Message) -> Map<String, Value> {
    let mut headers = Map::new();
    headers.insert("x-hcx-sender_code".into(), json!(sender));
    headers.insert("x-hcx-recipient_code".into(), json!(msg.recipient_code));
    headers.insert("x-hcx-api_call_id".into(), json!(msg.api_call_id));
    headers.insert("x-hcx-correlation_id".into(), json!(msg.correlation_id));
    headers.insert("x-hcx-workflow_id".into(), json!(msg.workflow_id));
    headers.insert(
        "x-hcx-timestamp".into(),
        json!(chrono::Utc::now().to_rfc3339()),
    );
    if let Some(status) = &msg.hcx_status {
        headers.insert("x-hcx-status".into(), json!(status));
    }
    headers
}

/// Record the send outcome on the message's record — only while this message
/// is still the record's latest, so an old retry never overwrites a newer
/// submission.
async fn mark_record(
    ctx: &HandlerCtx,
    msg: &Message,
    status: &str,
    reason: Option<&str>,
) -> Result<(), HandlerError> {
    let mut tx = tenant_tx(ctx).await?;
    // The table name comes from a closed enum, never from the payload text.
    let sql = format!(
        "UPDATE {} SET nhcx_status = $1, nhcx_disposition = $2, \
                nhcx_submitted_at = CASE WHEN $1 = 'sent' THEN now() ELSE nhcx_submitted_at END \
         WHERE id = $3 AND tenant_id = $4 AND nhcx_correlation_id = $5",
        msg.record.table()
    );
    sqlx::query(&sql)
        .bind(status)
        .bind(reason.map(|r| r.chars().take(500).collect::<String>()))
        .bind(msg.record_id)
        .bind(ctx.tenant_id)
        .bind(msg.correlation_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| transient(&e))?;
    tx.commit().await.map_err(|e| transient(&e))
}

/// A transaction under the event's tenant, so RLS holds even where the
/// worker's role does not bypass it.
async fn tenant_tx(
    ctx: &HandlerCtx,
) -> Result<sqlx::Transaction<'_, sqlx::Postgres>, HandlerError> {
    let mut tx = ctx.pool.begin().await.map_err(|e| transient(&e))?;
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(ctx.tenant_id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| transient(&e))?;
    Ok(tx)
}

fn transient(e: &sqlx::Error) -> HandlerError {
    HandlerError::Transient(format!("nhcx db: {e}"))
}

fn from_config(e: ConfigError) -> HandlerError {
    match e {
        ConfigError::NotSetUp(m) => HandlerError::Permanent(m),
        ConfigError::Db(e) => transient(&e),
    }
}

fn classify_reqwest_err(e: &reqwest::Error) -> HandlerError {
    if e.is_builder() {
        HandlerError::Permanent(format!("nhcx request build: {e}"))
    } else {
        HandlerError::Transient(format!("nhcx network: {e}"))
    }
}

fn classify_status(status: reqwest::StatusCode, body: &str) -> HandlerError {
    let trimmed = body.chars().take(512).collect::<String>();
    match status.as_u16() {
        400 | 403 | 404 | 422 => HandlerError::Permanent(format!("nhcx {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("nhcx {status}: {trimmed}")),
    }
}
