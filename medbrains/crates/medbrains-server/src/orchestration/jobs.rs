//! Background job queue worker.
//!
//! Spawns a tokio task that polls `job_queue` for pending jobs,
//! executes them with retry logic, and updates their status.

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Row fetched from the job queue for processing.
#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct JobRow {
    id: Uuid,
    tenant_id: Uuid,
    job_type: String,
    pipeline_id: Option<Uuid>,
    connector_id: Option<Uuid>,
    payload: Value,
    max_retries: i32,
    retry_count: i32,
}

/// Start the background job worker.
///
/// Spawns a long-lived tokio task that continuously polls the `job_queue`
/// table for pending jobs, claims them with row-level locking, executes
/// them, and records results.
pub fn start_job_worker(pool: PgPool) {
    let worker_id = format!("worker-{}", Uuid::new_v4());
    tracing::info!(worker_id = %worker_id, "starting job queue worker");

    tokio::spawn(async move {
        job_worker_loop(&pool, &worker_id).await;
    });
}

/// Main worker loop — runs until the process exits.
async fn job_worker_loop(pool: &PgPool, worker_id: &str) {
    loop {
        // Also pick up retryable failed jobs whose retry time has passed
        promote_retryable_jobs(pool).await;

        match claim_next_job(pool, worker_id).await {
            Ok(Some(job)) => {
                let job_id = job.id;
                tracing::debug!(job_id = %job_id, job_type = %job.job_type, "processing job");

                let result = execute_job(pool, &job).await;

                match result {
                    Ok(output) => {
                        complete_job(pool, job_id, &output).await;
                    }
                    Err(e) => {
                        let err_msg = format!("{e}");
                        fail_job(pool, job_id, &err_msg, job.retry_count, job.max_retries).await;
                    }
                }
            }
            Ok(None) => {
                // No pending jobs — sleep briefly before polling again
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
            Err(e) => {
                tracing::error!(error = %e, "job queue poll error");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    }
}

/// Claim the next pending job using `FOR UPDATE SKIP LOCKED`.
async fn claim_next_job(pool: &PgPool, worker_id: &str) -> Result<Option<JobRow>, sqlx::Error> {
    // Single atomic claim: select + update in one step
    let row = sqlx::query_as::<_, JobRow>(
        "WITH next_job AS ( \
             SELECT id, tenant_id, job_type, pipeline_id, connector_id, \
                    payload, max_retries, retry_count \
             FROM job_queue \
             WHERE status = 'pending' \
             ORDER BY priority, created_at \
             FOR UPDATE SKIP LOCKED \
             LIMIT 1 \
         ) \
         UPDATE job_queue SET \
             status = 'running', \
             locked_by = $1, \
             locked_at = now(), \
             started_at = now() \
         FROM next_job \
         WHERE job_queue.id = next_job.id \
         RETURNING job_queue.id, job_queue.tenant_id, job_queue.job_type, \
                   job_queue.pipeline_id, job_queue.connector_id, \
                   job_queue.payload, job_queue.max_retries, job_queue.retry_count",
    )
    .bind(worker_id)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

/// Execute a job based on its type.
async fn execute_job(pool: &PgPool, job: &JobRow) -> Result<Value, String> {
    match job.job_type.as_str() {
        "pipeline_event" => execute_pipeline_event(pool, job).await,
        "connector_call" => execute_connector_call(pool, job).await,
        "notification" => execute_notification_job(job),
        other => Err(format!("unknown job type: {other}")),
    }
}

/// Execute an after-event pipeline job.
///
/// Reads the event_code from payload, finds matching pipelines,
/// and runs them through the existing event emission system.
async fn execute_pipeline_event(pool: &PgPool, job: &JobRow) -> Result<Value, String> {
    let event_code = job
        .payload
        .get("event_code")
        .and_then(Value::as_str)
        .ok_or("missing event_code in job payload")?;
    let user_id: Uuid = job
        .payload
        .get("user_id")
        .and_then(Value::as_str)
        .and_then(|s| s.parse().ok())
        .ok_or("missing or invalid user_id in job payload")?;
    let payload = job.payload.get("payload").cloned().unwrap_or(Value::Null);

    // Use the existing emit_event function from events module
    crate::events::emit_event(pool, job.tenant_id, user_id, event_code, payload)
        .await
        .map_err(|e| format!("pipeline execution error: {e}"))?;

    Ok(serde_json::json!({
        "status": "completed",
        "event_code": event_code,
    }))
}

/// Execute a connector action job.
async fn execute_connector_call(pool: &PgPool, job: &JobRow) -> Result<Value, String> {
    let connector_id = job
        .connector_id
        .ok_or("missing connector_id for connector_call job")?;
    let action = job
        .payload
        .get("action")
        .and_then(Value::as_str)
        .ok_or("missing action in job payload")?;
    let input = job.payload.get("input").cloned().unwrap_or(Value::Null);

    super::connectors::execute_connector_action(pool, connector_id, action, &input)
        .await
        .map_err(|e| format!("connector call error: {e}"))
}

/// Execute a notification job (stub — records intent).
fn execute_notification_job(job: &JobRow) -> Result<Value, String> {
    let channel = job
        .payload
        .get("channel")
        .and_then(Value::as_str)
        .unwrap_or("in_app");

    Ok(serde_json::json!({
        "status": "notification_sent",
        "channel": channel,
        "job_id": job.id.to_string(),
    }))
}

/// Mark a job as completed.
async fn complete_job(pool: &PgPool, job_id: Uuid, output: &Value) {
    let result = sqlx::query(
        "UPDATE job_queue \
         SET status = 'completed', \
             completed_at = now(), \
             payload = jsonb_set(payload, '{result}', $2) \
         WHERE id = $1",
    )
    .bind(job_id)
    .bind(output)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::error!(job_id = %job_id, error = %e, "failed to mark job completed");
    }
}

/// Mark a job as failed, with retry or dead-letter logic.
async fn fail_job(pool: &PgPool, job_id: Uuid, error: &str, current_retry: i32, max_retries: i32) {
    let next_retry = current_retry + 1;
    let (status, next_retry_at) = if next_retry >= max_retries {
        ("dead_letter", None)
    } else {
        // Exponential backoff: 1s, 2s, 4s, 8s, ...
        let backoff_secs = 1_i64 << next_retry.min(10);
        let retry_at = chrono::Utc::now() + chrono::Duration::seconds(backoff_secs);
        ("failed", Some(retry_at))
    };

    let result = sqlx::query(
        "UPDATE job_queue \
         SET status = $2, \
             error = $3, \
             retry_count = $4, \
             next_retry_at = $5, \
             locked_by = NULL, \
             locked_at = NULL \
         WHERE id = $1",
    )
    .bind(job_id)
    .bind(status)
    .bind(error)
    .bind(next_retry)
    .bind(next_retry_at)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::error!(job_id = %job_id, error = %e, "failed to record job failure");
    } else if status == "dead_letter" {
        tracing::warn!(
            job_id = %job_id,
            retries = next_retry,
            "job moved to dead letter queue"
        );
    }
}

/// Promote retryable failed jobs back to pending when their retry time arrives.
async fn promote_retryable_jobs(pool: &PgPool) {
    let result = sqlx::query(
        "UPDATE job_queue \
         SET status = 'pending', locked_by = NULL, locked_at = NULL \
         WHERE status = 'failed' \
           AND retry_count < max_retries \
           AND next_retry_at <= now()",
    )
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::error!(error = %e, "failed to promote retryable jobs");
    }
}
