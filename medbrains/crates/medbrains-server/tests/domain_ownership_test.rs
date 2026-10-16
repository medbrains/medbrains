//! A hospital's own domain takes effect only once proven. Naming a domain
//! issues a token for a DNS TXT record; until the record is found the
//! certificate front end is refused (`/api/tls/allow` 404) and sign-in does
//! not follow the domain. Once proven it is allowed; naming a different
//! domain starts over.

mod common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn call(
    app: &common::TestApp,
    csrf: &str,
    method: Method,
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

async fn tls_allows(app: &common::TestApp, domain: &str) -> StatusCode {
    reqwest::Client::new()
        .get(app.url(&format!("/api/tls/allow?domain={domain}")))
        .send()
        .await
        .expect("ask")
        .status()
}

#[tokio::test]
async fn a_custom_domain_is_proven_before_it_takes_effect() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let before: (Option<String>, Option<String>, Option<chrono::DateTime<chrono::Utc>>) = sqlx::query_as(
        "SELECT custom_domain, custom_domain_token, custom_domain_verified_at FROM tenants WHERE id = $1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("before");
    let t = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let domain = format!("hms-{t}.example-hospital.in");

    let (s, _) = call(
        &app,
        &csrf,
        Method::PUT,
        "/api/setup/tenant",
        json!({ "custom_domain": domain }),
    )
    .await;
    assert!(s.is_success());
    let (_, own) = call(
        &app,
        &csrf,
        Method::GET,
        "/api/admin/domain-ownership",
        Value::Null,
    )
    .await;
    assert_eq!(own["record_name"], format!("_medbrains-verify.{domain}"));
    assert!(own["token"].as_str().is_some_and(|t| t.len() == 32));
    assert!(own["verified_at"].is_null(), "not proven yet");
    assert_eq!(
        tls_allows(&app, &domain).await,
        StatusCode::NOT_FOUND,
        "no certificate for an unproven domain"
    );

    // No TXT record exists for a made-up name: verifying says so.
    let (s, refused) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/admin/domain-ownership/verify",
        json!({}),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "{refused}");

    // The record is found (as DNS would answer): the domain is proven.
    sqlx::query("UPDATE tenants SET custom_domain_verified_at = now() WHERE id = $1")
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("prove");
    assert_eq!(tls_allows(&app, &domain).await, StatusCode::OK);
    assert_eq!(
        tls_allows(&app, &format!("{}.", domain.to_uppercase())).await,
        StatusCode::OK,
        "case and trailing dot"
    );

    // A different domain starts over: unproven, new token.
    let token_before = own["token"].clone();
    let other = format!("emr-{t}.example-hospital.in");
    let (s, _) = call(
        &app,
        &csrf,
        Method::PUT,
        "/api/setup/tenant",
        json!({ "custom_domain": other }),
    )
    .await;
    assert!(s.is_success());
    let (_, own2) = call(
        &app,
        &csrf,
        Method::GET,
        "/api/admin/domain-ownership",
        Value::Null,
    )
    .await;
    assert!(own2["verified_at"].is_null());
    assert_ne!(own2["token"], token_before);
    assert_eq!(
        tls_allows(&app, &domain).await,
        StatusCode::NOT_FOUND,
        "the old domain no longer counts"
    );

    sqlx::query("UPDATE tenants SET custom_domain = $2, custom_domain_token = $3, custom_domain_verified_at = $4 WHERE id = $1")
        .bind(tenant)
        .bind(before.0)
        .bind(before.1)
        .bind(before.2)
        .execute(&app.db)
        .await
        .expect("restore");
}
