//! Email handler — real outbound via `SendGrid` HTTP API or plain SMTP
//! (`lettre`, STARTTLS/implicit-TLS). SMTP covers on-prem deployments
//! and Indian hosting realities (Zoho, Google Workspace, local relay).
//!
//! Credentials resolved per-tenant via `ctx.secret_resolver`:
//!   - `EMAIL_PROVIDER`         — `sendgrid` (default) | `smtp` | `ses`
//!   - `SENDGRID_API_KEY`       — when provider=sendgrid
//!   - `SMTP_HOST`              — when provider=smtp
//!   - `SMTP_PORT`              — optional (default 587)
//!   - `SMTP_USERNAME` / `SMTP_PASSWORD` — optional (open relay when unset)
//!   - `SMTP_TLS`               — `starttls` (default) | `implicit` | `none`
//!   - `AWS_SES_*`              — when provider=ses (pending SigV4)
//!   - `EMAIL_FROM_ADDRESS`     — from-address (required, must be verified with provider)
//!   - `EMAIL_FROM_NAME`        — display name (optional)
//!
//! Missing credentials fall back to stub mode. Permanent errors (bad
//! recipient, unverified sender) go to DLQ; transient (rate limit, 5xx)
//! retry per outbox backoff.
//!
//! Payload shape:
//!   { "to": "user@example.com", "subject": "...", "html": "...", "text": "...",
//!     "attachments": [{ "object_key": "...", "filename": "invoice.pdf", "mime": "application/pdf" }] }
//! Attachments are fetched from the worker's object store at dispatch
//! time — outbox rows carry keys, never document bytes.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::handler::{Handler, HandlerCtx, HandlerError};

pub(crate) struct EmailAttachment {
    pub filename: String,
    pub mime: String,
    pub bytes: Vec<u8>,
}

