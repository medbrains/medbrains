//! Connected apps (RFC-HOSPITAL-OS C1): a vendor app is registered from its
//! manifest, cannot sign in until approved, gets only the permissions its
//! manifest names, and is cut off on the very next call when revoked.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

fn manifest(permissions: &[&str], reads: &[&str]) -> Value {
    json!({
        "manifestVersion": 1,
        "kind": "service",
        "name": format!("Census {}", &Uuid::new_v4().simple().to_string()[..6]),
        "purpose": "Sends admission ids to the regional bed dashboard.",
        "publisher": { "name": "Example Health Tech" },
        "version": "1.0.0",
        "permissions": permissions,
        "reads": reads,
        "events": ["patient.created"],
        "dataClasses": ["routine", "identifying"],
        "sendsDataTo": [{ "name": "Bed dashboard", "url": "https://beds.example-health.dev", "purpose": "Bed availability" }],
        "webhookUrl": "https://beds.example-health.dev/hooks/medbrains",
    })
}

async fn token(app: &common::TestApp, client_id: &str, secret: &str) -> (StatusCode, Value) {
    let resp = reqwest::Client::new()
        .post(app.url("/api/oauth/token"))
        .form(&[
            ("grant_type", "client_credentials"),
            ("client_id", client_id),
            ("client_secret", secret),
        ])
        .send()
        .await
        .expect("token");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn call(app: &common::TestApp, bearer: &str, path: &str) -> StatusCode {
    reqwest::Client::new()
        .get(app.url(path))
        .bearer_auth(bearer)
        .send()
        .await
        .expect("call")
        .status()
}

async fn admin_post(
    app: &common::TestApp,
    csrf: &str,
    path: &str,
    body: &Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(body)
        .send()
        .await
        .expect("admin post");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn an_app_gets_exactly_its_grant_until_revoked() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;

    // A wildcard never gets past the manifest check.
    let (status, _) = admin_post(
        &app,
        &csrf,
        "/api/admin/connected-apps",
        &json!({ "manifest": manifest(&["patients.*"], &[]) }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, issued) = admin_post(
        &app,
        &csrf,
        "/api/admin/connected-apps",
        &json!({ "manifest": manifest(&["patients.view"], &["Patient"]) }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{issued}");
    let id = issued["id"].as_str().expect("id").to_owned();
    let client_id = issued["client_id"].as_str().expect("client_id").to_owned();
    let secret = issued["client_secret"].as_str().expect("secret").to_owned();
    assert!(
        issued["webhook_signing_secret"]
            .as_str()
            .unwrap_or_default()
            .starts_with("whsec_")
    );

    // Only a hash is kept; the secret appears nowhere in the database's audit trail.
    let hash: String =
        sqlx::query_scalar("SELECT client_secret_hash FROM connected_apps WHERE id = $1::uuid")
            .bind(&id)
            .fetch_one(&app.db)
            .await
            .expect("hash");
    assert!(hash.starts_with("$argon2") && !hash.contains(&secret));
    let leaked: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE new_values::text LIKE '%' || $1 || '%'",
    )
    .bind(&secret)
    .fetch_one(&app.db)
    .await
    .expect("audit scan");
    assert_eq!(
        leaked, 0,
        "the client secret must never reach the audit log"
    );

    // Pending: right secret, but not let in. Wrong or unknown: no detail.
    let (status, body) = token(&app, &client_id, &secret).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (StatusCode::BAD_REQUEST, Some("unauthorized_client"))
    );
    let (status, body) = token(&app, &client_id, "mbcs_wrong").await;
    assert_eq!(
        (status, body["error"].as_str()),
        (StatusCode::UNAUTHORIZED, Some("invalid_client"))
    );
    let (status, _) = token(&app, "mbapp_000000000000000000000000", &secret).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, _) = admin_post(
        &app,
        &csrf,
        &format!("/api/admin/connected-apps/{id}/approve"),
        &json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let active: bool = sqlx::query_scalar(
        "SELECT s.is_active FROM webhook_subscriptions s JOIN connected_apps a ON a.webhook_subscription_id = s.id WHERE a.id = $1::uuid",
    ).bind(&id).fetch_one(&app.db).await.expect("subscription");
    assert!(active, "approval switches its event deliveries on");

    let (status, body) = token(&app, &client_id, &secret).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["token_type"], "Bearer");
    assert_eq!(body["expires_in"], 900);
    let bearer = body["access_token"].as_str().expect("token").to_owned();

    // Granted: past the permission gate (an unknown patient is then 404).
    // Not granted: 403. Least privilege, through the same checks as anyone.
    let patient = Uuid::new_v4();
    assert_eq!(
        call(&app, &bearer, &format!("/api/fhir/Patient/{patient}")).await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        call(&app, &bearer, "/api/admin/api-keys").await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(&app, &bearer, "/api/admin/connected-apps").await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(&app, &bearer, "/api/auth/me").await,
        StatusCode::FORBIDDEN,
        "the session surface stays closed"
    );

    // Audited with the app as the actor.
    let actor: Option<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM audit_log WHERE action = 'connected_app_token_issued' AND entity_id = $1::uuid ORDER BY created_at DESC LIMIT 1",
    ).bind(&id).fetch_one(&app.db).await.expect("audit");
    let service_user: Uuid =
        sqlx::query_scalar("SELECT service_user_id FROM connected_apps WHERE id = $1::uuid")
            .bind(&id)
            .fetch_one(&app.db)
            .await
            .expect("service user");
    assert_eq!(actor, Some(service_user));

    // App tokens are not listed with hand-issued keys.
    let keys: Value = app
        .client
        .get(app.url("/api/admin/api-keys"))
        .send()
        .await
        .expect("keys")
        .json()
        .await
        .expect("json");
    assert!(keys.as_array().is_some_and(|k| k.iter().all(|row| {
        !row["name"]
            .as_str()
            .unwrap_or_default()
            .contains("(OAuth token)")
    })));

    // Revoked: the very next call with the live token is refused.
    let (status, body) = admin_post(
        &app,
        &csrf,
        &format!("/api/admin/connected-apps/{id}/revoke"),
        &json!({ "reason": "test" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["tokens_revoked"], 1);
    assert_eq!(
        call(&app, &bearer, &format!("/api/fhir/Patient/{patient}")).await,
        StatusCode::UNAUTHORIZED
    );
    let (status, body) = token(&app, &client_id, &secret).await;
    assert_eq!(
        (status, body["error"].as_str()),
        (StatusCode::BAD_REQUEST, Some("unauthorized_client"))
    );
    let (status, _) = admin_post(
        &app,
        &csrf,
        &format!("/api/admin/connected-apps/{id}/approve"),
        &json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a revoked app is not re-approved"
    );
}

#[tokio::test]
async fn rotating_the_secret_retires_the_old_one_and_its_tokens() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let (_, issued) = admin_post(
        &app,
        &csrf,
        "/api/admin/connected-apps",
        &json!({ "manifest": manifest(&["patients.view"], &["Patient"]) }),
    )
    .await;
    let id = issued["id"].as_str().expect("id").to_owned();
    let client_id = issued["client_id"].as_str().expect("client_id").to_owned();
    let old = issued["client_secret"].as_str().expect("secret").to_owned();
    admin_post(
        &app,
        &csrf,
        &format!("/api/admin/connected-apps/{id}/approve"),
        &json!({}),
    )
    .await;
    let (_, body) = token(&app, &client_id, &old).await;
    let bearer = body["access_token"].as_str().expect("token").to_owned();

    let (status, rotated) = admin_post(
        &app,
        &csrf,
        &format!("/api/admin/connected-apps/{id}/rotate-secret"),
        &json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let new = rotated["client_secret"].as_str().expect("new secret");
    assert_eq!(
        token(&app, &client_id, &old).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(token(&app, &client_id, new).await.0, StatusCode::OK);
    assert_eq!(
        call(
            &app,
            &bearer,
            &format!("/api/fhir/Patient/{}", Uuid::new_v4())
        )
        .await,
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn a_token_cannot_ask_for_more_than_the_grant() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let (_, issued) = admin_post(
        &app,
        &csrf,
        "/api/admin/connected-apps",
        &json!({ "manifest": manifest(&["patients.view"], &["Patient"]) }),
    )
    .await;
    let id = issued["id"].as_str().expect("id").to_owned();
    admin_post(
        &app,
        &csrf,
        &format!("/api/admin/connected-apps/{id}/approve"),
        &json!({}),
    )
    .await;
    let resp = reqwest::Client::new()
        .post(app.url("/api/oauth/token"))
        .basic_auth(
            issued["client_id"].as_str().expect("id"),
            issued["client_secret"].as_str(),
        )
        .form(&[
            ("grant_type", "client_credentials"),
            ("scope", "patients.view billing.invoices.create"),
        ])
        .send()
        .await
        .expect("token");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["error"], "invalid_scope");
}
