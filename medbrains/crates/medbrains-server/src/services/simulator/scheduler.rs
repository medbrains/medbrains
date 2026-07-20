//! Background cron scheduler for the simulator.
//!
//! On startup we spawn a single tokio task that ticks every 30 seconds:
//!   1. Selects all enabled, non-deleted schedules with a non-empty
//!      `cron_expr`.
//!   2. Parses the cron expression and computes the next fire time.
//!   3. If `next_run_at` is null OR ≤ now, fires the engine and updates
//!      `last_run_at` + the new `next_run_at`.
//!
//! Each fire inserts the `simulator_runs` row, then runs the engine
//! (scripted, or the LLM agent engine when `profile.agent.enabled`),
//! persists steps + findings, and finalizes the run. Failures are recorded
//! on the run row, not propagated, so one bad schedule cannot block the
//! rest. This is what makes agent runs autonomous — no human clicks "run".

use std::str::FromStr;
use std::time::Duration;

use chrono::{DateTime, Utc};
use cron::Schedule;
use medbrains_core::simulator::{ApprovalMode, Profile, RunSummary, SimulatorSchedule};
use medbrains_server_core::state::AppState;
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth::Claims;

use super::agent::FindingRecord;
use super::{
    StepRecord, agent, finalize_run, finalize_run_with_approval, insert_run, pacer, persist_steps,
    run,
};

const TICK_INTERVAL: Duration = Duration::from_secs(30);
/// We use a synthetic Claims for cron-fired runs. The tenant_id /
/// triggered_by come from the schedule row; the agent engine authenticates
/// as real demo users itself, and the scripted engine reads only tenant +
/// sub + role off `claims`. Nothing on the cron path reads `permissions`.
const SYSTEM_ROLE: &str = "system";

pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(TICK_INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            ticker.tick().await;
            if let Err(err) = tick_once(&state).await {
                tracing::warn!(error = %err, "simulator scheduler tick failed");
            }
        }
    });
    tracing::info!("simulator scheduler spawned (30s tick)");
}

async fn tick_once(state: &AppState) -> Result<(), sqlx::Error> {
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
    .fetch_all(&state.db)
    .await?;

    for schedule in due {
        if let Err(err) = handle_schedule(state, schedule).await {
            tracing::warn!(error = %err, "simulator scheduler: schedule fire failed");
        }
    }

    // Autonomous census-paced agent schedules (no cron — the pacer decides how
    // much to run each tick from the hospital's current census + day curve).
    let auto: Vec<SimulatorSchedule> = sqlx::query_as(
        "SELECT * FROM simulator_schedules \
         WHERE deleted_at IS NULL AND enabled = true AND cron_expr IS NULL",
    )
    .fetch_all(&state.db)
    .await?;

    for schedule in auto {
        if let Err(err) = pace_schedule(state, schedule).await {
            tracing::warn!(error = %err, "simulator scheduler: pace failed");
        }
    }
    Ok(())
}

/// Census-paced fire: run only as many agent episodes as the hospital's
/// current volume warrants this tick. Skips non-agent / non-auto schedules.
async fn pace_schedule(state: &AppState, schedule: SimulatorSchedule) -> Result<(), sqlx::Error> {
    let profile: Profile = match serde_json::from_value(schedule.profile.clone()) {
        Ok(p) => p,
        Err(_) => return Ok(()),
    };
    if !profile.agent.enabled || !profile.agent.auto_census {
        return Ok(());
    }
    let episodes = pacer::episodes_for_tick(state, &schedule.tenant_id, &profile.agent).await;
    if episodes == 0 {
        return Ok(());
    }
    let claims = system_claims(&schedule);
    let run_id = match insert_run(
        &state.db,
        schedule.tenant_id,
        Some(schedule.id),
        claims.sub,
        "cron",
    )
    .await
    {
        Ok(id) => id,
        Err(err) => {
            tracing::warn!(error = ?err, "simulator scheduler: pace insert_run failed");
            return Ok(());
        }
    };
    let outcome = agent::run_agent_sampled(state, &claims, &profile.agent, episodes).await;
    persist_agent_run(state, &schedule, run_id, profile.approval_mode, outcome).await;
    Ok(())
}

