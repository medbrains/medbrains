//! Workflow history: what it looked like before somebody changed it.
//!
//! The situation these exist for is narrow and common. An active workflow
//! stops working. Somebody edited it. Nobody remembers what they edited. The
//! history has to answer that, and the restore has to be safe enough to use
//! at two in the morning without reading the documentation first.

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

fn sync_workflow(timeout: i64) -> Value {
    json!({
        "name": "Nightly patient sync",
        "nodes": [
            { "id": "t", "type": "manual", "name": "Start", "parameters": {}, "position": [0, 0] },
            { "id": "fetch", "type": "httpRequest", "name": "Fetch patients",
              "parameters": { "url": "https://api.example.com/patients", "timeoutMs": timeout },
              "position": [200, 0] }
        ],
        "connections": [{ "from": "t", "to": "fetch", "port": "main" }]
    })
}

/// The same workflow behind a webhook, so it can actually be switched on.
fn scheduled_workflow(timeout: i64) -> Value {
    let mut workflow = sync_workflow(timeout);
    workflow["nodes"][0] = json!({
        "id": "t", "type": "webhook", "name": "On admission",
        "parameters": { "path": "admissions", "method": "POST", "respond": "lastNode" },
        "position": [0, 0]
    });
    workflow
}

async fn history(server: &TestServer, id: &str) -> Vec<Value> {
    server
        .get(&format!("/rest/workflows/{id}/versions"))
        .await
        .expect_ok()
        .as_array()
        .expect("a list of versions")
        .clone()
}

// ================================================================= recording

#[tokio::test]
async fn creating_a_workflow_starts_its_history() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;

    let versions = history(&server, &id).await;

    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0]["version"], json!(1));
    // Nothing to compare the first version against, so it says what it is
    // rather than listing every node as an addition.
    assert_eq!(versions[0]["summary"], json!("Created"));
}

#[tokio::test]
async fn every_edit_adds_a_version_and_says_what_it_changed() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;

    server
        .patch(&format!("/rest/workflows/{id}"), sync_workflow(1_000))
        .await
        .expect_ok();

    let versions = history(&server, &id).await;

    // Newest first: the history reads like a page somebody scrolls down.
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0]["version"], json!(2));
    assert_eq!(versions[0]["summary"], json!("1 step edited"));

    let field = &versions[0]["changes"]["nodesChanged"][0]["fields"][0];
    assert_eq!(field["path"], json!("timeoutMs"));
    assert_eq!(field["before"], json!(30_000));
    assert_eq!(field["after"], json!(1_000));
}

#[tokio::test]
async fn saving_without_changing_anything_does_not_add_a_version() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;

    // The editor saves on a timer as well as on demand. A history full of
    // identical entries hides the one edit that mattered.
    for _ in 0..3 {
        server
            .patch(&format!("/rest/workflows/{id}"), sync_workflow(30_000))
            .await
            .expect_ok();
    }

    assert_eq!(history(&server, &id).await.len(), 1);
}

#[tokio::test]
async fn moving_a_node_around_the_canvas_does_not_add_a_version() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;

    let mut moved = sync_workflow(30_000);
    moved["nodes"][1]["position"] = json!([640, 320]);
    server
        .patch(&format!("/rest/workflows/{id}"), moved)
        .await
        .expect_ok();

    assert_eq!(history(&server, &id).await.len(), 1);
}

#[tokio::test]
async fn turning_a_workflow_on_is_not_an_edit_to_what_it_does() {
    let server = TestServer::start();
    let id = server.create(scheduled_workflow(30_000)).await;

    server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await
        .expect_ok();

    // Activation is operational state, not a revision. Recording it would put
    // an entry in the history for every scheduled pause and resume.
    assert_eq!(history(&server, &id).await.len(), 1);
}

// =================================================================== reading

