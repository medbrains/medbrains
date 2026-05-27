//! Background cron scheduler for the simulator.
//!
//! On startup we spawn a single tokio task that ticks every 30 seconds:
//!   1. Selects all enabled, non-deleted schedules with a non-empty
//!      `cron_expr`.
//!   2. Parses the cron expression and computes the next fire time.
//!   3. If `next_run_at` is null OR ≤ now, fires the engine and updates
//!      `last_run_at` + the new `next_run_at`.
//!
//! Each fire opens its own transaction and inserts the `simulator_runs`
//! row, then runs the engine, persists steps, and finalizes the run.
//! Failures are recorded on the run row, not propagated, so one bad
//! schedule cannot block the rest.

use std::str::FromStr;
use std::time::Duration;

use chrono::{DateTime, Utc};
use cron::Schedule;
use medbrains_core::simulator::{Profile, SimulatorSchedule};
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth::Claims;

use super::{finalize_run, insert_run, persist_steps, run};

const TICK_INTERVAL: Duration = Duration::from_secs(30);
/// We use a synthetic Claims for cron-fired runs. The tenant_id /
/// triggered_by come from the schedule row; permissions are bypassed by
/// `is_bypass_role` because `role = "system"` isn't in BYPASS_ROLES but
/// the engine takes a `Claims` only for tenant + sub + role — and the
/// engine's `is_dummy` gating already happened (the route layer is the
/// gate). The scheduler is server-side; nothing the engine reads off
/// `claims.permissions` is on the cron path.
const SYSTEM_ROLE: &str = "system";

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(TICK_INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            ticker.tick().await;
            if let Err(err) = tick_once(&pool).await {
                tracing::warn!(error = %err, "simulator scheduler tick failed");
            }
        }
    });
    tracing::info!("simulator scheduler spawned (30s tick)");
}

async fn tick_once(pool: &PgPool) -> Result<(), sqlx::Error> {
    let now: DateTime<Utc> = Utc::now();

    let due: Vec<SimulatorSchedule> = sqlx::query_as(
        "SELECT * FROM simulator_schedules \
         WHERE deleted_at IS NULL \
           AND enabled = true \
           AND cron_expr IS NOT NULL \
           AND cron_expr <> '' \
           AND (next_run_at IS NULL OR next_run_at <= $1)",
    )
    .bind(now)
    .fetch_all(pool)
    .await?;

    for schedule in due {
        if let Err(err) = handle_schedule(pool, schedule).await {
            tracing::warn!(error = %err, "simulator scheduler: schedule fire failed");
        }
    }
    Ok(())
}

async fn handle_schedule(pool: &PgPool, schedule: SimulatorSchedule) -> Result<(), sqlx::Error> {
    let cron_expr = match schedule.cron_expr.as_deref() {
        Some(expr) if !expr.trim().is_empty() => expr.trim().to_owned(),
        _ => return Ok(()),
    };

    // Parse the cron expression. Skip silently on parse error so a bad
    // schedule doesn't crash the scheduler; surface via tracing.
    let parsed = match Schedule::from_str(&cron_expr) {
        Ok(s) => s,
        Err(err) => {
            tracing::warn!(
                schedule_id = %schedule.id,
                cron_expr = %cron_expr,
                error = %err,
                "simulator scheduler: invalid cron expression"
            );
            // Disable the schedule so we don't keep retrying.
            disable_schedule(pool, schedule.id, "invalid cron")
                .await
                .ok();
            return Ok(());
        }
    };

    let now: DateTime<Utc> = Utc::now();
    let next_after_now = parsed.after(&now).next();

    // Decide whether to fire NOW.
    let should_fire = match schedule.next_run_at {
        Some(due) => due <= now,
        None => true,
    };

    if should_fire {
        fire(pool, &schedule).await;
    }

    // Always advance next_run_at to the next future occurrence.
    if let Some(next) = next_after_now {
        sqlx::query("UPDATE simulator_schedules SET next_run_at = $1 WHERE id = $2")
            .bind(next)
            .bind(schedule.id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

async fn disable_schedule(pool: &PgPool, id: Uuid, reason: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE simulator_schedules SET enabled = false, description = COALESCE(description, '') || $1 WHERE id = $2",
    )
    .bind(format!("\n[scheduler auto-disabled: {reason}]"))
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

async fn fire(pool: &PgPool, schedule: &SimulatorSchedule) {
    let profile: Profile = match serde_json::from_value(schedule.profile.clone()) {
        Ok(p) => p,
        Err(err) => {
            tracing::warn!(
                schedule_id = %schedule.id,
                error = %err,
                "simulator scheduler: invalid profile JSON, skipping fire"
            );
            return;
        }
    };

    let claims = Claims {
        sub: schedule.created_by.unwrap_or_else(Uuid::nil),
        tenant_id: schedule.tenant_id,
        role: SYSTEM_ROLE.to_owned(),
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version: 0,
        exp: 0,
    };

    let run_id = match insert_run(
        pool,
        schedule.tenant_id,
        Some(schedule.id),
        claims.sub,
        "cron",
    )
    .await
    {
        Ok(id) => id,
        Err(err) => {
            tracing::warn!(
                schedule_id = %schedule.id,
                error = ?err,
                "simulator scheduler: failed to insert run row"
            );
            return;
        }
    };

    match run(pool, &claims, &profile).await {
        Ok(result) => {
            if let Err(err) = persist_steps(pool, schedule.tenant_id, run_id, &result.steps).await {
                tracing::warn!(
                    run_id = %run_id,
                    error = ?err,
                    "simulator scheduler: persist_steps failed"
                );
            }
            if let Err(err) = finalize_run(
                pool,
                schedule.tenant_id,
                run_id,
                "succeeded",
                &result.summary,
                None,
            )
            .await
            {
                tracing::warn!(
                    run_id = %run_id,
                    error = ?err,
                    "simulator scheduler: finalize succeeded failed"
                );
            }
            let _ = sqlx::query("UPDATE simulator_schedules SET last_run_at = NOW() WHERE id = $1")
                .bind(schedule.id)
                .execute(pool)
                .await;
        }
        Err(err) => {
            let summary = medbrains_core::simulator::RunSummary::default();
            let _ = finalize_run(
                pool,
                schedule.tenant_id,
                run_id,
                "failed",
                &summary,
                Some(&err.to_string()),
            )
            .await;
            tracing::warn!(
                schedule_id = %schedule.id,
                run_id = %run_id,
                error = ?err,
                "simulator scheduler: engine run failed"
            );
        }
    }
}
