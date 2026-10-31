//! Runs a workflow and writes the result to the execution history.
//! Mirrors `workflow-runner.ts` — the seam between the engine and persistence.

use crate::databases::{Database, Lineage, Opening, WaitingRun};
use r8r_core::SuspendedAt;
use r8r_core::{
    BinaryStore, CredentialProvider, NodeRegistry, Result as CoreResult, StateStore, SubWorkflows,
    Variables, WorkflowExecute,
};
use r8r_workflow::Workflow;
use r8r_workflow::interfaces::{ExecutionMode, ExecutionStatus, Items, NodeRunStatus, RunResult};
use serde_json::json;
use std::sync::Arc;
use std::time::Instant;

const DEFAULT_HISTORY_LIMIT: usize = 200;

/// Where a run stopped, read back out of its result.
fn suspended_at(result: &RunResult) -> Option<SuspendedAt> {
    serde_json::from_value(result.suspended.clone()?).ok()
}

/// Fold what an approver supplied into every waiting item.
fn merge_into(items: &Items, added: &Items) -> Items {
    let Some(extra) = added.first().and_then(serde_json::Value::as_object) else {
        return items.clone();
    };

    items
        .iter()
        .map(|item| {
            let mut merged = item.as_object().cloned().unwrap_or_default();
            for (key, value) in extra {
                merged.insert(key.clone(), value.clone());
            }
            serde_json::Value::Object(merged)
        })
        .collect()
}

/// What the error workflow receives.
fn failure_payload(
    workflow: &Workflow,
    execution_id: &str,
    result: &RunResult,
) -> serde_json::Value {
    let failed_node = result
        .runs
        .iter()
        .find(|run| run.status == NodeRunStatus::Error)
        .map(|run| run.name.clone());

    json!({
        "error": {
            "message": result.error,
            "workflowId": workflow.id,
            "workflowName": workflow.name,
            "executionId": execution_id,
            "node": failed_node,
            "failedAt": chrono::Utc::now().to_rfc3339(),
        }
    })
}

/// Which workflow to run when this one fails, from `settings.errorWorkflowId`.
fn error_workflow_of(workflow: &Workflow) -> Option<String> {
    workflow
        .settings
        .get("errorWorkflowId")
        .and_then(serde_json::Value::as_str)
        .filter(|id| !id.is_empty())
        .map(str::to_owned)
}

#[derive(Debug)]
pub struct WorkflowRunner {
    db: Arc<Database>,
    engine: WorkflowExecute,
    history_limit: usize,
    /// Stamped on every execution this runner opens, so that a run can be told
    /// apart from one another worker is in the middle of.
    worker_id: String,
}

impl WorkflowRunner {
    pub fn new(db: Arc<Database>, registry: Arc<NodeRegistry>) -> CoreResult<Self> {
        Ok(WorkflowRunner {
            db,
            engine: WorkflowExecute::new(registry)?,
            history_limit: DEFAULT_HISTORY_LIMIT,
            worker_id: String::new(),
        })
    }

    /// Give the engine access to stored credentials.
    #[must_use]
    pub fn with_credentials(self, credentials: Arc<dyn CredentialProvider>) -> Self {
        WorkflowRunner {
            engine: self.engine.with_credentials(credentials),
            ..self
        }
    }

    /// Let workflows call other workflows.
    #[must_use]
    pub fn with_sub_workflows(self, sub_workflows: Arc<dyn SubWorkflows>) -> Self {
        WorkflowRunner {
            engine: self.engine.with_sub_workflows(sub_workflows),
            ..self
        }
    }

    /// Let workflows remember values between runs.
    #[must_use]
    pub fn with_state(self, state: Arc<dyn StateStore>) -> Self {
        WorkflowRunner {
            engine: self.engine.with_state(state),
            ..self
        }
    }

    /// Supply the instance's variables, read by expressions as `vars`.
    #[must_use]
    pub fn with_variables(self, variables: Arc<dyn Variables>) -> Self {
        WorkflowRunner {
            engine: self.engine.with_variables(variables),
            ..self
        }
    }