/// Resolve payload.attachments against the object store. A missing
/// object is permanent — retrying won't make the document appear.
async fn load_attachments(
    ctx: &HandlerCtx,
    payload: &Value,
) -> Result<Vec<EmailAttachment>, HandlerError> {
    let Some(entries) = payload.get("attachments").and_then(Value::as_array) else {
        return Ok(Vec::new());
    };
    let mut attachments = Vec::with_capacity(entries.len());
    for entry in entries {
        let key = entry
            .get("object_key")
            .and_then(Value::as_str)
            .ok_or_else(|| HandlerError::Permanent("attachment.object_key missing".to_owned()))?;
        let filename = entry
            .get("filename")
            .and_then(Value::as_str)
            .unwrap_or("document.pdf")
            .to_owned();
        let mime = entry
            .get("mime")
            .and_then(Value::as_str)
            .unwrap_or("application/pdf")
            .to_owned();
        let bytes = ctx
            .object_store
            .get(key)
            .await
            .map_err(|e| HandlerError::Permanent(format!("attachment fetch {key}: {e}")))?;
        attachments.push(EmailAttachment {
            filename,
            mime,
            bytes,
        });
    }
    Ok(attachments)
}

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

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
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

        let attachments = load_attachments(ctx, payload).await?;

        match provider.as_str() {
            "sendgrid" => {
                send_via_sendgrid(
                    ctx,
                    &from_address,
                    from_name.as_deref(),
                    to,
                    subject,
                    html,
                    text,
                    &attachments,
                )
                .await
            }
            "smtp" => {
                send_via_smtp(
                    ctx,
                    &from_address,
                    from_name.as_deref(),
                    to,
                    subject,
                    html,
                    text,
                    &attachments,
                )
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

#[allow(clippy::too_many_arguments)]
async fn send_via_sendgrid(
    ctx: &HandlerCtx,
    from_addr: &str,
    from_name: Option<&str>,
    to: &str,
    subject: &str,
    html: Option<&str>,
    text: Option<&str>,
    attachments: &[EmailAttachment],
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

    let mut body = json!({
        "personalizations": [{ "to": [{ "email": to }] }],
        "from": from,
        "subject": subject,
        "content": content,
    });
    if !attachments.is_empty() {
        use base64::Engine;
        let encoded: Vec<Value> = attachments
            .iter()
            .map(|a| {
                json!({
                    "content": base64::engine::general_purpose::STANDARD.encode(&a.bytes),
                    "filename": a.filename,
                    "type": a.mime,
                    "disposition": "attachment",
                })
            })
            .collect();
        body["attachments"] = json!(encoded);
    }

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

#[allow(clippy::too_many_lines, clippy::too_many_arguments)]
async fn send_via_smtp(
    ctx: &HandlerCtx,
    from_addr: &str,
    from_name: Option<&str>,
    to: &str,
    subject: &str,
    html: Option<&str>,
    text: Option<&str>,
    attachments: &[EmailAttachment],
) -> Result<Value, HandlerError> {
    use lettre::message::{Attachment, Mailbox, MultiPart, SinglePart};
    use lettre::transport::smtp::AsyncSmtpTransport;
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::{AsyncTransport, Message, Tokio1Executor};

    let host = match ctx.secret_resolver.get("SMTP_HOST").await {
        Ok(v) if !v.is_empty() => v,
        _ => {
            tracing::warn!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                "smtp: SMTP_HOST unset — running as stub"
            );
            return Ok(json!({
                "provider": "smtp",
                "stub": true,
                "reason": "creds_unset",
            }));
        }
    };
    let port: u16 = ctx
        .secret_resolver
        .get("SMTP_PORT")
        .await
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(587);
    let tls_mode = ctx
        .secret_resolver
        .get("SMTP_TLS")
        .await
        .unwrap_or_else(|_| "starttls".to_owned());

    let from: Mailbox = match from_name {
        Some(name) => format!("{name} <{from_addr}>"),
        None => from_addr.to_owned(),
    }
    .parse()
    .map_err(|e| HandlerError::Permanent(format!("smtp: invalid from address: {e}")))?;
    let to_mailbox: Mailbox = to
        .parse()
        .map_err(|e| HandlerError::Permanent(format!("smtp: invalid recipient: {e}")))?;

    let builder = Message::builder()
        .from(from)
        .to(to_mailbox)
        .subject(subject);
    let body_part = match (html, text) {
        (Some(h), Some(t)) => MultiPart::alternative_plain_html(t.to_owned(), h.to_owned()),
        (Some(h), None) => MultiPart::mixed().singlepart(SinglePart::html(h.to_owned())),
        (None, Some(t)) => MultiPart::mixed().singlepart(SinglePart::plain(t.to_owned())),
        (None, None) => unreachable!("validated above"),
    };
    let message = if attachments.is_empty() {
        builder.multipart(body_part)
    } else {
        let mut mixed = MultiPart::mixed().multipart(body_part);
        for a in attachments {
            let content_type = lettre::message::header::ContentType::parse(&a.mime)
                .map_err(|e| HandlerError::Permanent(format!("smtp: attachment mime: {e}")))?;
            mixed = mixed.singlepart(
                Attachment::new(a.filename.clone()).body(a.bytes.clone(), content_type),
            );
        }
        builder.multipart(mixed)
    }
    .map_err(|e| HandlerError::Permanent(format!("smtp: message build: {e}")))?;

    let mut transport = match tls_mode.as_str() {
        "implicit" => AsyncSmtpTransport::<Tokio1Executor>::relay(&host)
            .map_err(|e| HandlerError::Permanent(format!("smtp: relay config: {e}")))?,
        "none" => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&host),
        _ => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host)
            .map_err(|e| HandlerError::Permanent(format!("smtp: starttls config: {e}")))?,
    }
    .port(port);

    let username = ctx.secret_resolver.get("SMTP_USERNAME").await.ok();
    let password = ctx.secret_resolver.get("SMTP_PASSWORD").await.ok();
    if let (Some(user), Some(pass)) = (
        username.filter(|v| !v.is_empty()),
        password.filter(|v| !v.is_empty()),
    ) {
        transport = transport.credentials(Credentials::new(user, pass));
    }

    match transport.build().send(message).await {
        Ok(response) => {
            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                code = %response.code(),
                "smtp: email dispatched"
            );
            Ok(json!({
                "provider": "smtp",
                "status": "sent",
                "smtp_code": response.code().to_string(),
            }))
        }
        Err(error) => {
            // 5xx SMTP codes are permanent (bad mailbox, policy reject);
            // everything else (connect, timeout, 4xx) retries via outbox.
            if error.status().is_some_and(|code| {
                code.severity
                    == lettre::transport::smtp::response::Severity::PermanentNegativeCompletion
            }) {
                Err(HandlerError::Permanent(format!("smtp: {error}")))
            } else {
                Err(HandlerError::Transient(format!("smtp: {error}")))
            }
        }
    }
}
