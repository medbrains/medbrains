//! Walks the DAG and runs each node in order, carrying items along the edges.
//! The Rust counterpart of n8n's `WorkflowExecute`.

use crate::binary::{BinaryStore, NoBinaryStore};
use crate::credentials::{CredentialProvider, NoCredentials};
use crate::errors::{CoreError, Result};
use crate::execute_context::{ExecuteContext, NodeOutput};
use crate::nodes_loader::NodeRegistry;
use crate::state::{NoState, StagedState, StateStore};
use crate::sub_workflows::{NoSubWorkflows, SubWorkflows};
use crate::suspension::{NodeOutcome, SuspendedAt, Suspension};
use crate::variables::{NoVariables, Variables};
use r8r_workflow::graph;
use r8r_workflow::interfaces::{
    ERROR_PORT, ExecutionMode, ExecutionStatus, Items, MAIN_PORT, Node, NodeRunData, NodeRunStatus,
    RunResult,
};
use r8r_workflow::{Expression, Workflow};
use serde_json::{Map, Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);
const MAX_RETRIES: u32 = 10;
const MAX_RETRY_WAIT_MS: u64 = 60_000;

/// Items waiting on one edge, keyed by the node that produced them and the port
/// they left from.
type Bus = HashMap<(String, String), Items>;

pub struct WorkflowExecute {
    registry: Arc<NodeRegistry>,
    http: reqwest::Client,
    credentials: Arc<dyn CredentialProvider>,
    sub_workflows: Arc<dyn SubWorkflows>,
    state: Arc<dyn StateStore>,
    variables: Arc<dyn Variables>,
    binaries: Arc<dyn BinaryStore>,
    /// Which run this engine is executing, for tying stored files to it.
    execution_id: String,
    /// The workflows already running when this engine was built.
    chain: Vec<String>,
}

impl std::fmt::Debug for WorkflowExecute {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WorkflowExecute")
            .field("registry", &self.registry)
            .field("credentials", &self.credentials)
            .finish_non_exhaustive()
    }
}

