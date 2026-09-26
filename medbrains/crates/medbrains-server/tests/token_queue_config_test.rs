//! Configured queues (RFCs/modules/RFC-MODULE-token-queues.md, P1a,
//! scenarios 1, 3, 4 and 5).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn own_department(app: &common::TestApp) -> Uuid {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant");
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("QC{suffix}"))
    .bind(format!("Queue config {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department")
}

async fn configure(app: &common::TestApp, csrf: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/queues"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("create queue");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn queue(department: Uuid, extra: Value) -> Value {
    let mut body = json!({
        "name": "General OPD", "module": "opd", "scope": "department", "scope_id": department,
        "prefix": "gen", "start_at": 100, "pad_width": 3, "reset_rule": "daily",
        "max_tokens_per_period": null, "lifecycle": "permanent",
        "valid_from": null, "valid_until": null, "status": "active",
    });
    if let (Some(base), Some(add)) = (body.as_object_mut(), extra.as_object()) {
        base.extend(add.clone());
    }
    body
}

async fn issue(app: &common::TestApp, csrf: &str, department: Uuid) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "module": "opd", "scope": "department", "scope_id": department }))
        .send()
        .await
        .expect("issue");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Scenario 1 — Given the admin sets prefix GEN from 100, Then the next tokens
/// are GEN-100, GEN-101 (the prefix is upper-cased, as a slip needs).
#[tokio::test]
async fn the_admins_numbering_is_the_number_on_the_slip() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (status, _) = configure(&app, &csrf, queue(department, json!({}))).await;
    assert_eq!(status, StatusCode::OK);

    let (_, first) = issue(&app, &csrf, department).await;
    let (_, second) = issue(&app, &csrf, department).await;
    assert_eq!(first["number"], "GEN-100");
    assert_eq!(second["number"], "GEN-101");
}

/// Scenario 3 — Given a limit of 2, When a third token is asked for, Then the
/// desk is told the queue is full, in words, not an error.
#[tokio::test]
async fn a_full_queue_says_so() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    configure(&app, &csrf, queue(department, json!({ "max_tokens_per_period": 2 }))).await;
    for _ in 0..2 {
        assert_eq!(issue(&app, &csrf, department).await.0, StatusCode::OK);
    }
    let (status, body) = issue(&app, &csrf, department).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body.to_string().contains("full for today — 2 of 2"), "{body}");
}

/// Scenario 4 — a paused queue, and a camp queue outside its days, take nobody.
#[tokio::test]
async fn a_paused_or_finished_queue_takes_nobody() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let paused = own_department(&app).await;
    configure(&app, &csrf, queue(paused, json!({ "status": "paused" }))).await;
    let (status, body) = issue(&app, &csrf, paused).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body.to_string().contains("is paused"), "{body}");

    let camp = own_department(&app).await;
    configure(
        &app,
        &csrf,
        queue(
            camp,
            json!({ "name": "Village camp", "lifecycle": "temporary",
                    "valid_from": "2020-01-01", "valid_until": "2020-01-02" }),
        ),
    )
    .await;
    let (status, body) = issue(&app, &csrf, camp).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body.to_string().contains("runs 01 Jan to 02 Jan only"), "{body}");
}

/// Scenario 5 — one live queue per module and place; closing frees the place.
#[tokio::test]
async fn one_live_queue_per_place() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, first) = configure(&app, &csrf, queue(department, json!({}))).await;
    let (status, _) = configure(&app, &csrf, queue(department, json!({ "prefix": "B" }))).await;
    assert_eq!(status, StatusCode::CONFLICT);

    let id = first["id"].as_str().expect("queue id");
    let resp = app
        .client
        .put(app.url(&format!("/api/queues/{id}")))
        .header("x-csrf-token", &csrf)
        .json(&queue(department, json!({ "status": "closed" })))
        .send()
        .await
        .expect("close");
    assert_eq!(resp.status(), StatusCode::OK);
    let (status, _) = configure(&app, &csrf, queue(department, json!({ "prefix": "B" }))).await;
    assert_eq!(status, StatusCode::OK, "a closed queue frees its place");
}

/// A place nobody configured keeps the built-in numbering.
#[tokio::test]
async fn an_unconfigured_place_is_unchanged() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, token) = issue(&app, &csrf, department).await;
    assert_eq!(token["number"], "T-001");
    assert!(token.get("queue_id").is_none_or(Value::is_null));
}
