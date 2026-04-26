//! Cron job scheduler — polls `scheduled_jobs` and enqueues due jobs.
//!
//! Runs as a background tokio task. Every 60 seconds, it checks for
//! scheduled jobs whose `next_run_at` has passed and creates corresponding
//! entries in `job_queue` for the worker to pick up.

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Row fetched from `scheduled_jobs` for scheduling.
#[derive(Debug, sqlx::FromRow)]
struct ScheduledRow {
    id: Uuid,
    tenant_id: Uuid,
    pipeline_id: Uuid,
    name: String,
    cron_expression: String,
    input_data: Value,
}

/// Start the scheduler background task.
///
/// Polls every 60 seconds for due scheduled jobs and enqueues them.
pub fn start_scheduler(pool: PgPool) {
    tracing::info!("starting cron scheduler");

    tokio::spawn(async move {
        scheduler_loop(&pool).await;
    });
}

/// Main scheduler loop — runs until the process exits.
async fn scheduler_loop(pool: &PgPool) {
    loop {
        if let Err(e) = tick(pool).await {
            tracing::error!(error = %e, "scheduler tick error");
        }
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}

/// Single scheduler tick — find due jobs and enqueue them.
async fn tick(pool: &PgPool) -> Result<(), sqlx::Error> {
    let due_jobs = sqlx::query_as::<_, ScheduledRow>(
        "SELECT id, tenant_id, pipeline_id, name, cron_expression, input_data \
         FROM scheduled_jobs \
         WHERE next_run_at <= now() AND is_active = true \
         ORDER BY next_run_at \
         LIMIT 100",
    )
    .fetch_all(pool)
    .await?;

    if due_jobs.is_empty() {
        return Ok(());
    }

    tracing::debug!(count = due_jobs.len(), "processing due scheduled jobs");

    for job in &due_jobs {
        enqueue_scheduled_job(pool, job).await;
    }

    Ok(())
}

/// Enqueue a single scheduled job and update its schedule.
async fn enqueue_scheduled_job(pool: &PgPool, job: &ScheduledRow) {
    let job_payload = serde_json::json!({
        "scheduled_job_id": job.id.to_string(),
        "scheduled_job_name": job.name,
        "input_data": job.input_data,
    });

    // Insert into job queue
    let enqueue_result = sqlx::query(
        "INSERT INTO job_queue \
           (tenant_id, job_type, pipeline_id, payload, priority) \
         VALUES ($1, 'scheduled_pipeline', $2, $3, 3)",
    )
    .bind(job.tenant_id)
    .bind(job.pipeline_id)
    .bind(&job_payload)
    .execute(pool)
    .await;

    if let Err(e) = enqueue_result {
        tracing::error!(
            scheduled_job_id = %job.id,
            error = %e,
            "failed to enqueue scheduled job"
        );
        return;
    }

    // Calculate next_run_at from the cron expression
    let next_run = compute_next_run(&job.cron_expression);

    let update_result = sqlx::query(
        "UPDATE scheduled_jobs \
         SET last_run_at = now(), \
             last_status = 'enqueued', \
             next_run_at = $2 \
         WHERE id = $1",
    )
    .bind(job.id)
    .bind(next_run)
    .execute(pool)
    .await;

    if let Err(e) = update_result {
        tracing::error!(
            scheduled_job_id = %job.id,
            error = %e,
            "failed to update scheduled job after enqueue"
        );
    } else {
        tracing::info!(
            scheduled_job_id = %job.id,
            name = %job.name,
            next_run = ?next_run,
            "scheduled job enqueued"
        );
    }
}

/// Compute the next run time from a cron expression.
///
/// Uses a simple parser for standard 5-field cron syntax:
/// `minute hour day_of_month month day_of_week`
///
/// For complex expressions, falls back to "1 hour from now".
fn compute_next_run(cron_expr: &str) -> chrono::DateTime<chrono::Utc> {
    let now = chrono::Utc::now();
    let parts: Vec<&str> = cron_expr.split_whitespace().collect();

    if parts.len() < 5 {
        // Invalid expression — default to 1 hour
        return now + chrono::Duration::hours(1);
    }

    // Simple common patterns
    match (parts[0], parts[1], parts[2], parts[3], parts[4]) {
        // Every N minutes: */N * * * *
        (min, "*", "*", "*", "*") if min.starts_with("*/") => {
            let interval: i64 = min
                .strip_prefix("*/")
                .and_then(|s| s.parse().ok())
                .unwrap_or(60);
            now + chrono::Duration::minutes(interval)
        }
        // Every hour at minute M: M * * * *
        (min, "*", "*", "*", "*") => {
            let _minute: u32 = min.parse().unwrap_or(0);
            now + chrono::Duration::hours(1)
        }
        // Daily at H:M: M H * * *
        (_min, hour, "*", "*", "*") => {
            let _hour: u32 = hour.parse().unwrap_or(0);
            now + chrono::Duration::days(1)
        }
        // Weekly: M H * * DOW
        (_, _, "*", "*", _dow) => now + chrono::Duration::weeks(1),
        // Monthly: M H D * *
        (_, _, _day, "*", "*") => now + chrono::Duration::days(30),
        // Fallback
        _ => now + chrono::Duration::hours(1),
    }
}
