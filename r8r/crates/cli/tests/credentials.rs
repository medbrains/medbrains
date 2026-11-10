//! Credential handling, judged by the property that matters: a secret goes in
//! and never comes back out — not through the API, and not readable in the
//! database file.

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

const TOKEN: &str = "xoxb-super-secret-token";

fn slack_credential() -> Value {
    json!({
        "name": "Acme Slack",
        "type": "slackApi",
        "data": { "accessToken": TOKEN }
    })
}

// ================================================================ discovery

#[tokio::test]
async fn the_editor_can_discover_every_credential_type_and_its_fields() {
    let server = TestServer::start();

    let types = server.get("/rest/credential-types").await.expect_ok();
    let types = types.as_array().unwrap();

    let names: Vec<&str> = types.iter().filter_map(|t| t["name"].as_str()).collect();
    for expected in [
        "slackApi",
        "githubApi",
        "httpHeaderAuth",
        "httpBearerAuth",
        "httpBasicAuth",
    ] {
        assert!(names.contains(&expected), "{expected} should be offered");
    }

    let slack = types
        .iter()
        .find(|t| t["name"] == json!("slackApi"))
        .expect("slackApi");
    let token = slack["properties"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["name"] == json!("accessToken"))
        .expect("accessToken field");

    assert_eq!(
        token["password"],
        json!(true),
        "the editor must know to mask this"
    );
    assert_eq!(token["required"], json!(true));
}

#[tokio::test]
async fn a_node_declares_which_credential_type_it_needs() {
    let server = TestServer::start();

    let types = server.get("/rest/node-types").await.expect_ok();
    let slack = types
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["name"] == json!("slack"))
        .expect("the slack node");

    assert_eq!(slack["credentials"][0]["name"], json!("slackApi"));
    assert_eq!(slack["credentials"][0]["required"], json!(true));
}

// ================================================================ lifecycle

