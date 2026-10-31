//! Shared harness: build a workflow from a node list and run it for real.

// Each test binary compiles this module separately and uses a different
// slice of it, so unused-helper warnings here are noise, not signal.
#![allow(
    dead_code,
    unreachable_pub,
    clippy::needless_pass_by_value,
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use r8r_core::WorkflowExecute;
use r8r_workflow::Workflow;
use r8r_workflow::interfaces::{
    Connection, ExecutionMode, ExecutionStatus, Items, Node, NodeRunData, RunResult,
};
use serde_json::{Value, json};
use std::sync::Arc;

/// A node as tests like to declare it: id, type, parameters.
pub fn node(id: &str, kind: &str, parameters: Value) -> Node {
    serde_json::from_value(json!({
        "id": id, "type": kind, "name": id, "parameters": parameters
    }))
    .expect("test node should deserialize")
}

pub fn edge(from: &str, to: &str) -> Connection {
    Connection {
        from: from.into(),
        to: to.into(),
        port: "main".into(),
    }
}

pub fn port_edge(from: &str, to: &str, port: &str) -> Connection {
    Connection {
        from: from.into(),
        to: to.into(),
        port: port.into(),
    }
}

/// Chain the given nodes in order behind a manual trigger and execute them.
pub async fn run_chain(nodes: Vec<Node>, input: Items) -> RunResult {
    let mut all = vec![node("trigger", "manual", json!({}))];
    let mut connections = Vec::new();
    let mut previous = "trigger".to_string();
    for n in nodes {
        connections.push(edge(&previous, &n.id));
        previous.clone_from(&n.id);
        all.push(n);
    }
    run_workflow(
        Workflow {
            nodes: all,
            connections,
            ..Default::default()
        },
        input,
    )
    .await
}

pub async fn run_workflow(workflow: Workflow, input: Items) -> RunResult {
    let registry = Arc::new(r8r_nodes_base::registry());
    WorkflowExecute::new(registry)
        .expect("engine should build")
        .run(&workflow, None, input, ExecutionMode::Manual)
        .await
}

/// Run a chain with somewhere to put files, so a test can see what a node
/// offloaded rather than only what it kept.
pub async fn run_chain_with(
    nodes: Vec<Node>,
    input: Items,
    binaries: Arc<dyn r8r_core::BinaryStore>,
) -> RunResult {
    let mut all = vec![node("trigger", "manual", json!({}))];
    let mut connections = Vec::new();
    let mut previous = "trigger".to_string();
    for n in nodes {
        connections.push(edge(&previous, &n.id));
        previous.clone_from(&n.id);
        all.push(n);
    }

    let registry = Arc::new(r8r_nodes_base::registry());
    WorkflowExecute::new(registry)
        .expect("engine should build")
        .with_binaries(binaries)
        .for_execution("test-run")
        .run(
            &Workflow {
                nodes: all,
                connections,
                ..Default::default()
            },
            None,
            input,
            ExecutionMode::Manual,
        )
        .await
}

/// Assert the run succeeded, and hand back the final items.
pub fn expect_success(result: &RunResult) -> &Items {
    assert_eq!(
        result.status,
        ExecutionStatus::Success,
        "expected success but got: {:?}",
        result.error
    );
    &result.last
}

pub fn expect_failure(result: &RunResult) -> String {
    assert_eq!(
        result.status,
        ExecutionStatus::Error,
        "expected the run to fail"
    );
    result.error.clone().unwrap_or_default()
}

pub fn run_of<'a>(result: &'a RunResult, node_id: &str) -> &'a NodeRunData {
    result
        .runs
        .iter()
        .find(|run| run.node_id == node_id)
        .unwrap_or_else(|| panic!("no run recorded for `{node_id}`"))
}

/// Items a node emitted on a named port.
pub fn output_on<'a>(result: &'a RunResult, node_id: &str, port: &str) -> &'a Items {
    run_of(result, node_id)
        .output
        .get(port)
        .unwrap_or_else(|| panic!("`{node_id}` produced nothing on port `{port}`"))
}