#[tokio::test]
async fn an_old_version_can_be_read_back_exactly_as_it_was() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;
    server
        .patch(&format!("/rest/workflows/{id}"), sync_workflow(1_000))
        .await
        .expect_ok();

    let first = server
        .get(&format!("/rest/workflows/{id}/versions/1"))
        .await
        .expect_ok();

    assert_eq!(
        first["workflow"]["nodes"][1]["parameters"]["timeoutMs"],
        json!(30_000)
    );
    assert_eq!(first["version"], json!(1));
}

#[tokio::test]
async fn two_versions_can_be_compared_directly_without_walking_the_history() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;
    for timeout in [20_000, 10_000, 1_000] {
        server
            .patch(&format!("/rest/workflows/{id}"), sync_workflow(timeout))
            .await
            .expect_ok();
    }

    // "What has changed since the version that was working" is the question,
    // and it is rarely about two adjacent versions.
    let changes = server
        .post(
            &format!("/rest/workflows/{id}/versions/compare"),
            json!({ "from": 1, "to": 4 }),
        )
        .await
        .expect_ok();

    let field = &changes["nodesChanged"][0]["fields"][0];
    assert_eq!(field["before"], json!(30_000));
    assert_eq!(field["after"], json!(1_000));
}

#[tokio::test]
async fn asking_for_a_version_that_never_existed_says_so() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;

    server
        .get(&format!("/rest/workflows/{id}/versions/99"))
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn asking_for_the_history_of_a_workflow_that_never_existed_says_so() {
    let server = TestServer::start();

    server
        .get("/rest/workflows/nope/versions")
        .await
        .expect_status(StatusCode::NOT_FOUND);
}

// ================================================================= restoring

#[tokio::test]
async fn restoring_puts_the_workflow_back_the_way_it_was() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;
    server
        .patch(&format!("/rest/workflows/{id}"), sync_workflow(1_000))
        .await
        .expect_ok();

    let restored = server
        .post(
            &format!("/rest/workflows/{id}/versions/1/restore"),
            json!({}),
        )
        .await
        .expect_ok();

    assert_eq!(
        restored["nodes"][1]["parameters"]["timeoutMs"],
        json!(30_000)
    );

    // And it is what the workflow is now, not just what the response said.
    let current = server
        .get(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();
    assert_eq!(
        current["nodes"][1]["parameters"]["timeoutMs"],
        json!(30_000)
    );
}

#[tokio::test]
async fn a_restore_is_recorded_as_a_version_of_its_own() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;
    server
        .patch(&format!("/rest/workflows/{id}"), sync_workflow(1_000))
        .await
        .expect_ok();

    server
        .post(
            &format!("/rest/workflows/{id}/versions/1/restore"),
            json!({}),
        )
        .await
        .expect_ok();

    let versions = history(&server, &id).await;

    // History is append-only. The restore did not remove version 2 — which
    // matters when the restore turns out to be the thing that broke something.
    assert_eq!(versions.len(), 3);
    assert_eq!(versions[0]["version"], json!(3));
    assert_eq!(versions[0]["note"], json!("Restored version 1"));
    assert_eq!(versions[1]["version"], json!(2));
}

#[tokio::test]
async fn restoring_does_not_switch_a_workflow_on_or_off() {
    let server = TestServer::start();
    let id = server.create(scheduled_workflow(30_000)).await;
    server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await
        .expect_ok();
    server
        .patch(&format!("/rest/workflows/{id}"), scheduled_workflow(1_000))
        .await
        .expect_ok();

    let restored = server
        .post(
            &format!("/rest/workflows/{id}/versions/1/restore"),
            json!({}),
        )
        .await
        .expect_ok();

    // A version records what a workflow does, not whether it was running.
    // Restoring one at two in the morning must not silently stop the thing
    // that is keeping the ward's data in sync.
    assert_eq!(restored["active"], json!(true));
}

