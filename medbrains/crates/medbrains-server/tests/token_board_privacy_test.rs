//! A waiting-room board is sent no names
//! (RFCs/modules/RFC-MODULE-token-queues.md, P3, scenario 34).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A user who reads boards only as a display: `admin.tv_displays.board`
/// granted, the desk's `front_office.queue.list` denied.
async fn display_client(app: &common::TestApp, csrf: &str) -> reqwest::Client {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let username = format!("tv_{suffix}");
    let password = format!("Tv-Board-{suffix}-9!");
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "username": username, "email": format!("{username}@e2e.medbrains.localhost"),
            "password": password, "full_name": "Waiting Room TV", "role": "nurse",
        }))
        .send()
        .await
        .expect("create user");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    sqlx::query(
        "UPDATE users SET access_matrix = jsonb_build_object( \
           'extra', '[\"admin.tv_displays.board\"]'::jsonb, \
           'denied', '[\"front_office.queue.list\"]'::jsonb), \
           perm_version = perm_version + 1 \
         WHERE username = $1",
    )
    .bind(&username)
    .execute(&app.db)
    .await
    .expect("display-only access");
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    assert_eq!(login.status(), StatusCode::OK, "display login");
    client
}

async fn board(client: &reqwest::Client, app: &common::TestApp, department: Uuid) -> Vec<Value> {
    client
        .get(app.url(&format!(
            "/api/tokens/board?module=opd&scope=department&scope_id={department}"
        )))
        .send()
        .await
        .expect("board")
        .json()
        .await
        .expect("board json")
}

/// Given a named patient waiting, When a desk reads the board, Then it sees the
/// name (the two-identifier check); When a display reads it, Then no name is
/// sent at all; And a queue that opts into initials sends "A. K." only.
#[tokio::test]
async fn a_display_is_sent_the_number_and_at_most_initials() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("BP{suffix}"))
    .bind(format!("Board privacy {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department");
    let queue: Value = app
        .client
        .post(app.url("/api/queues"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "name": "Privacy OPD", "module": "opd", "scope": "department", "scope_id": department,
            "prefix": "PV", "start_at": 1, "pad_width": 3, "reset_rule": "daily",
            "max_tokens_per_period": null, "lifecycle": "permanent", "valid_from": null,
            "valid_until": null, "status": "active",
        }))
        .send()
        .await
        .expect("queue")
        .json()
        .await
        .expect("queue json");
    app.client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "module": "opd", "scope": "department", "scope_id": department,
                       "patient_name": "Anita Kumari" }),
        )
        .send()
        .await
        .expect("issue");

    let desk = board(&app.client, &app, department).await;
    assert_eq!(
        desk[0]["patient_name"], "Anita Kumari",
        "the desk needs the name"
    );

    let tv = display_client(&app, &csrf).await;
    let shown = board(&tv, &app, department).await;
    assert_eq!(shown[0]["number"], "PV-001");
    assert!(
        shown[0]["patient_name"].is_null(),
        "no name to a public screen: {}",
        shown[0]
    );

    sqlx::query("UPDATE queues SET board_shows = 'initials' WHERE id = $1::uuid")
        .bind(queue["id"].as_str().expect("queue id"))
        .execute(&app.db)
        .await
        .expect("opt into initials");
    assert_eq!(
        board(&tv, &app, department).await[0]["patient_name"],
        "A. K."
    );
}
