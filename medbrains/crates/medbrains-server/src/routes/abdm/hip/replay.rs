//! A gateway callback delivered twice changes nothing the second time.
//!
//! The gateway redelivers a callback it thinks we missed (~16 minutes later,
//! OHC care-abdm, MIT, docs/findings.md E10) with the same `REQUEST-ID`, and
//! ABDM's callback-authenticity rules say a request id is handled once.
//! For a callback that acts — link-init sends an OTP by SMS, link-confirm
//! links records — the `REQUEST-ID` is recorded with the answer we sent, in
//! the same transaction as the act. A repeat finds it and gets the same
//! answer again: no second OTP, no second SMS, no OTP attempt counted.
//! Two deliveries racing each other meet at the primary key; the loser's
//! transaction is rolled back.

use serde_json::Value;

use super::gateway::Caller;
use crate::error::AppError;

/// Long enough for every redelivery the gateway makes; old rows are deleted
/// as new ones are written, so the table stays small.
const KEEP_HOURS: i32 = 24;

/// The answer already sent for this callback's `REQUEST-ID`, when it was
/// handled before. A callback without a `REQUEST-ID` is never a repeat.
///
/// # Errors
/// A database fault.
pub(super) async fn answered(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    caller: &Caller,
) -> Result<Option<Value>, AppError> {
    if caller.request_id.is_empty() {
        return Ok(None);
    }
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    Ok(sqlx::query_scalar!(
        "SELECT answer FROM abdm_callback_replays WHERE tenant_id = $1 AND request_id = $2",
        caller.tenant_id,
        caller.request_id,
    )
    .fetch_optional(&mut **tx)
    .await?)
}

/// Record that this callback was handled with `answer`, inside the
/// transaction that does the handling. Returns `false` when another delivery
/// of the same `REQUEST-ID` got there first: roll back and send nothing.
///
/// # Errors
/// A database fault.
pub(super) async fn claim(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    caller: &Caller,
    path: &str,
    answer: &Value,
) -> Result<bool, AppError> {
    if caller.request_id.is_empty() {
        return Ok(true);
    }
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query!(
        "DELETE FROM abdm_callback_replays \
          WHERE tenant_id = $1 AND received_at < now() - make_interval(hours => $2)",
        caller.tenant_id,
        KEEP_HOURS,
    )
    .execute(&mut **tx)
    .await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let inserted = sqlx::query!(
        "INSERT INTO abdm_callback_replays (tenant_id, request_id, path, answer) \
         VALUES ($1, $2, $3, $4) ON CONFLICT (tenant_id, request_id) DO NOTHING",
        caller.tenant_id,
        caller.request_id,
        path,
        answer,
    )
    .execute(&mut **tx)
    .await?;
    Ok(inserted.rows_affected() == 1)
}
