//! One workflow calling another.
//!
//! The point is reuse: the steps that look up a patient and normalise the
//! result live once, and everything that needs them calls it. These tests pin
//! that the call works, that its failures are not swallowed, and that a
//! workflow which would run forever is refused by name.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use serde_json::{Value, json};
use support::TestServer;

/// Doubles whatever it is given — a stand-in for shared work.
fn doubler(name: &str) -> Value {
    json!({
        "name": name,
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "double", "type": "set", "name": "Double",
              "parameters": {
                  "mode": "fields",
                  "keepOnlySet": true,
                  "fields": { "value": "{{ item.value * 2 }}" }
              },
              "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "double", "port": "main" }]
    })
}

/// Calls another workflow and passes its result along.
fn caller(name: &str, target: &str, mode: &str) -> Value {
    json!({
        "name": name,
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "call", "type": "executeWorkflow", "name": "Shared step",
              "parameters": { "workflowId": target, "mode": mode }, "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "call", "port": "main" }]
    })
}

async fn run(server: &TestServer, id: &str, input: Value) -> Value {
    server
        .post(
            &format!("/rest/workflows/{id}/run"),
            json!({ "input": input }),
        )
        .await
        .expect_ok()
}

// ================================================================= calling

#[tokio::test]
async fn a_workflow_continues_with_what_the_one_it_called_produced() {
    let server = TestServer::start();
    let shared = server.create(doubler("Shared")).await;
    let main = server.create(caller("Main", &shared, "onceWithAll")).await;

    let result = run(&server, &main, json!([{ "value": 21 }])).await;

    assert_eq!(result["result"]["status"], json!("success"));
    assert_eq!(result["result"]["last"][0]["value"], json!(42));
}

#[tokio::test]
async fn every_item_reaches_the_workflow_that_was_called() {
    let server = TestServer::start();
    let shared = server.create(doubler("Shared")).await;
    let main = server.create(caller("Main", &shared, "onceWithAll")).await;

    let result = run(
        &server,
        &main,
        json!([{ "value": 1 }, { "value": 2 }, { "value": 3 }]),
    )
    .await;

    let out = result["result"]["last"].as_array().unwrap();
    assert_eq!(out.len(), 3);
    assert_eq!(out[2]["value"], json!(6));
}

#[tokio::test]
async fn calling_once_per_item_makes_one_run_each() {
    // Right when the shared workflow acts on a single record; costly when it
    // does not — which is why it is a choice rather than the default.
    let server = TestServer::start();
    let shared = server.create(doubler("Shared")).await;
    let main = server.create(caller("Main", &shared, "oncePerItem")).await;

    run(&server, &main, json!([{ "value": 1 }, { "value": 2 }])).await;

    let executions = server.get("/rest/executions").await.expect_ok();
    let shared_runs = executions
        .as_array()
        .unwrap()
        .iter()
        .filter(|e| e["workflowName"] == json!("Shared"))
        .count();

    assert_eq!(shared_runs, 2, "one run of the shared workflow per item");
}

#[tokio::test]
async fn a_workflow_that_was_called_is_recorded_as_its_own_run() {
    // A sub-workflow that failed at three in the morning should be findable on
    // its own, not only as a line inside its caller's history.
    let server = TestServer::start();
    let shared = server.create(doubler("Shared")).await;
    let main = server.create(caller("Main", &shared, "onceWithAll")).await;

    run(&server, &main, json!([{ "value": 1 }])).await;

    let executions = server.get("/rest/executions").await.expect_ok();
    let names: Vec<&str> = executions
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|e| e["workflowName"].as_str())
        .collect();

    assert!(names.contains(&"Main"));
    assert!(names.contains(&"Shared"));
}

