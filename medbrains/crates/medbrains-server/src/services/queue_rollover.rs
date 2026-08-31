//! Ending the day on the queues.
//!
//! Nothing ever closed a queue. `opd_queues` and `tokens` accumulated rows
//! that stayed `waiting` forever, and they were invisible only because every
//! read filters on today's date. The seeded database carried 363 rows still
//! waiting from the 11th of August.
//!
//! Two consequences, and the second is the expensive one:
//!
//! 1. A patient the hospital never reached leaves no record of having waited.
//! 2. **No row in the database has ever carried both `called_at` and
//!    `completed_at`**, so every wait-time estimate has silently fallen back
//!    to a hard-coded ten minutes. A queue cannot learn how long anything
//!    takes until days end and rows close.
//!
//! This pass closes what yesterday left open. It does not decide anything
//! clinical: a row it touches was never seen, and `expired` says exactly that
//! -- not `no_show`, which is a statistic about patients who were called and
//! did not come, and not `cancelled`, which implies somebody chose.
//!
//! Day boundaries are per tenant. A hospital's day ends on its own clock, so
//! the comparison is against each tenant's local date rather than the
//! server's, and a tenant whose date has not rolled over is skipped rather
//! than closed early.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Hourly. The pass is cheap and idempotent, and tenants roll over on
/// different clocks -- a daily tick would close some hospitals' days up to
/// twenty-three hours late.
const PASS_INTERVAL_SECS: u64 = 3600;

/// Ceiling on one tenant's close, so a hospital returning from a long outage
/// cannot hold the pass open against every other tenant. What is left is taken
/// on the next tick an hour later.
const MAX_ROWS_PER_TENANT: i64 = 5000;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            if let Err(error) = run_rollover_pass(&pool).await {
                tracing::error!(%error, "queue rollover pass failed");
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// Close every queue entry and token left open on a day that has ended.
pub async fn run_rollover_pass(pool: &PgPool) -> Result<(), AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM tenants WHERE is_active")
        .fetch_all(pool)
        .await?;

    for tenant_id in tenants {
        match close_tenant_day(pool, tenant_id).await {
            Ok((queues, tokens)) if queues > 0 || tokens > 0 => {
                tracing::info!(%tenant_id, queues, tokens, "closed yesterday's queues");
            }
            Ok(_) => {}
            // One tenant's failure must not stop the rest. A hospital whose
            // rollover fails keeps yesterday's rows for another hour, which is
            // the same state it was already in.
            Err(error) => tracing::error!(%tenant_id, %error, "queue rollover failed for tenant"),
        }
    }
    Ok(())
}

/// Close one tenant's expired rows, against that tenant's own local date.
async fn close_tenant_day(pool: &PgPool, tenant_id: Uuid) -> Result<(u64, u64), AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let today =
        medbrains_server_core::hospital_time::tenant_local_today(&mut *tx, tenant_id).await?;

    let queues = sqlx::query(
        "WITH stale AS ( \
             SELECT id FROM opd_queues \
              WHERE tenant_id = $1 AND queue_date < $2 AND deleted_at IS NULL \
                AND status IN ('waiting', 'called', 'in_consultation') \
              LIMIT $3 \
         ) \
         UPDATE opd_queues q SET status = 'expired', updated_at = now() \
           FROM stale WHERE q.id = stale.id",
    )
    .bind(tenant_id)
    .bind(today)
    .bind(MAX_ROWS_PER_TENANT)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    let tokens = sqlx::query(
        "WITH stale AS ( \
             SELECT id FROM tokens \
              WHERE tenant_id = $1 AND token_date < $2 \
                AND status IN ('waiting', 'called', 'serving') \
              LIMIT $3 \
         ) \
         UPDATE tokens t SET status = 'expired', updated_at = now() \
           FROM stale WHERE t.id = stale.id",
    )
    .bind(tenant_id)
    .bind(today)
    .bind(MAX_ROWS_PER_TENANT)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok((queues, tokens))
}
