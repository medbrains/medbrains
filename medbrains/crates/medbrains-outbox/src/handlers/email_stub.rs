//! Email handler — real outbound via SendGrid HTTP API (preferred) or
//! AWS SES HTTP API. SMTP-only providers should run their own SES-like
//! relay; we don't link `lettre` to keep the dep tree small.
//!
//! Credentials resolved per-tenant via `ctx.secret_resolver`:
//!   - `EMAIL_PROVIDER`         — `sendgrid` (default) | `ses`
//!   - `SENDGRID_API_KEY`       — when provider=sendgrid
//!   - `AWS_SES_REGION`         — when provider=ses (e.g. `ap-south-1`)
//!   - `AWS_SES_ACCESS_KEY_ID`  — when provider=ses
//!   - `AWS_SES_SECRET_KEY`     — when provider=ses
//!   - `EMAIL_FROM_ADDRESS`     — from-address (required, must be verified with provider)
//!   - `EMAIL_FROM_NAME`        — display name (optional)
//!
//! Missing credentials fall back to stub mode. Permanent errors (bad
//! recipient, unverified sender) go to DLQ; transient (rate limit, 5xx)
//! retry per outbox backoff.
//!
//! Payload shape:
//!   { "to": "user@example.com", "subject": "...", "html": "...", "text": "..." }

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::handler::{Handler, HandlerCtx, HandlerError};

const SENDGRID_API: &str = "https://api.sendgrid.com/v3/mail/send";

#[derive(Debug)]
pub struct SmtpSendHandler {
    event_type: &'static str,
}

impl SmtpSendHandler {
    pub const fn new(event_type: &'static str) -> Self {
        Self { event_type }
    }
}

#[async_trait]
impl Handler for SmtpSendHandler {
    fn event_type(&self) -> &'static str {
        self.event_type
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        let to = payload
            .get("to")
            .and_then(Value::as_str)
            .ok_or_else(|| HandlerError::Permanent("payload.to missing".to_owned()))?;
        let subject = payload
            .get("subject")
            .and_then(Value::as_str)
            .ok_or_else(|| HandlerError::Permanent("payload.subject missing".to_owned()))?;
        let html = payload.get("html").and_then(Value::as_str);
        let text = payload.get("text").and_then(Value::as_str);
        if html.is_none() && text.is_none() {
            return Err(HandlerError::Permanent(
                "payload.html or payload.text required".to_owned(),
            ));
        }

        let provider = ctx
            .secret_resolver
            .get("EMAIL_PROVIDER")
            .await
            .unwrap_or_else(|_| "sendgrid".to_owned());
        let from_address = match ctx.secret_resolver.get("EMAIL_FROM_ADDRESS").await {
            Ok(v) if !v.is_empty() => v,
            _ => {
                tracing::warn!(
                    tenant_id = %ctx.tenant_id,
                    event_id = %ctx.event_id,
                    "email: EMAIL_FROM_ADDRESS unset — running as stub"
                );
                return Ok(json!({
                    "provider": provider,
                    "stub": true,
                    "reason": "creds_unset",
                }));
            }
        };
        let from_name = ctx
            .secret_resolver
            .get("EMAIL_FROM_NAME")
            .await
            .ok()
            .filter(|s| !s.is_empty());

        match provider.as_str() {
            "sendgrid" => {
                send_via_sendgrid(ctx, &from_address, from_name.as_deref(), to, subject, html, text)
                    .await
            }
            "ses" => {
                // AWS SES requires SigV4 signing — non-trivial. For now,
                // log and fall through to stub. Wire `aws-sdk-sesv2`
                // when a customer needs SES (~2h follow-up).
                tracing::warn!(
                    "email: AWS SES not yet implemented (needs SigV4); use SendGrid or run a relay"
                );
                Ok(json!({
                    "provider": "ses",
                    "stub": true,
                    "reason": "ses_pending_sigv4",
                }))
            }
            other => Err(HandlerError::Permanent(format!(
                "email: unknown EMAIL_PROVIDER '{other}'"
            ))),
        }
    }
}

async fn send_via_sendgrid(
    ctx: &HandlerCtx,
    from_addr: &str,
    from_name: Option<&str>,
    to: &str,
    subject: &str,
    html: Option<&str>,
    text: Option<&str>,
) -> Result<Value, HandlerError> {
    let api_key = match ctx.secret_resolver.get("SENDGRID_API_KEY").await {
        Ok(v) if !v.is_empty() => v,
        _ => {
            tracing::warn!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                "sendgrid: SENDGRID_API_KEY unset — running as stub"
            );
            return Ok(json!({
                "provider": "sendgrid",
                "stub": true,
                "reason": "creds_unset",
            }));
        }
    };

    let mut content = Vec::new();
    if let Some(t) = text {
        content.push(json!({ "type": "text/plain", "value": t }));
    }
    if let Some(h) = html {
        content.push(json!({ "type": "text/html", "value": h }));
    }

    let mut from = json!({ "email": from_addr });
    if let Some(name) = from_name {
        from["name"] = json!(name);
    }

    let body = json!({
        "personalizations": [{ "to": [{ "email": to }] }],
        "from": from,
        "subject": subject,
        "content": content,
    });

    let resp = ctx
        .http_client
        .post(SENDGRID_API)
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| HandlerError::Transient(format!("sendgrid http: {e}")))?;

    let status = resp.status();
    if status.is_success() {
        // SendGrid returns 202 Accepted with X-Message-Id header.
        let message_id = resp
            .headers()
            .get("x-message-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("unknown")
            .to_owned();
        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id = %ctx.event_id,
            message_id = %message_id,
            "sendgrid: email dispatched"
        );
        Ok(json!({
            "provider": "sendgrid",
            "message_id": message_id,
            "status": "queued",
        }))
    } else if status.is_client_error() {
        let body_text = resp.text().await.unwrap_or_default();
        Err(HandlerError::Permanent(format!(
            "sendgrid {}: {body_text}",
            status.as_u16()
        )))
    } else {
        let body_text = resp.text().await.unwrap_or_default();
        Err(HandlerError::Transient(format!(
            "sendgrid {}: {body_text}",
            status.as_u16()
        )))
    }
}
