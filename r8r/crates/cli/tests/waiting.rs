//! Runs that stop and continue later.
//!
//! A prescription waits on a pharmacist; a follow-up waits three days. These
//! tests pin the two properties that make that trustworthy: the wait survives a
//! restart, and time passing is never mistaken for somebody approving.

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

/// Waits for a person, then records what they decided.
fn needs_approval() -> Value {
    json!({
        "name": "Dispense prescription",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "review", "type": "wait", "name": "Pharmacist review",
              "parameters": { "mode": "approval", "reason": "Pharmacist to review the prescription" },
              "position": [200, 0] },
            { "id": "dispense", "type": "set", "name": "Dispense",
              "parameters": {
                  "mode": "fields",
                  "keepOnlySet": true,
                  "fields": { "dispensed": "{{ item.prescription }}", "by": "{{ item.approvedBy }}" }
              },
              "position": [400, 0] }
        ],
        "connections": [
            { "from": "t", "to": "review", "port": "main" },
            { "from": "review", "to": "dispense", "port": "main" }
        ]
    })
}

/// Waits for a moment that has already passed.
fn waits_until(moment: &str) -> Value {
    json!({
        "name": "Follow up",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "hold", "type": "wait", "name": "Hold",
              "parameters": { "mode": "until", "until": moment }, "position": [200, 0] },
            { "id": "after", "type": "set", "name": "After",
              "parameters": { "mode": "fields", "fields": { "followedUp": true } },
              "position": [400, 0] }
        ],
        "connections": [
            { "from": "t", "to": "hold", "port": "main" },
            { "from": "hold", "to": "after", "port": "main" }
        ]
    })
}

async fn start(server: &TestServer, workflow: Value, input: Value) -> Value {
    let id = server.create(workflow).await;
    server
        .post(
            &format!("/rest/workflows/{id}/run"),
            json!({ "input": [input] }),
        )
        .await
        .expect_ok()
}

// ================================================================= stopping

#[tokio::test]
async fn a_run_waiting_on_a_person_stops_rather_than_finishing() {
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;

    assert_eq!(run["result"]["status"], json!("waiting"));

    // The node after the wait must not have run.
    let ran: Vec<&str> = run["result"]["runs"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|r| r["name"].as_str())
        .collect();
    assert!(
        !ran.contains(&"Dispense"),
        "nothing past the wait should have happened: {ran:?}"
    );
}

#[tokio::test]
async fn a_waiting_run_says_what_it_is_waiting_for() {
    let server = TestServer::start();
    start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;

    let waiting = server.get("/rest/waiting").await.expect_ok();
    let entry = &waiting.as_array().unwrap()[0];

    assert_eq!(entry["node"], json!("Pharmacist review"));
    assert_eq!(
        entry["reason"],
        json!("Pharmacist to review the prescription")
    );
    assert_eq!(entry["needsApproval"], json!(true));
    assert_eq!(
        entry["resumeAt"],
        Value::Null,
        "an approval has no deadline"
    );
}

#[tokio::test]
async fn a_wait_survives_a_restart() {
    // The whole reason this is in the database: a deploy must not lose the
    // run and leave it silently unfinished.
    let server = TestServer::start();
    start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;

    let restarted = server.restart();

    let waiting = restarted.get("/rest/waiting").await.expect_ok();
    assert_eq!(
        waiting.as_array().unwrap().len(),
        1,
        "it should still be waiting"
    );
}

#[tokio::test]
async fn a_waiting_run_is_not_closed_out_as_interrupted() {
    // Waiting is neither finished nor broken; a restart must not decide it is
    // the latter.
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    let restarted = server.restart();

    let stored = restarted
        .get(&format!("/rest/executions/{execution_id}"))
        .await
        .expect_ok();
    assert_eq!(stored["status"], json!("waiting"));
}

// ================================================================ approving

#[tokio::test]
async fn approving_continues_the_rest_of_the_workflow() {
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    let resumed = server
        .post(
            &format!("/rest/waiting/{execution_id}/resume"),
            json!({ "data": { "approvedBy": "pharmacist-7" } }),
        )
        .await
        .expect_ok();

    assert_eq!(resumed["result"]["status"], json!("success"));
    assert_eq!(resumed["result"]["last"][0]["dispensed"], json!("P-1"));
    assert_eq!(
        resumed["result"]["last"][0]["by"],
        json!("pharmacist-7"),
        "what the approver supplied must reach the workflow"
    );
}

#[tokio::test]
async fn the_approver_adds_to_what_the_run_was_carrying_rather_than_replacing_it() {
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-9" })).await;
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    let resumed = server
        .post(
            &format!("/rest/waiting/{execution_id}/resume"),
            json!({ "data": { "approvedBy": "pharmacist-2" } }),
        )
        .await
        .expect_ok();

    // The prescription came from before the wait; the approver only added a name.
    assert_eq!(resumed["result"]["last"][0]["dispensed"], json!("P-9"));
}

