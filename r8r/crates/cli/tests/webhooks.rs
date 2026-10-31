//! Webhook delivery: matching, payload shape, responses and refusals.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use support::{TestServer, greeting_workflow};

/// A workflow whose Set node exposes whatever the trigger received.
fn echo_workflow(path: &str, method: &str) -> Value {
    json!({
        "name": "Echo hook",
        "nodes": [
            { "id": "hook", "type": "webhook", "name": "Hook",
              "parameters": { "path": path, "method": method, "respond": "lastNode" },
              "position": [0, 0] },
            { "id": "echo", "type": "code", "name": "Echo",
              "parameters": { "mode": "eachItem", "script": "item" }, "position": [200, 0] }
        ],
        "connections": [{ "from": "hook", "to": "echo", "port": "main" }]
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

#[tokio::test]
async fn an_active_webhook_runs_its_workflow_and_returns_the_last_output() {
    let server = TestServer::start();
    activate(&server, greeting_workflow("greet")).await;

    let response = server
        .webhook(Method::POST, "greet", &[], json!({ "name": "ada" }))
        .await
        .expect_ok();

    assert_eq!(response, json!({ "message": "hello ada" }));
}

#[tokio::test]
async fn an_inactive_workflow_does_not_answer_its_webhook() {
    // Deactivating must actually take the endpoint offline.
    let server = TestServer::start();
    server.create(greeting_workflow("greet")).await;

    let response = server.webhook(Method::POST, "greet", &[], json!({})).await;

    assert_eq!(response.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn deactivating_takes_a_live_endpoint_offline() {
    let server = TestServer::start();
    let id = activate(&server, greeting_workflow("greet")).await;

    server
        .webhook(Method::POST, "greet", &[], json!({ "name": "x" }))
        .await
        .expect_ok();

    server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": false }),
        )
        .await
        .expect_ok();

    let after = server
        .webhook(Method::POST, "greet", &[], json!({ "name": "x" }))
        .await;
    assert_eq!(after.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn the_method_must_match_the_one_the_trigger_declares() {
    let server = TestServer::start();
    activate(&server, echo_workflow("only-post", "POST")).await;

    let wrong = server
        .webhook(Method::GET, "only-post", &[], json!({}))
        .await;
    assert_eq!(wrong.status, StatusCode::NOT_FOUND);
    assert!(
        wrong.error_message().contains("GET"),
        "say which method was refused"
    );

    let right = server
        .webhook(Method::POST, "only-post", &[], json!({}))
        .await;
    assert!(right.status.is_success());
}

#[tokio::test]
async fn a_trigger_set_to_any_accepts_every_method() {
    let server = TestServer::start();
    activate(&server, echo_workflow("anything", "ANY")).await;

    for method in [Method::GET, Method::POST, Method::PUT, Method::DELETE] {
        let response = server
            .webhook(method.clone(), "anything", &[], json!({}))
            .await;
        assert!(response.status.is_success(), "{method} should be accepted");
    }
}

#[tokio::test]
async fn the_path_is_matched_regardless_of_surrounding_slashes() {
    let server = TestServer::start();
    activate(&server, echo_workflow("/padded/", "ANY")).await;

    let response = server.webhook(Method::GET, "padded", &[], json!({})).await;
    assert!(response.status.is_success());
}

#[tokio::test]
async fn an_unknown_path_explains_what_was_not_found() {
    let server = TestServer::start();
    activate(&server, greeting_workflow("greet")).await;

    let response = server.webhook(Method::POST, "nope", &[], json!({})).await;

    assert_eq!(response.status, StatusCode::NOT_FOUND);
    assert!(response.error_message().contains("/webhook/nope"));
}

#[tokio::test]
async fn the_trigger_item_carries_method_path_query_headers_and_body() {
    let server = TestServer::start();
    activate(&server, echo_workflow("inspect", "POST")).await;

    let response = server
        .webhook(
            Method::POST,
            "inspect?tenant=acme&page=2",
            &[("x-request-id", "req-42")],
            json!({ "order": "O-1" }),
        )
        .await
        .expect_ok();

    assert_eq!(response["method"], json!("POST"));
    assert_eq!(response["path"], json!("inspect"));
    assert_eq!(response["query"]["tenant"], json!("acme"));
    assert_eq!(response["query"]["page"], json!("2"));
    assert_eq!(response["headers"]["x-request-id"], json!("req-42"));
    assert_eq!(response["body"]["order"], json!("O-1"));
}

#[tokio::test]
async fn authorization_headers_are_never_copied_into_the_execution() {
    // Execution history is visible to anyone who can open the editor, so an
    // inbound bearer token must not be written into it.
    let server = TestServer::start();
    activate(&server, echo_workflow("secure", "POST")).await;

    let response = server
        .webhook(
            Method::POST,
            "secure",
            &[
                ("authorization", "Bearer super-secret"),
                ("cookie", "session=also-secret"),
                ("x-api-key", "key-secret"),
                ("x-safe", "keep-me"),
            ],
            json!({}),
        )
        .await
        .expect_ok();

    let headers = response["headers"].as_object().unwrap();
    assert!(
        !headers.contains_key("authorization"),
        "bearer token leaked"
    );
    assert!(!headers.contains_key("cookie"), "cookie leaked");
    assert!(!headers.contains_key("x-api-key"), "api key leaked");
    assert_eq!(
        headers["x-safe"],
        json!("keep-me"),
        "ordinary headers still arrive"
    );

    let executions = server.get("/rest/executions").await.expect_ok();
    let id = executions.as_array().unwrap()[0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let stored = server
        .get(&format!("/rest/executions/{id}"))
        .await
        .expect_ok();
    assert!(
        !stored.to_string().contains("super-secret"),
        "the stored execution must not contain the token"
    );
}

#[tokio::test]
async fn a_non_json_body_arrives_as_text_rather_than_failing() {
    let server = TestServer::start();
    activate(&server, echo_workflow("raw", "POST")).await;

    let response = server
        .webhook(Method::POST, "raw", &[], json!("this is just a string"))
        .await
        .expect_ok();

    assert_eq!(response["body"], json!("this is just a string"));
}

#[tokio::test]
async fn an_empty_body_arrives_as_null() {
    let server = TestServer::start();
    activate(&server, echo_workflow("empty", "GET")).await;

    let response = server
        .webhook(Method::GET, "empty", &[], Value::Null)
        .await
        .expect_ok();

    assert_eq!(response["body"], Value::Null);
}

#[tokio::test]
async fn respond_immediately_returns_202_without_waiting_for_the_workflow() {
    let server = TestServer::start();
    let mut workflow = greeting_workflow("fast");
    workflow["nodes"][0]["parameters"]["respond"] = json!("immediately");
    // A wait long enough that a synchronous response could not have finished.
    workflow["nodes"][1] = json!({
        "id": "slow", "type": "wait", "name": "Slow",
        "parameters": { "ms": 2000 }, "position": [220, 0]
    });
    workflow["connections"] = json!([{ "from": "hook", "to": "slow", "port": "main" }]);
    activate(&server, workflow).await;

    let started = std::time::Instant::now();
    let response = server.webhook(Method::POST, "fast", &[], json!({})).await;

    assert_eq!(response.status, StatusCode::ACCEPTED);
    assert_eq!(response.body, json!({ "accepted": true }));
    assert!(
        started.elapsed().as_millis() < 1000,
        "the caller should not have waited"
    );
}

#[tokio::test]
async fn a_workflow_that_fails_answers_500_with_the_reason() {
    let server = TestServer::start();
    activate(
        &server,
        json!({
            "name": "Broken hook",
            "nodes": [
                { "id": "hook", "type": "webhook", "name": "Hook",
                  "parameters": { "path": "broken", "method": "POST" }, "position": [0,0] },
                { "id": "call", "type": "httpRequest", "name": "Call",
                  "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [200,0] }
            ],
            "connections": [{ "from": "hook", "to": "call", "port": "main" }]
        }),
    )
    .await;

    let response = server.webhook(Method::POST, "broken", &[], json!({})).await;

    assert_eq!(response.status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(response.body["error"].as_str().unwrap().contains("Call"));
    assert!(
        response.body["executionId"].is_string(),
        "the failure is still traceable"
    );
}

#[tokio::test]
async fn several_output_items_come_back_as_an_array() {
    let server = TestServer::start();
    activate(
        &server,
        json!({
            "name": "Fan out",
            "nodes": [
                { "id": "hook", "type": "webhook", "name": "Hook",
                  "parameters": { "path": "many", "method": "POST" }, "position": [0,0] },
                { "id": "split", "type": "splitOut", "name": "Split",
                  "parameters": { "field": "body.rows" }, "position": [200,0] }
            ],
            "connections": [{ "from": "hook", "to": "split", "port": "main" }]
        }),
    )
    .await;

    let response = server
        .webhook(
            Method::POST,
            "many",
            &[],
            json!({ "rows": [{ "a": 1 }, { "a": 2 }] }),
        )
        .await
        .expect_ok();

    assert_eq!(response.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn a_webhook_run_is_recorded_with_the_webhook_mode() {
    let server = TestServer::start();
    activate(&server, greeting_workflow("greet")).await;

    server
        .webhook(Method::POST, "greet", &[], json!({ "name": "ada" }))
        .await
        .expect_ok();

    let executions = server.get("/rest/executions").await.expect_ok();
    assert_eq!(executions.as_array().unwrap()[0]["mode"], json!("webhook"));
}

#[tokio::test]
async fn activation_is_refused_when_the_only_trigger_is_disabled() {
    let server = TestServer::start();
    let mut workflow = greeting_workflow("greet");
    workflow["nodes"][0]["disabled"] = json!(true);
    let id = server.create(workflow).await;

    let response = server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await;

    assert_eq!(response.status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn disabling_the_trigger_of_a_live_workflow_takes_it_offline() {
    let server = TestServer::start();
    let id = activate(&server, greeting_workflow("greet")).await;
    server
        .webhook(Method::POST, "greet", &[], json!({ "name": "ada" }))
        .await
        .expect_ok();

    let mut edited = greeting_workflow("greet");
    edited["active"] = json!(true);
    edited["nodes"][0]["disabled"] = json!(true);
    server
        .patch(&format!("/rest/workflows/{id}"), edited)
        .await
        .expect_ok();

    let response = server.webhook(Method::POST, "greet", &[], json!({})).await;
    assert_eq!(
        response.status,
        StatusCode::NOT_FOUND,
        "a disabled trigger must not answer"
    );
}
