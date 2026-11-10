//! Behaviour of the DAG executor, exercised through a stub node so these tests
//! stay independent of what `r8r-nodes-base` happens to implement.

// Integration tests live in their own crate, where clippy's in-test allowances
// do not reach. A panic here is the failure report, which is the point.
#![allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::needless_pass_by_value
)]

use async_trait::async_trait;
use r8r_core::execute_context::main_output;
use r8r_core::{
    ExecuteContext, NodeExecutor, NodeOutcome, NodeOutput, NodeRegistry, Result, WorkflowExecute,
};
use r8r_workflow::Workflow;
use r8r_workflow::interfaces::{
    Connection, ExecutionMode, ExecutionStatus, Items, Node, NodeGroup, NodeRunStatus,
    NodeTypeDescription, RunResult,
};
use serde_json::{Value, json};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

// ------------------------------------------------------------- stub nodes

fn describe(name: &str, group: NodeGroup, outputs: &[&str]) -> NodeTypeDescription {
    NodeTypeDescription {
        name: name.into(),
        display_name: name.into(),
        group,
        description: String::new(),
        icon: "*".into(),
        color: "#fff".into(),
        properties: vec![],
        outputs: outputs.iter().map(|s| (*s).to_string()).collect(),
        inputs: vec!["main".into()],
        ..NodeTypeDescription::default()
    }
}

/// Trigger that passes its input straight through.
struct Start;

#[async_trait]
impl NodeExecutor for Start {
    fn description(&self) -> NodeTypeDescription {
        describe("start", NodeGroup::Trigger, &["main"])
    }
    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        Ok(main_output(ctx.input.clone()).into())
    }
}

/// Tags every item with the node's name, so ordering is observable.
struct Tag;

#[async_trait]
impl NodeExecutor for Tag {
    fn description(&self) -> NodeTypeDescription {
        describe("tag", NodeGroup::Transform, &["main"])
    }
    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let items = ctx
            .input
            .iter()
            .map(|item| {
                let mut object = item.as_object().cloned().unwrap_or_default();
                let trail = object
                    .get("trail")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                object.insert(
                    "trail".into(),
                    json!(format!("{trail}{}", ctx.node.label())),
                );
                Value::Object(object)
            })
            .collect();
        Ok(main_output(items).into())
    }
}

/// Sends everything to whichever port its `port` parameter names, leaving the
/// other port empty — the shape that makes downstream nodes starve.
struct Router;

#[async_trait]
impl NodeExecutor for Router {
    fn description(&self) -> NodeTypeDescription {
        describe("router", NodeGroup::Flow, &["main", "false"])
    }
    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let port = ctx.str_param(&ctx.node.parameters, "port", "main");
        Ok(NodeOutcome::Output(NodeOutput::from([
            (port.clone(), ctx.input.clone()),
            (
                if port == "main" {
                    "false".to_string()
                } else {
                    "main".to_string()
                },
                vec![],
            ),
        ])))
    }
}

/// Fails its first `failTimes` attempts, then succeeds. Attempts are counted
/// across the whole registry instance so retries are observable.
struct Flaky {
    attempts: Arc<AtomicUsize>,
}

#[async_trait]
impl NodeExecutor for Flaky {
    fn description(&self) -> NodeTypeDescription {
        describe("flaky", NodeGroup::Transform, &["main"])
    }
    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let attempt = self.attempts.fetch_add(1, Ordering::SeqCst);
        let fail_times = ctx
            .num_param(&ctx.node.parameters, "failTimes", 0.0)
            .max(0.0) as usize;
        if attempt < fail_times {
            return Err("still warming up".into());
        }
        Ok(main_output(ctx.input.clone()).into())
    }
}

// -------------------------------------------------------------- fixtures

fn node(id: &str, kind: &str, parameters: Value) -> Node {
    serde_json::from_value(json!({
        "id": id, "type": kind, "name": id, "parameters": parameters
    }))
    .expect("valid node")
}

fn edge(from: &str, to: &str, port: &str) -> Connection {
    Connection {
        from: from.into(),
        to: to.into(),
        port: port.into(),
    }
}

fn engine(attempts: Arc<AtomicUsize>) -> WorkflowExecute {
    let mut registry = NodeRegistry::new();
    registry
        .register(Start)
        .register(Tag)
        .register(Router)
        .register(Flaky { attempts });
    WorkflowExecute::new(Arc::new(registry)).expect("engine builds")
}

async fn run(workflow: &Workflow) -> RunResult {
    engine(Arc::new(AtomicUsize::new(0)))
        .run(workflow, None, vec![json!({})], ExecutionMode::Manual)
        .await
}

fn status_of<'a>(result: &'a RunResult, node_id: &str) -> &'a r8r_workflow::NodeRunData {
    result
        .runs
        .iter()
        .find(|run| run.node_id == node_id)
        .unwrap_or_else(|| panic!("no run recorded for `{node_id}`"))
}

// ----------------------------------------------------------------- tests

#[tokio::test]
async fn runs_nodes_in_dependency_order() {
    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            node("a", "tag", json!({})),
            node("b", "tag", json!({})),
        ],
        connections: vec![edge("s", "a", "main"), edge("a", "b", "main")],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(result.status, ExecutionStatus::Success);
    assert_eq!(result.last, vec![json!({ "trail": "ab" })]);
}

#[tokio::test]
async fn a_join_node_receives_both_branches() {
    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            node("a", "tag", json!({})),
            node("b", "tag", json!({})),
            node("j", "tag", json!({})),
        ],
        connections: vec![
            edge("s", "a", "main"),
            edge("s", "b", "main"),
            edge("a", "j", "main"),
            edge("b", "j", "main"),
        ],
        ..Default::default()
    };

    let result = run(&workflow).await;

    let joined = &status_of(&result, "j").output["main"];
    assert_eq!(joined.len(), 2, "both branches should reach the join");
}

