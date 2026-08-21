//! Execution history.
//!
//! A run's payload can contain clinical data — it is whatever flowed through
//! the workflow — so history is retained rather than kept. Every write prunes
//! the workflow's older runs, which keeps the table bounded without a separate
//! job to forget about.

use crate::{Result, scope_to_tenant};
use medbrains_automation::prelude::RunResult;
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// A run, without its payload: enough for a list, cheap to fetch.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionSummary {
    pub id: Uuid,
    pub workflow_id: Uuid,
    pub workflow_name: String,
    pub status: String,
    pub mode: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
    pub duration_ms: i64,
    pub error: Option<String>,
}

const COLUMNS: &str = "id, workflow_id, workflow_name, status, mode, \
                       started_at, finished_at, duration_ms, error";

/// Recent runs, newest first.
///
/// Sweeps abandoned runs on the way past. A stale `running` row only misleads
/// somebody who is looking at the list, so the list is where it is worth
/// paying to fix — no background task, no leader to elect, and nothing to keep
/// running on a server that is otherwise idle.
pub async fn list(
    pool: &PgPool,
    tenant_id: Uuid,
    workflow_id: Option<Uuid>,
    limit: i64,
) -> Result<Vec<ExecutionSummary>> {
    match close_abandoned(pool, tenant_id).await {
        Ok(0) => {}
        Ok(closed) => tracing::warn!(
            closed,
            tenant = %tenant_id,
            "closed runs that were interrupted before they finished"
        ),
        // Worth continuing: showing the list with a stale row in it beats
        // refusing to show it at all.
        Err(error) => tracing::error!(%error, "could not close abandoned runs"),
    }

    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    // A caller-supplied limit is not trusted to be sensible.
    let limit = limit.clamp(1, 500);

    let sql = format!(
        "SELECT {COLUMNS} FROM public.automation_executions
          WHERE tenant_id = $1 AND ($2::uuid IS NULL OR workflow_id = $2)
          ORDER BY started_at DESC LIMIT $3"
    );
    let rows = sqlx::query(&sql)
        .bind(tenant_id)
        .bind(workflow_id)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;

    rows.iter().map(summary_from_row).collect()
}

/// One run, with the per-node detail the console and the canvas replay from.
pub async fn find(
    pool: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<(ExecutionSummary, serde_json::Value)>> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let sql = format!(
        "SELECT {COLUMNS}, data FROM public.automation_executions
          WHERE id = $1 AND tenant_id = $2"
    );
    let row = sqlx::query(&sql).bind(id).bind(tenant_id).fetch_optional(&mut *tx).await?;
    tx.commit().await?;

    row.map(|row| Ok((summary_from_row(&row)?, row.try_get("data")?))).transpose()
}

/// A run that is about to start.
#[derive(Debug, Clone, Copy)]
pub struct Opening<'a> {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workflow_id: Uuid,
    pub workflow_name: &'a str,
    pub mode: &'a str,
    pub started_at: chrono::DateTime<chrono::Utc>,
}

