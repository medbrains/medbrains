//! Patient portal sign-in is bounded per address, like staff sign-in.
//!
//! Each code asked for is an SMS and each code tried is a guess; without a
//! per-address limit one client could do either as fast as it liked.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;

/// POST `body` to `path` from `address`.
async fn post_from(
    app: &common::TestApp,
    path: &str,
    address: &str,
    body: &serde_json::Value,
) -> StatusCode {
    app.client
        .post(app.url(path))
        .header("x-forwarded-for", address)
        .json(body)
        .send()
        .await
        .expect("request")
        .status()
}

/// Given one address, When it tries sign-in codes past the limit, Then it is
/// refused, and another address is not.
#[tokio::test]
async fn one_address_cannot_try_portal_codes_without_limit() {
    let app = common::spawn_app().await;
    let guess = json!({ "tenant_code": "NO-SUCH", "phone": "+919800000001", "code": "000000" });
    for _ in 0..5 {
        let status = post_from(&app, "/api/portal/auth/verify", "198.51.100.61", &guess).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }
    assert_eq!(
        post_from(&app, "/api/portal/auth/verify", "198.51.100.61", &guess).await,
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(
        post_from(&app, "/api/portal/auth/verify", "198.51.100.62", &guess).await,
        StatusCode::UNAUTHORIZED
    );
}

/// Given one address, When it asks for codes past the limit, Then it is refused.
#[tokio::test]
async fn one_address_cannot_ask_for_portal_codes_without_limit() {
    let app = common::spawn_app().await;
    let ask = json!({ "tenant_code": "NO-SUCH", "phone": "+919800000001" });
    for _ in 0..5 {
        let status = post_from(&app, "/api/portal/auth/request-otp", "198.51.100.63", &ask).await;
        assert_eq!(status, StatusCode::OK);
    }
    assert_eq!(
        post_from(&app, "/api/portal/auth/request-otp", "198.51.100.63", &ask).await,
        StatusCode::TOO_MANY_REQUESTS
    );
}