    /// Supply somewhere to put files too big to carry in an item.
    #[must_use]
    pub fn with_binaries(self, binaries: Arc<dyn BinaryStore>) -> Self {
        WorkflowRunner {
            engine: self.engine.with_binaries(binaries),
            ..self
        }
    }

    /// Say which worker owns the runs this runner opens.
    #[must_use]
    pub fn with_worker(mut self, worker_id: String) -> Self {
        self.worker_id = worker_id;
        self
    }

    #[must_use]
    pub fn with_history_limit(mut self, limit: usize) -> Self {
        self.history_limit = limit;
        self
    }

    /// Execute without writing to the execution history — how the editor tries
    /// out a workflow that has not been saved.
    pub async fn dry_run(
        &self,
        workflow: &Workflow,
        start: Option<&str>,
        input: Items,
        mode: ExecutionMode,
    ) -> RunResult {
        self.engine.run(workflow, start, input, mode).await
    }

    /// Execute and persist. Returns the new execution id alongside the result.
    pub async fn run(
        &self,
        workflow: &Workflow,
        start: Option<&str>,
        input: Items,
        mode: ExecutionMode,
    ) -> (String, RunResult) {
        self.run_with_lineage(workflow, start, input, mode, None)
            .await
    }

    /// Run a workflow that another workflow called.
    ///
    /// Recorded like any other run: a sub-workflow that failed at three in the
    /// morning should be findable on its own, not only as a line inside its
    /// caller's history.
    pub async fn run_nested(
        &self,
        workflow: &Workflow,
        input: Items,
        chain: Vec<String>,
    ) -> (String, RunResult) {
        let execution_id = uuid::Uuid::new_v4().to_string();
        let started_at = chrono::Utc::now().to_rfc3339();
        let clock = Instant::now();

        self.open(
            &execution_id,
            workflow,
            ExecutionMode::Trigger,
            &started_at,
            &input,
            None,
        );

        let result = self
            .engine
            .clone_in_chain(chain)
            .run(workflow, None, input, ExecutionMode::Trigger)
            .await;
        let ms = u64::try_from(clock.elapsed().as_millis()).unwrap_or(u64::MAX);

        self.close(&execution_id, workflow, ms, &result).await;
        self.record_suspension(&execution_id, workflow, &result);
        self.remember(workflow, &result);

        (execution_id, result)
    }

    /// Continue a run that was waiting.
    ///
    /// Starts the workflow at the node after the one that stopped it, carrying
    /// the items that were in flight — and anything the approver supplied,
    /// which is how a decision reaches the rest of the workflow.
    pub async fn resume(
        &self,
        workflow: &Workflow,
        waiting: &WaitingRun,
        extra: Option<Items>,
    ) -> (String, RunResult) {
        let items = match extra {
            // Merged onto each item rather than replacing them: the approver
            // adds to what the workflow already knew, they do not overwrite it.
            Some(added) => merge_into(&waiting.suspended.suspension.items, &added),
            None => waiting.suspended.suspension.items.clone(),
        };

        let execution_id = uuid::Uuid::new_v4().to_string();
        let started_at = chrono::Utc::now().to_rfc3339();
        let clock = Instant::now();

        self.open(
            &execution_id,
            workflow,
            ExecutionMode::Trigger,
            &started_at,
            &items,
            None,
        );

        // After the node that stopped it, not at it — otherwise the wait is
        // entered a second time and the run stops again, forever.
        let result = self
            .engine
            .resume_after(
                workflow,
                &waiting.suspended.node_id,
                items,
                ExecutionMode::Trigger,
            )
            .await;
        let ms = u64::try_from(clock.elapsed().as_millis()).unwrap_or(u64::MAX);

        self.close(&execution_id, workflow, ms, &result).await;

        self.record_suspension(&execution_id, workflow, &result);
        self.remember(workflow, &result);

        if result.status == ExecutionStatus::Error {
            self.notify_failure(workflow, &execution_id, &result).await;
        }

        (execution_id, result)
    }

