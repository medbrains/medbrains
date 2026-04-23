mod common;

use reqwest::StatusCode;

#[tokio::test]
async fn test_login_valid() {
    let app = common::spawn_app().await;

    let resp = app
        .post_json(
            &app.client,
            "/api/auth/login",
            &serde_json::json!({
                "username": "admin",
                "password": "admin123"
            }),
        )
        .await;

    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    assert_eq!(body["user"]["role"], "super_admin");
    assert_eq!(body["user"]["username"], "admin");
    assert!(body["csrf_token"].is_string());
}

#[tokio::test]
async fn test_login_invalid() {
    let app = common::spawn_app().await;

    let resp = app
        .post_json(
            &app.client,
            "/api/auth/login",
            &serde_json::json!({
                "username": "admin",
                "password": "wrong_password"
            }),
        )
        .await;

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_login_no_user() {
    let app = common::spawn_app().await;

    let resp = app
        .post_json(
            &app.client,
            "/api/auth/login",
            &serde_json::json!({
                "username": "nonexistent",
                "password": "test"
            }),
        )
        .await;

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_protected_no_auth() {
    let app = common::spawn_app().await;

    // Access protected endpoint without logging in
    let resp = app.get(&app.client, "/api/patients").await;
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[ignore] // reqwest cookie jar doesn't forward HttpOnly cookies to 127.0.0.1 — works in real browser
async fn test_me_endpoint() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    let resp = app.get(&app.client, "/api/auth/me").await;
    assert_eq!(resp.status(), StatusCode::OK);
}
