//! API keys for integration partners (#224): each key has a request budget
//! per minute and is answered 429 past it, and the API's own OpenAPI
//! description is served only to a key (or person) granted it.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};

async fn issue(app: &common::TestApp, csrf: &str, permissions: &[&str], limit: i32) -> String {
    let resp = app
        .client
        .post(app.url("/api/admin/api-keys"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "name": format!("p{}", &uuid::Uuid::new_v4().simple().to_string()[..8]),
            "permissions": permissions,
            "rate_limit_per_minute": limit,
        }))
        .send()
        .await
        .expect("issue");
    let status = resp.status();
    let body: Value = resp.json().await.expect("issue json");
    assert_eq!(status, StatusCode::OK, "{body}");
    body["secret"].as_str().expect("secret").to_owned()
}

async fn get(app: &common::TestApp, key: &str, path: &str) -> StatusCode {
    reqwest::Client::new()
        .get(app.url(path))
        .bearer_auth(key)
        .send()
        .await
        .expect("get")
        .status()
}

#[tokio::test]
async fn a_key_past_its_budget_is_answered_429() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let key = issue(&app, &csrf, &["admin.api_keys.docs"], 2).await;
    assert_eq!(get(&app, &key, "/api/openapi.json").await, StatusCode::OK);
    assert_eq!(get(&app, &key, "/api/openapi.json").await, StatusCode::OK);
    assert_eq!(
        get(&app, &key, "/api/openapi.json").await,
        StatusCode::TOO_MANY_REQUESTS,
        "the third request in the minute is over the budget of 2"
    );
}

#[tokio::test]
async fn the_api_description_is_served_only_to_those_granted_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let without = issue(&app, &csrf, &["patients.list"], 600).await;
    assert_eq!(
        get(&app, &without, "/api/openapi.json").await,
        StatusCode::FORBIDDEN
    );
    let with = issue(&app, &csrf, &["admin.api_keys.docs"], 600).await;
    let spec: Value = reqwest::Client::new()
        .get(app.url("/api/openapi.json"))
        .bearer_auth(&with)
        .send()
        .await
        .expect("spec")
        .json()
        .await
        .expect("spec json");
    assert!(
        spec["openapi"]
            .as_str()
            .unwrap_or_default()
            .starts_with("3.")
    );
    assert!(
        spec["paths"]["/api/openapi.json"].is_object(),
        "it describes itself"
    );
}

#[tokio::test]
async fn an_out_of_range_budget_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let resp = app
        .client
        .post(app.url("/api/admin/api-keys"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "name": "too-fast", "permissions": ["patients.list"], "rate_limit_per_minute": 100_000 }))
        .send()
        .await
        .expect("issue");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
