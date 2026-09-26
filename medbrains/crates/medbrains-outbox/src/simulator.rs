//! Message simulator — what a patient's or a staff member's phone would have
//! received, on deployments that must not send anything.
//!
//! On (`MEDBRAINS_NOTIFY_SIMULATOR=true`, dev and test only), the SMS, WhatsApp
//! and email handlers render the message exactly as they would send it and
//! write it to `simulated_messages` instead of calling the provider. The server
//! refuses to start with the simulator on in production
//! (`medbrains-server` main), so a real patient is never left unmessaged.

use serde_json::{Value, json};

use crate::handler::{HandlerCtx, HandlerError};

pub const ENV_FLAG: &str = "MEDBRAINS_NOTIFY_SIMULATOR";

/// Whether messages are captured instead of sent.
pub fn enabled() -> bool {
    std::env::var(ENV_FLAG).is_ok_and(|value| value == "true")
}

/// One fully rendered message, as the provider would have received it.
pub struct SimulatedMessage<'a> {
    pub channel: &'a str,
    pub recipient: &'a str,
    pub subject: Option<&'a str>,
    pub body: &'a str,
    pub attachments: Value,
    pub template_id: Option<&'a str>,
}

/// Record the message and answer the way a successful send does, so the
/// outbox row completes normally.
pub async fn capture(
    ctx: &HandlerCtx,
    message: SimulatedMessage<'_>,
) -> Result<Value, HandlerError> {
    // Scoped like any tenant write: the worker's pool is not guaranteed to
    // bypass RLS on every deployment.
    let fail = |error: sqlx::Error| HandlerError::Transient(format!("simulator capture: {error}"));
    let mut tx = ctx.pool.begin().await.map_err(fail)?;
    sqlx::query!("SELECT set_config('app.tenant_id', $1, true)", ctx.tenant_id.to_string())
        .fetch_one(&mut *tx)
        .await
        .map_err(fail)?;
    let id = sqlx::query_scalar!(
        "INSERT INTO simulated_messages \
           (tenant_id, channel, recipient, event_type, subject, body, attachments, \
            template_id, outbox_event_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
        ctx.tenant_id,
        message.channel,
        message.recipient,
        ctx.event_type,
        message.subject,
        message.body,
        message.attachments,
        message.template_id,
        ctx.event_id,
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(fail)?;
    tx.commit().await.map_err(fail)?;
    Ok(json!({ "provider": "simulator", "simulated": true, "id": id }))
}

/// What a WhatsApp payload reads as on the phone: the text, or the template
/// with its parameters filled in, since the simulator cannot render Meta's
/// approved template itself.
pub fn whatsapp_text(payload: &Value) -> Option<String> {
    if let Some(text) = payload.get("text").and_then(Value::as_str) {
        return Some(text.to_owned());
    }
    let name = payload.get("template_name").and_then(Value::as_str)?;
    let params: Vec<&str> = payload
        .get("components")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|component| component.get("parameters").and_then(Value::as_array))
        .flatten()
        .filter_map(|param| param.get("text").and_then(Value::as_str))
        .collect();
    Some(format!("[{name}] {}", params.join(" · ")))
}

#[cfg(test)]
mod tests {
    use super::whatsapp_text;
    use serde_json::json;

    #[test]
    fn a_template_reads_as_its_parameters() {
        let payload = json!({
            "template_name": "patient_welcome",
            "components": [{ "type": "body", "parameters": [
                { "type": "text", "text": "Asha" }, { "type": "text", "text": "AMH-000123" }
            ]}]
        });
        assert_eq!(
            whatsapp_text(&payload).as_deref(),
            Some("[patient_welcome] Asha · AMH-000123")
        );
    }

    #[test]
    fn free_text_wins_and_nothing_to_show_is_none() {
        assert_eq!(whatsapp_text(&json!({ "text": "hi" })).as_deref(), Some("hi"));
        assert_eq!(whatsapp_text(&json!({ "to": "+91" })), None);
    }
}
