//! Repeated inbound requests.
//!
//! Every webhook sender retries when it does not get a timely answer — that is
//! correct of them. These tests pin the property that makes it safe: the same
//! event handled twice does the work once, and the second caller cannot tell.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use support::TestServer;

/// A workflow that appends a row every time it runs, so running twice is
/// visible rather than merely suspected.
fn recorder(path: &str, idempotency_key: &str) -> Value {
    json!({
        "name": "Lab results",
        "nodes": [
            { "id": "hook", "type": "webhook", "name": "Hook",
              "parameters": {
                  "path": path,
                  "method": "POST",
                  "respond": "lastNode",
                  "idempotencyKey": idempotency_key
              },
              "position": [0, 0] },
            { "id": "book", "type": "set", "name": "Book result",
              "parameters": {
                  "mode": "fields",
                  "keepOnlySet": true,
                  "fields": { "booked": "{{ item.body.resultId }}", "at": "{{ now() }}" }
              },
              "position": [220, 0] }
        ],
        "connections": [{ "from": "hook", "to": "book", "port": "main" }]
    })
}

async fn activate(server: &TestServer, workflow: Value) -> String {
    let id = server.create(workflow).await;
    server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await
        .expect_ok();
    id
}

/// How many times the workflow actually ran.
async fn run_count(server: &TestServer) -> usize {
    server
        .get("/rest/executions")
        .await
        .expect_ok()
        .as_array()
        .map_or(0, Vec::len)
}

#[tokio::test]
async fn the_same_event_delivered_twice_is_handled_once() {
    // The case this exists for: a lab result booked twice is a second result
    // in the patient's record, and it looks as legitimate as the first.
    let server = TestServer::start();
    activate(&server, recorder("labs", "{{ item.body.resultId }}")).await;

    let first = server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();
    let second = server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();

    assert_eq!(
        first, second,
        "the retry must receive exactly the first answer"
    );
    assert_eq!(
        run_count(&server).await,
        1,
        "the workflow must have run once"
    );
}

#[tokio::test]
async fn a_replay_says_that_it_is_one() {
    // A caller comparing responses should not be left wondering why nothing
    // happened the second time.
    let server = TestServer::start();
    activate(&server, recorder("labs", "{{ item.body.resultId }}")).await;

    let first = server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await;
    assert!(first.header("x-r8r-idempotent-replay").is_none());

    let second = server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await;
    assert_eq!(
        second.header("x-r8r-idempotent-replay").as_deref(),
        Some("true")
    );
}

#[tokio::test]
async fn different_events_are_both_handled() {
    let server = TestServer::start();
    activate(&server, recorder("labs", "{{ item.body.resultId }}")).await;

    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();
    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-2" }))
        .await
        .expect_ok();

    assert_eq!(run_count(&server).await, 2, "two events are two runs");
}

#[tokio::test]
async fn the_key_can_come_from_a_header_the_sender_sets() {
    let server = TestServer::start();
    activate(
        &server,
        recorder("labs", "{{ item.headers[\"idempotency-key\"] }}"),
    )
    .await;

    let headers = [("idempotency-key", "evt-42")];
    server
        .webhook(Method::POST, "labs", &headers, json!({ "resultId": "R-1" }))
        .await
        .expect_ok();
    // A different body under the same key is still the same event: the sender
    // said so, and it is the sender that knows.
    server
        .webhook(Method::POST, "labs", &headers, json!({ "resultId": "R-9" }))
        .await
        .expect_ok();

    assert_eq!(run_count(&server).await, 1);
}

#[tokio::test]
async fn a_workflow_without_a_key_treats_every_request_as_new() {
    // Opt-in: a workflow that has not thought about identity must not have
    // requests silently suppressed.
    let server = TestServer::start();
    activate(&server, recorder("labs", "")).await;

    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();
    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();

    assert_eq!(run_count(&server).await, 2);
}

#[tokio::test]
async fn a_key_that_resolves_to_nothing_is_not_a_key() {
    // Otherwise every request with a missing header would be a duplicate of
    // the last one, and real events would vanish.
    let server = TestServer::start();
    activate(
        &server,
        recorder("labs", "{{ item.headers[\"idempotency-key\"] }}"),
    )
    .await;

    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();
    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-2" }))
        .await
        .expect_ok();

    assert_eq!(
        run_count(&server).await,
        2,
        "no header means no suppression"
    );
}

#[tokio::test]
async fn a_failure_is_not_remembered_so_the_retry_can_succeed() {
    // Retrying is exactly how a transient failure gets fixed. Pinning a 500
    // for a day would turn a blip into an outage.
    let server = TestServer::start();
    activate(
        &server,
        json!({
            "name": "Flaky",
            "nodes": [
                { "id": "hook", "type": "webhook", "name": "Hook",
                  "parameters": { "path": "flaky", "method": "POST",
                                  "idempotencyKey": "{{ item.body.id }}" },
                  "position": [0, 0] },
                { "id": "call", "type": "httpRequest", "name": "Call",
                  "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [220, 0] }
            ],
            "connections": [{ "from": "hook", "to": "call", "port": "main" }]
        }),
    )
    .await;

    let first = server
        .webhook(Method::POST, "flaky", &[], json!({ "id": "E-1" }))
        .await;
    assert_eq!(first.status, StatusCode::INTERNAL_SERVER_ERROR);

    let second = server
        .webhook(Method::POST, "flaky", &[], json!({ "id": "E-1" }))
        .await;
    assert_eq!(second.status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(
        second.header("x-r8r-idempotent-replay").is_none(),
        "a failure must be retryable, not replayed"
    );
    assert_eq!(run_count(&server).await, 2, "the retry really ran");
}

#[tokio::test]
async fn two_workflows_do_not_share_a_key_space() {
    // "evt-1" from one sender is unrelated to "evt-1" from another.
    let server = TestServer::start();
    activate(&server, recorder("labs", "{{ item.body.resultId }}")).await;
    activate(&server, recorder("imaging", "{{ item.body.resultId }}")).await;

    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();
    server
        .webhook(Method::POST, "imaging", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();

    assert_eq!(run_count(&server).await, 2);
}

#[tokio::test]
async fn an_accepted_immediately_response_is_also_replayed() {
    // Fire-and-forget still runs the workflow, so a retry would still double
    // the work even though the caller sees only a 202.
    let server = TestServer::start();
    let mut workflow = recorder("fast", "{{ item.body.resultId }}");
    workflow["nodes"][0]["parameters"]["respond"] = json!("immediately");
    activate(&server, workflow).await;

    let first = server
        .webhook(Method::POST, "fast", &[], json!({ "resultId": "R-1" }))
        .await;
    assert_eq!(first.status, StatusCode::ACCEPTED);

    let second = server
        .webhook(Method::POST, "fast", &[], json!({ "resultId": "R-1" }))
        .await;
    assert_eq!(second.status, StatusCode::ACCEPTED);
    assert_eq!(
        second.header("x-r8r-idempotent-replay").as_deref(),
        Some("true")
    );
}

#[tokio::test]
async fn deleting_a_workflow_takes_its_idempotency_records_with_it() {
    // Otherwise a recreated workflow would inherit a stranger's history.
    let server = TestServer::start();
    let id = activate(&server, recorder("labs", "{{ item.body.resultId }}")).await;

    server
        .webhook(Method::POST, "labs", &[], json!({ "resultId": "R-1" }))
        .await
        .expect_ok();
    server
        .delete(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();

    let remaining = server.raw_column("SELECT key FROM idempotency_entity");
    assert!(
        remaining.is_empty(),
        "the records should have gone with the workflow"
    );
}