/// Write down that a run has begun, before it has.
///
/// Without this a run that never finishes leaves no row at all: the workflow
/// ran, may have written to the hospital, and the history shows nothing. An
/// operator asking "did the nightly sync go last night" gets silence, which
/// reads exactly like "it was never scheduled".
///
/// The row is opened `running` and closed by [`finish`]. One that stays
/// `running` is a run that was interrupted — see [`close_abandoned`].
pub async fn open(pool: &PgPool, opening: &Opening<'_>) -> Result<()> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &opening.tenant_id).await?;

    sqlx::query(
        "INSERT INTO public.automation_executions
             (id, tenant_id, workflow_id, workflow_name, status, mode, started_at)
         VALUES ($1, $2, $3, $4, 'running', $5, $6)",
    )
    .bind(opening.id)
    .bind(opening.tenant_id)
    .bind(opening.workflow_id)
    .bind(opening.workflow_name)
    .bind(opening.mode)
    .bind(opening.started_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// How long a run may be in flight before it is presumed interrupted.
///
/// Well beyond any real run. A workflow still going after this has either been
/// abandoned by a process that died, or is doing something that should not be
/// a workflow. Being generous is the safe direction: closing a run that is
/// still going would report a healthy execution as dead while it carried on
/// writing.
pub const ABANDONED_AFTER_HOURS: i64 = 6;

/// What an interrupted run is told it died of.
///
/// Deliberately specific: "failed" would send somebody looking for a bug in
/// the workflow, when what happened is that the process stopped underneath it.
pub const INTERRUPTED_REASON: &str =
    "interrupted — the server stopped while this run was in progress, so it did not finish";

/// Close out runs that have been in flight too long to still be running.
pub async fn close_abandoned(pool: &PgPool, tenant_id: Uuid) -> Result<u64> {
    let cutoff = chrono::Utc::now() - chrono::Duration::hours(ABANDONED_AFTER_HOURS);

    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let closed = sqlx::query(
        "UPDATE public.automation_executions
            SET status = 'error', finished_at = now(), error = $3
          WHERE tenant_id = $1 AND status = 'running' AND started_at < $2",
    )
    .bind(tenant_id)
    .bind(cutoff)
    .bind(INTERRUPTED_REASON)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(closed)
}

/// A run that has finished, and what to keep of its workflow's history.
///
/// A struct rather than nine positional arguments, four of them interchangeable
/// at the type level. Passing `workflow_name` where `mode` belongs would
/// compile and would write nonsense into a table somebody reads during an
/// incident.
#[derive(Debug, Clone, Copy)]
pub struct Finished<'a> {
    /// Decided before the run starts, not by the database afterwards.
    ///
    /// A run has to be able to name itself while it is happening: a file it
    /// downloads is stored against this id, and a file stored against an id
    /// that does not exist yet has nothing to be cleaned up with.
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub workflow_id: Uuid,
    pub workflow_name: &'a str,
    pub mode: &'a str,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub duration_ms: i64,
    pub result: &'a RunResult,
    /// How many of this workflow's runs to keep.
    pub keep: i64,
}

/// Record a finished run and forget the ones beyond the retention limit.
///
/// Both happen in one transaction: a run that was recorded but not pruned
/// would leave the table growing on exactly the workflows that run most.
pub async fn record(pool: &PgPool, finished: &Finished<'_>) -> Result<Uuid> {
    let Finished {
        id,
        tenant_id,
        workflow_id,
        workflow_name,
        mode,
        started_at,
        duration_ms,
        result,
        keep,
    } = *finished;

    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    // Closes the row `open` wrote, or writes one if there was none — a run
    // recorded without having been opened is still worth keeping.
    sqlx::query(
        "INSERT INTO public.automation_executions
             (id, tenant_id, workflow_id, workflow_name, status, mode,
              started_at, finished_at, duration_ms, error, data)
         VALUES ($10, $1, $2, $3, $4, $5, $6, now(), $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
             status = $4, finished_at = now(), duration_ms = $7,
             error = $8, data = $9",
    )
    .bind(tenant_id)
    .bind(workflow_id)
    .bind(workflow_name)
    .bind(result.status.as_str())
    .bind(mode)
    .bind(started_at)
    .bind(duration_ms)
    .bind(result.error.as_deref())
    .bind(serde_json::to_value(result).unwrap_or_default())
    .bind(id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "DELETE FROM public.automation_executions
          WHERE tenant_id = $1 AND workflow_id = $2
            AND id NOT IN (
                SELECT id FROM public.automation_executions
                 WHERE tenant_id = $1 AND workflow_id = $2
                 ORDER BY started_at DESC LIMIT $3
            )",
    )
    .bind(tenant_id)
    .bind(workflow_id)
    .bind(keep.clamp(1, 10_000))
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(id)
}

pub async fn delete(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<u64> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let affected =
        sqlx::query("DELETE FROM public.automation_executions WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

    tx.commit().await?;
    Ok(affected)
}

fn summary_from_row(row: &sqlx::postgres::PgRow) -> Result<ExecutionSummary> {
    Ok(ExecutionSummary {
        id: row.try_get("id")?,
        workflow_id: row.try_get("workflow_id")?,
        workflow_name: row.try_get("workflow_name")?,
        status: row.try_get("status")?,
        mode: row.try_get("mode")?,
        started_at: row.try_get("started_at")?,
        finished_at: row.try_get("finished_at")?,
        duration_ms: row.try_get("duration_ms")?,
        error: row.try_get("error")?,
    })
}
