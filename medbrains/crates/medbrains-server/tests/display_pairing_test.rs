//! Pairing a waiting-room screen (RFCs/modules/RFC-MODULE-token-queues.md,
//! P3b, scenario 38).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(
    app: &common::TestApp,
    csrf: Option<&str>,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let mut req = app.client.post(app.url(path)).json(&body);
    if let Some(csrf) = csrf {
        req = req.header("x-csrf-token", csrf);
    }
    let resp = req.send().await.expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn as_screen(app: &common::TestApp, jwt: &str, path: &str) -> (StatusCode, Value) {
    let resp = reqwest::Client::new()
        .get(app.url(path))
        .bearer_auth(jwt)
        .send()
        .await
        .expect("screen request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a TV asking to be paired, When the administrator approves it for the
/// OPD board of one department, Then the TV opens on that board, reads it
/// without patient names, and can do nothing else — it acts as the hospital's
/// display account, never as the administrator who approved it.
#[tokio::test]
async fn an_approved_screen_shows_its_board_and_nothing_else() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("DP{suffix}"))
    .bind(format!("Screen OPD {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department");

    let (status, code) = post(
        &app,
        None,
        "/api/device-pairing/device-code",
        json!({ "app_variant": "tv", "label": "Waiting hall TV" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{code}");
    let user_code = code["user_code"].as_str().expect("user code");

    // A screen must be told which board it shows.
    let (status, _) = post(
        &app,
        Some(&csrf),
        "/api/admin/device-pairing/approve",
        json!({ "user_code": user_code }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, body) = post(
        &app,
        Some(&csrf),
        "/api/admin/device-pairing/approve",
        json!({ "user_code": user_code, "department_id": department, "board_module": "opd" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let (status, token) = post(
        &app,
        None,
        "/api/device-pairing/device-token",
        json!({ "device_code": code["device_code"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{token}");
    let jwt = token["jwt"].as_str().expect("screen jwt");
    let acts_as: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1::uuid")
        .bind(token["user_id"].as_str().expect("user id"))
        .fetch_one(&app.db)
        .await
        .expect("screen user");
    assert_eq!(
        acts_as, "display_boards",
        "never the approving administrator"
    );

    let (status, board) = as_screen(&app, jwt, "/api/device/board").await;
    assert_eq!(status, StatusCode::OK, "{board}");
    assert_eq!(board["module"], "opd");
    assert_eq!(board["department_id"], department.to_string().as_str());

    app.client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "module": "opd", "scope": "department", "scope_id": department,
                       "patient_name": "Ravi Shankar" }),
        )
        .send()
        .await
        .expect("issue");
    let path = format!("/api/tokens/board?module=opd&scope=department&scope_id={department}");
    let (status, tokens) = as_screen(&app, jwt, &path).await;
    assert_eq!(status, StatusCode::OK, "{tokens}");
    assert!(tokens[0]["patient_name"].is_null(), "{tokens}");

    let (status, _) = as_screen(&app, jwt, "/api/patients").await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a screen cannot list patients"
    );
}
