//! Handler trait + Registry. Each external integration registers a
//! typed handler; the Registry dispatches by `event_type` string.

use async_trait::async_trait;
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use uuid::Uuid;

/// Per-event-dispatch context passed to handlers. Carries the pool +
/// the actor context captured at queue time so RLS scoping matches the
/// original request, even though the worker connects with BYPASSRLS.
#[derive(Debug, Clone)]
pub struct HandlerCtx {
    pub pool: PgPool,
    pub tenant_id: Uuid,
    pub event_id: Uuid,
    pub event_type: String,
    pub actor_user_id: Option<Uuid>,
    pub attempts: i32,
}

/// Errors a handler can raise. The worker uses these to decide retry vs
/// straight-to-DLQ.
#[derive(Debug, Error)]
pub enum HandlerError {
    /// Network blip / 5xx / rate limit — retry per backoff.
    #[error("transient: {0}")]
    Transient(String),

    /// Validation error / 4xx / forbidden — straight to DLQ. No retry.
    /// Razorpay 400 amount_too_small, Twilio account suspended, etc.
    #[error("permanent: {0}")]
    Permanent(String),
}

#[async_trait]
pub trait Handler: Send + Sync + std::fmt::Debug {
    /// Stable event_type code matching `outbox_events.event_type`.
    fn event_type(&self) -> &'static str;

    /// Execute the side-effect. `payload` is the JSONB column value.
    /// Return value is the response to record (logged, optionally
    /// stored on the row in a `result` column — Phase-2 follow-up).
    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError>;
}

/// Registry of typed handlers + a fallback for unregistered event_types
/// (which delegates to the existing pipeline framework via
/// `pipeline_fallback.rs`). Lookup is O(1).
#[derive(Debug, Default)]
pub struct Registry {
    handlers: HashMap<&'static str, Arc<dyn Handler>>,
    fallback: Option<Arc<dyn Handler>>,
}

impl Registry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a typed handler. Panics if the same event_type is
    /// registered twice — matches "compile-time exhaustiveness" intent.
    pub fn register<H: Handler + 'static>(&mut self, handler: H) {
        let key = handler.event_type();
        if self.handlers.contains_key(key) {
            panic!("medbrains-outbox: duplicate handler for event_type '{key}'");
        }
        self.handlers.insert(key, Arc::new(handler));
    }

    /// Register the fallback handler that catches unregistered event_types.
    /// Typically the `pipeline_fallback::PipelineFallbackHandler` which
    /// delegates to the existing `events::dispatch_to_pipelines`.
    pub fn set_fallback<H: Handler + 'static>(&mut self, handler: H) {
        self.fallback = Some(Arc::new(handler));
    }

    pub fn lookup(&self, event_type: &str) -> Option<Arc<dyn Handler>> {
        self.handlers
            .get(event_type)
            .cloned()
            .or_else(|| self.fallback.clone())
    }

    pub fn len(&self) -> usize {
        self.handlers.len()
    }

    pub fn is_empty(&self) -> bool {
        self.handlers.is_empty()
    }
}
