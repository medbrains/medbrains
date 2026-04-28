//! Lightweight metrics surface. Phase-2 wires these into the OTEL
//! collector / Prometheus; Sprint A just exposes the read-side queries
//! so `/api/health` can include outbox depth + DLQ size.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize)]
pub struct OutboxStats {
    pub pending: i64,
    pub retrying: i64,
    pub dlq: i64,
    pub oldest_pending: Option<DateTime<Utc>>,
    pub oldest_retrying_attempts: Option<i32>,
}

/// Aggregate stats across all tenants (admin scope) — caller must use
/// the BYPASSRLS worker role or admin tenant context for cross-tenant
/// view. For per-tenant stats, set `app.tenant_id` first then call.
pub async fn outbox_stats(pool: &PgPool) -> Result<OutboxStats, sqlx::Error> {
    // allow-raw-sql: aggregate query for admin /api/health surface
    let row: (i64, i64, i64, Option<DateTime<Utc>>, Option<i32>) = sqlx::query_as(
        "SELECT \
            COUNT(*) FILTER (WHERE status = 'pending') AS pending, \
            COUNT(*) FILTER (WHERE status = 'retrying') AS retrying, \
            (SELECT COUNT(*) FROM outbox_dlq) AS dlq, \
            MIN(created_at) FILTER (WHERE status = 'pending') AS oldest_pending, \
            MAX(attempts) FILTER (WHERE status = 'retrying') AS oldest_retrying_attempts \
         FROM outbox_events",
    )
    .fetch_one(pool)
    .await?;

    Ok(OutboxStats {
        pending: row.0,
        retrying: row.1,
        dlq: row.2,
        oldest_pending: row.3,
        oldest_retrying_attempts: row.4,
    })
}

/// Per-tenant stats. Caller must have set app.tenant_id before invoking.
pub async fn tenant_outbox_stats(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<OutboxStats, sqlx::Error> {
    let mut tx = pool.begin().await?;
    // allow-raw-sql: tenant context bootstrap
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    let row: (i64, i64, i64, Option<DateTime<Utc>>, Option<i32>) = sqlx::query_as(
        "SELECT \
            COUNT(*) FILTER (WHERE status = 'pending'), \
            COUNT(*) FILTER (WHERE status = 'retrying'), \
            (SELECT COUNT(*) FROM outbox_dlq WHERE tenant_id = $1), \
            MIN(created_at) FILTER (WHERE status = 'pending'), \
            MAX(attempts) FILTER (WHERE status = 'retrying') \
         FROM outbox_events WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(OutboxStats {
        pending: row.0,
        retrying: row.1,
        dlq: row.2,
        oldest_pending: row.3,
        oldest_retrying_attempts: row.4,
    })
}
