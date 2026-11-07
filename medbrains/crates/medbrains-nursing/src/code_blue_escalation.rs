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
//! The round is claimed by bumping `page_round` in the same statement that
//! picks the code, so two passes, or two servers, never queue the same round.

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

/// Queue the next round for every open, unanswered code past its window.
/// Returns how many codes were re-paged.
pub async fn escalate_unanswered(pool: &PgPool) -> Result<u64, AppError> {
    // Claim and select in one statement, across every hospital (the worker
    // pool bypasses row level security); each hospital's own window and cap.
    // The claim and the queued rounds commit together: a round is never
    // counted without its page.
    let mut tx = pool.begin().await?;
    let due: Vec<(Uuid, Uuid, i16)> = sqlx::query_as(
        "WITH due AS ( \
           SELECT e.id FROM code_blue_events e \
             LEFT JOIN tenant_settings rs ON rs.tenant_id = e.tenant_id \
                  AND rs.category = 'operations' AND rs.key = $1 AND rs.deleted_at IS NULL \
             LEFT JOIN tenant_settings mr ON mr.tenant_id = e.tenant_id \
                  AND mr.category = 'operations' AND mr.key = $2 AND mr.deleted_at IS NULL \
            WHERE e.ended_at IS NULL AND e.deleted_at IS NULL AND e.page_round > 0 \
              AND e.page_round < COALESCE((mr.value #>> '{}')::int, $4) \
              AND e.last_paged_at < now() - make_interval( \
                    secs => COALESCE((rs.value #>> '{}')::int, $3)) \
              AND NOT EXISTS (SELECT 1 FROM code_blue_responses r \
                               WHERE r.tenant_id = e.tenant_id AND r.code_blue_id = e.id \
                                 AND r.deleted_at IS NULL) \
            ORDER BY e.last_paged_at LIMIT $5 \
            FOR UPDATE OF e SKIP LOCKED \
         ) \
         UPDATE code_blue_events e SET page_round = e.page_round + 1, last_paged_at = now() \
           FROM due WHERE e.id = due.id \
         RETURNING e.id, e.tenant_id, e.page_round",
    )
    .bind(RESPONSE_SECS_KEY)
    .bind(MAX_ROUNDS_KEY)
    .bind(DEFAULT_RESPONSE_SECS)
    .bind(DEFAULT_MAX_ROUNDS)
    .bind(PASS_LIMIT)
    .fetch_all(&mut *tx)
    .await?;

    let mut queued = 0u64;
    for (code_blue_id, tenant_id, round) in due {
        medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
        queue_in_tx(
            &mut tx,
            OutboxRow {
                tenant_id,
                aggregate_type: "code_blue",
                aggregate_id: Some(code_blue_id),
                event_type: CODE_BLUE_ALERT_EVENT,
                payload: json!({ "code_blue_id": code_blue_id, "round": round }),
                idempotency_key: Some(format!("code_blue:{code_blue_id}:round:{round}")),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("code blue re-page not queued: {e}")))?;
        queued += 1;
    }
    tx.commit().await?;
    Ok(queued)
}
