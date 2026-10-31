//! r8r server library: REST API, webhook delivery, scheduling and persistence.
//!
//! Mirrors `packages/cli` in n8n. The binary in `main.rs` is a thin wrapper so
//! that integration tests can build the same router in-process.

pub mod binary_store;
pub mod config;
pub mod controllers;
pub mod credential_provider;
pub mod databases;
pub mod http_log;
pub mod instance_key;
pub mod logging;
pub mod response_helper;
pub mod scheduling;
pub mod server;
pub mod state_provider;
pub mod sub_workflow_provider;
pub mod variable_provider;
pub mod webhooks;
pub mod worker;
pub mod workflow_runner;

use std::sync::Arc;

/// Work out who this process is and say so, so other workers can tell its
/// runs from theirs.
#[allow(clippy::cognitive_complexity)] // tracing macro expansion
fn announce_worker(db: &Arc<Database>, configured: Option<&str>) -> worker::Worker {
    let worker = worker::Worker::identify(db, configured);
    if let Err(error) = db.workers().register(&worker.id, &worker.hostname) {
        tracing::error!(%error, "could not announce this worker");
    }
    tracing::info!(worker = %worker.id, "worker started");
    worker
}

/// Close out what this worker was in the middle of when it last stopped.
///
/// Scoped to this worker: another one sharing the database may have runs in
/// flight right now, and closing those would report a healthy execution as
/// dead while it carried on writing. Runs left by workers that have stopped
/// reporting are picked up separately, by whichever worker leads scheduling.
///
/// Saying so turns an invisible loss into a failure an operator can see and
/// retry.
#[allow(clippy::cognitive_complexity)] // tracing macro expansion
fn close_interrupted_runs(db: &Database, worker_id: &str) {
    if let Err(e) = db.executions().close_unowned(INTERRUPTED_REASON) {
        tracing::error!(error = %e, "could not close unowned executions");
    }

    match db
        .executions()
        .close_own_interrupted(worker_id, INTERRUPTED_REASON)
    {
        Ok(0) => {}
        Ok(count) => tracing::warn!(count, "closed executions interrupted when r8r last stopped"),
        Err(e) => tracing::error!(error = %e, "could not close interrupted executions"),
    }
}

/// What an interrupted run is told it died of.
///
/// Deliberately specific: "failed" would send someone looking for a bug in the
/// workflow, when what happened is that the process stopped underneath it.
pub const INTERRUPTED_REASON: &str =
    "interrupted — r8r stopped while this run was in progress, so it did not finish";

use binary_store::FileBinaryStore;
use config::Config;
use credential_provider::DatabaseCredentials;
use databases::Database;
use instance_key::KeySource;
use server::AppState;
use state_provider::DatabaseState;
use sub_workflow_provider::DatabaseSubWorkflows;
use variable_provider::DatabaseVariables;
use workflow_runner::WorkflowRunner;

/// Wire up database, registries and runner into the state every handler
/// shares. Fails only on unusable configuration — an unreadable database path,
/// a missing encryption key, or a platform without TLS.
pub fn build_state(config: Config) -> Result<AppState, Box<dyn std::error::Error>> {
    Ok(build_state_reporting_key(config)?.0)
}

/// Build the state and report where the encryption key came from, so the
/// binary can tell the operator on first run.
pub fn build_state_reporting_key(
    config: Config,
) -> Result<(AppState, KeySource), Box<dyn std::error::Error>> {
    let (encryptor, key_source) = instance_key::load(&config.database_path)?;
    let db = Arc::new(Database::open(&config.database_path, encryptor)?);

    let worker = announce_worker(&db, config.worker_id.as_deref());
    let catalog = r8r_nodes_base::catalog();
    let registry = Arc::new(catalog.nodes);
    let credential_types = Arc::new(catalog.credentials);

    // Built empty and attached below: the runner owns the engine, the engine
    // hands nodes this capability, and this capability needs the runner.
    let sub_workflows = Arc::new(DatabaseSubWorkflows::new());

    let runner = Arc::new(
        WorkflowRunner::new(db.clone(), registry.clone())?
            .with_credentials(Arc::new(DatabaseCredentials::new(db.clone())))
            .with_sub_workflows(sub_workflows.clone())
            .with_state(Arc::new(DatabaseState::new(db.clone())))
            .with_variables(Arc::new(DatabaseVariables::new(db.clone())))
            .with_binaries(Arc::new(FileBinaryStore::beside(&config.database_path)))
            .with_worker(worker.id.clone())
            .with_history_limit(config.execution_history_limit),
    );
    sub_workflows.attach(&db, &runner);

    close_interrupted_runs(&db, &worker.id);

    Ok((
        AppState {
            db,
            worker,
            registry,
            credential_types,
            runner,
            config,
        },
        key_source,
    ))
}