impl WorkflowExecute {
    /// Fails only if the platform cannot provide a TLS backend, which is worth
    /// surfacing at startup rather than on the first HTTP node.
    pub fn new(registry: Arc<NodeRegistry>) -> Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("r8r/", env!("CARGO_PKG_VERSION")))
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|e| CoreError::Node(format!("could not build the HTTP client: {e}")))?;
        Ok(Self::with_client(registry, http))
    }

    /// Share one client (and therefore one connection pool) across the process.
    pub fn with_client(registry: Arc<NodeRegistry>, http: reqwest::Client) -> Self {
        WorkflowExecute {
            registry,
            http,
            credentials: Arc::new(NoCredentials),
            sub_workflows: Arc::new(NoSubWorkflows),
            state: Arc::new(NoState),
            variables: Arc::new(NoVariables),
            binaries: Arc::new(NoBinaryStore),
            execution_id: String::new(),
            chain: Vec::new(),
        }
    }

    /// Supply the store that decrypts credentials for nodes that need them.
    /// Without one, a node bound to a credential fails with a clear message
    /// rather than silently sending an unauthenticated request.
    #[must_use]
    pub fn with_credentials(mut self, credentials: Arc<dyn CredentialProvider>) -> Self {
        self.credentials = credentials;
        self
    }

    /// Let workflows call other workflows.
    #[must_use]
    pub fn with_sub_workflows(mut self, sub_workflows: Arc<dyn SubWorkflows>) -> Self {
        self.sub_workflows = sub_workflows;
        self
    }

    /// Supply the instance's variables, read by expressions as `vars`.
    #[must_use]
    pub fn with_variables(mut self, variables: Arc<dyn Variables>) -> Self {
        self.variables = variables;
        self
    }

    /// Supply somewhere to put files too big to carry in an item.
    #[must_use]
    pub fn with_binaries(mut self, binaries: Arc<dyn BinaryStore>) -> Self {
        self.binaries = binaries;
        self
    }

    /// A view of this engine that knows which run it is executing.
    ///
    /// Cheap: everything it holds is behind an `Arc`. Per-run rather than
    /// per-engine because one engine serves every run in the process, and a
    /// file has to be attributable to the run that produced it or it can never
    /// be cleaned up.
    #[must_use]
    pub fn for_execution(&self, execution_id: &str) -> Self {
        let mut cloned = self.clone_in_chain(self.chain.clone());
        execution_id.clone_into(&mut cloned.execution_id);
        cloned
    }

    /// Let workflows remember values between runs.
    #[must_use]
    pub fn with_state(mut self, state: Arc<dyn StateStore>) -> Self {
        self.state = state;
        self
    }

    /// Record which workflows are already running, so a call that would loop
    /// is refused naming them rather than exhausting a stack.
    #[must_use]
    pub fn in_chain(mut self, chain: Vec<String>) -> Self {
        self.chain = chain;
        self
    }

    /// The same engine, running one level deeper.
    ///
    /// Cheap: everything it holds is behind an `Arc`, so this shares the HTTP
    /// pool, the registry and the credential store rather than rebuilding them.
    #[must_use]
    pub fn clone_in_chain(&self, chain: Vec<String>) -> Self {
        WorkflowExecute {
            registry: Arc::clone(&self.registry),
            http: self.http.clone(),
            credentials: Arc::clone(&self.credentials),
            sub_workflows: Arc::clone(&self.sub_workflows),
            state: Arc::clone(&self.state),
            // A sub-workflow reads the same variables as its caller: they
            // describe the instance, not the run.
            variables: Arc::clone(&self.variables),
            binaries: Arc::clone(&self.binaries),
            execution_id: self.execution_id.clone(),
            chain,
        }
    }

    /// Where this engine puts files too big to carry in an item.
    #[must_use]
    pub fn binaries(&self) -> &Arc<dyn BinaryStore> {
        &self.binaries
    }

    pub fn registry(&self) -> &NodeRegistry {
        &self.registry
    }

    /// Run `workflow` beginning at `start` (or every trigger node when `None`),
    /// feeding `input` to the starting node.
    pub async fn run(
        &self,
        workflow: &Workflow,
        start: Option<&str>,
        input: Items,
        mode: ExecutionMode,
    ) -> RunResult {
        let started = Instant::now();
        tracing::info!(
            workflow = %workflow.name,
            workflow_id = %workflow.id,
            mode = mode.as_str(),
            nodes = workflow.nodes.len(),
            items_in = input.len(),
            "execution started"
        );

        let start_ids = self.start_ids(workflow, start);
        self.run_from(workflow, start_ids, input, mode, started)
            .await
    }

    /// Continue a workflow from the node after `node_id`.
    ///
    /// Resuming has to begin *after* the node that stopped the run, not at it —
    /// otherwise the wait is simply entered a second time and the run stops
    /// again, forever.
    pub async fn resume_after(
        &self,
        workflow: &Workflow,
        node_id: &str,
        input: Items,
        mode: ExecutionMode,
    ) -> RunResult {
        let started = Instant::now();
        let next: Vec<String> = workflow
            .connections_from(node_id)
            .map(|c| c.to.clone())
            .collect();

        if next.is_empty() {
            // Nothing followed the wait, so the workflow is simply over. Saying
            // so is better than reporting a run that cannot be started.
            tracing::info!(workflow = %workflow.name, "resumed a run that had nothing left to do");
            return RunResult {
                status: ExecutionStatus::Success,
                error: None,
                runs: Vec::new(),
                last: input,
                suspended: None,
                remembered: None,
            };
        }

        self.run_from(workflow, next, input, mode, started).await
    }

    async fn run_from(
        &self,
        workflow: &Workflow,
        start_ids: Vec<String>,
        input: Items,
        _mode: ExecutionMode,
        started: Instant,
    ) -> RunResult {
        if start_ids.iter().all(|id| workflow.node(id).is_none()) {
            return aborted("workflow has no trigger node to start from");
        }

        let order = match graph::execution_order(workflow, &start_ids) {
            Ok(order) => order,
            Err(e) => return aborted(&e.to_string()),
        };

        let mut state = RunState::new(workflow, input, start_ids, self.variables.all());

        // Read once, so every expression in the run sees the same values. What
        // the workflow remembered last time is `state` inside `{{ }}`.
        match self.state.load(&workflow.id).await {
            Ok(remembered) => {
                state
                    .expression
                    .set_variable("state", Value::Object(remembered));
            }
            Err(e) => {
                tracing::warn!(error = %e, "could not read what this workflow remembered");
                state
                    .expression
                    .set_variable("state", Value::Object(Map::new()));
            }
        }
        for id in order {
            let Some(node) = workflow.node(&id) else {
                continue;
            };
            if self.step(workflow, node, &mut state).await.is_break() {
                break;
            }
        }

        let result = state.finish();
        log_outcome(workflow, &result, started.elapsed());
        result
    }

    /// Execute one node and fold its outcome into `state`. Breaking means the
    /// run is over.
    async fn step(
        &self,
        workflow: &Workflow,
        node: &Node,
        state: &mut RunState,
    ) -> std::ops::ControlFlow<()> {
        let Some(incoming) = state.input_for(workflow, node) else {
            state.runs.push(run_data(
                node,
                NodeRunStatus::Skipped,
                0,
                0,
                NodeOutput::new(),
                None,
            ));
            return std::ops::ControlFlow::Continue(());
        };

        let started = Instant::now();
        let (outcome, tries) = self
            .run_node(node, &incoming, &state.expression, &state.staged)
            .await;
        let ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);

        match outcome {
            Ok(NodeOutcome::Output(output)) => {
                log_node_ok(node, &output, ms, tries);
                state.accept(node, output, ms, tries);
                std::ops::ControlFlow::Continue(())
            }

            // The node cannot finish inside this run. Record where it stopped
            // and what was in flight, and end the run as waiting rather than
            // as done or as failed — it is neither.
            Ok(NodeOutcome::Suspend(suspension)) => suspend(state, node, *suspension, ms, tries),
            Err(e) => {
                let message = e.to_string();
                tracing::error!(
                    node = node.label(),
                    kind = %node.kind,
                    ms,
                    tries,
                    continues = node.continues_on_fail(),
                    error = %message,
                    "node failed"
                );
                state.reject(node, &message, ms, tries)
            }
        }
    }

    fn start_ids(&self, workflow: &Workflow, start: Option<&str>) -> Vec<String> {
        match start {
            Some(id) => vec![id.to_string()],
            None => workflow
                .trigger_nodes(|kind| self.registry.is_trigger(kind))
                .iter()
                .map(|n| n.id.clone())
                .collect(),
        }
    }

    /// Run one node over its whole input, or record by record if it asks to
    /// isolate failures.
    async fn run_node(
        &self,
        node: &Node,
        input: &Items,
        expression: &Expression,
        staged: &StagedState,
    ) -> (Result<NodeOutcome>, u32) {
        // Applies to a batch of one as well: a workflow's error routing must
        // not depend on how many records happened to arrive.
        if node.isolates_records() {
            return self
                .execute_per_record(node, input, expression, staged)
                .await;
        }
        self.execute_node(node, input, expression, staged).await
    }

    /// Process the items one at a time so that one bad record does not take
    /// the rest of the batch with it.
    ///
    /// Records that worked leave on `main`; records that failed leave on
    /// `error`, each carrying the item that caused it alongside the message —
    /// which is what makes the failures fixable rather than merely counted.
    ///
    /// This costs one node execution per record, which is why it is opt-in.
    /// For a node that was already making one call per item it costs nothing
    /// extra; for one that batches internally it gives up that batching in
    /// exchange for knowing which record was bad.
    async fn execute_per_record(
        &self,
        node: &Node,
        input: &Items,
        expression: &Expression,
        staged: &StagedState,
    ) -> (Result<NodeOutcome>, u32) {
        let mut passed = Items::new();
        let mut failed = Items::new();
        let mut most_tries = 1;

        // Bounded loop (Power of 10 rule 2): the input is a materialised list.
        for item in input {
            let one = vec![item.clone()];
            let (outcome, tries) = self.execute_node(node, &one, expression, staged).await;
            most_tries = most_tries.max(tries);

            match outcome {
                Ok(NodeOutcome::Output(output)) => {
                    if let Some(main) = output.get(MAIN_PORT) {
                        passed.extend(main.iter().cloned());
                    }
                }
                // A node that suspends mid-batch cannot be isolated: resuming
                // would restart the whole batch. Hand the suspension back
                // rather than pretend the records after it were processed.
                Ok(suspend @ NodeOutcome::Suspend(_)) => return (Ok(suspend), most_tries),
                Err(error) => failed.push(json!({
                    "error": error.to_string(),
                    "node": node.label(),
                    "item": item,
                })),
            }
        }

        tracing::info!(
            node = node.label(),
            passed = passed.len(),
            failed = failed.len(),
            "records isolated"
        );

        let output = NodeOutput::from([
            (MAIN_PORT.to_string(), passed),
            (ERROR_PORT.to_string(), failed),
        ]);
        (Ok(NodeOutcome::Output(output)), most_tries)
    }

    /// Run one node, honouring its retry settings. Returns the attempt count so
    /// the UI can show that a node only succeeded on its third try.
    async fn execute_node(
        &self,
        node: &Node,
        input: &Items,
        expression: &Expression,
        staged: &StagedState,
    ) -> (Result<NodeOutcome>, u32) {
        let Some(executor) = self.registry.get(&node.kind) else {
            return (Err(CoreError::UnknownNodeType(node.kind.clone())), 1);
        };

        let max_tries = if node.retry_on_fail {
            node.max_tries.unwrap_or(3).clamp(1, MAX_RETRIES)
        } else {
            1
        };
        let wait = Duration::from_millis(
            node.wait_between_tries_ms
                .unwrap_or(1000)
                .min(MAX_RETRY_WAIT_MS),
        );

        // Bounded loop (Power of 10 rule 2): `max_tries` is clamped above.
        let mut attempt = 0;
        loop {
            attempt += 1;
            let ctx = ExecuteContext {
                node,
                input,
                expression,
                staged_state: staged,
                binaries: self.binaries.as_ref(),
                execution_id: &self.execution_id,
                http: &self.http,
                credentials: self.credentials.as_ref(),
                sub_workflows: self.sub_workflows.as_ref(),
                chain: &self.chain,
            };
            match executor.execute(&ctx).await {
                Ok(output) => return (Ok(output), attempt),
                Err(e) if attempt < max_tries => {
                    // A service that named a wait gets that wait. Retrying
                    // sooner spends quota that is already exhausted, and a
                    // wait longer than we will ever accept is a refusal, not
                    // a delay — so fail now rather than sleep and fail later.
                    let pause = match e.retry_after() {
                        Some(asked) if asked > Duration::from_millis(MAX_RETRY_WAIT_MS) => {
                            return (Err(e), attempt);
                        }
                        Some(asked) => asked,
                        None => wait,
                    };
                    tracing::warn!(
                        node = node.label(),
                        attempt,
                        of = max_tries,
                        wait_ms = pause.as_millis(),
                        error = %e,
                        "node failed, retrying"
                    );
                    tokio::time::sleep(pause).await;
                }
                Err(e) => return (Err(e), attempt),
            }
        }
    }
}

