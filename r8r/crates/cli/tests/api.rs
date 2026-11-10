//! The REST API as an editor or a script actually uses it.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use axum::http::StatusCode;
use serde_json::{Value, json};
use support::{TestServer, greeting_workflow};

fn manual_workflow(name: &str) -> Value {
    json!({
        "name": name,
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "s", "type": "set", "name": "Shape",
              "parameters": { "mode": "fields", "fields": { "ok": true } }, "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "s", "port": "main" }]
    })
}

// ============================================================== node types

#[tokio::test]
async fn the_palette_lists_every_built_in_node_with_its_parameter_schema() {
    let server = TestServer::start();

    let types = server.get("/rest/node-types").await.expect_ok();
    let types = types.as_array().unwrap();

    assert!(
        types.len() >= 13,
        "expected the full built-in set, got {}",
        types.len()
    );

    let http = types
        .iter()
        .find(|t| t["name"] == json!("httpRequest"))
        .expect("httpRequest");
    assert_eq!(http["group"], json!("output"));
    let url = http["properties"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["name"] == json!("url"))
        .expect("url property");
    assert_eq!(
        url["required"],
        json!(true),
        "the editor needs to know url is required"
    );
}

// =============================================================== lifecycle

#[tokio::test]
async fn a_workflow_can_be_created_read_back_updated_and_deleted() {
    let server = TestServer::start();

    let id = server.create(manual_workflow("First draft")).await;

    let fetched = server
        .get(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();
    assert_eq!(fetched["name"], json!("First draft"));
    assert_eq!(fetched["nodes"].as_array().unwrap().len(), 2);
    assert_eq!(
        fetched["active"],
        json!(false),
        "new workflows start inactive"
    );

    let mut renamed = manual_workflow("Renamed");
    renamed["id"] = json!(id);
    let updated = server
        .patch(&format!("/rest/workflows/{id}"), renamed)
        .await
        .expect_ok();
    assert_eq!(updated["name"], json!("Renamed"));

    server
        .delete(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();
    server
        .get(&format!("/rest/workflows/{id}"))
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn the_server_assigns_the_id_and_ignores_one_supplied_by_the_client() {
    let server = TestServer::start();

    let mut payload = manual_workflow("Mine");
    payload["id"] = json!("i-picked-this");

    let created = server.post("/rest/workflows", payload).await.expect_ok();
    assert_ne!(
        created["id"],
        json!("i-picked-this"),
        "identity belongs to the server"
    );
}

#[tokio::test]
async fn an_unnamed_workflow_gets_a_default_name() {
    let server = TestServer::start();

    let created = server
        .post(
            "/rest/workflows",
            json!({ "name": "   ", "nodes": [], "connections": [] }),
        )
        .await
        .expect_ok();

    assert_eq!(created["name"], json!("My workflow"));
}

#[tokio::test]
async fn the_list_is_ordered_with_the_most_recently_touched_first() {
    let server = TestServer::start();

    let first = server.create(manual_workflow("Older")).await;
    let _second = server.create(manual_workflow("Newer")).await;

    // Touching the older one should float it back to the top.
    let mut touched = manual_workflow("Older, edited");
    touched["id"] = json!(first);
    server
        .patch(&format!("/rest/workflows/{first}"), touched)
        .await
        .expect_ok();

    let list = server.get("/rest/workflows").await.expect_ok();
    assert_eq!(list.as_array().unwrap()[0]["name"], json!("Older, edited"));
}

#[tokio::test]
async fn unknown_ids_are_reported_as_not_found_rather_than_crashing() {
    let server = TestServer::start();

    for uri in [
        "/rest/workflows/does-not-exist",
        "/rest/executions/does-not-exist",
    ] {
        let response = server.get(uri).await;
        assert_eq!(response.status, StatusCode::NOT_FOUND, "{uri}");
        assert!(response.error_message().contains("not found"), "{uri}");
    }
}

// ============================================================== validation

#[tokio::test]
async fn a_connection_to_a_node_that_does_not_exist_is_rejected() {
    let server = TestServer::start();

    let response = server
        .post(
            "/rest/workflows",
            json!({
                "name": "Broken",
                "nodes": [{ "id": "a", "type": "manual", "name": "A", "parameters": {}, "position": [0,0] }],
                "connections": [{ "from": "a", "to": "ghost", "port": "main" }]
            }),
        )
        .await;

    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert!(
        response.error_message().contains("ghost"),
        "name the offending node"
    );
}

#[tokio::test]
async fn duplicate_node_ids_are_rejected() {
    let server = TestServer::start();

    let response = server
        .post(
            "/rest/workflows",
            json!({
                "name": "Twins",
                "nodes": [
                    { "id": "a", "type": "manual", "name": "A", "parameters": {}, "position": [0,0] },
                    { "id": "a", "type": "noOp", "name": "B", "parameters": {}, "position": [0,0] }
                ],
                "connections": []
            }),
        )
        .await;

    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert!(response.error_message().contains("duplicate"));
}

// ============================================================== activation

#[tokio::test]
async fn activating_a_workflow_with_no_automatic_trigger_is_refused() {
    // A manual-only workflow that claims to be "active" would be a lie: no
    // trigger exists that could ever fire it.
    let server = TestServer::start();
    let id = server.create(manual_workflow("Manual only")).await;

    let response = server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await;

    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert!(response.error_message().contains("Webhook or Schedule"));
}

#[tokio::test]
async fn a_webhook_workflow_can_be_activated_and_deactivated() {
    let server = TestServer::start();
    let id = server.create(greeting_workflow("greet")).await;

    let activated = server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await
        .expect_ok();
    assert_eq!(activated["active"], json!(true));

    let deactivated = server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": false }),
        )
        .await
        .expect_ok();
    assert_eq!(deactivated["active"], json!(false));
}

// ================================================================ running

#[tokio::test]
async fn running_a_saved_workflow_records_an_execution() {
    let server = TestServer::start();
    let id = server.create(manual_workflow("Runnable")).await;

    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    assert_eq!(run["result"]["status"], json!("success"));
    let execution_id = run["executionId"].as_str().expect("an execution id");

    let stored = server
        .get(&format!("/rest/executions/{execution_id}"))
        .await
        .expect_ok();
    assert_eq!(stored["workflowName"], json!("Runnable"));
    assert_eq!(stored["mode"], json!("manual"));
    assert_eq!(
        stored["data"]["runs"].as_array().unwrap().len(),
        2,
        "both nodes recorded"
    );
}

#[tokio::test]
async fn a_run_can_be_seeded_with_input_items() {
    let server = TestServer::start();
    let id = server
        .create(json!({
            "name": "Echo",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0,0] },
                { "id": "s", "type": "set", "name": "Echo",
                  "parameters": { "mode": "fields", "keepOnlySet": true,
                                  "fields": { "seen": "{{ item.who }}" } }, "position": [200,0] }
            ],
            "connections": [{ "from": "t", "to": "s", "port": "main" }]
        }))
        .await;

    let run = server
        .post(
            &format!("/rest/workflows/{id}/run"),
            json!({ "input": [{ "who": "ada" }] }),
        )
        .await
        .expect_ok();

    assert_eq!(run["result"]["last"][0]["seen"], json!("ada"));
}

