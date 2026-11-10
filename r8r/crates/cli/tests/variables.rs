//! Instance variables, end to end.
//!
//! The situation: the same workflow has to run against a test hospital and a
//! live one. Everything that differs between them belongs in one short list
//! somebody can read, not typed into forty nodes.

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

/// Reports back whatever `vars.FHIR_BASE_URL` resolves to.
fn reads_a_variable() -> Value {
    json!({
        "name": "Where am I pointed",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "read", "type": "set", "name": "Read",
              "parameters": {
                  "mode": "fields",
                  "keepOnlySet": true,
                  "fields": { "target": "{{ vars.FHIR_BASE_URL }}/Patient" }
              },
              "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "read", "port": "main" }]
    })
}

async fn set_variable(server: &TestServer, key: &str, value: Value) -> Value {
    server
        .request(
            axum::http::Method::PUT,
            &format!("/rest/variables/{key}"),
            Some(json!({ "value": value })),
        )
        .await
        .expect_ok()
}

async fn run_and_read(server: &TestServer, id: &str) -> Value {
    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    run["result"]["last"][0].clone()
}

// ==================================================================== a run

#[tokio::test]
async fn a_workflow_reads_a_variable_the_instance_was_given() {
    let server = TestServer::start();
    set_variable(&server, "FHIR_BASE_URL", json!("https://hims.example.org")).await;
    let id = server.create(reads_a_variable()).await;

    let out = run_and_read(&server, &id).await;

    assert_eq!(out["target"], json!("https://hims.example.org/Patient"));
}

#[tokio::test]
async fn changing_a_variable_changes_the_next_run_without_touching_the_workflow() {
    // The whole point. Promoting a workflow is a copy, not an edit of every
    // step that mentions a hostname.
    let server = TestServer::start();
    set_variable(&server, "FHIR_BASE_URL", json!("https://test.local")).await;
    let id = server.create(reads_a_variable()).await;

    assert_eq!(
        run_and_read(&server, &id).await["target"],
        json!("https://test.local/Patient")
    );

    set_variable(&server, "FHIR_BASE_URL", json!("https://hims.example.org")).await;

    assert_eq!(
        run_and_read(&server, &id).await["target"],
        json!("https://hims.example.org/Patient")
    );
}

#[tokio::test]
async fn a_variable_that_was_never_set_leaves_an_obvious_gap_rather_than_failing() {
    // A missing variable is a configuration mistake. Surfacing it as an
    // obviously wrong URL in the run log beats aborting before the first node
    // with something about Rhai.
    let server = TestServer::start();
    let id = server.create(reads_a_variable()).await;

    let out = run_and_read(&server, &id).await;

    assert_eq!(out["target"], json!("/Patient"));
}

#[tokio::test]
async fn a_variable_keeps_the_type_it_was_stored_with() {
    let server = TestServer::start();
    set_variable(&server, "BATCH_SIZE", json!(500)).await;
    set_variable(&server, "DRY_RUN", json!(true)).await;

    let stored = server.get("/rest/variables").await.expect_ok();
    let by_key: std::collections::BTreeMap<&str, &Value> = stored
        .as_array()
        .expect("a list")
        .iter()
        .map(|v| (v["key"].as_str().expect("key"), &v["value"]))
        .collect();

    // A batch size that comes back as the string "500" fails differently, and
    // later, than one that comes back as a number.
    assert_eq!(by_key["BATCH_SIZE"], &json!(500));
    assert_eq!(by_key["DRY_RUN"], &json!(true));
}

// ================================================================== editing

#[tokio::test]
async fn variables_are_listed_in_a_stable_order() {
    // A settings page that reshuffles between reloads is one nobody trusts.
    let server = TestServer::start();
    for key in ["ZONE", "ALPHA", "MIDDLE"] {
        set_variable(&server, key, json!("x")).await;
    }

    let keys: Vec<String> = server
        .get("/rest/variables")
        .await
        .expect_ok()
        .as_array()
        .expect("a list")
        .iter()
        .map(|v| v["key"].as_str().unwrap_or_default().to_owned())
        .collect();

    assert_eq!(keys, ["ALPHA", "MIDDLE", "ZONE"]);
}

