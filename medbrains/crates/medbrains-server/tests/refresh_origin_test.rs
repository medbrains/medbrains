//! A cookie session is refreshed only from the app's own origin.

use crate::common;

use reqwest::StatusCode;

/// Given a signed-in browser session, When a page on another origin of the
/// same site asks for a refresh with the person's cookie, Then it is refused
/// and the session is untouched; the app's own refresh still works after.
#[tokio::test]
async fn a_cookie_refresh_from_another_origin_is_refused() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let forged = app
        .client
        .post(app.url("/api/auth/refresh"))
        .header("sec-fetch-site", "same-site")
        .send()
        .await
        .expect("refresh from another origin");
    assert_eq!(forged.status(), StatusCode::FORBIDDEN);

    let own = app
        .client
        .post(app.url("/api/auth/refresh"))
        .header("sec-fetch-site", "same-origin")
        .header("content-type", "application/json")
        .body("{}")
        .send()
        .await
        .expect("refresh from the app");
    assert_eq!(own.status(), StatusCode::OK);
}
