//! WhatsApp Business — Meta Cloud API.
//!
//! Credentials resolved per-tenant:
//!   - `WHATSAPP_PHONE_NUMBER_ID`  (the sender phone number id from Meta Business)
//!   - `WHATSAPP_ACCESS_TOKEN`     (system-user permanent token)
//!
//! Payload shape (template message — required for most outbound):
//!   {
//!     "to": "+91XXXXXXXXXX",
//!     "template_name": "appointment_reminder",
//!     "language": "en",
//!     "components": [{ "type": "body", "parameters": [{ "type": "text", "text": "..." }] }]
//!   }
//!
//! Or text message (only allowed within 24h of last user message — the
//! "service window"):
//!   { "to": "+91...", "text": "..." }

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::handler::{Handler, HandlerCtx, HandlerError};

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

#[async_trait]
impl Handler for WhatsAppSendHandler {
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

        let phone_number_id = match ctx.secret_resolver.get("WHATSAPP_PHONE_NUMBER_ID").await {
            Ok(v) if !v.is_empty() => v,
            _ => {
                tracing::warn!(
                    tenant_id = %ctx.tenant_id,
                    event_id = %ctx.event_id,
                    "whatsapp: WHATSAPP_PHONE_NUMBER_ID unset — running as stub"
                );
                return Ok(json!({
                    "provider": "whatsapp_cloud",
                    "stub": true,
                    "reason": "creds_unset",
                }));
            }
        };
        let access_token = ctx
            .secret_resolver
            .get("WHATSAPP_ACCESS_TOKEN")
            .await
            .map_err(|e| HandlerError::Permanent(format!("WHATSAPP_ACCESS_TOKEN: {e}")))?;

        // Build the message body. Prefer template; fall back to text.
        let message_body = if let Some(template_name) =
            payload.get("template_name").and_then(Value::as_str)
        {
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
            // 4xx — bad number, expired template, outside service window.
            // Meta returns code+message body — surface for DLQ inspection.
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