#[tokio::test]
async fn setting_a_variable_twice_replaces_it_rather_than_adding_a_second() {
    let server = TestServer::start();
    set_variable(&server, "REGION", json!("ap-south-1")).await;
    set_variable(&server, "REGION", json!("eu-west-1")).await;

    let stored = server.get("/rest/variables").await.expect_ok();

    assert_eq!(stored.as_array().expect("a list").len(), 1);
    assert_eq!(stored[0]["value"], json!("eu-west-1"));
}

#[tokio::test]
async fn a_deleted_variable_stops_reaching_the_next_run() {
    let server = TestServer::start();
    set_variable(&server, "FHIR_BASE_URL", json!("https://test.local")).await;
    let id = server.create(reads_a_variable()).await;

    server
        .delete("/rest/variables/FHIR_BASE_URL")
        .await
        .expect_ok();

    assert_eq!(
        run_and_read(&server, &id).await["target"],
        json!("/Patient")
    );
}

#[tokio::test]
async fn deleting_a_variable_that_was_never_there_says_so() {
    let server = TestServer::start();

    server
        .delete("/rest/variables/NOPE")
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn variables_survive_a_restart() {
    let server = TestServer::start();
    set_variable(&server, "FHIR_BASE_URL", json!("https://hims.example.org")).await;

    let restarted = server.restart();

    let stored = restarted.get("/rest/variables").await.expect_ok();
    assert_eq!(stored[0]["value"], json!("https://hims.example.org"));
}

// ================================================================== refusals

#[tokio::test]
async fn a_name_an_expression_could_not_read_back_is_refused() {
    let server = TestServer::start();

    // `{{ vars.my-var }}` parses as a subtraction. Accepting the name would
    // make a variable that is settable and permanently unreadable.
    for name in ["my-var", "2fast", "has.dot"] {
        let refusal = server
            .request(
                axum::http::Method::PUT,
                &format!("/rest/variables/{name}"),
                Some(json!({ "value": "x" })),
            )
            .await;
        assert_eq!(
            refusal.status,
            StatusCode::BAD_REQUEST,
            "{name} was accepted"
        );
    }
}

#[tokio::test]
async fn an_underscore_is_a_perfectly_good_name() {
    let server = TestServer::start();

    set_variable(&server, "_internal", json!("x")).await;
    set_variable(&server, "FHIR_BASE_URL", json!("x")).await;

    assert_eq!(
        server
            .get("/rest/variables")
            .await
            .expect_ok()
            .as_array()
            .expect("a list")
            .len(),
        2
    );
}

#[tokio::test]
async fn a_value_too_large_to_be_configuration_is_refused() {
    let server = TestServer::start();

    let enormous = "x".repeat(10_000);
    let refusal = server
        .request(
            axum::http::Method::PUT,
            "/rest/variables/BLOB",
            Some(json!({ "value": enormous })),
        )
        .await;

    assert_eq!(refusal.status, StatusCode::BAD_REQUEST);
    assert!(refusal.error_message().contains("characters"));
}

#[tokio::test]
async fn an_instance_cannot_be_turned_into_a_data_store_one_variable_at_a_time() {
    let server = TestServer::start();

    for index in 0..200 {
        set_variable(&server, &format!("VAR_{index}"), json!(index)).await;
    }

    let refusal = server
        .request(
            axum::http::Method::PUT,
            "/rest/variables/ONE_TOO_MANY",
            Some(json!({ "value": "x" })),
        )
        .await;
    assert_eq!(refusal.status, StatusCode::BAD_REQUEST);

    // Replacing an existing one is still fine at the cap — otherwise an
    // instance that reached it could never be reconfigured again.
    set_variable(&server, "VAR_0", json!("changed")).await;
}

// ================================================================= withheld

#[tokio::test]
async fn a_workflow_cannot_read_the_instance_encryption_key() {
    let server = TestServer::start();
    let id = server
        .create(json!({
            "name": "Exfiltrate",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
                { "id": "leak", "type": "set", "name": "Leak",
                  "parameters": {
                      "mode": "fields", "keepOnlySet": true,
                      "fields": { "key": "{{ env.R8R_ENCRYPTION_KEY }}" }
                  },
                  "position": [200, 0] }
            ],
            "connections": [{ "from": "t", "to": "leak", "port": "main" }]
        }))
        .await;

    // Anyone who could read this could read every credential the instance
    // stores — through an ordinary HTTP node, without touching the database.
    let out = run_and_read(&server, &id).await;

    assert_eq!(out["key"], Value::Null);
}
