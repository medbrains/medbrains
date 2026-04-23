mod common;

use reqwest::StatusCode;

#[tokio::test]
async fn health_endpoint_returns_ok() {
    let app = common::spawn_app().await;

    let resp = app.get(&app.client, "/api/health").await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    assert_eq!(body["status"], "ok");
    assert_eq!(body["postgres"], "connected");
}
