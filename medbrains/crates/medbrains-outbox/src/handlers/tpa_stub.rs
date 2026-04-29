//! TPA (Third Party Administrator) handlers — stubs for Phase 1.
//!
//! Phase 2 wires per-TPA connectors via SiteToSiteVpn / mTLS / Public.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// `tpa.preauth_submit` — cashless preauth submission.
#[derive(Debug)]
pub struct PreauthSubmitHandler;

#[async_trait]
impl Handler for PreauthSubmitHandler {
    fn event_type(&self) -> &'static str {
        "tpa.preauth_submit"
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
            "tpa.preauth_submit STUB — Phase 2 wires per-TPA connectors"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}
