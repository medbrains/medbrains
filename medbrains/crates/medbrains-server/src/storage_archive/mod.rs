//! Storage-archive sweeper.
//!
//! Walks `patient_documents` per tenant and moves rows that have
//! crossed their lifecycle thresholds (`hot → cold → archive →
//! deleted`). Each transition writes a hash-chained row into
//! `object_storage_transitions`, mirroring the audit-log pattern in
//! migration `0056_audit_hash_chain.sql`.
//!
//! Designed to be called from:
//!   - The `medbrains-archive` binary on a systemd timer (one-shot).
//!   - A tokio task spawned alongside the outbox worker
//!     (`spawn_archive_loop`) for environments without external cron.
//!
//! The store impls (hot / cold / archive) are injected by the
//! caller. The pilot deploy plugs in `LocalFsObjectStore` for hot
//! and `ColdLocalObjectStore` for cold + archive (different roots).
//! Cloud-hosted tenants swap the archive store for an S3 or Glacier
//! adapter without touching this code.

use chrono::{DateTime, Utc};
use medbrains_core::object_store::{
    transition_hash, ObjectStore, StorageTier, StorageTierTransition,
};
use sqlx::{PgPool, Postgres, Transaction};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::time::interval;
use uuid::Uuid;

/// Store handles supplied by the caller. One impl per tier — they
/// can all point at the same backend (e.g. one `LocalFsObjectStore`
/// for tests) or three different backends (LocalFs hot,
/// ColdLocalObjectStore cold, S3 archive).
#[derive(Clone)]
pub struct StoreSet {
    pub hot: Arc<dyn ObjectStore>,
    pub cold: Arc<dyn ObjectStore>,
    pub archive: Arc<dyn ObjectStore>,
}