#[tokio::test]
async fn nodes_on_an_empty_branch_are_skipped_not_failed() {
    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            node("r", "router", json!({ "port": "main" })),
            node("taken", "tag", json!({})),
            node("dead", "tag", json!({})),
        ],
        connections: vec![
            edge("s", "r", "main"),
            edge("r", "taken", "main"),
            edge("r", "dead", "false"),
        ],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(result.status, ExecutionStatus::Success);
    assert_eq!(status_of(&result, "taken").status, NodeRunStatus::Ok);
    assert_eq!(status_of(&result, "dead").status, NodeRunStatus::Skipped);
}

#[tokio::test]
async fn a_failing_node_stops_the_run_by_default() {
    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            node("f", "flaky", json!({ "failTimes": 99 })),
            node("after", "tag", json!({})),
        ],
        connections: vec![edge("s", "f", "main"), edge("f", "after", "main")],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(result.status, ExecutionStatus::Error);
    assert!(result.error.unwrap().contains("still warming up"));
    assert!(
        result.runs.iter().all(|run| run.node_id != "after"),
        "downstream nodes must not run after an unhandled failure"
    );
}

#[tokio::test]
async fn continue_on_error_passes_an_error_item_downstream() {
    let mut failing = node("f", "flaky", json!({ "failTimes": 99 }));
    failing.on_error = Some(r8r_workflow::OnError::Continue);

    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            failing,
            node("after", "tag", json!({})),
        ],
        connections: vec![edge("s", "f", "main"), edge("f", "after", "main")],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(result.status, ExecutionStatus::Success);
    assert_eq!(status_of(&result, "after").status, NodeRunStatus::Ok);
    let items = &status_of(&result, "after").output["main"];
    assert!(
        items[0]["error"]
            .as_str()
            .unwrap()
            .contains("still warming up")
    );
}

#[tokio::test]
async fn retry_on_fail_tries_again_before_giving_up() {
    let mut flaky = node("f", "flaky", json!({ "failTimes": 2 }));
    flaky.retry_on_fail = true;
    flaky.max_tries = Some(3);
    flaky.wait_between_tries_ms = Some(0);

    let workflow = Workflow {
        nodes: vec![node("s", "start", json!({})), flaky],
        connections: vec![edge("s", "f", "main")],
        ..Default::default()
    };

    let attempts = Arc::new(AtomicUsize::new(0));
    let result = engine(attempts.clone())
        .run(&workflow, None, vec![json!({})], ExecutionMode::Manual)
        .await;

    assert_eq!(result.status, ExecutionStatus::Success);
    assert_eq!(status_of(&result, "f").tries, 3);
    assert_eq!(attempts.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn a_disabled_node_is_skipped_and_starves_the_rest() {
    let mut disabled = node("a", "tag", json!({}));
    disabled.disabled = true;

    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            disabled,
            node("b", "tag", json!({})),
        ],
        connections: vec![edge("s", "a", "main"), edge("a", "b", "main")],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(status_of(&result, "a").status, NodeRunStatus::Skipped);
    assert_eq!(status_of(&result, "b").status, NodeRunStatus::Skipped);
}

#[tokio::test]
async fn an_unregistered_node_type_is_reported_clearly() {
    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            node("x", "doesNotExist", json!({})),
        ],
        connections: vec![edge("s", "x", "main")],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(result.status, ExecutionStatus::Error);
    assert!(result.error.unwrap().contains("doesNotExist"));
}

#[tokio::test]
async fn a_workflow_without_a_trigger_refuses_to_start() {
    let workflow = Workflow {
        nodes: vec![node("a", "tag", json!({}))],
        connections: vec![],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(result.status, ExecutionStatus::Error);
    assert!(result.error.unwrap().contains("trigger"));
}

#[tokio::test]
async fn a_cycle_is_rejected_before_anything_runs() {
    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            node("a", "tag", json!({})),
            node("b", "tag", json!({})),
        ],
        connections: vec![
            edge("s", "a", "main"),
            edge("a", "b", "main"),
            edge("b", "a", "main"),
        ],
        ..Default::default()
    };

    let result = run(&workflow).await;

    assert_eq!(result.status, ExecutionStatus::Error);
    assert!(result.error.unwrap().contains("cycle"));
    assert!(result.runs.is_empty());
}

#[tokio::test]
async fn expressions_can_read_an_earlier_nodes_output() {
    // `nodes["a"]` is populated as soon as node `a` finishes.
    let mut consumer = node("b", "tag", json!({}));
    consumer.parameters = json!({ "unused": "{{ nodes[\"a\"][0].trail }}" });

    let workflow = Workflow {
        nodes: vec![
            node("s", "start", json!({})),
            node("a", "tag", json!({})),
            consumer,
        ],
        connections: vec![edge("s", "a", "main"), edge("a", "b", "main")],
        ..Default::default()
    };

    let result = run(&workflow).await;
    assert_eq!(result.status, ExecutionStatus::Success);
}

#[tokio::test]
async fn items_flowing_in_are_the_ones_handed_to_the_trigger() {
    let workflow = Workflow {
        nodes: vec![node("s", "start", json!({})), node("a", "tag", json!({}))],
        connections: vec![edge("s", "a", "main")],
        ..Default::default()
    };

    let input: Items = vec![json!({ "id": 1 }), json!({ "id": 2 })];
    let result = engine(Arc::new(AtomicUsize::new(0)))
        .run(&workflow, None, input, ExecutionMode::Manual)
        .await;

    assert_eq!(result.last.len(), 2);
    assert_eq!(result.last[0]["id"], json!(1));
}
