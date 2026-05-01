//! Twilio SMS handler — real outbound via Twilio REST API.
//!
//! Credentials resolved per-tenant via `ctx.secret_resolver`:
//!   - `TWILIO_ACCOUNT_SID`  (required)
//!   - `TWILIO_AUTH_TOKEN`   (required)
//!   - `TWILIO_FROM_NUMBER`  (required, E.164 like `+91XXXXXXXXXX`)
//!   - `TWILIO_MESSAGING_SERVICE_SID` (optional, used for DLT in India)
//!
//! When any required secret is missing the handler logs at warn-level
//! and returns Ok with `{stub: true, reason: "creds_unset"}` — keeps
//! dev environments quiet without burying the error in DLQ.
//!
//! Payload shape (any of these fields can be present):
//!   { "to": "+91...", "body": "...", "template_id": "...", "dlt_template_id": "..." }
//!
//! Returns `{provider: "twilio", sid: "SM...", status: "queued"}` on success.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// Outcome of the DLT lookup. `rendered_body` is set when a template
/// matched and we substituted variables. `template_id` is propagated
/// to the success response for audit.
#[derive(Debug, Default)]
struct DltLookup {
    rendered_body: Option<String>,
    template_id: Option<String>,
}

async fn render_with_dlt_template(
    ctx: &HandlerCtx,
    payload: &Value,
) -> Result<DltLookup, HandlerError> {
    let scope = payload.get("template_scope").and_then(Value::as_str);
    let language = payload.get("language").and_then(Value::as_str);

    let enforce_str = ctx
        .secret_resolver
        .get("DLT_ENFORCE")
        .await
        .unwrap_or_default();
    let enforce = matches!(enforce_str.to_ascii_lowercase().as_str(), "1" | "true" | "yes");

    let Some(scope) = scope else {
        if enforce {
            return Err(HandlerError::Permanent(
                "DLT_ENFORCE=true but payload.template_scope missing".to_owned(),
            ));
        }
        return Ok(DltLookup::default());
    };

    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT template_id, body_pattern FROM dlt_templates \
         WHERE tenant_id = $1 AND scope = $2 AND is_active \
           AND (expires_at IS NULL OR expires_at > CURRENT_DATE) \
         ORDER BY (language = $3) DESC, language ASC LIMIT 1",
    )
    .bind(ctx.tenant_id)
    .bind(scope)
    .bind(language.unwrap_or("en"))
    .fetch_optional(&ctx.pool)
    .await
    .map_err(|e| HandlerError::Transient(format!("dlt lookup: {e}")))?;

    let Some((template_id, pattern)) = row else {
        if enforce {
            return Err(HandlerError::Permanent(format!(
                "DLT_ENFORCE=true and no active template registered for scope '{scope}'"
            )));
        }
        return Ok(DltLookup::default());
    };

    // Substitute {#var#} placeholders with values from
    // payload.variables (object) — telcos accept the rendered text and
    // verify it against the registered pattern at the gateway.
    let mut rendered = pattern.clone();
    if let Some(vars) = payload.get("variables").and_then(Value::as_object) {
        for (k, v) in vars {
            let placeholder = format!("{{#{k}#}}");
            let value = match v {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => continue,
            };
            rendered = rendered.replace(&placeholder, &value);
        }
    }

    Ok(DltLookup {
        rendered_body: Some(rendered),
        template_id: Some(template_id),
    })
}

const TWILIO_API_BASE: &str = "https://api.twilio.com/2010-04-01/Accounts";

#[derive(Debug)]
pub struct SmsSendHandler {
    event_type: &'static str,
}

impl SmsSendHandler {
    pub const fn new(event_type: &'static str) -> Self {
        Self { event_type }
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
        // Pull the recipient + body from the payload first; fail fast
        // before contacting the credential resolver.
        let to = payload
            .get("to")
            .and_then(Value::as_str)
            .ok_or_else(|| HandlerError::Permanent("payload.to missing".to_owned()))?;

        // DLT template gate (India). If the payload carries a
        // `template_scope`, look up the registered template and render
        // the body from the pattern + provided variables. If the
        // tenant has DLT enforcement on (`DLT_ENFORCE=true`) and we
        // don't find a match, refuse to send — un-templated SMS gets
        // dropped at the carrier and any send is wasted credits.
        let dlt_lookup = render_with_dlt_template(ctx, payload).await?;
        let body: String = if let Some(rendered) = dlt_lookup.rendered_body.clone() {
            rendered
        } else {
            payload
                .get("body")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    HandlerError::Permanent("payload.body or template_scope missing".to_owned())
                })?
                .to_owned()
        };

        // Resolve credentials. Missing → graceful stub mode (dev/CI).
        let sid = match ctx.secret_resolver.get("TWILIO_ACCOUNT_SID").await {
            Ok(v) if !v.is_empty() => v,
            _ => {
                tracing::warn!(
                    tenant_id = %ctx.tenant_id,
                    event_id = %ctx.event_id,
                    "twilio: TWILIO_ACCOUNT_SID unset — running as stub"
                );
                return Ok(serde_json::json!({
                    "provider": "twilio",
                    "stub": true,
                    "reason": "creds_unset",
                }));
            }
        };
        let token = ctx
            .secret_resolver
            .get("TWILIO_AUTH_TOKEN")
            .await
            .map_err(|e| HandlerError::Permanent(format!("TWILIO_AUTH_TOKEN: {e}")))?;
        let from_number = ctx
            .secret_resolver
            .get("TWILIO_FROM_NUMBER")
            .await
            .map_err(|e| HandlerError::Permanent(format!("TWILIO_FROM_NUMBER: {e}")))?;
        let messaging_service_sid = ctx
            .secret_resolver
            .get("TWILIO_MESSAGING_SERVICE_SID")
            .await
            .ok();

        // Build form body. Use MessagingServiceSid when present (India DLT
        // routing); fall back to From for international/dev.
        let mut form: Vec<(&str, String)> = vec![
            ("To", to.to_owned()),
            ("Body", body.clone()),
        ];
        if let Some(svc) = messaging_service_sid.filter(|s| !s.is_empty()) {
            form.push(("MessagingServiceSid", svc));
        } else {
            form.push(("From", from_number));
        }

        let url = format!("{TWILIO_API_BASE}/{sid}/Messages.json");
        let resp = ctx
            .http_client
            .post(&url)
            .basic_auth(&sid, Some(&token))
            .form(&form)
            .send()
            .await
            .map_err(|e| HandlerError::Transient(format!("twilio http: {e}")))?;

        let status = resp.status();
        let body_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "<unreadable response>".to_owned());

        if status.is_success() {
            // Twilio returns the full Message resource; parse for `sid` + `status`.
            let parsed: Value = serde_json::from_str(&body_text).unwrap_or_else(|_| Value::Null);
            let sid = parsed
                .get("sid")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_owned();
            let twilio_status = parsed
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("queued")
                .to_owned();
            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                sid = %sid,
                status = %twilio_status,
                dlt_template = ?dlt_lookup.template_id,
                "twilio: SMS dispatched"
            );
            Ok(serde_json::json!({
                "provider": "twilio",
                "sid": sid,
                "status": twilio_status,
                "dlt_template_id": dlt_lookup.template_id,
            }))
        } else if status.is_client_error() {
            // 4xx — bad number, account suspended, body too long. DLQ.
            Err(HandlerError::Permanent(format!(
                "twilio {}: {body_text}",
                status.as_u16()
            )))
        } else {
            // 5xx / network — retry.
            Err(HandlerError::Transient(format!(
                "twilio {}: {body_text}",
                status.as_u16()
            )))
        }
    }
}