// ----------------------------------------------------------------- run state

/// Everything that changes as an execution progresses. Split out of `run` so
/// each transition is a short, separately testable function.
struct RunState {
    expression: Expression,
    bus: Bus,
    runs: Vec<NodeRunData>,
    last: Items,
    input: Items,
    start_ids: Vec<String>,
    error: Option<String>,
    staged: StagedState,
    /// Set when a node stopped the run rather than failing it.
    suspended: Option<SuspendedAt>,
}

impl RunState {
    fn new(
        workflow: &Workflow,
        input: Items,
        start_ids: Vec<String>,
        variables: Map<String, Value>,
    ) -> Self {
        RunState {
            expression: Expression::new(&workflow.id, &workflow.name).with_vars(variables),
            bus: Bus::new(),
            runs: Vec::new(),
            last: Vec::new(),
            input,
            start_ids,
            error: None,
            staged: StagedState::new(),
            suspended: None,
        }
    }

    /// Items this node should receive, or `None` when it must be skipped
    /// because it is disabled or every upstream branch produced nothing.
    fn input_for(&self, workflow: &Workflow, node: &Node) -> Option<Items> {
        if node.disabled {
            return None;
        }
        if self.start_ids.contains(&node.id) {
            return Some(self.input.clone());
        }

        let mut incoming = Items::new();
        let mut has_upstream = false;
        for c in workflow.connections_to(&node.id) {
            has_upstream = true;
            if let Some(items) = self.bus.get(&(c.from.clone(), c.port.clone())) {
                incoming.extend(items.iter().cloned());
            }
        }

        // A dead branch (the untaken side of an If) starves its successors.
        if !has_upstream || incoming.is_empty() {
            return None;
        }
        Some(incoming)
    }

