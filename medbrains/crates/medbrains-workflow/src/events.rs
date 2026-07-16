//! Internal event emission for the Integration Hub.
//!
//! When a module-level action completes (e.g. prescription created), it calls
//! [`emit_event`] with the event type and payload.
//!
//! This queries active pipelines that subscribe to that event and executes them
//! within SAVEPOINTs so a pipeline failure does not rollback the parent
//! transaction.

use medbrains_core::clinical_events::ClinicalEventEnvelope;
use medbrains_outbox::OutboxRow;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// Emit an internal event.
///
/// **Sprint A change** (RFCs/sprints/SPRINT-A-outbox.md §5):
/// 1. Caller's transaction continues to write to `integration_pipelines` matches.
/// 2. Pipeline execution moved into [`dispatch_to_pipelines`], which the outbox
///    worker invokes asynchronously via `pipeline_fallback` for unregistered
///    event_types. Synchronous in-line dispatch retained for backwards compat
///    until A.4 lands the outbox-write at every call site.
///
/// Today this remains synchronous. The function signature stays unchanged so
/// existing call sites in `routes/payment_gateway.rs:290`, `routes/integration.rs`
/// etc. compile without modification.
pub async fn emit_event(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    event_type: &str,
    payload: Value,
) -> Result<(), AppError> {
    dispatch_to_pipelines(pool, tenant_id, user_id, event_type, &payload).await
}

/// Emit a typed cross-module clinical/business event.
///
/// This is the preferred API for new route code. The event envelope carries the
/// mandatory tenant/source/actor metadata, while the existing pipeline
/// dispatcher keeps receiving the event payload shape it already understands.
pub async fn emit_clinical_event(
    pool: &PgPool,
    event: ClinicalEventEnvelope,
) -> Result<(), AppError> {
    validate_clinical_event_payload(&event)?;
    dispatch_to_pipelines(
        pool,
        event.tenant_id,
        event.actor_id,
        event.event_name.as_str(),
        &event.payload,
    )
    .await
}

/// Build the durable outbox row for a typed clinical event.
///
/// The outbox payload is the full envelope so downstream workers, dashboards,
/// and audit consumers never lose source metadata. `aggregate_type` and
/// `event_type` come from enums, not ad-hoc route strings.
pub fn clinical_event_outbox_row(event: &ClinicalEventEnvelope) -> Result<OutboxRow, AppError> {
    validate_clinical_event_payload(event)?;
    let payload = serde_json::to_value(event)
        .map_err(|e| AppError::Internal(format!("clinical event serialization failed: {e}")))?;
    Ok(OutboxRow {
        tenant_id: event.tenant_id,
        aggregate_type: event.source_module.as_str(),
        aggregate_id: Some(event.source_record_id),
        event_type: event.event_name.as_str(),
        payload,
        idempotency_key: Some(event.idempotency_key()),
    })
}

/// Queue a typed clinical event in the caller's transaction.
///
/// Use this when the event must be committed atomically with the domain write.
pub async fn queue_clinical_event_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    event: &ClinicalEventEnvelope,
) -> Result<Uuid, AppError> {
    let row = clinical_event_outbox_row(event)?;
    medbrains_outbox::queue_in_tx(tx, row)
        .await
        .map_err(|e| AppError::Internal(format!("clinical event outbox queue failed: {e}")))
}

/// Pipeline dispatcher — extracted from `emit_event` so the outbox worker
/// can invoke it for unregistered event_types (`handlers/pipeline_fallback.rs`).
///
/// Same semantics as the original `emit_event` body: find active pipelines
/// matching the event_type, execute each in its own SAVEPOINT, swallow per-
/// pipeline errors. Returns `Ok` even if individual pipelines failed.
pub async fn dispatch_to_pipelines(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    event_type: &str,
    payload: &Value,
) -> Result<(), AppError> {
    // **Architecture decision (RFC):** dynamic `integration_pipelines`
    // dispatch is removed. Cross-module pipelines are hardcoded Rust
    // in `default_pipelines.rs` — version-controlled, code-reviewed,
    // tested. Tenant variants live in `tenant_settings`.
    crate::orchestration::default_pipelines::dispatch_default_pipelines(
        pool, tenant_id, user_id, event_type, payload,
    )
    .await;
    Ok(())
}

fn validate_clinical_event_payload(event: &ClinicalEventEnvelope) -> Result<(), AppError> {
    let missing = event.missing_payload_keys();
    if missing.is_empty() {
        return Ok(());
    }
    Err(AppError::BadRequest(format!(
        "clinical event {} missing required payload key(s): {}",
        event.event_name.as_str(),
        missing.join(", ")
    )))
}
