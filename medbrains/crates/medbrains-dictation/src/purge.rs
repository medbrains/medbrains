//! A recording never outlives 24 hours unsaved. Saving or rejecting deletes
//! it at once ([`crate::review`]); this pass deletes what was left behind.
//!
//! Tenants are listed from `tenants` (not row-level secured), then each one is
//! counted and purged in its own kernel unit of work as the system actor, so
//! the tenant context is set and the pass sees that tenant's rows under RLS
//! whatever role the pool connects as. Each pass logs how many sessions older
//! than 24 hours still held a recording or unsaved words, even when none, so a
//! pass that silently stopped working shows as a count that never falls. A
//! tenant that fails is logged and skipped; the rest of the pass carries on.
//! Each tenant's deletion is written to its own audit chain.

use std::time::Duration;

use medbrains_kernel::{Actor, KernelError};
use sqlx::PgPool;
use uuid::Uuid;

const PASS_INTERVAL: Duration = Duration::from_mins(15);
/// How long an unsaved recording is held.
pub const HOLD_HOURS: i32 = 24;
/// Tenants handled per pass: a bound far above any deployment's count.
const MAX_TENANTS_PER_PASS: i64 = 10_000;
/// Sessions handled per tenant per pass; a backlog drains over passes.
const MAX_SESSIONS_PER_TENANT: i64 = 5000;

/// Run [`purge_expired`] every fifteen minutes on `pool` (the worker pool).
/// Runs on `spawn_forever`: the loop cannot return and stop the pass unseen.
pub fn spawn(pool: PgPool) {
    medbrains_server_core::background::spawn_forever(async move {
        loop {
            match purge_expired(&pool, HOLD_HOURS).await {
                Ok(pass) => tracing::info!(
                    held_past_limit = pass.held,
                    purged = pass.purged,
                    tenants = pass.tenants,
                    tenants_failed = pass.failed,
                    "dictation purge pass"
                ),
                Err(error) => tracing::error!(%error, "dictation purge pass failed"),
            }
            tokio::time::sleep(PASS_INTERVAL).await;
        }
    });
}

/// What one pass found and did.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Pass {
    /// Sessions older than the limit still holding a recording or unsaved words.
    pub held: i64,
    /// Sessions whose recording or words this pass deleted.
    pub purged: u64,
    /// Tenants that had something to purge.
    pub tenants: usize,
    /// Tenants whose purge failed this pass (logged; tried again next pass).
    pub failed: usize,
}

/// Delete every recording older than `hours`, and the transcript and draft
/// of every such session that was not saved; mark unsaved ones abandoned.
///
/// # Errors
/// Only when the tenants cannot be listed; one tenant's failure is logged
/// and counted in [`Pass::failed`], never the end of the pass.
pub async fn purge_expired(pool: &PgPool, hours: i32) -> Result<Pass, KernelError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar!(
        "SELECT id FROM tenants ORDER BY id LIMIT $1",
        MAX_TENANTS_PER_PASS
    )
    .fetch_all(pool)
    .await?;
    let mut pass = Pass::default();
    for tenant_id in tenants {
        match purge_tenant(pool, tenant_id, hours).await {
            Ok((0, _)) => {}
            Ok((held, purged)) => {
                pass.held += held;
                pass.purged += purged;
                pass.tenants += 1;
            }
            Err(error) => {
                pass.failed += 1;
                tracing::error!(%tenant_id, %error, "dictation purge failed for a tenant; carrying on");
            }
        }
    }
    Ok(pass)
}

/// One tenant's expired data, counted, deleted and audited in one unit of
/// work: (sessions found holding data, sessions purged). Nothing found means
/// nothing written, not even an audit row.
async fn purge_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
    hours: i32,
) -> Result<(i64, u64), KernelError> {
    let mut tx = medbrains_kernel::begin(pool, Actor::system(tenant_id)).await?;
    let expired: Vec<Uuid> = sqlx::query_scalar!(
        "SELECT s.id FROM dictation_sessions s \
          WHERE s.tenant_id = $1 AND s.created_at < now() - make_interval(hours => $2) \
            AND (EXISTS (SELECT 1 FROM dictation_audio a WHERE a.session_id = s.id) \
                 OR (s.status <> 'saved' \
                     AND EXISTS (SELECT 1 FROM dictation_content c WHERE c.session_id = s.id)) \
                 OR s.status IN ('processing', 'drafted', 'stt_failed', 'llm_failed', 'no_speech')) \
          ORDER BY s.created_at LIMIT $3",
        tenant_id,
        hours,
        MAX_SESSIONS_PER_TENANT,
    )
    .fetch_all(&mut *tx)
    .await?;
    if expired.is_empty() {
        return Ok((0, 0));
    }
    let held = i64::try_from(expired.len()).unwrap_or(i64::MAX);
    let audio = sqlx::query!(
        "DELETE FROM dictation_audio WHERE tenant_id = $1 AND session_id = ANY($2)",
        tenant_id,
        &expired,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let words = sqlx::query!(
        "DELETE FROM dictation_content c USING dictation_sessions s \
          WHERE s.id = c.session_id AND c.tenant_id = $1 AND s.status <> 'saved' \
            AND c.session_id = ANY($2)",
        tenant_id,
        &expired,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let abandoned = sqlx::query!(
        "UPDATE dictation_sessions \
            SET audio_deleted_at = COALESCE(audio_deleted_at, now()), \
                status = CASE WHEN status IN ('saved', 'rejected') THEN status ELSE 'abandoned' END \
          WHERE tenant_id = $1 AND id = ANY($2) \
            AND (audio_deleted_at IS NULL OR status NOT IN ('saved', 'rejected', 'abandoned'))",
        tenant_id,
        &expired,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let detail = serde_json::json!({
        "recordings_deleted": audio,
        "unsaved_transcripts_deleted": words,
        "sessions_abandoned": abandoned,
        "hold_hours": hours,
    });
    let entry = medbrains_kernel::audit::AuditEntry {
        tenant_id,
        user_id: None,
        action: "dictation_recordings_purged",
        entity_type: "dictation_session",
        entity_id: None,
        old_values: None,
        new_values: Some(&detail),
        ip_address: None,
    };
    medbrains_kernel::audit(&mut tx, &entry).await?;
    tx.commit().await?;
    Ok((held, audio.max(words).max(abandoned)))
}