#[tokio::test]
async fn a_run_can_be_approved_without_the_approver_adding_anything() {
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    let resumed = server
        .post(&format!("/rest/waiting/{execution_id}/resume"), json!({}))
        .await
        .expect_ok();
    assert_eq!(resumed["result"]["status"], json!("success"));
}

#[tokio::test]
async fn a_run_stops_being_listed_once_it_has_continued() {
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    server
        .post(&format!("/rest/waiting/{execution_id}/resume"), json!({}))
        .await
        .expect_ok();

    let waiting = server.get("/rest/waiting").await.expect_ok();
    assert!(waiting.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn approving_the_same_run_twice_is_refused() {
    // Otherwise a double-click dispenses the prescription twice.
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    server
        .post(&format!("/rest/waiting/{execution_id}/resume"), json!({}))
        .await
        .expect_ok();

    let again = server
        .post(&format!("/rest/waiting/{execution_id}/resume"), json!({}))
        .await;
    assert_eq!(again.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn a_wait_can_be_cancelled_instead_of_approved() {
    // A prescription that was refused should end, not sit in the list forever.
    let server = TestServer::start();
    let run = start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    server
        .post(&format!("/rest/waiting/{execution_id}/cancel"), json!({}))
        .await
        .expect_ok();

    assert!(
        server
            .get("/rest/waiting")
            .await
            .expect_ok()
            .as_array()
            .unwrap()
            .is_empty()
    );

    let stored = server
        .get(&format!("/rest/executions/{execution_id}"))
        .await
        .expect_ok();
    assert_eq!(stored["status"], json!("canceled"));
    assert!(stored["error"].as_str().unwrap().contains("Pharmacist"));
}

// ==================================================================== time

#[tokio::test]
async fn a_wait_for_a_moment_records_when_it_may_continue() {
    let server = TestServer::start();
    start(&server, waits_until("2030-01-01T00:00:00Z"), json!({})).await;

    let waiting = server.get("/rest/waiting").await.expect_ok();
    let entry = &waiting.as_array().unwrap()[0];
    assert_eq!(entry["needsApproval"], json!(false));
    assert!(
        entry["resumeAt"]
            .as_str()
            .unwrap()
            .starts_with("2030-01-01")
    );
}

#[tokio::test]
async fn time_passing_never_approves_anything() {
    // The failure this guards against: a prescription dispensing itself
    // because a deadline went by rather than because anyone approved it.
    let server = TestServer::start();
    start(&server, needs_approval(), json!({ "prescription": "P-1" })).await;

    let due = server.raw_column(
        "SELECT execution_id FROM execution_wait WHERE needs_approval = 0 AND resume_at IS NOT NULL",
    );
    assert!(
        due.is_empty(),
        "an approval must never be eligible to resume on its own"
    );
}

#[tokio::test]
async fn a_short_wait_is_simply_waited_out() {
    // Under a minute there is nothing to record: the run holds still, which is
    // what respecting a rate limit needs.
    let server = TestServer::start();
    let run = start(
        &server,
        json!({
            "name": "Brief pause",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0,0] },
                { "id": "hold", "type": "wait", "name": "Hold",
                  "parameters": { "mode": "duration", "ms": 5 }, "position": [200,0] }
            ],
            "connections": [{ "from": "t", "to": "hold", "port": "main" }]
        }),
        json!({}),
    )
    .await;

    assert_eq!(
        run["result"]["status"],
        json!("success"),
        "a short wait does not suspend"
    );
    assert!(
        server
            .get("/rest/waiting")
            .await
            .expect_ok()
            .as_array()
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn an_unparseable_moment_is_reported_rather_than_waited_on_forever() {
    let server = TestServer::start();
    let run = start(&server, waits_until("next tuesday"), json!({})).await;

    assert_eq!(run["result"]["status"], json!("error"));
    assert!(
        run["result"]["error"]
            .as_str()
            .unwrap()
            .contains("next tuesday")
    );
}

#[tokio::test]
async fn resuming_something_that_is_not_waiting_is_a_clean_404() {
    let server = TestServer::start();
    server
        .post("/rest/waiting/does-not-exist/resume", json!({}))
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn deleting_a_workflow_takes_its_waiting_runs_with_it() {
    let server = TestServer::start();
    let id = server.create(needs_approval()).await;
    server
        .post(
            &format!("/rest/workflows/{id}/run"),
            json!({ "input": [{ "prescription": "P-1" }] }),
        )
        .await
        .expect_ok();

    server
        .delete(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();

    assert!(
        server
            .get("/rest/waiting")
            .await
            .expect_ok()
            .as_array()
            .unwrap()
            .is_empty()
    );
}
