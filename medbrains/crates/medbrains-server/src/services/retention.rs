//! Data-retention enforcement (audit P1 #172).
//!
//! Daily pass with two very different obligations:
//!
//! 1. **Technical housekeeping (auto-purge)** — rows that exist only
//!    for mechanics and become pure liability after their window:
//!    revoked/expired refresh tokens, consumed OTPs, delivered outbox
//!    events. Windows are tenant-tunable via `retention.*` settings.
//!
//! 2. **Medical records (flag, never delete)** — MRD records past
//!    `destruction_due_date` are moved to `archived` for the MRD
//!    officer's destruction workflow. Statutory destruction needs a
//!    human signature and a destruction register; software deleting
//!    patient records on a timer is a compliance violation, not a
//!    feature.
//!
//! `MEDBRAINS_RETENTION_DRY_RUN=true` logs counts without touching
//! rows. Every batch that changes anything writes an audit entry.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 24 * 3600;
const DEFAULT_TOKEN_DAYS: i32 = 30;
const DEFAULT_OTP_DAYS: i32 = 7;
const DEFAULT_OUTBOX_DAYS: i32 = 90;
const DEFAULT_DLQ_DAYS: i32 = 90;
const DEFAULT_JOB_DAYS: i32 = 30;
const DEFAULT_CAMP_SYNC_DAYS: i32 = 60;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            if let Err(error) = run_retention_pass(&pool).await {
                tracing::error!(%error, "retention pass failed");
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

fn dry_run() -> bool {
    std::env::var("MEDBRAINS_RETENTION_DRY_RUN")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

async fn tenant_setting_days(
    pool: &PgPool,
    tenant_id: Uuid,
    key: &str,
    default: i32,
) -> Result<i32, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(pool, &tenant_id).await?;
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'retention' AND key = $2",
    )
    .bind(tenant_id)
    .bind(key)
    .fetch_optional(&mut *conn)
    .await?;
    Ok(value
        .and_then(|v| v.as_i64())
        .and_then(|v| i32::try_from(v).ok())
        .filter(|v| *v > 0)
        .unwrap_or(default))
}

