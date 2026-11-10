//! What a workflow remembers between runs.
//!
//! The property these exist for: a run that fails leaves the watermark where it
//! was. Advancing it and then failing is how records are skipped — silently,
//! and only noticed when somebody asks why one never synced.

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

/// Reads a watermark, reports what it saw, and moves it on.
fn incremental() -> Value {
    json!({
        "name": "Sync appointments",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "since", "type": "set", "name": "Since",
              "parameters": {
                  "mode": "fields",
                  "keepOnlySet": true,
                  "fields": { "askedFor": "{{ state.lastSync }}" }
              },
              "position": [200, 0] },
            { "id": "save", "type": "remember", "name": "Save watermark",
              "parameters": { "values": { "lastSync": "2026-08-21T10:00:00Z" } },
              "position": [400, 0] }
        ],
        "connections": [
            { "from": "t", "to": "since", "port": "main" },
            { "from": "since", "to": "save", "port": "main" }
        ]
    })
}

/// Moves the watermark on, then fails.
fn fails_after_remembering() -> Value {
    json!({
        "name": "Breaks after saving",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "save", "type": "remember", "name": "Save watermark",
              "parameters": { "values": { "lastSync": "2026-08-21T10:00:00Z" } },
              "position": [200, 0] },
            { "id": "call", "type": "httpRequest", "name": "Vendor",
              "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [400, 0] }
        ],
        "connections": [
            { "from": "t", "to": "save", "port": "main" },
            { "from": "save", "to": "call", "port": "main" }
        ]
    })
}

async fn run(server: &TestServer, id: &str) -> Value {
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok()
}

// ============================================================= remembering

#[tokio::test]
async fn the_first_run_has_nothing_to_go_on() {
    let server = TestServer::start();
    let id = server.create(incremental()).await;

    let result = run(&server, &id).await;

    assert_eq!(result["result"]["status"], json!("success"));
    assert_eq!(
        result["result"]["runs"][1]["output"]["main"][0]["askedFor"],
        Value::Null,
        "with nothing remembered, the watermark is empty rather than an error"
    );
}

#[tokio::test]
async fn the_next_run_sees_what_the_last_one_remembered() {
    // The whole point: the second run asks for what changed, not for everything.
    let server = TestServer::start();
    let id = server.create(incremental()).await;

    run(&server, &id).await;
    let second = run(&server, &id).await;

    assert_eq!(
        second["result"]["runs"][1]["output"]["main"][0]["askedFor"],
        json!("2026-08-21T10:00:00Z")
    );
}

#[tokio::test]
async fn what_a_workflow_remembers_can_be_read_back() {
    let server = TestServer::start();
    let id = server.create(incremental()).await;
    run(&server, &id).await;

    let state = server
        .get(&format!("/rest/workflows/{id}/state"))
        .await
        .expect_ok();
    assert_eq!(state["lastSync"], json!("2026-08-21T10:00:00Z"));
}

#[tokio::test]
async fn a_remembered_value_keeps_its_type() {
    // A cursor that is a number must come back a number, or the next request
    // sends a string and the vendor rejects it.
    let server = TestServer::start();
    let id = server
        .create(json!({
            "name": "Cursor",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0,0] },
                { "id": "save", "type": "remember", "name": "Save",
                  "parameters": { "values": { "page": "{{ 3 + 4 }}", "done": "{{ true }}" } },
                  "position": [200,0] }
            ],
            "connections": [{ "from": "t", "to": "save", "port": "main" }]
        }))
        .await;

    run(&server, &id).await;

    let state = server
        .get(&format!("/rest/workflows/{id}/state"))
        .await
        .expect_ok();
    assert_eq!(state["page"], json!(7));
    assert_eq!(state["done"], json!(true));
}

// ================================================================ failures

#[tokio::test]
async fn a_failed_run_does_not_move_the_watermark() {
    // The failure this guards against: the run advances the watermark, then
    // breaks, and the records between the old and new value are never fetched
    // again by anybody.
    let server = TestServer::start();
    let id = server.create(fails_after_remembering()).await;

    let result = run(&server, &id).await;
    assert_eq!(result["result"]["status"], json!("error"));

    let state = server
        .get(&format!("/rest/workflows/{id}/state"))
        .await
        .expect_ok();
    assert_eq!(
        state.as_object().unwrap().len(),
        0,
        "nothing should have been remembered by a run that failed"
    );
}

#[tokio::test]
async fn a_failed_run_leaves_an_earlier_watermark_untouched() {
    let server = TestServer::start();
    let good = server.create(incremental()).await;
    run(&server, &good).await;

    // A second workflow that fails must not disturb the first's state, and a
    // failing run of any workflow must not disturb its own.
    let bad = server.create(fails_after_remembering()).await;
    run(&server, &bad).await;

    let state = server
        .get(&format!("/rest/workflows/{good}/state"))
        .await
        .expect_ok();
    assert_eq!(state["lastSync"], json!("2026-08-21T10:00:00Z"));
}

#[tokio::test]
async fn each_workflow_remembers_its_own_values() {
    let server = TestServer::start();
    let first = server.create(incremental()).await;
    let second = server.create(incremental()).await;

    run(&server, &first).await;

    let untouched = server
        .get(&format!("/rest/workflows/{second}/state"))
        .await
        .expect_ok();
    assert!(untouched.as_object().unwrap().is_empty());
}

// ================================================================ forgetting

#[tokio::test]
async fn clearing_a_watermark_makes_the_next_run_cover_old_ground() {
    // This is how a backfill is started, without editing the workflow.
    let server = TestServer::start();
    let id = server.create(incremental()).await;
    run(&server, &id).await;

    server
        .delete(&format!("/rest/workflows/{id}/state/lastSync"))
        .await
        .expect_ok();

    let after = run(&server, &id).await;
    assert_eq!(
        after["result"]["runs"][1]["output"]["main"][0]["askedFor"],
        Value::Null,
        "with the watermark cleared, the run starts from the beginning again"
    );
}

#[tokio::test]
async fn everything_a_workflow_remembers_can_be_cleared_at_once() {
    let server = TestServer::start();
    let id = server.create(incremental()).await;
    run(&server, &id).await;

    let cleared = server
        .delete(&format!("/rest/workflows/{id}/state"))
        .await
        .expect_ok();
    assert_eq!(cleared["cleared"], json!(1));

    let state = server
        .get(&format!("/rest/workflows/{id}/state"))
        .await
        .expect_ok();
    assert!(state.as_object().unwrap().is_empty());
}

#[tokio::test]
async fn forgetting_something_never_remembered_is_not_an_error() {
    let server = TestServer::start();
    let id = server.create(incremental()).await;

    let response = server
        .delete(&format!("/rest/workflows/{id}/state/nope"))
        .await
        .expect_ok();
    assert_eq!(response["forgotten"], json!(false));
}

#[tokio::test]
async fn asking_about_a_workflow_that_does_not_exist_is_a_404() {
    // An empty object would read as "it remembers nothing" rather than "there
    // is no such workflow".
    let server = TestServer::start();
    server
        .get("/rest/workflows/does-not-exist/state")
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn deleting_a_workflow_takes_what_it_remembered_with_it() {
    let server = TestServer::start();
    let id = server.create(incremental()).await;
    run(&server, &id).await;

    server
        .delete(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();

    let orphaned = server.raw_column("SELECT key FROM workflow_state");
    assert!(
        orphaned.is_empty(),
        "a recreated workflow must not inherit a stranger's watermark"
    );
}
