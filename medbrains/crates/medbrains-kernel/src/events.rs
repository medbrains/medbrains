//! Events: before-events that can refuse, after-events that react.
//!
//! Wraps `medbrains_workflow::orchestration::lifecycle::{emit_before_event,
//! enqueue_after_event}`. The tenant and user come from the [`Tx`].
//!
//! Before-events are synchronous gates and run on their own connection.
//! After-events are an outbox write on the caller's transaction: they commit
//! with the work, and a rollback drops them.

use serde_json::Value;

use crate::{AppError, Tx};

pub use medbrains_core::orchestration::EventGateResult;

/// Run the pipelines gating `event_code`; `allowed == false` means a pipeline
/// refused and the caller must not proceed.
#[inline]
pub async fn before(
    tx: &Tx,
    event_code: &str,
    payload: &Value,
) -> Result<EventGateResult, AppError> {
    let actor = tx.actor();
    medbrains_workflow::orchestration::lifecycle::emit_before_event(
        &tx.pool,
        actor.tenant_id,
        actor.user_id,
        event_code,
        payload,
    )
    .await
}

/// Queue the pipelines reacting to `event_code`, inside the unit of work.
///
/// The job is visible to the worker only once `tx` commits, and is discarded if it
/// rolls back. A failed write fails the unit of work rather than committing
/// work whose event was lost.
#[inline]
pub async fn after(tx: &mut Tx, event_code: &str, payload: Value) -> Result<(), AppError> {
    let actor = tx.actor();
    medbrains_workflow::orchestration::lifecycle::enqueue_after_event(
        tx,
        actor.tenant_id,
        actor.user_id,
        event_code,
        payload,
    )
    .await
}
