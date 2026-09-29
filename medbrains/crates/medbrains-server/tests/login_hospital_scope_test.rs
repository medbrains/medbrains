//! Sign-in names a hospital, never a guess.
//!
//! Usernames are unique within a hospital, not across a deployment. The login
//! and password-reset lookups searched every hospital and took the first row,
//! so two hospitals that both had a `nurse1` signed one of them into — or sent
//! the other's reset code for — the wrong account.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const PASSWORD: &str = "admin123";

async fn login(app: &common::TestApp, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/auth/login"))
        .json(&body)
        .send()
        .await
        .expect("login");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given two hospitals that each have a user with the same name, When one
/// signs in without saying which hospital, Then they are asked to choose
/// rather than signed in to either; And naming the hospital signs them into
/// that hospital's account; And a code that names no hospital is refused.
#[tokio::test]
async fn a_username_two_hospitals_share_is_never_resolved_by_guessing() {
    let app = common::spawn_app().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let username = format!("shared_{suffix}");

    // Hospital A is the seeded one; its admin's password hash is reused so
    // both accounts accept the same password — the worst case for a guess.
    let (tenant_a, code_a): (Uuid, String) = sqlx::query_as(
        "SELECT t.id, t.code FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("hospital A");
    let code_b = format!("HB{}", suffix.to_uppercase());
    let tenant_b: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Second Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code_b)
    .fetch_one(&app.db)
    .await
    .expect("hospital B");
    for tenant in [tenant_a, tenant_b] {
        sqlx::query(
            "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
             SELECT $1, $2, $2 || '@' || $3 || '.example.org', 'Shared Name', 'nurse', password_hash \
               FROM users WHERE username = 'admin'",
        )
        .bind(tenant)
        .bind(&username)
        .bind(tenant.simple().to_string())
        .execute(&app.db)
        .await
        .expect("account");
    }

    let (status, body) = login(&app, json!({ "username": username, "password": PASSWORD })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hospital_required"], true, "asked to choose: {body}");
    assert!(body.get("user").is_none(), "and not signed in to either");

    for (code, tenant) in [(&code_a, tenant_a), (&code_b, tenant_b)] {
        let (status, body) = login(
            &app,
            json!({ "username": username, "password": PASSWORD, "hospital_code": code.to_lowercase() }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{body}");
        assert_eq!(
            body["user"]["tenant_id"],
            tenant.to_string(),
            "signed into {code}"
        );
    }

    let (status, _) = login(
        &app,
        json!({ "username": username, "password": PASSWORD, "hospital_code": "NO-SUCH-HOSPITAL" }),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let reset: Value = app
        .client
        .post(app.url("/api/auth/password-reset/request"))
        .json(&json!({ "username": username }))
        .send()
        .await
        .expect("reset")
        .json()
        .await
        .expect("reset json");
    assert_eq!(
        reset["hospital_required"], true,
        "a reset code is not sent to a guessed account"
    );

    sqlx::query("DELETE FROM users WHERE username = $1")
        .bind(&username)
        .execute(&app.db)
        .await
        .expect("cleanup users");
    sqlx::query("DELETE FROM tenants WHERE id = $1")
        .bind(tenant_b)
        .execute(&app.db)
        .await
        .expect("cleanup hospital");
}