async fn handle_schedule(state: &AppState, schedule: SimulatorSchedule) -> Result<(), sqlx::Error> {
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
            disable_schedule(&state.db, schedule.id, "invalid cron")
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
        fire(state, &schedule).await;
    }

    // Always advance next_run_at to the next future occurrence.
    if let Some(next) = next_after_now {
        sqlx::query("UPDATE simulator_schedules SET next_run_at = $1 WHERE id = $2")
            .bind(next)
            .bind(schedule.id)
            .execute(&state.db)
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

async fn fire(state: &AppState, schedule: &SimulatorSchedule) {
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

    let claims = system_claims(schedule);

    let run_id = match insert_run(
        &state.db,
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

    if profile.agent.enabled {
        fire_agent(state, schedule, &claims, run_id, &profile).await;
    } else {
        fire_scripted(state, schedule, &claims, run_id, &profile).await;
    }
}

/// Fire the LLM agent engine (autonomous — no human trigger).
async fn fire_agent(
    state: &AppState,
    schedule: &SimulatorSchedule,
    claims: &Claims,
    run_id: Uuid,
    profile: &Profile,
) {
    let outcome = agent::run_agent(state, claims, &profile.agent).await;
    persist_agent_run(state, schedule, run_id, profile.approval_mode, outcome).await;
}

/// Shared persistence for an agent run (cron cross-product or census-paced).
async fn persist_agent_run(
    state: &AppState,
    schedule: &SimulatorSchedule,
    run_id: Uuid,
    approval_mode: ApprovalMode,
    outcome: (RunSummary, Vec<StepRecord>, Vec<FindingRecord>),
) {
    let (summary, steps, findings) = outcome;
    let _ = persist_steps(&state.db, schedule.tenant_id, run_id, &steps).await;
    let _ = agent::persist_findings(&state.db, schedule.tenant_id, run_id, &findings).await;
    let approval = match approval_mode {
        ApprovalMode::Auto => "auto_committed",
        ApprovalMode::Manual => "pending_approval",
    };
    let _ = finalize_run_with_approval(
        &state.db,
        schedule.tenant_id,
        run_id,
        "succeeded",
        &summary,
        None,
        approval,
    )
    .await;
    let _ = sqlx::query("UPDATE simulator_schedules SET last_run_at = NOW() WHERE id = $1")
        .bind(schedule.id)
        .execute(&state.db)
        .await;
}

fn system_claims(schedule: &SimulatorSchedule) -> Claims {
    Claims {
        sub: schedule.created_by.unwrap_or_else(Uuid::nil),
        tenant_id: schedule.tenant_id,
        role: SYSTEM_ROLE.to_owned(),
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version: 0,
        exp: 0,
    }
}

/// Fire the classic scripted engine (direct in-tx row inserts).
async fn fire_scripted(
    state: &AppState,
    schedule: &SimulatorSchedule,
    claims: &Claims,
    run_id: Uuid,
    profile: &Profile,
) {
    match run(&state.db, claims, profile).await {
        Ok(result) => {
            if let Err(err) =
                persist_steps(&state.db, schedule.tenant_id, run_id, &result.steps).await
            {
                tracing::warn!(run_id = %run_id, error = ?err, "simulator scheduler: persist_steps failed");
            }
            if let Err(err) = finalize_run(
                &state.db,
                schedule.tenant_id,
                run_id,
                "succeeded",
                &result.summary,
                None,
            )
            .await
            {
                tracing::warn!(run_id = %run_id, error = ?err, "simulator scheduler: finalize succeeded failed");
            }
            let _ = sqlx::query("UPDATE simulator_schedules SET last_run_at = NOW() WHERE id = $1")
                .bind(schedule.id)
                .execute(&state.db)
                .await;
        }
        Err(err) => {
            let summary = RunSummary::default();
            let _ = finalize_run(
                &state.db,
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
