//! Two sign-in routes that answered 500 to ordinary requests.

use crate::common;

use reqwest::StatusCode;

/// Given no sign-in provider with this id, When the sign-in page starts SSO
/// with it, Then the answer is a plain 404, not a 500.
#[tokio::test]
async fn an_unknown_sso_provider_is_not_found() {
    let app = common::spawn_app().await;
    let unknown = uuid::Uuid::new_v4();
    let resp = app
        .client
        .get(app.url(&format!("/api/auth/sso/{unknown}/authorize")))
        .send()
        .await
        .expect("authorize");
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    let body = resp.text().await.expect("body");
    assert!(!body.contains("decod"), "internal detail in {body}");
}

/// Given nobody signed in, When the resend-verification link is asked for,
/// Then it is a 401; Given a signed-in user, Then it is sent (200), not a 500.
#[tokio::test]
async fn resend_verification_needs_and_uses_the_session() {
    let app = common::spawn_app().await;
    let anon = reqwest::Client::new()
        .post(app.url("/api/auth/resend-verification"))
        .send()
        .await
        .expect("anonymous resend");
    assert_eq!(anon.status(), StatusCode::UNAUTHORIZED);

    let csrf = app.login_admin().await;
    let own = app
        .client
        .post(app.url("/api/auth/resend-verification"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("resend");
    assert_eq!(own.status(), StatusCode::OK);
}
