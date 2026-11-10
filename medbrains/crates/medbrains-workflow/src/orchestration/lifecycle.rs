//! Event lifecycle — the after-event entry point for code outside a unit of work.
//!
//! [`emit_after_event`] is **non-blocking**: it enqueues a job to `job_queue` for
//! async execution and never fails the caller. The before-event gate and the
//! outbox write live in `medbrains_kernel::events`.

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// AFTER events — non-blocking.
///
/// Inserts a job into `job_queue` with `job_type = 'pipeline_event'` for
/// async pickup by the background worker. Never fails the caller.
///
/// Runs on its own connection, so call it only after the work it reports has
/// committed. Inside a unit of work use `medbrains_kernel::events::after`, which rides
/// the caller's transaction and is dropped with it on rollback.
pub async fn emit_after_event(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    event_code: &str,
    payload: Value,
) -> Result<(), AppError> {
    // Under the event's hospital: `job_queue` is row level secured, and an
    // insert outside a tenant is refused (and only logged, below).
    let result = match medbrains_db::pool::tenant_conn(pool, &tenant_id).await {
        Ok(mut conn) => medbrains_kernel::events::enqueue_after_event(
            &mut conn, tenant_id, user_id, event_code, payload,
        )
        .await
        .map_err(AppError::from),
        Err(e) => Err(AppError::from(e)),
    };

    if let Err(e) = result {
        // Log but never fail the caller
        tracing::error!(
            event_code,
            tenant_id = %tenant_id,
            error = %e,
            "failed to enqueue after-event job"
        );
    }

    Ok(())
}
