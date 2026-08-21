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

pub async fn list(
    pool: &PgPool,
    tenant_id: Uuid,
    workflow_id: Option<Uuid>,
    limit: i64,
) -> Result<Vec<ExecutionSummary>> {
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

    sqlx::query(
        "INSERT INTO public.automation_executions
             (id, tenant_id, workflow_id, workflow_name, status, mode,
              started_at, finished_at, duration_ms, error, data)
         VALUES ($10, $1, $2, $3, $4, $5, $6, now(), $7, $8, $9)",
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
