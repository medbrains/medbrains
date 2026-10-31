//! When a workflow fails, the failure has to reach somebody.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use serde_json::{Value, json};
use support::TestServer;

/// A workflow that always fails: the endpoint is never listening.
fn doomed(name: &str, error_workflow_id: Option<&str>) -> Value {
    json!({
        "name": name,
        "settings": { "errorWorkflowId": error_workflow_id },
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "call", "type": "httpRequest", "name": "Call vendor",
              "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "call", "port": "main" }]
    })
}

/// A workflow that records whatever it was handed.
fn recorder(name: &str) -> Value {
    json!({
        "name": name,
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "record", "type": "set", "name": "Record",
              "parameters": {
                  "mode": "fields",
                  "keepOnlySet": true,
                  "fields": {
                      "alertedFor": "{{ item.error.workflowName }}",
                      "failedNode": "{{ item.error.node }}",
                      "reason": "{{ item.error.message }}"
                  }
              },
              "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "record", "port": "main" }]
    })
}

#[tokio::test]
async fn a_failed_run_starts_the_error_workflow_with_the_failure_details() {
    let server = TestServer::start();
    let handler_id = server.create(recorder("On failure")).await;
    let failing_id = server
        .create(doomed("Nightly sync", Some(&handler_id)))
        .await;

    server
        .post(&format!("/rest/workflows/{failing_id}/run"), json!({}))
        .await
        .expect_ok();

    let executions = server.get("/rest/executions").await.expect_ok();
    let executions = executions.as_array().unwrap();

    // Two runs: the one that failed, and the notification it triggered.
    assert_eq!(executions.len(), 2);

    let notification = executions
        .iter()
        .find(|execution| execution["workflowName"] == json!("On failure"))
        .expect("the error workflow should have run");
    assert_eq!(notification["status"], json!("success"));
    assert_eq!(notification["mode"], json!("trigger"));

    let id = notification["id"].as_str().unwrap().to_owned();
    let detail = server
        .get(&format!("/rest/executions/{id}"))
        .await
        .expect_ok();
    let recorded = &detail["data"]["last"][0];

    assert_eq!(recorded["alertedFor"], json!("Nightly sync"));
    assert_eq!(recorded["failedNode"], json!("Call vendor"));
    assert!(
        recorded["reason"].as_str().unwrap().contains("127.0.0.1:1"),
        "the notification should say what actually broke: {recorded}"
    );
}

#[tokio::test]
async fn a_workflow_without_an_error_workflow_simply_fails() {
    let server = TestServer::start();
    let id = server.create(doomed("Unwatched", None)).await;

    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    let executions = server.get("/rest/executions").await.expect_ok();
    assert_eq!(
        executions.as_array().unwrap().len(),
        1,
        "nothing extra should run"
    );
}

#[tokio::test]
async fn a_successful_run_notifies_nobody() {
    let server = TestServer::start();
    let handler_id = server.create(recorder("On failure")).await;
    let fine = server
        .create(json!({
            "name": "Healthy",
            "settings": { "errorWorkflowId": handler_id },
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0,0] }
            ],
            "connections": []
        }))
        .await;

    server
        .post(&format!("/rest/workflows/{fine}/run"), json!({}))
        .await
        .expect_ok();

    let executions = server.get("/rest/executions").await.expect_ok();
    assert_eq!(executions.as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn a_workflow_pointing_at_itself_does_not_loop() {
    // Left unchecked this would fail, notify itself, fail again, forever.
    let server = TestServer::start();
    let id = server.create(doomed("Self referential", None)).await;

    let mut updated = doomed("Self referential", Some(&id));
    updated["id"] = json!(id);
    server
        .patch(&format!("/rest/workflows/{id}"), updated)
        .await
        .expect_ok();

    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    let executions = server.get("/rest/executions").await.expect_ok();
    assert_eq!(
        executions.as_array().unwrap().len(),
        1,
        "it must not re-trigger itself"
    );
}

#[tokio::test]
async fn an_error_workflow_that_was_deleted_does_not_break_the_original_run() {
    let server = TestServer::start();
    let handler_id = server.create(recorder("On failure")).await;
    let failing_id = server
        .create(doomed("Nightly sync", Some(&handler_id)))
        .await;

    server
        .delete(&format!("/rest/workflows/{handler_id}"))
        .await
        .expect_ok();

    // The run still completes and is still recorded as failed.
    let run = server
        .post(&format!("/rest/workflows/{failing_id}/run"), json!({}))
        .await
        .expect_ok();
    assert_eq!(run["result"]["status"], json!("error"));
}

#[tokio::test]
async fn a_failing_webhook_also_notifies() {
    let server = TestServer::start();
    let handler_id = server.create(recorder("On failure")).await;

    let hook_id = server
        .create(json!({
            "name": "Inbound",
            "settings": { "errorWorkflowId": handler_id },
            "nodes": [
                { "id": "hook", "type": "webhook", "name": "Hook",
                  "parameters": { "path": "broken", "method": "POST" }, "position": [0,0] },
                { "id": "call", "type": "httpRequest", "name": "Call vendor",
                  "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [200,0] }
            ],
            "connections": [{ "from": "hook", "to": "call", "port": "main" }]
        }))
        .await;
    server
        .patch(
            &format!("/rest/workflows/{hook_id}/activate"),
            json!({ "active": true }),
        )
        .await
        .expect_ok();

    server
        .webhook(axum::http::Method::POST, "broken", &[], json!({}))
        .await;

    let executions = server.get("/rest/executions").await.expect_ok();
    let names: Vec<&str> = executions
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|e| e["workflowName"].as_str())
        .collect();

    assert!(
        names.contains(&"On failure"),
        "a failing webhook should notify too: {names:?}"
    );
}
