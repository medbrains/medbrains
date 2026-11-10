//! Runs that never finished.
//!
//! A workflow interrupted by a restart used to leave nothing behind — no row,
//! no error, no trace. These tests pin the opposite: an unfinished run is
//! visible, says what happened to it, and can be run again.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use axum::http::StatusCode;
use serde_json::{Value, json};
use support::TestServer;

fn echoing_workflow() -> Value {
    json!({
        "name": "Book result",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "book", "type": "set", "name": "Book",
              "parameters": {
                  "mode": "fields",
                  "keepOnlySet": true,
                  "fields": { "booked": "{{ item.resultId }}" }
              },
              "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "book", "port": "main" }]
    })
}

#[tokio::test]
async fn a_finished_run_records_what_it_was_given_and_what_it_produced() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;

    let run = server
        .post(
            &format!("/rest/workflows/{id}/run"),
            json!({ "input": [{ "resultId": "R-1" }] }),
        )
        .await
        .expect_ok();

    assert_eq!(run["result"]["last"][0]["booked"], json!("R-1"));

    let execution_id = run["executionId"].as_str().unwrap().to_owned();
    let stored = server
        .get(&format!("/rest/executions/{execution_id}"))
        .await
        .expect_ok();
    assert_eq!(stored["status"], json!("success"));
    assert!(
        stored["finishedAt"].is_string(),
        "a finished run has a finish time"
    );
}

#[tokio::test]
async fn a_run_is_recorded_the_moment_it_starts() {
    // The property everything else rests on: if the process died here, there
    // would still be a row saying a run was in flight.
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    let started = server.raw_column("SELECT started_at FROM execution_entity");
    assert_eq!(started.len(), 1);
    assert!(!started[0].is_empty(), "the start time is written up front");
}

#[tokio::test]
async fn an_interrupted_run_is_closed_out_when_r8r_next_starts() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    // Stand in for a crash: put the row back the way it looked mid-run.
    server.execute_sql(
        "UPDATE execution_entity SET status = 'running', finished_at = NULL, error = NULL",
    );

    let restarted = server.restart();

    let executions = restarted.get("/rest/executions").await.expect_ok();
    let execution = &executions.as_array().unwrap()[0];

    assert_eq!(execution["status"], json!("error"));
    assert!(
        execution["error"].as_str().unwrap().contains("interrupted"),
        "it should say the process stopped, not imply a bug in the workflow: {execution}"
    );
}

#[tokio::test]
async fn a_healthy_run_is_not_disturbed_by_a_restart() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    let restarted = server.restart();

    let executions = restarted.get("/rest/executions").await.expect_ok();
    assert_eq!(
        executions.as_array().unwrap()[0]["status"],
        json!("success")
    );
}

#[tokio::test]
async fn an_interrupted_run_can_be_retried_with_the_items_it_started_with() {
    // The point of storing the trigger input: a retry has to be the same work,
    // not a fresh empty run.
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;

    let first = server
        .post(
            &format!("/rest/workflows/{id}/run"),
            json!({ "input": [{ "resultId": "R-7" }] }),
        )
        .await
        .expect_ok();
    let execution_id = first["executionId"].as_str().unwrap().to_owned();

    let retried = server
        .post(&format!("/rest/executions/{execution_id}/retry"), json!({}))
        .await
        .expect_ok();

    assert_eq!(retried["retryOf"], json!(execution_id));
    assert_eq!(
        retried["result"]["last"][0]["booked"],
        json!("R-7"),
        "the retry must see the original items"
    );
    assert_ne!(
        retried["executionId"],
        json!(execution_id),
        "a retry is its own run"
    );
}

#[tokio::test]
async fn a_retry_is_recorded_as_a_retry() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    let first = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    let execution_id = first["executionId"].as_str().unwrap().to_owned();

    server
        .post(&format!("/rest/executions/{execution_id}/retry"), json!({}))
        .await
        .expect_ok();

    let executions = server.get("/rest/executions").await.expect_ok();
    let modes: Vec<&str> = executions
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|e| e["mode"].as_str())
        .collect();
    assert!(
        modes.contains(&"retry"),
        "the mode says how the run was started: {modes:?}"
    );
}

#[tokio::test]
async fn retrying_something_that_does_not_exist_is_a_clean_404() {
    let server = TestServer::start();
    server
        .post("/rest/executions/does-not-exist/retry", json!({}))
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn a_run_whose_workflow_was_deleted_cannot_be_retried() {
    let server = TestServer::start();
    let id = server.create(echoing_workflow()).await;
    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    server
        .delete(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();

    // Deleting a workflow takes its history too, so the run is gone as well —
    // either answer is a 404, and neither is a crash.
    let response = server
        .post(&format!("/rest/executions/{execution_id}/retry"), json!({}))
        .await;
    assert_eq!(response.status, StatusCode::NOT_FOUND);
}