    fn accept(&mut self, node: &Node, output: NodeOutput, ms: u64, tries: u32) {
        if let Some(main) = output.get(MAIN_PORT) {
            if !main.is_empty() {
                self.last.clone_from(main);
            }
            self.expression.set_node_output(node.label(), main);
        }
        for (port, items) in &output {
            self.bus
                .insert((node.id.clone(), port.clone()), items.clone());
        }
        self.runs
            .push(run_data(node, NodeRunStatus::Ok, ms, tries, output, None));
    }

    fn reject(
        &mut self,
        node: &Node,
        message: &str,
        ms: u64,
        tries: u32,
    ) -> std::ops::ControlFlow<()> {
        let carry_on = node.continues_on_fail();
        let error_items = vec![json!({ "error": message, "node": node.label() })];

        let output = if carry_on {
            self.bus.insert(
                (node.id.clone(), MAIN_PORT.to_string()),
                error_items.clone(),
            );
            self.last.clone_from(&error_items);
            NodeOutput::from([(MAIN_PORT.to_string(), error_items)])
        } else {
            NodeOutput::new()
        };

        self.runs.push(run_data(
            node,
            NodeRunStatus::Error,
            ms,
            tries,
            output,
            Some(message.to_string()),
        ));

        if carry_on {
            std::ops::ControlFlow::Continue(())
        } else {
            self.error = Some(format!("{}: {message}", node.label()));
            std::ops::ControlFlow::Break(())
        }
    }

