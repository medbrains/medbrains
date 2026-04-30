//! Twilio SMS handler — covers all `sms.*` event types.
//!
//! Sprint A spec §6 / hybrid roadmap Phase 8. Real HTTPS via reqwest
//! + per-tenant SecretResolver lookup of:
//!   - twilio-account-sid
//!   - twilio-auth-token
//!   - twilio-from-number
//!
//! Status-code map mirrors the Razorpay handler:
//!   2xx                          → Ok
//!   400 / 401 / 403 / 404 / 422  → Permanent (DLQ — operator action)
//!   429 / 5xx / network / timeout → Transient (retry per Worker backoff)
//!
//! Twilio's Messages.json POST is naturally idempotent if you reuse
//! the same Idempotency-Key header (or omit it and rely on outbox
//! `event_id` for dedup at the worker layer). We send the
//! `event_id` as the Idempotency-Key so a Transient-then-retry cycle
//! converges to the same Twilio message_sid.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const TWILIO_API_BASE: &str = "https://api.twilio.com/2010-04-01";

/// `sms.*` handler — real HTTPS via reqwest.
///
/// One handler instance handles a single event_type (e.g.,
/// `sms.appointment_reminder`, `sms.otp`, ...) so the registry can
/// route by type cleanly. Default constructs hits production Twilio;
/// tests use `with_api_base()` to point at a wiremock server.
#[derive(Debug)]
pub struct SmsSendHandler {
    event_type: &'static str,
    api_base: Option<String>,
}

impl SmsSendHandler {
    pub const fn new(event_type: &'static str) -> Self {
        Self {
            event_type,
            api_base: None,
        }
    }

    pub fn with_api_base(event_type: &'static str, api_base: impl Into<String>) -> Self {
        Self {
            event_type,
            api_base: Some(api_base.into()),
        }
    }

    fn api_base(&self) -> &str {
        self.api_base.as_deref().unwrap_or(TWILIO_API_BASE)
    }
}

#[async_trait]
impl Handler for SmsSendHandler {
    fn event_type(&self) -> &'static str {
        self.event_type
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        let to = payload["to"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing to (E.164 phone)".into()))?;
        let body = payload["body"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing body".into()))?;
        if !to.starts_with('+') {
            return Err(HandlerError::Permanent(format!(
                "to must be E.164 with leading '+', got {to}"
            )));
        }
        if body.is_empty() {
            return Err(HandlerError::Permanent("body must not be empty".into()));
        }

        let account_sid = resolve_secret(ctx, "twilio-account-sid").await?;
        let auth_token = resolve_secret(ctx, "twilio-auth-token").await?;
        let from_number = resolve_secret(ctx, "twilio-from-number").await?;

        let url = format!("{}/Accounts/{account_sid}/Messages.json", self.api_base());

        // Twilio Messages.json takes form-urlencoded.
        let form = [
            ("To", to.to_owned()),
            ("From", from_number),
            ("Body", body.to_owned()),
        ];

        let resp = ctx
            .http_client
            .post(&url)
            .basic_auth(&account_sid, Some(&auth_token))
            // Twilio honors I-Idempotency-Token on Messages — pass
            // the outbox event_id so retries collapse to one SMS.
            .header("I-Idempotency-Token", ctx.event_id.to_string())
            .form(&form)
            .send()
            .await
            .map_err(classify_reqwest_err)?;

        let status = resp.status();
        if status.is_success() {
            let resp_body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("twilio parse: {e}")))?;
            let sid = resp_body["sid"]
                .as_str()
                .ok_or_else(|| HandlerError::Permanent("twilio response missing sid".into()))?;
            let twilio_status = resp_body["status"].as_str().unwrap_or("queued");

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                event_type = self.event_type,
                sid,
                twilio_status,
                "twilio.sms ok"
            );

            return Ok(serde_json::json!({
                "sid":    sid,
                "status": twilio_status,
                "to":     to,
            }));
        }

        // Non-2xx: classify
        let body_text = resp.text().await.unwrap_or_default();
        Err(classify_status(status, &body_text))
    }
}

// ── helpers ────────────────────────────────────────────────────────

async fn resolve_secret(ctx: &HandlerCtx, name: &str) -> Result<String, HandlerError> {
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    let key = format!("medbrains/{env}/{tenant}/{name}", tenant = ctx.tenant_id);
    ctx.secret_resolver
        .get(&key)
        .await
        .map_err(|e| HandlerError::Transient(format!("secret {name}: {e}")))
}

fn classify_reqwest_err(e: reqwest::Error) -> HandlerError {
    if e.is_timeout() || e.is_connect() {
        HandlerError::Transient(format!("network: {e}"))
    } else if e.is_builder() {
        HandlerError::Permanent(format!("request build: {e}"))
    } else {
        HandlerError::Transient(format!("reqwest: {e}"))
    }
}

fn classify_status(status: reqwest::StatusCode, body: &str) -> HandlerError {
    let trimmed = body.chars().take(512).collect::<String>();
    match status.as_u16() {
        400 | 401 | 403 | 404 | 422 => {
            HandlerError::Permanent(format!("twilio {status}: {trimmed}"))
        }
        429 | 500..=599 => HandlerError::Transient(format!("twilio {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("twilio unexpected {status}: {trimmed}")),
    }
}