#[derive(Debug, Clone, Default)]
pub struct SweepReport {
    pub hot_to_cold: u32,
    pub cold_to_archive: u32,
    pub archive_to_deleted: u32,
    pub failures: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum SweepError {
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
    #[error("rls context: {0}")]
    RlsContext(#[from] medbrains_db::pool::DbError),
    #[error("object store: {0}")]
    Store(String),
    #[error("internal: {0}")]
    Internal(String),
}

/// Run a single sweep pass across every tenant.
pub async fn sweep_all_tenants(pool: &PgPool, stores: &StoreSet) -> Result<SweepReport, SweepError> {
    let mut report = SweepReport::default();
    let tenants: Vec<(Uuid,)> = sqlx::query_as("SELECT id FROM tenants WHERE is_active = true")
        .fetch_all(pool)
        .await?;

    for (tenant_id,) in tenants {
        match sweep_tenant(pool, stores, tenant_id).await {
            Ok(t) => {
                report.hot_to_cold += t.hot_to_cold;
                report.cold_to_archive += t.cold_to_archive;
                report.archive_to_deleted += t.archive_to_deleted;
                report.failures += t.failures;
            }
            Err(e) => {
                tracing::error!(?tenant_id, error = %e, "tenant sweep failed");
                report.failures = report.failures.saturating_add(1);
            }
        }
    }

    Ok(report)
}

/// Run the sweep for a single tenant. Always call this with the
/// tenant context set on `tx` so RLS does the heavy lifting.
pub async fn sweep_tenant(
    pool: &PgPool,
    stores: &StoreSet,
    tenant_id: Uuid,
) -> Result<SweepReport, SweepError> {
    let mut report = SweepReport::default();

    report.hot_to_cold = transition_eligible(
        pool,
        stores,
        tenant_id,
        StorageTier::Hot,
        StorageTier::Cold,
        "hot_to_cold_days",
    )
    .await?;

    report.cold_to_archive = transition_eligible(
        pool,
        stores,
        tenant_id,
        StorageTier::Cold,
        StorageTier::Archive,
        "cold_to_archive_days",
    )
    .await?;

    report.archive_to_deleted = transition_eligible(
        pool,
        stores,
        tenant_id,
        StorageTier::Archive,
        StorageTier::Deleted,
        "archive_to_delete_days",
    )
    .await?;

    Ok(report)
}

/// Move every document at `from` whose age exceeds the configured
/// threshold to `to`. Transitions are written one row at a time so a
/// crash mid-batch doesn't leak bytes.
async fn transition_eligible(
    pool: &PgPool,
    stores: &StoreSet,
    tenant_id: Uuid,
    from: StorageTier,
    to: StorageTier,
    threshold_column: &'static str,
) -> Result<u32, SweepError> {
    let mut moved = 0u32;

    loop {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

        // Claim a small batch of eligible rows. FOR UPDATE SKIP
        // LOCKED keeps a second sweeper from grabbing the same row.
        let sql = format!(
            "SELECT pd.id, pd.file_url, pd.tier_key, pd.file_size \
               FROM patient_documents pd \
               JOIN object_storage_policies p \
                 ON p.tenant_id = pd.tenant_id \
                AND p.document_category = pd.document_type \
              WHERE pd.tenant_id = $1 \
                AND pd.storage_tier = $2::storage_tier \
                AND p.{threshold_column} IS NOT NULL \
                AND pd.created_at + (p.{threshold_column} * INTERVAL '1 day') <= now() \
              ORDER BY pd.created_at \
              FOR UPDATE SKIP LOCKED \
              LIMIT 32"
        );

        let rows: Vec<(Uuid, String, Option<String>, Option<i64>)> = sqlx::query_as(&sql)
            .bind(tenant_id)
            .bind(from.as_str())
            .fetch_all(&mut *tx)
            .await?;

        if rows.is_empty() {
            tx.commit().await?;
            break;
        }

        for (doc_id, src_key, tier_key, byte_size) in &rows {
            let from_key = tier_key.clone().unwrap_or_else(|| src_key.clone());
            let to_key = if matches!(to, StorageTier::Deleted) {
                None
            } else {
                Some(format!("{}/{}", to.as_str(), doc_id))
            };

            // Move bytes between stores, except for the deletion
            // tombstone path which just removes the source.
            match move_object(stores, from, to, &from_key, to_key.as_deref()).await {
                Ok(()) => {}
                Err(e) => {
                    tracing::warn!(?doc_id, error = %e, "object move failed; row left in place");
                    continue;
                }
            }

            // Update patient_documents.
            sqlx::query(
                "UPDATE patient_documents \
                    SET storage_tier = $1::storage_tier, \
                        tier_key = $2, \
                        last_tier_transition_at = now() \
                  WHERE id = $3",
            )
            .bind(to.as_str())
            .bind(to_key.as_deref())
            .bind(doc_id)
            .execute(&mut *tx)
            .await?;

            // Write the hash-chained transition audit row.
            write_transition_row(
                &mut tx,
                tenant_id,
                *doc_id,
                "patient_documents",
                from,
                to,
                Some(from_key.clone()),
                to_key.clone(),
                *byte_size,
            )
            .await?;

            moved += 1;
        }

        tx.commit().await?;

        if rows.len() < 32 {
            break;
        }
    }

    Ok(moved)
}

/// Copy bytes from `from` store to `to` store and delete from
/// source. For `Archive → Deleted`, just delete from source — no
/// destination.
async fn move_object(
    stores: &StoreSet,
    from: StorageTier,
    to: StorageTier,
    from_key: &str,
    to_key: Option<&str>,
) -> Result<(), SweepError> {
    let src = pick(stores, from)?;
    if let (StorageTier::Deleted, _) = (to, to_key) {
        // Tombstone — drop the source, no destination.
        if let Some(s) = src {
            s.delete(from_key).await.map_err(|e| SweepError::Store(e.to_string()))?;
        }
        return Ok(());
    }

    let dst_key = to_key.ok_or_else(|| {
        SweepError::Internal(format!("missing destination key for tier transition to {to:?}"))
    })?;
    let src = src.ok_or_else(|| SweepError::Internal(format!("no store for source tier {from:?}")))?;
    let dst = pick(stores, to)?
        .ok_or_else(|| SweepError::Internal(format!("no store for destination tier {to:?}")))?;

    let bytes = src
        .get(from_key)
        .await
        .map_err(|e| SweepError::Store(e.to_string()))?;
    dst.put(dst_key, bytes, None)
        .await
        .map_err(|e| SweepError::Store(e.to_string()))?;
    src.delete(from_key)
        .await
        .map_err(|e| SweepError::Store(e.to_string()))?;
    Ok(())
}

fn pick(stores: &StoreSet, tier: StorageTier) -> Result<Option<&Arc<dyn ObjectStore>>, SweepError> {
    Ok(match tier {
        StorageTier::Hot => Some(&stores.hot),
        StorageTier::Cold => Some(&stores.cold),
        StorageTier::Archive => Some(&stores.archive),
        StorageTier::Deleted => None,
    })
}

/// Insert a hash-chained transition row. Uses an advisory lock
/// keyed on `('storage_chain', tenant_id)` so concurrent sweepers
/// can't race the previous-hash lookup. Mirrors migration 0056's
/// audit-log pattern.
#[allow(clippy::too_many_arguments)]
async fn write_transition_row(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    document_id: Uuid,
    document_table: &'static str,
    from_tier: StorageTier,
    to_tier: StorageTier,
    from_key: Option<String>,
    to_key: Option<String>,
    byte_size: Option<i64>,
) -> Result<(), SweepError> {
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtext('storage_chain'), hashtext($1::text))",
    )
    .bind(tenant_id.to_string())
    .execute(&mut **tx)
    .await?;

