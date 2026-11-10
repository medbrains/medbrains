//! Chronic-care programmes can be created, listed and edited.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: reqwest::Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_uppercase()
}

/// Given an admin setting up a diabetes programme, When it is created, listed
/// and edited, Then each answers with the programme, not a 500 from reading
/// the programme-type enum into text.
#[tokio::test]
async fn a_chronic_care_programme_can_be_created_listed_and_edited() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let code = format!("DM{}", tag());
    let (status, created) = send(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/chronic-care/programs",
        json!({ "name": "Diabetes clinic", "code": code, "program_type": "diabetes" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    assert_eq!(created["program_type"], "diabetes");

    let (status, list) = send(
        &app,
        &csrf,
        reqwest::Method::GET,
        &format!("/api/chronic-care/programs?search={code}"),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert_eq!(list.as_array().map(Vec::len), Some(1));

    let id = created["id"].as_str().expect("id");
    let (status, updated) = send(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &format!("/api/chronic-care/programs/{id}"),
        json!({ "default_duration_months": 12 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(updated["default_duration_months"], 12);
}
