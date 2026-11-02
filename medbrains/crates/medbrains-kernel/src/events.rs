//! Events: before-events that can refuse, after-events that react.
//!
//! The tenant and user come from the [`Tx`].
//!
//! Before-events are synchronous gates and run on their own connection.
//! After-events are an outbox write on the caller's transaction: they commit
//! with the work, and a rollback drops them.

mod gate;

use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{KernelError, Tx};

pub use medbrains_core::orchestration::EventGateResult;

/// Run the pipelines gating `event_code`; `allowed == false` means a pipeline
/// refused and the caller must not proceed.
#[inline]
pub async fn before(
    tx: &Tx,
    event_code: &str,
    payload: &Value,
) -> Result<EventGateResult, KernelError> {
    let actor = tx.actor();
    gate::emit_before_event(
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
pub async fn after(tx: &mut Tx, event_code: &str, payload: Value) -> Result<(), KernelError> {
    let actor = tx.actor();
    Ok(enqueue_after_event(tx, actor.tenant_id, actor.user_id, event_code, payload).await?)
}

/// Write the after-event job on `conn` — the outbox row.
///
/// On a connection inside a transaction the job commits or rolls back with the work, so an
/// event is never queued for work that did not happen. Errors propagate.
pub async fn enqueue_after_event(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    user_id: Uuid,
    event_code: &str,
    payload: Value,
) -> Result<(), sqlx::Error> {
    let job_payload = serde_json::json!({
        "event_code": event_code,
        "user_id": user_id.to_string(),
        "payload": payload,
    });
    sqlx::query(
        "INSERT INTO job_queue \
           (tenant_id, job_type, payload, priority) \
         VALUES ($1, 'pipeline_event', $2, 5)",
    )
    .bind(tenant_id)
    .bind(&job_payload)
    .execute(conn)
    .await?;
    Ok(())
}
