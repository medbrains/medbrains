//! NHCX (National Health Claims Exchange) outbound — coverage eligibility,
//! pre-authorisation, claim submission, answers to payer queries, the
//! status / search / cancel / reprocess Tasks and payment acknowledgements,
//! one handler per operation (`medbrains_core::nhcx::OPERATIONS`):
//! `nhcx.coverage_eligibility_check`, `nhcx.preauth_submit`,
//! `nhcx.claim_submit`, `nhcx.communication`, `nhcx.status`, `nhcx.search`,
//! `nhcx.cancel`, `nhcx.reprocess`, `nhcx.payment_ack`.
//!
//! Each message follows the HCX open protocol (v0.7.1): the FHIR bundle is
//! the plaintext of a JWE encrypted for the payer's certificate (from the
//! payer directory), the `x-hcx-*` routing headers ride in the JWE protected
//! header, and the HTTP body is `{"payload": "<compact JWE>"}`, posted with a
//! gateway session token. The payer answers later, at the callback receiver.
//!
//! The queueing route records the correlation, api-call and workflow ids on
//! the record the message belongs to (a claim, pre-authorisation,
//! eligibility check, payer query, Task or payment notice) in the same
//! transaction; this handler
//! marks that record `sent` when the gateway accepts, or `send_failed` (with
//! the reason) when it refuses for good.
//!
//! Status mapping: 2xx → sent; 401 → drop the session, retry; 400/403/404/422
//! → permanent; 429/5xx/network → retry with backoff. A retry goes under a
//! fresh api_call_id (and, for a request, a fresh correlation id aliased to
//! the record's — NHCX retires a correlation that failed); the last failed
//! retry marks the record `send_failed`, never leaving it "waiting to send".
//! A record a payer has already answered is never marked failed.

pub mod config;
pub mod session;

use async_trait::async_trait;
use medbrains_core::nhcx::{NhcxOperation, NhcxRecord};
use medbrains_core::nhcx_wire;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::backoff::MAX_ATTEMPTS;
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
    /// The step code (`x-hcx-workflow_id`), where the message has one.
    #[serde(default)]
    workflow_id: Option<String>,
    bundle: Value,
}

/// The ids one attempt goes out under.
struct Attempt {
    correlation_id: Uuid,
    api_call_id: Uuid,
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
        let gave_up;
        let outcome = match &result {
            Ok(v) if v.get("superseded").is_some() => None,
            Ok(_) => Some(("sent", None)),
            Err(HandlerError::Permanent(reason)) => Some(("send_failed", Some(reason.as_str()))),
            // The outbox stops here; the desk must see it, not "waiting to send".
            Err(HandlerError::Transient(reason)) if ctx.attempts >= MAX_ATTEMPTS => {
                gave_up = format!(
                    "NHCX did not take it after {} tries: {reason}",
                    ctx.attempts
                );
                Some(("send_failed", Some(gave_up.as_str())))
            }
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
        if !is_current(&mut tx, ctx, msg).await? {
            // The desk sent this again since; the newer message is the one
            // the payer should get.
            tx.commit().await.map_err(|e| transient(&e))?;
            return Ok(json!({ "superseded": true }));
        }
        let stored = config::stored(&mut tx, ctx.tenant_id)
            .await
            .map_err(from_config)?;
        let attempt = self.attempt(&mut tx, ctx, msg).await?;
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

        let headers = Envelope {
            sender,
            msg,
            attempt: &attempt,
            hcx_status: self.operation.hcx_status(),
        };
        let jwe =
            medbrains_crypto::jwe::encrypt_hcx(&msg.bundle, &headers.protected(), cert.as_bytes())
                .map_err(|e| {
                    HandlerError::Permanent(format!("nhcx encrypt for {}: {e}", msg.recipient_code))
                })?;

        let url = format!("{}{}", endpoints.gateway, self.operation.path());
        // NHCX reads the token from `bearer_auth`; NHA's own collection sends
        // Authorization too.
        let resp = ctx
            .http_client
            .post(&url)
            .bearer_auth(&token)
            .header(BEARER_AUTH_HEADER, format!("Bearer {token}"))
            .header(reqwest::header::ACCEPT, "application/json")
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
                correlation_id = %attempt.correlation_id,
                operation = self.operation.event_type(),
                "nhcx message accepted by the gateway"
            );
            return Ok(json!({
                "correlation_id": attempt.correlation_id,
                "api_call_id": attempt.api_call_id,
                "gateway": serde_json::from_str::<Value>(&body).unwrap_or(Value::Null),
            }));
        }
        if status == reqwest::StatusCode::UNAUTHORIZED {
            session::forget(ctx.tenant_id);
        }
        Err(classify_status(status, &body))
    }
}

/// The header NHA's package says the gateway reads the session token from.
const BEARER_AUTH_HEADER: &str = "bearer_auth";

