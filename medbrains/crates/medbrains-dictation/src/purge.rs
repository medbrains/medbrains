//! A recording never outlives 24 hours unsaved. Saving or rejecting deletes
//! it at once ([`crate::review`]); this pass deletes what was left behind.
//!
//! Each pass logs how many sessions older than 24 hours still hold a
//! recording or unsaved words, even when that is none, so a pass that
//! silently stopped working shows up as a count that never falls. The
//! deletion runs per tenant in a kernel unit of work as the system actor
//! (tenant context set, so it works under RLS whatever role the pool is),
//! and each tenant's deletion is written to its audit chain.

use std::time::Duration;

use medbrains_kernel::{Actor, KernelError};
use sqlx::PgPool;
use uuid::Uuid;

const PASS_INTERVAL: Duration = Duration::from_mins(15);
/// How long an unsaved recording is held.
pub const HOLD_HOURS: i32 = 24;
/// Tenants handled per pass; the rest wait for the next one.
const MAX_TENANTS_PER_PASS: i64 = 1000;
/// Sessions handled per tenant per pass; a backlog drains over passes.
const MAX_SESSIONS_PER_TENANT: i64 = 5000;

/// Run [`purge_expired`] every fifteen minutes on `pool` (the worker pool,
/// which may list every tenant's sessions).
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match purge_expired(&pool, HOLD_HOURS).await {
                Ok(pass) => tracing::info!(
                    held_past_limit = pass.held,
                    purged = pass.purged,
                    tenants = pass.tenants,
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
    pub tenants: usize,
}

/// Delete every recording older than `hours`, and the transcript and draft
/// of every such session that was not saved; mark unsaved ones abandoned.
///
/// # Errors
/// The database error; the next pass tries again.
pub async fn purge_expired(pool: &PgPool, hours: i32) -> Result<Pass, KernelError> {
    let held = sqlx::query!(
        r#"SELECT s.tenant_id, count(*) AS "held!"
             FROM dictation_sessions s
            WHERE s.created_at < now() - make_interval(hours => $1)
              AND (EXISTS (SELECT 1 FROM dictation_audio a WHERE a.session_id = s.id)
                   OR (s.status <> 'saved'
                       AND EXISTS (SELECT 1 FROM dictation_content c WHERE c.session_id = s.id)))
            GROUP BY s.tenant_id
            ORDER BY s.tenant_id
            LIMIT $2"#,
        hours,
        MAX_TENANTS_PER_PASS,
    )
    .fetch_all(pool)
    .await?;
    let mut pass = Pass {
        held: held.iter().map(|t| t.held).sum(),
        tenants: held.len(),
        ..Pass::default()
    };
    for tenant in held {
        pass.purged += purge_tenant(pool, tenant.tenant_id, hours).await?;
    }
    Ok(pass)
}

/// One tenant's expired data, deleted and audited in one unit of work.
async fn purge_tenant(pool: &PgPool, tenant_id: Uuid, hours: i32) -> Result<u64, KernelError> {
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
    Ok(audio.max(words))
}
