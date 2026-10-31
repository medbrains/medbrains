//! Getting a backlog of failures through.
//!
//! When a vendor is down for twenty minutes, everything that fired in that
//! window fails together. These tests pin what happens next: the failures are
//! findable, replayable as a batch, and the same broken work cannot be put
//! through forever.

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

fn healthy() -> Value {
    json!({
        "name": "Healthy",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "s", "type": "set", "name": "Shape",
              "parameters": { "mode": "fields", "fields": { "ok": true } }, "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "s", "port": "main" }]
    })
}

/// Fails every time: the vendor is never listening.
fn failing(name: &str) -> Value {
    json!({
        "name": name,
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "call", "type": "httpRequest", "name": "Call vendor",
              "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "call", "port": "main" }]
    })
}

async fn ids_of(server: &TestServer, query: &str) -> Vec<String> {
    server
        .get(&format!("/rest/executions{query}"))
        .await
        .expect_ok()
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|e| e["id"].as_str().map(str::to_owned))
        .collect()
}

// ============================================================== finding them

#[tokio::test]
async fn failures_can_be_listed_on_their_own() {
    let server = TestServer::start();
    let good = server.create(healthy()).await;
    let bad = server.create(failing("Broken")).await;

    server
        .post(&format!("/rest/workflows/{good}/run"), json!({}))
        .await
        .expect_ok();
    server
        .post(&format!("/rest/workflows/{bad}/run"), json!({}))
        .await
        .expect_ok();
    server
        .post(&format!("/rest/workflows/{bad}/run"), json!({}))
        .await
        .expect_ok();

    assert_eq!(ids_of(&server, "").await.len(), 3, "everything, unfiltered");
    assert_eq!(
        ids_of(&server, "?status=error").await.len(),
        2,
        "only the failures"
    );
    assert_eq!(ids_of(&server, "?status=success").await.len(), 1);
}

#[tokio::test]
async fn failures_can_be_narrowed_to_one_workflow() {
    let server = TestServer::start();
    let first = server.create(failing("First")).await;
    let second = server.create(failing("Second")).await;

    server
        .post(&format!("/rest/workflows/{first}/run"), json!({}))
        .await
        .expect_ok();
    server
        .post(&format!("/rest/workflows/{second}/run"), json!({}))
        .await
        .expect_ok();

    let narrowed = ids_of(&server, &format!("?status=error&workflowId={first}")).await;
    assert_eq!(narrowed.len(), 1);
}

// ============================================================= replaying them

#[tokio::test]
async fn a_batch_of_failures_is_replayed_in_one_call() {
    // The whole point: twenty minutes of failures, one action to put them
    // through — not twenty separate clicks somebody abandons halfway.
    let server = TestServer::start();
    let bad = server.create(failing("Broken")).await;

    for _ in 0..3 {
        server
            .post(&format!("/rest/workflows/{bad}/run"), json!({}))
            .await
            .expect_ok();
    }
    let failures = ids_of(&server, "?status=error").await;

    let outcome = server
        .post(
            "/rest/executions/retry",
            json!({ "executionIds": failures }),
        )
        .await
        .expect_ok();

    assert_eq!(outcome["requested"], json!(3));
    assert_eq!(outcome["retried"], json!(3));
    assert_eq!(outcome["results"].as_array().unwrap().len(), 3);
}

#[tokio::test]
async fn a_replay_records_what_it_is_a_replay_of() {
    let server = TestServer::start();
    let id = server.create(healthy()).await;
    let first = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    let original = first["executionId"].as_str().unwrap().to_owned();

    let retried = server
        .post(&format!("/rest/executions/{original}/retry"), json!({}))
        .await
        .expect_ok();

    assert_eq!(retried["retryOf"], json!(original));
    assert_eq!(retried["attempt"], json!(2), "the original was attempt 1");

    let stored = server
        .get(&format!(
            "/rest/executions/{}",
            retried["executionId"].as_str().unwrap()
        ))
        .await
        .expect_ok();
    assert_eq!(stored["retryOf"], json!(original));
    assert_eq!(stored["attempt"], json!(2));
}

#[tokio::test]
async fn one_unreplayable_run_does_not_abandon_the_batch() {
    // Getting through the backlog matters more than the batch being tidy.
    let server = TestServer::start();
    let id = server.create(failing("Broken")).await;
    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    let real = run["executionId"].as_str().unwrap().to_owned();

    let outcome = server
        .post(
            "/rest/executions/retry",
            json!({ "executionIds": [real, "does-not-exist"] }),
        )
        .await
        .expect_ok();

    assert_eq!(outcome["requested"], json!(2));
    assert_eq!(
        outcome["retried"],
        json!(1),
        "the real one still went through"
    );

    let refused = outcome["results"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["retried"] == json!(false))
        .expect("the missing one is reported, not swallowed");
    assert!(refused["reason"].as_str().unwrap().contains("not found"));
}

// ================================================================ the ceiling

#[tokio::test]
async fn the_same_broken_work_cannot_be_replayed_forever() {
    // A run that has failed five times is telling you something a sixth
    // attempt will not fix; an automation replaying it would be permanent load.
    let server = TestServer::start();
    let id = server.create(failing("Never works")).await;
    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    let mut current = run["executionId"].as_str().unwrap().to_owned();
    let mut attempts = 1;

    // Keep replaying the newest attempt until r8r refuses.
    loop {
        let response = server
            .post(&format!("/rest/executions/{current}/retry"), json!({}))
            .await;
        if response.status == StatusCode::BAD_REQUEST {
            assert!(
                response.error_message().contains("attempts"),
                "say why it stopped"
            );
            break;
        }
        let body = response.expect_ok();
        current = body["executionId"].as_str().unwrap().to_owned();
        attempts += 1;
        assert!(attempts <= 10, "it should have refused by now");
    }

    assert_eq!(attempts, 5, "five attempts at the same work, then no more");
}

#[tokio::test]
async fn a_run_still_in_flight_is_not_replayed() {
    // It may yet succeed; replaying now would do the work twice on purpose.
    let server = TestServer::start();
    let id = server.create(healthy()).await;
    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    server.execute_sql("UPDATE execution_entity SET status = 'running'");

    let response = server
        .post(&format!("/rest/executions/{execution_id}/retry"), json!({}))
        .await;
    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert!(response.error_message().contains("has not finished"));
}

#[tokio::test]
async fn an_oversized_batch_is_refused_rather_than_attempted() {
    // Replaying the whole history would take the vendor down a second time.
    let server = TestServer::start();
    let ids: Vec<String> = (0..101).map(|i| format!("e-{i}")).collect();

    let response = server
        .post("/rest/executions/retry", json!({ "executionIds": ids }))
        .await;

    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert!(response.error_message().contains("101"));
}

#[tokio::test]
async fn an_empty_batch_is_accepted_and_does_nothing() {
    let server = TestServer::start();
    let outcome = server
        .post("/rest/executions/retry", json!({ "executionIds": [] }))
        .await
        .expect_ok();

    assert_eq!(outcome["requested"], json!(0));
    assert_eq!(outcome["retried"], json!(0));
}
