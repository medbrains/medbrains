//! `WhatsApp` Business — Meta Cloud API.
//!
//! Credentials resolved per-tenant:
//!   - `WHATSAPP_PHONE_NUMBER_ID`  (the sender phone number id from Meta Business)
//!   - `WHATSAPP_ACCESS_TOKEN`     (system-user permanent token)
//!
//! Payload shape (template message — required for most outbound):
//!   {
//!     "to": "+91XXXXXXXXXX",
//!     "`template_name"`: "`appointment_reminder`",
//!     "language": "en",
//!     "components": [{ "type": "body", "parameters": [{ "type": "text", "text": "..." }] }]
//!   }
//!
//! Or text message (only allowed within 24h of last user message — the
//! "service window"):
//!   { "to": "+91...", "text": "..." }
//!
//! SMS fallback: when WhatsApp is unconfigured or Meta rejects the
//! message permanently (no WhatsApp account, expired template), and
//! the payload carries `sms_fallback_body` (or `text`), the handler
//! enqueues the matching `sms.*` event so the patient still gets the
//! message. The fallback row is idempotent on the original event id.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::handler::{Handler, HandlerCtx, HandlerError};
use crate::queue::{OutboxRow, queue_in_tx};

const META_GRAPH_BASE: &str = "https://graph.facebook.com/v20.0";

#[derive(Debug)]
pub struct WhatsAppSendHandler {
    event_type: &'static str,
}

impl WhatsAppSendHandler {
    pub const fn new(event_type: &'static str) -> Self {
        Self { event_type }
    }
}

/// Enqueue the matching `sms.*` event when the payload carries a
/// plain-text body. Returns true when a fallback was queued.
async fn enqueue_sms_fallback(ctx: &HandlerCtx, payload: &Value, to: &str) -> bool {
    let Some(body) = payload
        .get("sms_fallback_body")
        .or_else(|| payload.get("text"))
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
    else {
        return false;
    };
    let Some(suffix) = ctx.event_type.strip_prefix("whatsapp.") else {
        return false;
    };
    let sms_event = format!("sms.{suffix}");
    // Leak: event types are a small fixed set, each leaked once per
    // process — required because OutboxRow stores &'static str.
    let sms_event: &'static str = Box::leak(sms_event.into_boxed_str());

    let mut tx = match ctx.pool.begin().await {
        Ok(tx) => tx,
        Err(error) => {
            tracing::error!(%error, "whatsapp fallback: tx begin failed");
            return false;
        }
    };
    let queued = queue_in_tx(
        &mut tx,
        OutboxRow {
            tenant_id: ctx.tenant_id,
            aggregate_type: "whatsapp_fallback",
            aggregate_id: Some(ctx.event_id),
            event_type: sms_event,
            payload: json!({ "to": to, "body": body }),
            idempotency_key: Some(format!("wafb:{}", ctx.event_id)),
        },
    )
    .await;
    match queued {
        Ok(_) => tx.commit().await.is_ok(),
        Err(error) => {
            tracing::error!(%error, "whatsapp fallback: enqueue failed");
            false
        }
    }
}

#[async_trait]
impl Handler for WhatsAppSendHandler {
    fn event_type(&self) -> &'static str {
        self.event_type
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let to = payload
            .get("to")
            .and_then(Value::as_str)
            .ok_or_else(|| HandlerError::Permanent("payload.to missing".to_owned()))?;

        let phone_number_id = match ctx.secret_resolver.get("WHATSAPP_PHONE_NUMBER_ID").await {
            Ok(v) if !v.is_empty() => v,
            _ => {
                // Unconfigured tenant: deliver over SMS when possible.
                let fell_back = enqueue_sms_fallback(ctx, payload, to).await;
                tracing::warn!(
                    tenant_id = %ctx.tenant_id,
                    event_id = %ctx.event_id,
                    fell_back,
                    "whatsapp: WHATSAPP_PHONE_NUMBER_ID unset"
                );
                return Ok(json!({
                    "provider": "whatsapp_cloud",
                    "stub": true,
                    "reason": "creds_unset",
                    "sms_fallback": fell_back,
                }));
            }
        };
        let access_token = ctx
            .secret_resolver
            .get("WHATSAPP_ACCESS_TOKEN")
            .await
            .map_err(|e| HandlerError::Permanent(format!("WHATSAPP_ACCESS_TOKEN: {e}")))?;

        // Build the message body. Prefer template; fall back to text.
        let message_body =
            if let Some(template_name) = payload.get("template_name").and_then(Value::as_str) {
                let language = payload
                    .get("language")
                    .and_then(Value::as_str)
                    .unwrap_or("en");
                let mut tmpl = json!({
                    "name": template_name,
                    "language": { "code": language },
                });
                if let Some(comps) = payload.get("components") {
                    tmpl["components"] = comps.clone();
                }
                json!({
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "template",
                    "template": tmpl,
                })
            } else if let Some(text) = payload.get("text").and_then(Value::as_str) {
                json!({
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "text",
                    "text": { "body": text },
                })
            } else {
                return Err(HandlerError::Permanent(
                    "payload must include template_name or text".to_owned(),
                ));
            };

        let url = format!("{META_GRAPH_BASE}/{phone_number_id}/messages");
        let resp = ctx
            .http_client
            .post(&url)
            .bearer_auth(&access_token)
            .json(&message_body)
            .send()
            .await
            .map_err(|e| HandlerError::Transient(format!("whatsapp http: {e}")))?;

        let status = resp.status();
        let body_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "<unreadable>".to_owned());

        if status.is_success() {
            let parsed: Value = serde_json::from_str(&body_text).unwrap_or(Value::Null);
            let message_id = parsed
                .get("messages")
                .and_then(|m| m.as_array())
                .and_then(|arr| arr.first())
                .and_then(|m| m.get("id"))
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_owned();
            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                message_id = %message_id,
                "whatsapp: dispatched"
            );
            Ok(json!({
                "provider": "whatsapp_cloud",
                "message_id": message_id,
                "status": "sent",
            }))
        } else if status.is_client_error() {
            // 4xx — bad number, no WhatsApp account, expired template,
            // outside service window. Try SMS before giving up: a
            // delivered fallback is a success, not a DLQ entry.
            if enqueue_sms_fallback(ctx, payload, to).await {
                tracing::warn!(
                    tenant_id = %ctx.tenant_id,
                    event_id = %ctx.event_id,
                    status = status.as_u16(),
                    "whatsapp rejected — delivered via SMS fallback"
                );
                return Ok(json!({
                    "provider": "whatsapp_cloud",
                    "status": "sms_fallback",
                    "whatsapp_error": body_text,
                }));
            }
            Err(HandlerError::Permanent(format!(
                "whatsapp {}: {body_text}",
                status.as_u16()
            )))
        } else {
            Err(HandlerError::Transient(format!(
                "whatsapp {}: {body_text}",
                status.as_u16()
            )))
        }
    }
}