    /// Run, recording that this is another attempt at work that already ran.
    ///
    /// The lineage is what lets a batch of replays be reviewed afterwards, and
    /// what stops the same failing work being put through forever.
    pub async fn run_retry(
        &self,
        workflow: &Workflow,
        input: Items,
        lineage: &Lineage,
    ) -> (String, RunResult) {
        self.run_with_lineage(workflow, None, input, ExecutionMode::Retry, Some(lineage))
            .await
    }

    async fn run_with_lineage(
        &self,
        workflow: &Workflow,
        start: Option<&str>,
        input: Items,
        mode: ExecutionMode,
        lineage: Option<&Lineage>,
    ) -> (String, RunResult) {
        let execution_id = uuid::Uuid::new_v4().to_string();
        let started_at = chrono::Utc::now().to_rfc3339();
        let clock = Instant::now();

        // Opened before the work starts, so a run that never finishes still
        // leaves a record. Without this a crash mid-run was invisible.
        self.open(&execution_id, workflow, mode, &started_at, &input, lineage);

        // The engine is told which run it is executing, so a file it stores
        // can be cleaned up when this run's history is pruned.
        let result = self
            .engine
            .for_execution(&execution_id)
            .run(workflow, start, input, mode)
            .await;
        let ms = u64::try_from(clock.elapsed().as_millis()).unwrap_or(u64::MAX);

        self.close(&execution_id, workflow, ms, &result).await;

        self.record_suspension(&execution_id, workflow, &result);
        self.remember(workflow, &result);

        // Waiting is not failing, so it does not raise an alert.
        if result.status == ExecutionStatus::Error {
            self.notify_failure(workflow, &execution_id, &result).await;
        }

        (execution_id, result)
    }

    /// Open the execution row before the workflow runs.
    ///
    /// A failure here is logged and swallowed: losing the record of a run is
    /// not a reason to refuse to do the work.
    fn open(
        &self,
        execution_id: &str,
        workflow: &Workflow,
        mode: ExecutionMode,
        started_at: &str,
        input: &Items,
        lineage: Option<&Lineage>,
    ) {
        if let Err(e) = self.db.executions().start(&Opening {
            id: execution_id,
            workflow_id: &workflow.id,
            workflow_name: &workflow.name,
            mode: mode.as_str(),
            started_at,
            input,
            lineage,
            worker_id: &self.worker_id,
        }) {
            tracing::error!(execution = %execution_id, error = %e, "could not open execution");
        }
    }

    /// Save what a successful run asked to remember.
    ///
    /// `remembered` is populated by the engine only for a run that succeeded,
    /// so there is no path here by which a failed run's watermark is written
    /// and the records it never processed are skipped.
    #[allow(clippy::cognitive_complexity)] // tracing macro expansion
    fn remember(&self, workflow: &Workflow, result: &RunResult) {
        let Some(values) = result
            .remembered
            .clone()
            .filter(|values| !values.is_empty())
        else {
            return;
        };

        match self.db.state().commit(&workflow.id, &values) {
            Ok(written) => {
                tracing::debug!(workflow = %workflow.name, written, "saved workflow state");
            }
            Err(e) => tracing::error!(
                workflow = %workflow.name,
                error = %e,
                "could not save what this run remembered; the next run will repeat it"
            ),
        }
    }

    /// Write down a run that stopped part-way, so it can be continued later.
    ///
    /// Held in memory it would simply be lost on the next deploy, and the
    /// workflow would never finish and never say so.
    #[allow(clippy::cognitive_complexity)] // tracing macro expansion
    fn record_suspension(&self, execution_id: &str, workflow: &Workflow, result: &RunResult) {
        let Some(suspended) = suspended_at(result) else {
            return;
        };

        match self
            .db
            .waits()
            .suspend(execution_id, &workflow.id, &suspended)
        {
            Ok(()) => tracing::info!(
                execution = %execution_id,
                workflow = %workflow.name,
                node = %suspended.node_name,
                reason = %suspended.suspension.reason,
                "run is waiting"
            ),
            Err(e) => tracing::error!(
                execution = %execution_id,
                error = %e,
                "could not record a waiting run; it will not resume"
            ),
        }
    }

