//! ABDM (Ayushman Bharat Digital Mission) handlers — stubs for Phase 1.
//!
//! Phase 2 wires the real NHA gateway with HFR cert + HIU auth + IP
//! allowlist (no VPN — ABDM is HTTPS-only, see SPRINT-A plan §1).

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// `abdm.verify_abha` — verify ABHA ID with NHA on patient registration.
#[derive(Debug)]
pub struct VerifyAbhaHandler;

#[async_trait]
impl Handler for VerifyAbhaHandler {
    fn event_type(&self) -> &'static str {
        "abdm.verify_abha"
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
            "abdm.verify_abha STUB — Phase 2 wires NHA gateway"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}

/// `abdm.hie_bundle_push` — push FHIR R4 bundle on discharge.
#[derive(Debug)]
pub struct HieBundlePushHandler;

#[async_trait]
impl Handler for HieBundlePushHandler {
    fn event_type(&self) -> &'static str {
        "abdm.hie_bundle_push"
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
            "abdm.hie_bundle_push STUB — Phase 2 wires NHA HIE wire format"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}
