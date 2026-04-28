//! Fallback handler — delegates to the existing pipeline framework
//! (`medbrains-server::events::dispatch_to_pipelines`).
//!
//! medbrains-outbox cannot directly depend on medbrains-server (circular —
//! server depends on outbox). Solution: a `PipelineDispatcher` trait
//! defined here; medbrains-server's `events::dispatch_to_pipelines` is
//! wrapped by an implementor and injected into the Registry by main.rs.

use async_trait::async_trait;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// Boundary trait — main.rs implements this with a closure that calls
/// `medbrains_server::events::dispatch_to_pipelines`.
#[async_trait]
pub trait PipelineDispatcher: Send + Sync + std::fmt::Debug {
    async fn dispatch(
        &self,
        pool: &PgPool,
        tenant_id: Uuid,
        user_id: Uuid,
        event_type: &str,
        payload: &Value,
    ) -> Result<(), String>;
}

/// Fallback handler — registered in the Registry as the catch-all for
/// any event_type not bound to a typed handler.
pub struct PipelineFallbackHandler {
    dispatcher: Arc<dyn PipelineDispatcher>,
}

impl std::fmt::Debug for PipelineFallbackHandler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PipelineFallbackHandler").finish_non_exhaustive()
    }
}

impl PipelineFallbackHandler {
    pub fn new(dispatcher: Arc<dyn PipelineDispatcher>) -> Self {
        Self { dispatcher }
    }
}

#[async_trait]
impl Handler for PipelineFallbackHandler {
    /// The fallback's event_type is unused — the Registry routes any
    /// unknown event_type here regardless. Returning a sentinel string
    /// preserves the trait shape.
    fn event_type(&self) -> &'static str {
        "_pipeline_fallback"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        // Use the worker's pool for dispatch. RLS is satisfied because
        // the worker runs with BYPASSRLS; per-pipeline execution sets
        // app.tenant_id internally via execute_pipeline_safe.
        let user_id = ctx.actor_user_id.unwrap_or(Uuid::nil());
        self.dispatcher
            .dispatch(&ctx.pool, ctx.tenant_id, user_id, &ctx.event_type, payload)
            .await
            .map_err(HandlerError::Transient)?;
        Ok(serde_json::json!({ "dispatched_via": "pipeline_fallback" }))
    }
}
