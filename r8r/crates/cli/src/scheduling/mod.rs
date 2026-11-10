//! Fires schedule triggers. Mirrors `active-workflow-manager.ts` plus
//! `packages/cli/src/scheduling`.
//!
//! One task wakes every second, asks the database which workflows are active
//! and fires any cron whose moment has arrived. Reading state from the database
//! each tick means activating a workflow in the editor takes effect within a
//! second, with no cache to invalidate.
//!
//! Only one worker does this at a time. When each cron is next due is held in
//! memory, so two workers scheduling at once would each keep their own copy
//! and fire every scheduled workflow twice — which for a nightly patient sync
//! means importing the same records twice, not merely doing the work twice.
//! Whoever holds the scheduler lease fires; everyone else waits, ready to take
//! over if the leader stops.

use crate::databases::{StoredWorkflow, WaitingRun};
use crate::server::AppState;
use chrono::{DateTime, Utc};
use croner::Cron;
use r8r_workflow::interfaces::{ExecutionMode, Node};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::time::Duration;

const TICK: Duration = Duration::from_secs(1);

/// Identifies one cron trigger: workflow, node, and the expression itself so
/// that editing the cron reschedules rather than inheriting the old due time.
type TriggerKey = (String, String, String);

/// When each known trigger is next due.
type Schedule = HashMap<TriggerKey, DateTime<Utc>>;

/// Never returns: this is the process-lifetime scheduler loop. Power of 10
/// rule 2 asks for bounded loops; a service's main loop is the documented
/// exception, and every iteration inside it is bounded by the workflow count.
pub async fn run(state: AppState) {
    let mut due: Schedule = Schedule::new();
    let mut leading = false;

    loop {
        tokio::time::sleep(TICK).await;

        if !take_the_lead(&state, &mut leading) {
            // Taking over later means starting from a clean slate: a due time
            // worked out while another worker was leading says nothing about
            // what has already fired.
            due.clear();
            continue;
        }

        let workflows = match state.db.workflows().active() {
            Ok(workflows) => workflows,
            Err(e) => {
                tracing::error!(error = %e, "scheduler could not read active workflows");
                continue;
            }
        };

        let now = Utc::now();

        // Runs whose moment has come. Approval waits are never here: time
        // passing is not somebody approving.
        resume_due(&state, now);

        let mut seen: Vec<TriggerKey> = Vec::new();

        for stored in &workflows {
            for node in &stored.workflow.nodes {
                if let Some(key) = tick_node(&state, stored, node, now, &mut due) {
                    seen.push(key);
                }
            }
        }

        // Forget triggers whose workflow was deactivated, deleted or edited.
        due.retain(|key, _| seen.contains(key));
    }
}

/// Whether this worker should be doing the once-only work this tick, and the
/// housekeeping that comes with leading.
///
/// Split out so the loop above reads as what it does rather than as how
/// leadership is decided.
fn take_the_lead(state: &AppState, leading: &mut bool) -> bool {
    let leads = crate::worker::leads_scheduling(&state.db, &state.worker.id);

    if leads != *leading {
        *leading = leads;
        tracing::info!(worker = %state.worker.id, leading = leads, "scheduling leadership changed");
    }
    if !leads {
        return false;
    }

    // Somebody has to notice the workers that stopped, and it cannot be the
    // worker that stopped.
    crate::worker::recover_abandoned(&state.db, crate::INTERRUPTED_REASON);
    true
}

/// Continue any run whose wait has elapsed.
fn resume_due(state: &AppState, now: DateTime<Utc>) {
    let due = match state.db.waits().due(now) {
        Ok(due) => due,
        Err(e) => {
            tracing::error!(error = %e, "could not look for runs whose wait has elapsed");
            return;
        }
    };

    for waiting in due {
        resume_one(state, waiting);
    }
}

/// Continue one run whose wait has elapsed.
#[allow(clippy::cognitive_complexity)] // tracing macro expansion
fn resume_one(state: &AppState, waiting: WaitingRun) {
    let Ok(Some(workflow)) = state.db.workflows().find(&waiting.workflow_id) else {
        // The workflow is gone, so the wait cannot be honoured. Clearing it
        // stops the scheduler retrying it every second, forever.
        let _ = state.db.waits().clear(&waiting.execution_id);
        return;
    };

    // Cleared before resuming, so the next tick arriving while this run is
    // still going cannot start it a second time.
    if let Err(e) = state.db.waits().clear(&waiting.execution_id) {
        tracing::error!(error = %e, "could not clear a wait; not resuming it twice");
        return;
    }

    let state = state.clone();
    tokio::spawn(async move {
        tracing::info!(
            execution = %waiting.execution_id,
            workflow = %workflow.workflow.name,
            node = %waiting.suspended.node_name,
            "a wait has elapsed; continuing the run"
        );
        state
            .runner
            .resume(&workflow.workflow, &waiting, None)
            .await;
    });
}

/// Consider one node. Returns its key when it is a live schedule trigger, so
/// the caller can retire the keys it did not see.
fn tick_node(
    state: &AppState,
    stored: &StoredWorkflow,
    node: &Node,
    now: DateTime<Utc>,
    due: &mut Schedule,
) -> Option<TriggerKey> {
    if node.kind != "schedule" || node.disabled {
        return None;
    }

    let expression = node
        .param("cron")
        .and_then(Value::as_str)?
        .trim()
        .to_owned();
    if expression.is_empty() {
        return None;
    }

    let cron: Cron = match expression.parse() {
        Ok(cron) => cron,
        Err(e) => {
            tracing::error!(
                workflow = %stored.workflow.name,
                node = node.label(),
                cron = %expression,
                error = %e,
                "invalid cron expression; this trigger will not fire"
            );
            return None;
        }
    };

    let key = (stored.workflow.id.clone(), node.id.clone(), expression);

    let Some(&fire_at) = due.get(&key) else {
        // First sighting: schedule forward so startup never back-fires.
        if let Ok(next) = cron.find_next_occurrence(&now, false) {
            due.insert(key.clone(), next);
        }
        return Some(key);
    };

    if now >= fire_at {
        if let Ok(next) = cron.find_next_occurrence(&now, false) {
            due.insert(key.clone(), next);
        }
        fire(state, stored, node, now, fire_at);
    }
    Some(key)
}

fn fire(
    state: &AppState,
    stored: &StoredWorkflow,
    node: &Node,
    now: DateTime<Utc>,
    fire_at: DateTime<Utc>,
) {
    let state = state.clone();
    let workflow = stored.workflow.clone();
    let node_id = node.id.clone();
    let item = json!({ "timestamp": now.to_rfc3339(), "scheduled": fire_at.to_rfc3339() });

    tokio::spawn(async move {
        let (_, result) = state
            .runner
            .run(
                &workflow,
                Some(&node_id),
                vec![item],
                ExecutionMode::Schedule,
            )
            .await;
        if let Some(error) = result.error {
            eprintln!("scheduler: `{}` failed: {error}", workflow.name);
        }
    });
}
