//! This process's identity, and the heartbeat that says it is still here.
//!
//! Everything about running more than one r8r against one database turns on
//! being able to tell "that run belongs to somebody else, who is still going"
//! from "that run belongs to somebody who is gone".

use crate::databases::{Database, HEARTBEAT_TIMEOUT_SECS, SCHEDULER_LEASE};
use std::sync::Arc;
use std::time::Duration;

/// Set this to give a worker the same name across restarts.
///
/// Worth setting wherever the deployment already has a stable name — a
/// container's ordinal, a systemd instance, a hostname. It is what lets a
/// worker recognise its own interrupted runs the moment it comes back, rather
/// than waiting out the heartbeat timeout for somebody else to notice.
pub const WORKER_ID_ENV: &str = "R8R_WORKER_ID";

/// How often a worker says it is alive.
///
/// Several times within the timeout, so that one missed beat — a slow query, a
/// paused container — is not mistaken for a dead worker.
pub const HEARTBEAT: Duration = Duration::from_secs(10);

/// Who this process is.
#[derive(Debug, Clone)]
pub struct Worker {
    pub id: String,
    pub hostname: String,
}

impl Worker {
    /// Identify this process.
    ///
    /// The name is stable by default — `$R8R_WORKER_ID`, or the hostname —
    /// because that is what lets a worker recognise its own interrupted runs
    /// the moment it comes back, instead of waiting out the heartbeat timeout
    /// for somebody else to notice.
    ///
    /// Starting under a name takes it over: runs still marked running under
    /// this name belong to a previous incarnation of it, because this process
    /// has only just begun. That is what makes recovery instant.
    ///
    /// It also means two processes must never share a name. They would each
    /// close the other's live runs at startup, and no amount of guessing here
    /// can tell "the previous process crashed a second ago" apart from "the
    /// other process is still running" — both leave a worker row that was
    /// updated a second ago. So a name that still looks alive is taken anyway
    /// and said out loud, because the fix is for the operator to name the
    /// processes, not for r8r to invent a name and quietly stop recovering.
    #[must_use]
    pub fn identify(db: &Database, configured: Option<&str>) -> Self {
        let hostname = hostname();
        let id = configured
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| hostname.clone());

        if looks_alive(db, &id) {
            tracing::warn!(
                worker = %id,
                "a worker was reporting under this name moments ago. If that \
                 was this process restarting, all is well. If two r8r \
                 processes are sharing one database, give each its own \
                 $R8R_WORKER_ID — otherwise they will close each other's runs"
            );
        }

        Worker { id, hostname }
    }

    /// Announce this worker and keep saying it is alive.
    ///
    /// Never returns: this is a process-lifetime loop. Power of 10 rule 2 asks
    /// for bounded loops; a service's own heartbeat is the documented
    /// exception.
    pub async fn beat(self, db: Arc<Database>) {
        loop {
            tokio::time::sleep(HEARTBEAT).await;
            if let Err(error) = db.workers().heartbeat(&self.id) {
                // Worth saying out loud: a worker whose heartbeat is failing
                // is about to be declared dead by everybody else, and its runs
                // recovered out from under it.
                tracing::error!(worker = %self.id, %error, "could not record heartbeat");
            }
        }
    }
}

/// Whether something was reporting under this name recently.
fn looks_alive(db: &Database, id: &str) -> bool {
    match db.workers().list() {
        Ok(workers) => workers.iter().any(|worker| worker.alive && worker.id == id),
        // Only used to decide whether to warn, so a failed read costs nothing
        // worth turning into a startup failure.
        Err(error) => {
            tracing::error!(%error, "could not check for other workers");
            false
        }
    }
}

/// A worker's name when the machine will not say what it is called.
fn hostname() -> String {
    std::env::var("HOSTNAME")
        .ok()
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "r8r".to_owned())
}

/// Whether this worker should do the work that must happen exactly once.
///
/// Asked every tick rather than decided at startup, so that leadership moves
/// on its own when the leader stops: the lease expires, the next worker to ask
/// gets it, and nothing had to notice the failure or agree on a successor.
pub fn leads_scheduling(db: &Database, worker_id: &str) -> bool {
    match db.workers().claim_lease(SCHEDULER_LEASE, worker_id) {
        Ok(held) => held,
        Err(error) => {
            // Standing down on an error is the safe way to be wrong. Two
            // workers both firing every schedule is worse than none doing it
            // for a second, and the next tick asks again.
            tracing::error!(%error, "could not claim the scheduler lease");
            false
        }
    }
}

/// Close out anything left running by workers that have stopped reporting.
///
/// Runs on the scheduling leader, because the worker that died is not the one
/// that will notice.
pub fn recover_abandoned(db: &Database, reason: &str) {
    let Ok(dead) = db.workers().dead_ids().inspect_err(|error| {
        tracing::error!(%error, "could not look for workers that have stopped");
    }) else {
        return;
    };

    report_recovery(db.executions().close_abandoned(&dead, reason), dead.len());

    if let Err(error) = db.workers().forget_stale() {
        tracing::error!(%error, "could not forget long-gone workers");
    }
}

#[allow(clippy::cognitive_complexity)] // tracing macro expansion
fn report_recovery(closed: rusqlite::Result<usize>, workers: usize) {
    match closed {
        Ok(0) => {}
        Ok(count) => tracing::warn!(
            count,
            workers,
            timeout_secs = HEARTBEAT_TIMEOUT_SECS,
            "closed runs whose worker stopped reporting"
        ),
        Err(error) => tracing::error!(%error, "could not close abandoned runs"),
    }
}