    /// End the run as waiting, recording where and why.
    fn suspend(&mut self, node: &Node, suspension: Suspension, ms: u64, tries: u32) {
        self.runs.push(run_data(
            node,
            NodeRunStatus::Ok,
            ms,
            tries,
            NodeOutput::new(),
            None,
        ));
        self.suspended = Some(SuspendedAt {
            node_id: node.id.clone(),
            node_name: node.label().to_owned(),
            suspension,
        });
    }

    fn finish(self) -> RunResult {
        let status = match (&self.error, &self.suspended) {
            (Some(_), _) => ExecutionStatus::Error,
            // Waiting is neither done nor broken, and calling it either would
            // mislead whoever looks at the history.
            (None, Some(_)) => ExecutionStatus::Waiting,
            (None, None) => ExecutionStatus::Success,
        };

        // Only a successful run's staged values travel out. A failed run
        // leaving its watermark alone is what makes the next one cover the same
        // ground rather than skip it.
        let remembered = match status {
            ExecutionStatus::Success => Some(self.staged.peek()),
            _ => None,
        };

        RunResult {
            status,
            error: self.error,
            runs: self.runs,
            last: self.last,
            suspended: self.suspended.and_then(|at| serde_json::to_value(at).ok()),
            remembered,
        }
    }
}

/// A short, safe rendering of items for the log: enough to see the shape,
/// capped so one large payload cannot flood the console.
fn preview(items: &Items) -> String {
    const MAX_CHARS: usize = 2000;

    let rendered = serde_json::to_string(items).unwrap_or_else(|_| "<unserialisable>".to_owned());
    if rendered.chars().count() <= MAX_CHARS {
        return rendered;
    }
    let head: String = rendered.chars().take(MAX_CHARS).collect();
    format!("{head}… ({} items, truncated)", items.len())
}

/// End the run here, waiting.
#[allow(clippy::cognitive_complexity)] // tracing macro expansion
fn suspend(
    state: &mut RunState,
    node: &Node,
    suspension: Suspension,
    ms: u64,
    tries: u32,
) -> std::ops::ControlFlow<()> {
    tracing::info!(node = node.label(), reason = %suspension.reason, "run suspended");
    state.suspend(node, suspension, ms, tries);
    std::ops::ControlFlow::Break(())
}

/// What a node produced, at the two levels of detail worth having.
// `tracing`'s macros expand into a good deal of branching, which the
// cognitive-complexity lint counts as if it were written by hand. These two
// functions are a straight line of logging statements.
#[allow(clippy::cognitive_complexity)]
fn log_node_ok(node: &Node, output: &NodeOutput, ms: u64, tries: u32) {
    tracing::info!(
        node = node.label(),
        kind = %node.kind,
        items_out = output.get(MAIN_PORT).map_or(0, Vec::len),
        ports = output.len(),
        ms,
        tries,
        "node ok"
    );

    for (port, items) in output {
        tracing::trace!(
            node = node.label(),
            %port,
            count = items.len(),
            output = %preview(items),
            "node output"
        );
    }
}

/// The closing line of an execution.
#[allow(clippy::cognitive_complexity)]
fn log_outcome(workflow: &Workflow, result: &RunResult, elapsed: std::time::Duration) {
    let ms = u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX);

    if let Some(error) = &result.error {
        tracing::error!(workflow = %workflow.name, ms, %error, "execution failed");
        return;
    }

    let ran = result
        .runs
        .iter()
        .filter(|run| run.status != NodeRunStatus::Skipped)
        .count();
    tracing::info!(
        workflow = %workflow.name,
        ms,
        nodes_run = ran,
        items_out = result.last.len(),
        "execution finished"
    );
}

fn run_data(
    node: &Node,
    status: NodeRunStatus,
    ms: u64,
    tries: u32,
    output: NodeOutput,
    error: Option<String>,
) -> NodeRunData {
    NodeRunData {
        node_id: node.id.clone(),
        name: node.name.clone(),
        kind: node.kind.clone(),
        status,
        ms,
        tries,
        output,
        error,
    }
}

fn aborted(message: &str) -> RunResult {
    RunResult {
        status: ExecutionStatus::Error,
        error: Some(message.to_string()),
        runs: Vec::new(),
        last: Items::new(),
        suspended: None,
        remembered: None,
    }
}
