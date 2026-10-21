//! An API path nothing answers is a JSON 404 — never the web app's page,
//! which the static fallback serves with a 200 for the app's own routes.

use crate::common;

use reqwest::StatusCode;
use serde_json::Value;

#[tokio::test]
async fn an_unknown_api_path_is_a_json_404() {
    let app = common::spawn_app().await;
    let resp = app
        .client
        .get(app.url("/api/no-such-thing/here"))
        .send()
        .await
        .expect("request");
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    let body: Value = resp.json().await.expect("a JSON body, not HTML");
    assert_eq!(body["error"], "not found");

    let known = app
        .client
        .get(app.url("/api/health"))
        .send()
        .await
        .expect("health");
    assert_eq!(
        known.status(),
        StatusCode::OK,
        "real routes win over the wildcard"
    );
}
