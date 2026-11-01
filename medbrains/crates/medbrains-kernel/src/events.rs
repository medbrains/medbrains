//! Events: before-events that can refuse, after-events that react.
//!
//! Wraps `medbrains_workflow::orchestration::lifecycle::{emit_before_event,
//! emit_after_event}`. The tenant and user come from the [`Tx`].
//!
//! **Gap:** both open their own tenant connection, so they run outside the
//! caller's transaction — an after-event is queued even if the unit of work
//! later rolls back. Moving them onto the caller's transaction (a true outbox
//! write) changes behaviour and is left for a later phase.

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

/// Queue the pipelines reacting to `event_code`. Never fails the caller: a
/// queueing fault is logged by the wrapped function.
#[inline]
pub async fn after(tx: &Tx, event_code: &str, payload: Value) -> Result<(), AppError> {
    let actor = tx.actor();
    medbrains_workflow::orchestration::lifecycle::emit_after_event(
        &tx.pool,
        actor.tenant_id,
        actor.user_id,
        event_code,
        payload,
    )
    .await
}
