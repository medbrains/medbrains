//! Code blue — the table-only half of the linkage.
//!
//! The Playwright spec proves what the API shows: who was paged, who
//! answered, who was stood down. This proves what only the tables show: the
//! outbox rows the handlers emit, the NABH arrival the first response
//! writes, and that delivering an event twice pages nobody twice.
//!
//! `spawn_app` never starts the outbox worker, which is the lever: the emit
//! half is a SELECT on outbox_events, and the consume half is a direct call
//! into the pipeline dispatcher — deterministic, no polling.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn count_notifications(app: &common::TestApp, code_blue_id: Uuid, title: &str) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM notifications \
          WHERE entity_type = 'code_blue' AND entity_id = $1 AND title = $2",
    )
    .bind(code_blue_id)
    .bind(title)
    .fetch_one(&app.db)
    .await
    .expect("count notifications")
}

#[tokio::test]
async fn code_blue_emits_pages_once_records_arrival_and_stands_down() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "first_name": "Linkage",
            "last_name": "CodeBlue",
            "gender": "female",
            "phone": "9990000071",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant id");

    // ── start: the handler emits the activation ──────────────────────
    let started: Value = app
        .client
        .post(app.url("/api/nurse/code-blue"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": patient_id, "location": "Linkage Ward" }))
        .send()
        .await
        .expect("start code blue")
        .json()
        .await
        .expect("code blue json");
    let code_blue_id: Uuid = started["id"].as_str().and_then(|s| s.parse().ok()).expect("code blue id");
    let id_str = code_blue_id.to_string();

    let emitted = app.outbox_rows("emergency.code_blue.activated", &id_str).await;
    assert_eq!(emitted.len(), 1, "start_code_blue must queue exactly one activation event");

    // ── consume, twice: pages once ───────────────────────────────────
    let payload = json!({
        "code_blue_id": code_blue_id,
        "patient_id": patient_id,
        "location": "Linkage Ward",
    });
    app.dispatch(tenant_id, "emergency.code_blue.activated", &payload).await;
    let paged = count_notifications(&app, code_blue_id, "CODE BLUE").await;
    assert!(paged >= 1, "a code blue that pages nobody is the failure this exists to catch");
    app.dispatch(tenant_id, "emergency.code_blue.activated", &payload).await;
    assert_eq!(
        count_notifications(&app, code_blue_id, "CODE BLUE").await,
        paged,
        "a redelivered activation must not page the same people twice"
    );

    // ── respond: the first answer is NABH's arrival time ─────────────
    let resp = app
        .client
        .post(app.url(&format!("/api/nurse/code-blue/{code_blue_id}/respond")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("respond");
    assert_eq!(resp.status(), StatusCode::OK);
    let (arrived, seconds): (bool, Option<i32>) = sqlx::query_as(
        "SELECT team_arrived_at IS NOT NULL, response_seconds \
           FROM nabh_code_blue_activations \
          WHERE tenant_id = $1 AND source_module = 'code_blue_events' AND source_record_id = $2",
    )
    .bind(tenant_id)
    .bind(code_blue_id)
    .fetch_one(&app.db)
    .await
    .expect("nabh mirror row exists for the activation");
    assert!(arrived, "the first response must fill team_arrived_at");
    assert!(seconds.is_some(), "response_seconds derives from the arrival");

    // ── end: stand-down to exactly the paged users, once ─────────────
    let ended = app
        .client
        .put(app.url(&format!("/api/nurse/code-blue/{code_blue_id}/end")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "outcome": "rosc" }))
        .send()
        .await
        .expect("end code blue");
    assert_eq!(ended.status(), StatusCode::OK);
    assert_eq!(app.outbox_rows("emergency.code_blue.completed", &id_str).await.len(), 1);

    let done = json!({ "code_blue_id": code_blue_id, "outcome": "rosc" });
    app.dispatch(tenant_id, "emergency.code_blue.completed", &done).await;
    app.dispatch(tenant_id, "emergency.code_blue.completed", &done).await;
    assert_eq!(
        count_notifications(&app, code_blue_id, "Code blue stood down").await,
        paged,
        "stand-down goes to the paged users and only once"
    );

    // ── after the end, answering is not a response ───────────────────
    let late = app
        .client
        .post(app.url(&format!("/api/nurse/code-blue/{code_blue_id}/respond")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("late respond");
    assert_eq!(late.status(), StatusCode::NOT_FOUND);
}