async fn run_retention_pass(pool: &PgPool) -> Result<(), AppError> {
    // Partition maintenance — pre-create upcoming partitions and retire old ones
    // for every table registered in `partition_config`. Global (not tenant-scoped)
    // and best-effort: a failure here must not block the retention pass below.
    // See RFC-DATA-INFRASTRUCTURE.md.
    match sqlx::query("SELECT ensure_partitions()").execute(pool).await {
        Ok(_) => tracing::debug!("partition maintenance complete"),
        Err(error) => tracing::error!(%error, "partition maintenance failed"),
    }

    let tenants: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM tenants WHERE is_active = true")
        .fetch_all(pool)
        .await?;
    let dry = dry_run();

    for tenant_id in tenants {
        let token_days =
            tenant_setting_days(pool, tenant_id, "token_days", DEFAULT_TOKEN_DAYS).await?;
        let otp_days = tenant_setting_days(pool, tenant_id, "otp_days", DEFAULT_OTP_DAYS).await?;
        let outbox_days =
            tenant_setting_days(pool, tenant_id, "outbox_days", DEFAULT_OUTBOX_DAYS).await?;
        let dlq_days = tenant_setting_days(pool, tenant_id, "dlq_days", DEFAULT_DLQ_DAYS).await?;
        let job_days = tenant_setting_days(pool, tenant_id, "job_days", DEFAULT_JOB_DAYS).await?;
        let camp_sync_days =
            tenant_setting_days(pool, tenant_id, "camp_sync_days", DEFAULT_CAMP_SYNC_DAYS).await?;

        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

        let mut summary = serde_json::Map::new();

        // 1. Housekeeping purges — rows with no clinical meaning.
        let purges: Vec<(&str, String)> = vec![
            (
                "refresh_tokens",
                format!(
                    "DELETE FROM refresh_tokens WHERE tenant_id = $1 \
                     AND (revoked = true OR expires_at < now()) \
                     AND created_at < now() - make_interval(days => {token_days})"
                ),
            ),
            (
                "password_reset_otps",
                format!(
                    "DELETE FROM password_reset_otps WHERE tenant_id = $1 \
                     AND created_at < now() - make_interval(days => {otp_days})"
                ),
            ),
            (
                "public_booking_otps",
                format!(
                    "DELETE FROM public_booking_otps WHERE tenant_id = $1 \
                     AND created_at < now() - make_interval(days => {otp_days})"
                ),
            ),
            (
                "outbox_events",
                format!(
                    "DELETE FROM outbox_events WHERE tenant_id = $1 \
                     AND status = 'sent' \
                     AND created_at < now() - make_interval(days => {outbox_days})"
                ),
            ),
            // Dead-letter events: keep a review window, then drop.
            (
                "outbox_dlq",
                format!(
                    "DELETE FROM outbox_dlq WHERE tenant_id = $1 \
                     AND moved_at < now() - make_interval(days => {dlq_days})"
                ),
            ),
            // Integration job history in a terminal state. 'failed' is
            // transient (the worker resets it to 'pending' for retry),
            // so only 'completed'/'dead_letter' are purged.
            (
                "job_queue",
                format!(
                    "DELETE FROM job_queue WHERE tenant_id = $1 \
                     AND status IN ('completed', 'dead_letter') \
                     AND created_at < now() - make_interval(days => {job_days})"
                ),
            ),
            // Camp sync events that reached a settled state. 'received'
            // and 'failed' are still in-flight / need attention.
            (
                "camp_sync_events",
                format!(
                    "DELETE FROM camp_sync_events WHERE tenant_id = $1 \
                     AND status IN ('applied', 'duplicate') \
                     AND received_at < now() - make_interval(days => {camp_sync_days})"
                ),
            ),
        ];

        for (table, delete_sql) in purges {
            if dry {
                let count_sql = delete_sql.replacen("DELETE FROM", "SELECT COUNT(*) FROM", 1);
                let count: i64 = sqlx::query_scalar(&count_sql)
                    .bind(tenant_id)
                    .fetch_one(&mut *tx)
                    .await?;
                if count > 0 {
                    tracing::info!(%tenant_id, table, count, "retention dry-run: would purge");
                }
                continue;
            }
            let purged = sqlx::query(&delete_sql)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?
                .rows_affected();
            if purged > 0 {
                summary.insert(table.to_owned(), serde_json::json!(purged));
            }
        }

        // 2. MRD records past their destruction due date → archived for
        //    the MRD officer's destruction workflow. Never deleted here.
        if dry {
            let due: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM mrd_medical_records \
                 WHERE tenant_id = $1 AND status = 'active' \
                   AND destruction_due_date IS NOT NULL AND destruction_due_date < CURRENT_DATE",
            )
            .bind(tenant_id)
            .fetch_one(&mut *tx)
            .await?;
            if due > 0 {
                tracing::info!(%tenant_id, due, "retention dry-run: MRD records past destruction date");
            }
        } else {
            let flagged = sqlx::query(
                "UPDATE mrd_medical_records SET status = 'archived', updated_at = now() \
                 WHERE tenant_id = $1 AND status = 'active' \
                   AND destruction_due_date IS NOT NULL AND destruction_due_date < CURRENT_DATE",
            )
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();
            if flagged > 0 {
                summary.insert(
                    "mrd_records_archived".to_owned(),
                    serde_json::json!(flagged),
                );
            }
        }

        if !summary.is_empty() {
            let details = serde_json::Value::Object(summary);
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id,
                    user_id: None,
                    action: "retention_purge",
                    entity_type: "system",
                    entity_id: None,
                    old_values: None,
                    new_values: Some(&details),
                    ip_address: None,
                },
            )
            .await
            .map_err(AppError::from)?;
            tracing::info!(%tenant_id, ?details, "retention pass purged");
        }

        tx.commit().await?;
    }

    Ok(())
}
