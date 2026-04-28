//! Twilio SMS handler — covers all `sms.*` event types.
//!
//! Phase 1 stub: logs and returns Ok. Phase 1.2 wires real Twilio HTTPS.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

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
        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id = %ctx.event_id,
            event_type = self.event_type,
            payload = ?payload,
            "twilio.sms STUB — Phase 1.2 will wire real Twilio HTTPS"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}