#[tokio::test]
async fn workflows_nest_more_than_one_level() {
    let server = TestServer::start();
    let inner = server.create(doubler("Inner")).await;
    let middle = server.create(caller("Middle", &inner, "onceWithAll")).await;
    let outer = server.create(caller("Outer", &middle, "onceWithAll")).await;

    let result = run(&server, &outer, json!([{ "value": 5 }])).await;
    assert_eq!(result["result"]["last"][0]["value"], json!(10));
}

// ================================================================ failures

#[tokio::test]
async fn a_failure_inside_the_called_workflow_fails_the_caller() {
    // Swallowing it would let the caller carry on with nothing and still look
    // successful, which is the worst of both.
    let server = TestServer::start();
    let broken = server
        .create(json!({
            "name": "Broken",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0,0] },
                { "id": "call", "type": "httpRequest", "name": "Vendor",
                  "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [200,0] }
            ],
            "connections": [{ "from": "t", "to": "call", "port": "main" }]
        }))
        .await;
    let main = server.create(caller("Main", &broken, "onceWithAll")).await;

    let result = run(&server, &main, json!([{}])).await;

    assert_eq!(result["result"]["status"], json!("error"));
    let error = result["result"]["error"].as_str().unwrap();
    assert!(
        error.contains("Broken"),
        "name the workflow that failed: {error}"
    );
}

#[tokio::test]
async fn calling_a_workflow_that_no_longer_exists_says_so() {
    let server = TestServer::start();
    let main = server
        .create(caller("Main", "does-not-exist", "onceWithAll"))
        .await;

    let result = run(&server, &main, json!([{}])).await;

    assert_eq!(result["result"]["status"], json!("error"));
    assert!(
        result["result"]["error"]
            .as_str()
            .unwrap()
            .contains("no longer exists")
    );
}

// =================================================================== loops

#[tokio::test]
async fn a_workflow_that_calls_itself_is_refused_by_name() {
    let server = TestServer::start();
    let id = server
        .create(caller("Recursive", "placeholder", "onceWithAll"))
        .await;

    // Point it at itself now that it has an id.
    let mut itself = caller("Recursive", &id, "onceWithAll");
    itself["id"] = json!(id);
    server
        .patch(&format!("/rest/workflows/{id}"), itself)
        .await
        .expect_ok();

    let result = run(&server, &id, json!([{}])).await;

    assert_eq!(result["result"]["status"], json!("error"));
    let error = result["result"]["error"].as_str().unwrap();
    assert!(error.contains("run forever"), "got: {error}");
    assert!(
        error.contains(&id),
        "the message should name the workflow: {error}"
    );
}

#[tokio::test]
async fn two_workflows_calling_each_other_are_refused() {
    let server = TestServer::start();
    let a = server
        .create(caller("A", "placeholder", "onceWithAll"))
        .await;
    let b = server.create(caller("B", &a, "onceWithAll")).await;

    let mut points_at_b = caller("A", &b, "onceWithAll");
    points_at_b["id"] = json!(a);
    server
        .patch(&format!("/rest/workflows/{a}"), points_at_b)
        .await
        .expect_ok();

    let result = run(&server, &a, json!([{}])).await;

    assert_eq!(result["result"]["status"], json!("error"));
    assert!(
        result["result"]["error"]
            .as_str()
            .unwrap()
            .contains("run forever")
    );
}

#[tokio::test]
async fn a_loop_does_not_run_away_before_it_is_caught() {
    // The refusal happens before anything runs, so a cycle costs two
    // executions rather than however many a stack can hold.
    let server = TestServer::start();
    let id = server
        .create(caller("Recursive", "placeholder", "onceWithAll"))
        .await;
    let mut itself = caller("Recursive", &id, "onceWithAll");
    itself["id"] = json!(id);
    server
        .patch(&format!("/rest/workflows/{id}"), itself)
        .await
        .expect_ok();

    run(&server, &id, json!([{}])).await;

    let executions = server.get("/rest/executions").await.expect_ok();
    assert!(
        executions.as_array().unwrap().len() <= 3,
        "a cycle should be caught almost immediately, not unwound"
    );
}
