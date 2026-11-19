//! Starts and stops the background jobs of app bricks with the bricks' switches.
//!
//! Which job serves which brick is data in `medbrains_core::bricks::BRICK_JOBS`; the decision is
//! `medbrains_server_core::brick_jobs`. This file only knows how to start each one. Jobs every
//! install needs are [`PLATFORM_JOBS`], started by `main.rs` and never stopped.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use medbrains_core::bricks::BrickJob;
use medbrains_core::secrets::SecretResolver;
use medbrains_server_core::brick_jobs::{read_bricks_on, reconcile};
use medbrains_server_core::state::AppState;
use sqlx::PgPool;
use tokio::task::JoinHandle;

use super::{
    appointment_reminders, calibration_lock, critical_alert_escalation, ews_escalation,
    nurse_call_escalation, pacs_sync, preauth_sweep, prescription_expiry,
    restraint_observation_escalation, room_rent, unbilled_orders, verbal_order_escalation,
};

/// How often the switches are read again. The request gate trusts its cache as long, so a brick
/// switched on starts its jobs within about the time its screens start answering.
const RECHECK: Duration = Duration::from_secs(30);

/// Jobs `main.rs` starts on every install, whatever bricks are on.
///
/// Platform, security and legal duties, and jobs of groups that are not bricks yet. `scripts/check_bricks.py` fails on a job
/// `main.rs` starts that is not listed here; a job that serves a brick goes in `BRICK_JOBS`.
pub const PLATFORM_JOBS: &[&str] = &[
    "notification_listener",
    "simulator::scheduler",
    "paperless_meter",
    "vaccination_reminders",
    "medbrains_nursing::code_blue_escalation",
    "enquiry_sla_escalation",
    "breach_deadline_escalation",
    "access_alert_scan",
    "marketing_message_status",
    "notifiable_report_escalation",
    "medbrains_health_intel::job",
    "crs_registration_escalation",
    "medbrains_dictation::purge",
    "retention",
    "queue_rollover",
];

/// What the jobs are started with.
#[allow(missing_debug_implementations)] // AppState and the resolver carry keys; nothing to print.
pub struct Ctx {
    /// Shared state, for the jobs that announce on the boards.
    pub state: AppState,
    /// The worker pool (crosses hospitals).
    pub worker: PgPool,
    /// Credentials, for the jobs that send SMS.
    pub secrets: Arc<dyn SecretResolver>,
}

/// Starts one brick job by id; `None` for an id this server cannot start.
fn start(job: &BrickJob, ctx: &Ctx) -> Option<JoinHandle<()>> {
    let pool = ctx.worker.clone();
    Some(match job.id {
        "opd_auto_close" => medbrains_opd::auto_close::spawn(ctx.state.clone()),
        "appointment_reminders" => appointment_reminders::spawn(pool),
        "prescription_expiry" => prescription_expiry::spawn(pool),
        "verbal_order_escalation" => verbal_order_escalation::spawn(pool),
        "room_rent" => room_rent::spawn(pool),
        "mrd_file_requests" => medbrains_mrd::file_requests::jobs::spawn(pool),
        "nurse_call_escalation" => nurse_call_escalation::spawn(pool),
        "ews_escalation" => ews_escalation::spawn(pool),
        "restraint_observation_escalation" => restraint_observation_escalation::spawn(pool),
        "critical_alert_escalation" => {
            critical_alert_escalation::spawn(pool, Arc::clone(&ctx.secrets))
        }
        "calibration_lock" => calibration_lock::spawn(pool),
        "pacs_sync" => pacs_sync::spawn(pool),
        "unbilled_orders" => unbilled_orders::spawn(pool),
        "preauth_sweep" => preauth_sweep::spawn(pool),
        "hrms_pull" => medbrains_hrms_gateway::spawn(pool),
        "flow_aggregate" => medbrains_flow::aggregate::spawn(pool),
        _ => return None,
    })
}

/// Runs the supervisor for the life of the server: read the switches, reconcile, wait.
///
/// An unreadable switch is logged and every brick job is kept running (fail-safe).
pub fn supervise(ctx: Ctx) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut running = HashMap::new();
        loop {
            let on = match read_bricks_on(&ctx.worker).await {
                Ok(on) => Some(on),
                Err(error) => {
                    tracing::warn!(%error, "module switches unreadable: every brick job keeps running");
                    None
                }
            };
            reconcile(&mut running, on.as_ref(), |job| start(job, &ctx));
            tokio::time::sleep(RECHECK).await;
        }
    })
}

#[cfg(test)]
mod tests {
    use medbrains_core::bricks::BRICK_JOBS;

    /// Every job in the table has a starter: `start`'s arms, read from this file.
    #[test]
    fn every_brick_job_can_be_started() {
        let source = include_str!("brick_jobs.rs");
        for job in BRICK_JOBS {
            assert!(
                source.contains(&format!("\"{}\" =>", job.id)),
                "{} has no starter",
                job.id
            );
        }
    }
}