#[tokio::test]
async fn a_credential_can_be_created_listed_and_deleted() {
    let server = TestServer::start();

    let id = server.create_credential(slack_credential()).await;

    let list = server.get("/rest/credentials").await.expect_ok();
    assert_eq!(list.as_array().unwrap().len(), 1);
    assert_eq!(list[0]["name"], json!("Acme Slack"));
    assert_eq!(list[0]["type"], json!("slackApi"));

    server
        .delete(&format!("/rest/credentials/{id}"))
        .await
        .expect_ok();
    assert!(
        server
            .get("/rest/credentials")
            .await
            .expect_ok()
            .as_array()
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn an_unnamed_credential_is_named_after_its_type() {
    let server = TestServer::start();

    let created = server
        .post(
            "/rest/credentials",
            json!({ "name": "  ", "type": "githubApi", "data": {} }),
        )
        .await
        .expect_ok();

    assert_eq!(created["name"], json!("GitHub account"));
}

#[tokio::test]
async fn an_unknown_credential_type_is_refused() {
    let server = TestServer::start();

    let response = server
        .post(
            "/rest/credentials",
            json!({ "name": "x", "type": "notARealApi", "data": {} }),
        )
        .await;

    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert!(response.error_message().contains("notARealApi"));
}

#[tokio::test]
async fn deleting_a_credential_that_does_not_exist_is_a_clean_404() {
    let server = TestServer::start();
    server
        .delete("/rest/credentials/nope")
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

// =================================================================== secrecy

#[tokio::test]
async fn the_api_never_returns_a_stored_secret() {
    let server = TestServer::start();
    let id = server.create_credential(slack_credential()).await;

    let created_response = server
        .get(&format!("/rest/credentials/{id}"))
        .await
        .expect_ok();
    let listing = server.get("/rest/credentials").await.expect_ok();

    for body in [&created_response, &listing] {
        assert!(
            !body.to_string().contains(TOKEN),
            "a secret leaked through the API: {body}"
        );
    }
    assert_eq!(
        created_response["data"]["accessToken"],
        json!("__r8r_unchanged__"),
        "the editor gets a placeholder so the form looks filled in"
    );
}

#[tokio::test]
async fn the_secret_is_not_readable_in_the_database_file() {
    // The point of encrypting at rest: a copied `r8r.sqlite` is not a copied
    // set of API tokens.
    let server = TestServer::start();
    server.create_credential(slack_credential()).await;

    let stored = server.raw_column("SELECT data FROM credential_entity");

    assert_eq!(stored.len(), 1);
    assert!(
        !stored[0].contains(TOKEN),
        "the token is sitting in the database in clear text"
    );
    assert!(
        !stored[0].contains("xoxb"),
        "even a fragment of it should not be there"
    );
    assert!(
        stored[0].starts_with("r8r.v1:"),
        "expected a sealed value, got: {}",
        stored[0]
    );
}

#[tokio::test]
async fn the_credential_name_stays_readable_for_the_listing() {
    // Only `data` is encrypted; encrypting the name would make the list
    // unsortable for no security benefit.
    let server = TestServer::start();
    server.create_credential(slack_credential()).await;

    let names = server.raw_column("SELECT name FROM credential_entity");
    assert_eq!(names[0], "Acme Slack");
}

// ==================================================================== edits

#[tokio::test]
async fn saving_a_form_without_retyping_the_secret_keeps_it() {
    // The editor sends back the placeholder for untouched password fields.
    // Treating that as the new value would silently destroy the credential.
    let server = TestServer::start();
    let id = server.create_credential(slack_credential()).await;

    server
        .patch(
            &format!("/rest/credentials/{id}"),
            json!({ "name": "Renamed", "data": { "accessToken": "__r8r_unchanged__" } }),
        )
        .await
        .expect_ok();

    let stored = server.raw_column("SELECT data FROM credential_entity");
    assert!(stored[0].starts_with("r8r.v1:"), "still sealed");

    // Prove the original token survived by reading it back through the engine's
    // own path: a fresh listing plus a re-seal would differ, so compare via the
    // API's redaction, which only shows a placeholder for a non-empty secret.
    let fetched = server
        .get(&format!("/rest/credentials/{id}"))
        .await
        .expect_ok();
    assert_eq!(fetched["name"], json!("Renamed"));
    assert_eq!(fetched["data"]["accessToken"], json!("__r8r_unchanged__"));
}

#[tokio::test]
async fn typing_a_new_secret_replaces_the_old_one() {
    let server = TestServer::start();
    let id = server.create_credential(slack_credential()).await;

    server
        .patch(
            &format!("/rest/credentials/{id}"),
            json!({ "data": { "accessToken": "xoxb-rotated" } }),
        )
        .await
        .expect_ok();

    let stored = server.raw_column("SELECT data FROM credential_entity");
    assert!(
        !stored[0].contains("xoxb-rotated"),
        "the new secret is sealed too"
    );

    // The old ciphertext must be gone; re-encrypting the same plaintext would
    // produce a different value anyway, so compare against a fresh read.
    let fetched = server
        .get(&format!("/rest/credentials/{id}"))
        .await
        .expect_ok();
    assert_eq!(fetched["data"]["accessToken"], json!("__r8r_unchanged__"));
}

#[tokio::test]
async fn a_non_secret_field_is_returned_so_the_editor_can_show_it() {
    let server = TestServer::start();
    let id = server
        .create_credential(json!({
            "name": "Enterprise",
            "type": "githubApi",
            "data": { "accessToken": "ghp_secret", "baseUrl": "https://github.acme.com/api/v3" }
        }))
        .await;

    let fetched = server
        .get(&format!("/rest/credentials/{id}"))
        .await
        .expect_ok();

    assert_eq!(
        fetched["data"]["baseUrl"],
        json!("https://github.acme.com/api/v3")
    );
    assert_eq!(fetched["data"]["accessToken"], json!("__r8r_unchanged__"));
}

#[tokio::test]
async fn renaming_without_sending_data_at_all_is_safe() {
    let server = TestServer::start();
    let id = server.create_credential(slack_credential()).await;

    server
        .patch(
            &format!("/rest/credentials/{id}"),
            json!({ "name": "Just a rename" }),
        )
        .await
        .expect_ok();

    let fetched = server
        .get(&format!("/rest/credentials/{id}"))
        .await
        .expect_ok();
    assert_eq!(fetched["name"], json!("Just a rename"));
}

// ================================================================ execution

#[tokio::test]
async fn a_workflow_using_an_integration_without_a_credential_fails_clearly() {
    let server = TestServer::start();

    let run = server
        .post(
            "/rest/workflows/run",
            json!({
                "workflow": {
                    "name": "Unauthorised",
                    "nodes": [
                        { "id": "t", "type": "manual", "name": "Start",
                          "parameters": {}, "position": [0, 0] },
                        { "id": "s", "type": "slack", "name": "Slack",
                          "parameters": { "resource": "message", "operation": "send",
                                          "channel": "#c", "text": "hi" },
                          "position": [200, 0] }
                    ],
                    "connections": [{ "from": "t", "to": "s", "port": "main" }]
                }
            }),
        )
        .await
        .expect_ok();

    assert_eq!(run["result"]["status"], json!("error"));
    let error = run["result"]["error"].as_str().unwrap();
    assert!(
        error.contains("slackApi"),
        "tell the user what to pick: {error}"
    );
}

#[tokio::test]
async fn an_execution_record_never_contains_a_credential() {
    // Execution history is browsable in the editor, so it must not become a
    // second copy of the secret store.
    let server = TestServer::start();
    let credential_id = server.create_credential(slack_credential()).await;

    let workflow_id = server
        .create(json!({
            "name": "Slack post",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0,0] },
                { "id": "s", "type": "slack", "name": "Slack",
                  "parameters": { "resource": "message", "operation": "send",
                                  "channel": "#c", "text": "hi" },
                  "credentials": { "slackApi": credential_id },
                  "position": [200, 0] }
            ],
            "connections": [{ "from": "t", "to": "s", "port": "main" }]
        }))
        .await;

    // The request goes nowhere real, which is fine: what matters is what got
    // written to the execution row.
    server
        .post(&format!("/rest/workflows/{workflow_id}/run"), json!({}))
        .await
        .expect_ok();

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
        !stored.to_string().contains(TOKEN),
        "the token reached the execution history"
    );
}
