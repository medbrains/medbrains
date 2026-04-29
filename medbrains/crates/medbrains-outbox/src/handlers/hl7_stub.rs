//! HL7 outbound handlers — stubs for Phase 1.
//!
//! Phase 1 fallback: log + dispatch to in-app notify pipeline (already
//! exists). Phase 2 wires MLLP-over-TLS-over-IPSec to lab/hospital
//! integration partners.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// `lab.critical_value_notify` — critical lab value notification.
/// Phase 1: in-app + SMS to ordering doctor (via outbox `sms.*` event).
#[derive(Debug)]
pub struct CriticalValueHandler;

#[async_trait]
impl Handler for CriticalValueHandler {
    fn event_type(&self) -> &'static str {
        "lab.critical_value_notify"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id = %ctx.event_id,
            payload = ?payload,
            "lab.critical_value_notify STUB — Phase 2 wires HL7 outbound MLLP"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}
