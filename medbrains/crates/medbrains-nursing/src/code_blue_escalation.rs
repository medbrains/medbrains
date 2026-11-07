//! A code blue nobody answers is paged again, wider.
//!
//! `code_blue_responses` records who said they were coming. Until now nothing
//! read it while the arrest was going on: a page that reached a phone in a
//! locker was the whole of the response. This pass looks for open codes with
//! no response row whose last page is older than the hospital's window
//! (`code_blue_response_secs`, default 60), and queues the next round of
//! `emergency.code_blue_alert`: the team again, plus the duty medical
//! officer, then the medical superintendent. It stops at the first response,
//! when the code is ended, or after `code_blue_max_rounds` rounds (default 5).
//!
//! Each round is claimed by a conditional bump of `page_round` and queued in
//! the same transaction, one transaction per code, so two passes (or two
//! servers) never queue the same round and one bad code never stops the rest.

use std::time::Duration;

use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_outbox::queue::{OutboxRow, queue_in_tx};
use medbrains_server_core::error::AppError;
use medbrains_workflow::orchestration::default_pipelines::CODE_BLUE_ALERT_EVENT;

/// Every fifteen seconds: the default window is sixty, so a slower pass would
/// make the re-page noticeably later than the window it enforces.
const PASS_INTERVAL_SECS: u64 = 15;
/// `tenant_settings` (`operations`) keys, and their defaults.
pub const RESPONSE_SECS_KEY: &str = "code_blue_response_secs";
pub const MAX_ROUNDS_KEY: &str = "code_blue_max_rounds";
pub const DEFAULT_RESPONSE_SECS: i32 = 60;
pub const DEFAULT_MAX_ROUNDS: i32 = 5;
/// The bounds a setting is clamped to: a re-page faster than fifteen seconds
/// is noise, slower than ten minutes is no escalation at all.
pub const RESPONSE_SECS_RANGE: (i32, i32) = (15, 600);
pub const MAX_ROUNDS_RANGE: (i32, i32) = (1, 10);
/// Codes escalated per pass, across every hospital.
const PASS_LIMIT: i64 = 200;

/// Run the pass forever on the worker pool.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_unanswered(&pool).await {
                Ok(n) if n > 0 => tracing::warn!(n, "code blues re-paged: nobody responded"),
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "code blue escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// A tenant setting as an integer, safely: anything but 1-6 digits (a typo,
/// a string, a negative) falls back to the default, then the value is
/// clamped. A bad setting must never break the pass for every hospital.
/// `$col` is a `tenant_settings` alias; the result is SQL text.
pub fn safe_int_sql(col: &str, default: &str, (lo, hi): (i32, i32)) -> String {
    format!(
        "LEAST(GREATEST(CASE WHEN ({col}.value #>> '{{}}') ~ '^[0-9]{{1,6}}$' \
                             THEN ({col}.value #>> '{{}}')::int ELSE {default} END, {lo}), {hi})"
    )
}

/// Queue the next round for every open, unanswered code past its window.
/// Returns how many codes were re-paged. Each code is claimed and queued in
/// its own transaction, so one failing code never holds up the others.
pub async fn escalate_unanswered(pool: &PgPool) -> Result<u64, AppError> {
    // Across every hospital (the worker pool bypasses row level security);
    // each hospital's own window and cap, safely read and clamped.
    let sql = format!(
        "SELECT e.id, e.tenant_id, e.page_round FROM code_blue_events e \
           LEFT JOIN tenant_settings rs ON rs.tenant_id = e.tenant_id \
                AND rs.category = 'operations' AND rs.key = $1 AND rs.deleted_at IS NULL \
           LEFT JOIN tenant_settings mr ON mr.tenant_id = e.tenant_id \
                AND mr.category = 'operations' AND mr.key = $2 AND mr.deleted_at IS NULL \
          WHERE e.ended_at IS NULL AND e.deleted_at IS NULL AND e.page_round > 0 \
            AND e.page_round < {rounds} \
            AND e.last_paged_at < now() - make_interval(secs => {secs}) \
            AND NOT EXISTS (SELECT 1 FROM code_blue_responses r \
                             WHERE r.tenant_id = e.tenant_id AND r.code_blue_id = e.id \
                               AND r.deleted_at IS NULL) \
          ORDER BY e.last_paged_at LIMIT $3",
        rounds = safe_int_sql("mr", "$5", MAX_ROUNDS_RANGE),
        secs = safe_int_sql("rs", "$4", RESPONSE_SECS_RANGE),
    );
    let due: Vec<(Uuid, Uuid, i16)> = sqlx::query_as(&sql)
        .bind(RESPONSE_SECS_KEY)
        .bind(MAX_ROUNDS_KEY)
        .bind(PASS_LIMIT)
        .bind(DEFAULT_RESPONSE_SECS)
        .bind(DEFAULT_MAX_ROUNDS)
        .fetch_all(pool)
        .await?;

    let mut queued = 0u64;
    for (code_blue_id, tenant_id, round) in due {
        match repage(pool, tenant_id, code_blue_id, round).await {
            Ok(true) => queued += 1,
            Ok(false) => {}
            Err(error) => tracing::error!(%code_blue_id, %error, "code blue re-page failed"),
        }
    }
    Ok(queued)
}

/// Claim round `round + 1` of one code and queue it, together. The claim is
/// conditional on the round not having moved and nobody having responded,
/// so two passes (or two servers) never queue the same round. Returns
/// whether it queued one.
async fn repage(
    pool: &PgPool,
    tenant_id: Uuid,
    code_blue_id: Uuid,
    round: i16,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let next: Option<i16> = sqlx::query_scalar(
        "UPDATE code_blue_events SET page_round = page_round + 1, last_paged_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND page_round = $3 AND ended_at IS NULL \
            AND NOT EXISTS (SELECT 1 FROM code_blue_responses r \
                             WHERE r.tenant_id = $2 AND r.code_blue_id = $1 \
                               AND r.deleted_at IS NULL) \
         RETURNING page_round",
    )
    .bind(code_blue_id)
    .bind(tenant_id)
    .bind(round)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(next) = next else {
        return Ok(false);
    };
    queue_in_tx(
        &mut tx,
        OutboxRow {
            tenant_id,
            aggregate_type: "code_blue",
            aggregate_id: Some(code_blue_id),
            event_type: CODE_BLUE_ALERT_EVENT,
            payload: json!({ "code_blue_id": code_blue_id, "round": next }),
            idempotency_key: Some(format!("code_blue:{code_blue_id}:round:{next}")),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("code blue re-page not queued: {e}")))?;
    tx.commit().await?;
    Ok(true)
}
