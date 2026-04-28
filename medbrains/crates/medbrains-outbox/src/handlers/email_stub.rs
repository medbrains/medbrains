//! Email (SMTP) handler — stub for Phase 1, real protocol Phase 2.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

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
        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id = %ctx.event_id,
            event_type = self.event_type,
            payload = ?payload,
            "smtp.send STUB — Phase 2 will wire real SMTP"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}