    /// Close the execution row with what happened, and trim old history.
    #[allow(clippy::cognitive_complexity)] // tracing macro expansion; see above
    async fn close(&self, execution_id: &str, workflow: &Workflow, ms: u64, result: &RunResult) {
        let executions = self.db.executions();

        if let Err(e) = executions.finish(execution_id, ms, result) {
            tracing::error!(execution = %execution_id, error = %e, "could not save execution");
            return;
        }

        match executions.prune(&workflow.id, self.history_limit) {
            // A pruned run's files go with it. Keeping them would fill a disk
            // with attachments nothing points at any more.
            Ok(pruned) => self.forget_files(&pruned).await,
            Err(e) => tracing::warn!(error = %e, "could not prune execution history"),
        }
    }

    /// Read back a file a run produced.
    pub async fn read_file(&self, id: &str) -> CoreResult<Vec<u8>> {
        self.engine.binaries().get(id).await
    }

    /// Remove the files these runs left behind.
    pub async fn forget_files(&self, execution_ids: &[String]) {
        // Bounded loop (Power of 10 rule 2): one pass over what pruning just
        // removed, which is bounded by the history limit.
        for id in execution_ids {
            if let Err(e) = self.engine.binaries().forget(id).await {
                tracing::warn!(execution = %id, error = %e, "could not remove a run's files");
            }
        }
    }

    /// Run the workflow's designated error workflow, if it has one.
    ///
    /// This is how failures become notifications: rather than r8r shipping an
    /// email client and a Slack client and a pager client, a failed run starts
    /// a workflow you built, with the failure as its input. Anything r8r can do
    /// normally, it can do in response to an error.
    // `tracing`'s macros expand into branchy code that this lint attributes to
    // the enclosing function; both of these are a short sequence of guards.
    #[allow(clippy::cognitive_complexity)]
    async fn notify_failure(&self, workflow: &Workflow, execution_id: &str, result: &RunResult) {
        let Some(handler) = self.error_workflow_for(workflow) else {
            return;
        };

        tracing::info!(
            workflow = %workflow.name,
            error_workflow = %handler.name,
            "running the error workflow"
        );

        let payload = failure_payload(workflow, execution_id, result);

        // Errors in the error workflow are logged and dropped: there is no
        // sensible third workflow to escalate to, and looping is worse.
        let (_, outcome) =
            Box::pin(self.run(&handler, None, vec![payload], ExecutionMode::Trigger)).await;

        if let Some(error) = outcome.error {
            tracing::error!(
                error_workflow = %handler.name,
                %error,
                "the error workflow itself failed"
            );
        }
    }

    /// Look up the workflow to run when `workflow` fails, if it is usable.
    #[allow(clippy::cognitive_complexity)] // see above
    fn error_workflow_for(&self, workflow: &Workflow) -> Option<Workflow> {
        let id = error_workflow_of(workflow)?;

        // A workflow pointing at itself would fail, notify itself, and repeat.
        if id == workflow.id {
            tracing::warn!(
                workflow = %workflow.name,
                "error workflow points at itself; not notifying"
            );
            return None;
        }

        match self.db.workflows().find(&id) {
            Ok(Some(found)) => Some(found.workflow),
            Ok(None) => {
                tracing::warn!(
                    workflow = %workflow.name,
                    error_workflow = %id,
                    "error workflow is configured but no longer exists"
                );
                None
            }
            Err(e) => {
                tracing::error!(error = %e, "could not load the error workflow");
                None
            }
        }
    }
}