    let previous_hash: Option<String> = sqlx::query_scalar(
        "SELECT hash FROM object_storage_transitions \
          WHERE tenant_id = $1 \
          ORDER BY triggered_at DESC, id DESC \
          LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let triggered_at: DateTime<Utc> = Utc::now();
    let mut transition = StorageTierTransition {
        document_id,
        document_table: document_table.to_owned(),
        from_tier,
        to_tier,
        from_key: from_key.clone(),
        to_key: to_key.clone(),
        byte_size,
        triggered_by: "medbrains-archive".to_owned(),
        triggered_at,
        previous_hash: previous_hash.clone(),
        hash: String::new(),
    };
    transition.hash = transition_hash(&transition);

    sqlx::query(
        "INSERT INTO object_storage_transitions \
            (tenant_id, document_id, document_table, from_tier, to_tier, \
             from_key, to_key, byte_size, triggered_by, triggered_at, \
             previous_hash, hash) \
         VALUES ($1, $2, $3, $4::storage_tier, $5::storage_tier, $6, $7, $8, $9, $10, $11, $12)",
    )
    .bind(tenant_id)
    .bind(transition.document_id)
    .bind(transition.document_table)
    .bind(transition.from_tier.as_str())
    .bind(transition.to_tier.as_str())
    .bind(transition.from_key)
    .bind(transition.to_key)
    .bind(transition.byte_size)
    .bind(transition.triggered_by)
    .bind(transition.triggered_at)
    .bind(transition.previous_hash)
    .bind(transition.hash)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

/// Spawn the sweep loop as a tokio task — call from `main()` on
/// process startup. Returns a `watch::Sender<bool>` you can flip to
/// stop the loop gracefully (e.g. on SIGTERM).
pub fn spawn_archive_loop(
    pool: PgPool,
    stores: StoreSet,
    interval_secs: u64,
) -> watch::Sender<bool> {
    let (stop_tx, mut stop_rx) = watch::channel(false);
    tokio::spawn(async move {
        let mut tick = interval(Duration::from_secs(interval_secs));
        loop {
            tokio::select! {
                _ = tick.tick() => {
                    match sweep_all_tenants(&pool, &stores).await {
                        Ok(r) => tracing::info!(
                            hot_to_cold = r.hot_to_cold,
                            cold_to_archive = r.cold_to_archive,
                            archive_to_deleted = r.archive_to_deleted,
                            failures = r.failures,
                            "storage sweep complete"
                        ),
                        Err(e) => tracing::error!(error = %e, "storage sweep failed"),
                    }
                }
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        tracing::info!("archive loop stop signal received");
                        break;
                    }
                }
            }
        }
    });
    stop_tx
}