impl NhcxHandler {
    /// The ids for this attempt. The first goes out as queued; a retry gets
    /// a fresh api_call_id, and a request a fresh correlation id too
    /// (correlation = api_call_id on a request), recorded as an alias of the
    /// record's so the payer's answer to it still lands.
    async fn attempt(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        ctx: &HandlerCtx,
        msg: &Message,
    ) -> Result<Attempt, HandlerError> {
        if ctx.attempts <= 1 {
            return Ok(Attempt {
                correlation_id: msg.correlation_id,
                api_call_id: msg.api_call_id,
            });
        }
        let api_call_id = Uuid::new_v4();
        if self.operation.keeps_correlation() {
            return Ok(Attempt {
                correlation_id: msg.correlation_id,
                api_call_id,
            });
        }
        sqlx::query(
            "INSERT INTO nhcx_correlation_aliases \
                 (tenant_id, correlation_id, canonical_correlation_id, outbox_event_id, attempt) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(ctx.tenant_id)
        .bind(api_call_id)
        .bind(msg.correlation_id)
        .bind(ctx.event_id)
        .bind(ctx.attempts)
        .execute(&mut **tx)
        .await
        .map_err(|e| transient(&e))?;
        Ok(Attempt {
            correlation_id: api_call_id,
            api_call_id,
        })
    }
}

/// Whether the record still carries this message's correlation id — a
/// newer submission replaces an older one still retrying.
async fn is_current(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ctx: &HandlerCtx,
    msg: &Message,
) -> Result<bool, HandlerError> {
    // The table name comes from a closed enum, never from the payload text.
    let sql = format!(
        "SELECT nhcx_correlation_id = $1 FROM {} WHERE id = $2 AND tenant_id = $3",
        msg.record.table()
    );
    let current: Option<Option<bool>> = sqlx::query_scalar(&sql)
        .bind(msg.correlation_id)
        .bind(msg.record_id)
        .bind(ctx.tenant_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| transient(&e))?;
    Ok(current.flatten().unwrap_or(false))
}

/// What goes in the JWE protected header.
struct Envelope<'a> {
    sender: &'a str,
    msg: &'a Message,
    attempt: &'a Attempt,
    hcx_status: &'static str,
}

impl Envelope<'_> {
    /// The HCX protocol headers, carried in the JWE protected header.
    fn protected(&self) -> Map<String, Value> {
        let msg = self.msg;
        let mut h = Map::new();
        h.insert("x-hcx-sender_code".into(), json!(self.sender));
        h.insert("x-hcx-recipient_code".into(), json!(msg.recipient_code));
        h.insert("x-hcx-api_call_id".into(), json!(self.attempt.api_call_id));
        h.insert(
            "x-hcx-correlation_id".into(),
            json!(self.attempt.correlation_id),
        );
        // One per originating request, the same on every retry.
        h.insert("x-hcx-request_id".into(), json!(msg.api_call_id));
        h.insert("x-hcx-status".into(), json!(self.hcx_status));
        let timestamp = nhcx_wire::ist_timestamp(chrono::Utc::now());
        h.insert("x-hcx-timestamp".into(), json!(timestamp));
        if let Some(code) = msg.workflow_id.as_deref().filter(|c| !c.is_empty()) {
            if let Some(use_case) = nhcx_wire::use_case(code) {
                h.insert("x-hcx-use_case".into(), json!(use_case));
            }
            h.insert("x-hcx-workflow_id".into(), json!(code));
        }
        if let Some(abha) = beneficiary_abha(&msg.bundle) {
            h.insert("x-hcx-ben-abha-id".into(), json!(abha));
        }
        h
    }
}

/// The patient's ABHA number from the bundle, in the header's form.
fn beneficiary_abha(bundle: &Value) -> Option<String> {
    let entries = bundle.get("entry")?.as_array()?;
    let patient = entries
        .iter()
        .filter_map(|e| e.get("resource"))
        .find(|r| r.get("resourceType").and_then(Value::as_str) == Some("Patient"))?;
    patient
        .get("identifier")?
        .as_array()?
        .iter()
        .filter(|i| {
            i.get("system")
                .and_then(Value::as_str)
                .is_some_and(|s| s.contains("healthid"))
        })
        .filter_map(|i| i.get("value").and_then(Value::as_str))
        .find_map(nhcx_wire::hyphenated_abha)
}

/// Record the send outcome on the message's record — only while this message
/// is still the record's latest, so an old retry never overwrites a newer
/// submission, and only while the record is still waiting to send: a payer
/// may answer before the gateway's 202 reaches us (or a timed-out send may
/// have arrived), and that answer is never overwritten by "sent" or
/// "send_failed".
async fn mark_record(
    ctx: &HandlerCtx,
    msg: &Message,
    status: &str,
    reason: Option<&str>,
) -> Result<(), HandlerError> {
    let mut tx = tenant_tx(ctx).await?;
    // The table name comes from a closed enum, never from the payload text.
    let sql = format!(
        "UPDATE {} SET \
                nhcx_status = CASE WHEN nhcx_status IS NULL OR nhcx_status = 'queued' THEN $1 ELSE nhcx_status END, \
                nhcx_disposition = CASE WHEN nhcx_status IS NULL OR nhcx_status = 'queued' THEN $2 ELSE nhcx_disposition END, \
                nhcx_submitted_at = CASE WHEN $1 = 'sent' THEN COALESCE(nhcx_submitted_at, now()) \
                                         ELSE nhcx_submitted_at END \
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