#[tokio::test]
async fn restoring_the_version_a_workflow_is_already_at_records_nothing_new() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;

    server
        .post(
            &format!("/rest/workflows/{id}/versions/1/restore"),
            json!({}),
        )
        .await
        .expect_ok();

    // Nothing changed, so there is nothing to record — the same rule as any
    // other save.
    assert_eq!(history(&server, &id).await.len(), 1);
}

#[tokio::test]
async fn restoring_a_version_that_never_existed_leaves_the_workflow_alone() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;

    server
        .post(
            &format!("/rest/workflows/{id}/versions/99/restore"),
            json!({}),
        )
        .await
        .expect_status(StatusCode::NOT_FOUND);

    let current = server
        .get(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();
    assert_eq!(
        current["nodes"][1]["parameters"]["timeoutMs"],
        json!(30_000)
    );
}

// ================================================================= retention

#[tokio::test]
async fn history_stops_growing_but_never_drops_the_current_version() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(1)).await;

    // Somebody tuning a timeout, one save at a time, all afternoon.
    for timeout in 2..=60 {
        server
            .patch(&format!("/rest/workflows/{id}"), sync_workflow(timeout))
            .await
            .expect_ok();
    }

    let versions = history(&server, &id).await;

    assert_eq!(versions.len(), 50, "the oldest are dropped, not the newest");
    assert_eq!(versions[0]["version"], json!(60));
    // Version 60 is what the workflow is right now, so trimming from the old
    // end can never discard what is deployed.
    let newest = server
        .get(&format!("/rest/workflows/{id}/versions/60"))
        .await
        .expect_ok();
    assert_eq!(
        newest["workflow"]["nodes"][1]["parameters"]["timeoutMs"],
        json!(60)
    );
}

#[tokio::test]
async fn deleting_a_workflow_takes_its_history_with_it() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;
    server
        .patch(&format!("/rest/workflows/{id}"), sync_workflow(1_000))
        .await
        .expect_ok();

    server
        .delete(&format!("/rest/workflows/{id}"))
        .await
        .expect_ok();

    let orphans = server.raw_column(&format!(
        "SELECT version FROM workflow_version WHERE workflow_id = '{id}'"
    ));
    assert!(orphans.is_empty(), "history outlived the workflow");
}

#[tokio::test]
async fn history_survives_a_restart() {
    let server = TestServer::start();
    let id = server.create(sync_workflow(30_000)).await;
    server
        .patch(&format!("/rest/workflows/{id}"), sync_workflow(1_000))
        .await
        .expect_ok();

    let restarted = server.restart();

    assert_eq!(history(&restarted, &id).await.len(), 2);
}

#[tokio::test]
async fn editing_a_running_workflow_does_not_switch_it_off() {
    let server = TestServer::start();
    let id = server.create(scheduled_workflow(30_000)).await;
    server
        .patch(
            &format!("/rest/workflows/{id}/activate"),
            json!({ "active": true }),
        )
        .await
        .expect_ok();

    // The payload does not mention `active` — the editor's autosave does not
    // either. Deciding activation from the body would stop a live workflow as
    // a side effect of changing a timeout.
    let saved = server
        .patch(&format!("/rest/workflows/{id}"), scheduled_workflow(1_000))
        .await
        .expect_ok();

    assert_eq!(saved["active"], json!(true));
    assert_eq!(saved["nodes"][1]["parameters"]["timeoutMs"], json!(1_000));
}

#[tokio::test]
async fn a_save_cannot_switch_a_workflow_on_either() {
    let server = TestServer::start();
    let id = server.create(scheduled_workflow(30_000)).await;

    let mut payload = scheduled_workflow(1_000);
    payload["active"] = json!(true);
    let saved = server
        .patch(&format!("/rest/workflows/{id}"), payload)
        .await
        .expect_ok();

    // Activation is a deliberate act with its own endpoint and its own
    // validation. A save claiming it would bypass both.
    assert_eq!(saved["active"], json!(false));
}