#[tokio::test]
async fn an_unsaved_workflow_can_be_tried_without_being_stored() {
    let server = TestServer::start();

    let run = server
        .post(
            "/rest/workflows/run",
            json!({ "workflow": manual_workflow("Scratch") }),
        )
        .await
        .expect_ok();

    assert_eq!(run["result"]["status"], json!("success"));
    assert_eq!(
        run["executionId"],
        Value::Null,
        "a dry run is not persisted"
    );

    let executions = server.get("/rest/executions").await.expect_ok();
    assert!(
        executions.as_array().unwrap().is_empty(),
        "nothing should be recorded"
    );
}

#[tokio::test]
async fn a_failing_run_is_reported_as_a_failed_execution_not_a_server_error() {
    let server = TestServer::start();
    let id = server
        .create(json!({
            "name": "Doomed",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0,0] },
                { "id": "h", "type": "httpRequest", "name": "Call",
                  "parameters": { "url": "http://127.0.0.1:1/nope" }, "position": [200,0] }
            ],
            "connections": [{ "from": "t", "to": "h", "port": "main" }]
        }))
        .await;

    // The request succeeded; the workflow did not. Those are different things.
    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    assert_eq!(run["result"]["status"], json!("error"));

    let executions = server.get("/rest/executions").await.expect_ok();
    assert_eq!(executions.as_array().unwrap()[0]["status"], json!("error"));
}

// ============================================================= executions

#[tokio::test]
async fn executions_can_be_filtered_to_one_workflow() {
    let server = TestServer::start();
    let first = server.create(manual_workflow("One")).await;
    let second = server.create(manual_workflow("Two")).await;

    server
        .post(&format!("/rest/workflows/{first}/run"), json!({}))
        .await
        .expect_ok();
    server
        .post(&format!("/rest/workflows/{second}/run"), json!({}))
        .await
        .expect_ok();
    server
        .post(&format!("/rest/workflows/{second}/run"), json!({}))
        .await
        .expect_ok();

    let all = server.get("/rest/executions").await.expect_ok();
    assert_eq!(all.as_array().unwrap().len(), 3);

    let filtered = server
        .get(&format!("/rest/executions?workflowId={second}"))
        .await
        .expect_ok();
    assert_eq!(filtered.as_array().unwrap().len(), 2);
    assert!(
        filtered
            .as_array()
            .unwrap()
            .iter()
            .all(|e| e["workflowId"] == json!(second))
    );
}

#[tokio::test]
async fn execution_history_is_pruned_to_the_configured_limit() {
    // The harness sets the limit to 5; without pruning a schedule trigger would
    // grow the table without bound.
    let server = TestServer::start();
    let id = server.create(manual_workflow("Chatty")).await;

    for _ in 0..8 {
        server
            .post(&format!("/rest/workflows/{id}/run"), json!({}))
            .await
            .expect_ok();
    }

    let executions = server.get("/rest/executions").await.expect_ok();
    assert_eq!(executions.as_array().unwrap().len(), 5);
}

#[tokio::test]
async fn deleting_a_workflow_takes_its_execution_history_with_it() {
    let server = TestServer::start();
    let id = server.create(manual_workflow("Temporary")).await;
    server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();

    server
        .delete(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();

    let executions = server.get("/rest/executions").await.expect_ok();
    assert!(
        executions.as_array().unwrap().is_empty(),
        "orphaned history must not linger"
    );
}

#[tokio::test]
async fn a_single_execution_can_be_deleted() {
    let server = TestServer::start();
    let id = server.create(manual_workflow("Keep tidy")).await;
    let run = server
        .post(&format!("/rest/workflows/{id}/run"), json!({}))
        .await
        .expect_ok();
    let execution_id = run["executionId"].as_str().unwrap().to_owned();

    server
        .delete(&format!("/rest/executions/{execution_id}"))
        .await
        .expect_ok();
    server
        .get(&format!("/rest/executions/{execution_id}"))
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

// ================================================================= health

#[tokio::test]
async fn the_health_endpoint_answers_without_touching_the_database() {
    let server = TestServer::start();
    let response = server.get("/healthz").await;
    assert_eq!(response.status, StatusCode::OK);
}
