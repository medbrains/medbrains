//! The native app's step-up token: what the password sheet on iOS and Android
//! gets back from `/api/auth/step-up` and sends in `X-Step-Up-Token`.
//!
//! It must prove the same thing the browser's cookie does, and no more: this
//! user, this session, the last five minutes, a step-up and nothing else.

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// A native sign-in: the bearer token in the body, no cookies.
async fn native_session(app: &common::TestApp) -> String {
    let body: Value = Client::new()
        .post(app.url("/api/auth/login"))
        .header("x-medbrains-client", "mobile-staff")
        .json(&json!({ "username": "admin", "password": "admin123" }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    body["token"]
        .as_str()
        .expect("native login answers a token")
        .to_owned()
}

/// Step up on a bearer session; the token comes back in the body.
async fn native_step_up(app: &common::TestApp, bearer: &str) -> String {
    let resp = Client::new()
        .post(app.url("/api/auth/step-up"))
        .bearer_auth(bearer)
        .header("x-medbrains-client", "mobile-staff")
        .json(&json!({ "password": "admin123" }))
        .send()
        .await
        .expect("step-up");
    assert_eq!(resp.status(), StatusCode::OK);
    let set_cookie = resp
        .headers()
        .get_all("set-cookie")
        .iter()
        .any(|v| v.to_str().unwrap_or("").starts_with("step_up="));
    assert!(!set_cookie, "a native client gets no step-up cookie");
    let body: Value = resp.json().await.expect("json");
    body["step_up_token"]
        .as_str()
        .expect("step_up_token")
        .to_owned()
}

/// Call a step-up-guarded route. A record that does not exist answers 404
/// once the step-up passes, and 403 `step_up_required` when it does not.
async fn guarded(app: &common::TestApp, bearer: &str, step_up: &str) -> StatusCode {
    Client::new()
        .post(app.url("/api/signatures/sign"))
        .bearer_auth(bearer)
        .header("x-step-up-token", step_up)
        .json(&json!({ "record_type": "prescription", "record_id": Uuid::new_v4() }))
        .send()
        .await
        .expect("sign")
        .status()
}

/// Re-sign `token` with one claim changed, as a forger holding the server's
/// key could not but a test can: proves the check reads the claim.
fn tampered(app: &common::TestApp, token: &str, field: &str, value: Value) -> String {
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::EdDSA);
    validation.validate_aud = false;
    let mut claims: Value =
        jsonwebtoken::decode::<Value>(token, &app.state.jwt_decoding_key, &validation)
            .expect("decode")
            .claims;
    claims[field] = value;
    let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::EdDSA);
    jsonwebtoken::encode(&header, &claims, &app.state.jwt_encoding_key).expect("encode")
}

#[tokio::test]
async fn a_native_step_up_token_lets_its_own_session_sign() {
    let app = common::spawn_app().await;
    let bearer = native_session(&app).await;
    let token = native_step_up(&app, &bearer).await;
    assert_eq!(guarded(&app, &bearer, &token).await, StatusCode::NOT_FOUND);
    assert_eq!(
        guarded(&app, &bearer, "not-a-token").await,
        StatusCode::FORBIDDEN,
        "a session without a proof is asked for one"
    );
}

#[tokio::test]
async fn a_token_reused_from_another_session_is_refused() {
    let app = common::spawn_app().await;
    let first = native_session(&app).await;
    let token = native_step_up(&app, &first).await;
    // Access tokens carry a one-second expiry; two sign-ins in the same
    // second are byte-identical, the same credential.
    tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
    let second = native_session(&app).await;
    assert_ne!(first, second);
    assert_eq!(
        guarded(&app, &second, &token).await,
        StatusCode::FORBIDDEN,
        "same user, another sign-in: the proof does not travel"
    );
}

#[tokio::test]
async fn a_token_for_another_user_is_refused() {
    let app = common::spawn_app().await;
    let bearer = native_session(&app).await;
    let token = native_step_up(&app, &bearer).await;
    let forged = tampered(&app, &token, "sub", json!(Uuid::new_v4()));
    assert_eq!(guarded(&app, &bearer, &forged).await, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn an_expired_token_is_refused() {
    let app = common::spawn_app().await;
    let bearer = native_session(&app).await;
    let token = native_step_up(&app, &bearer).await;
    let stale = tampered(
        &app,
        &token,
        "exp",
        json!(chrono::Utc::now().timestamp() - 5),
    );
    assert_eq!(guarded(&app, &bearer, &stale).await, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn a_token_for_another_purpose_is_refused() {
    let app = common::spawn_app().await;
    let bearer = native_session(&app).await;
    let token = native_step_up(&app, &bearer).await;
    let other = tampered(&app, &token, "purpose", json!("refresh"));
    assert_eq!(guarded(&app, &bearer, &other).await, StatusCode::FORBIDDEN);
    // Nor is the access token itself, signed with the same key.
    assert_eq!(guarded(&app, &bearer, &bearer).await, StatusCode::FORBIDDEN);
}

/// A typo is a refused step-up, not a dead session: 403, so neither client
/// signs the doctor out.
#[tokio::test]
async fn a_wrong_password_is_refused_without_ending_the_session() {
    let app = common::spawn_app().await;
    let bearer = native_session(&app).await;
    let resp = Client::new()
        .post(app.url("/api/auth/step-up"))
        .bearer_auth(&bearer)
        .json(&json!({ "password": "not-the-password" }))
        .send()
        .await
        .expect("step-up");
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    let me = Client::new()
        .get(app.url("/api/auth/me"))
        .bearer_auth(&bearer)
        .send()
        .await
        .expect("me");
    assert_eq!(me.status(), StatusCode::OK, "the session survives the typo");
}

/// A token without the step-up `typ` is refused, even with the right
/// purpose, user and session: the two kinds of token never stand in for
/// each other.
#[tokio::test]
async fn a_token_without_the_step_up_type_is_refused() {
    let app = common::spawn_app().await;
    let bearer = native_session(&app).await;
    let token = native_step_up(&app, &bearer).await;
    let retyped = tampered(&app, &token, "typ", json!("access"));
    assert_eq!(
        guarded(&app, &bearer, &retyped).await,
        StatusCode::FORBIDDEN
    );
}

/// Five wrong passwords at step-up lock the account for fifteen minutes,
/// the same lock sign-in uses, and every failure is audited. A fresh
/// account, so the lock touches no other test.
#[tokio::test]
async fn repeated_wrong_step_up_passwords_lock_the_account_and_are_audited() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let (username, password) = (format!("lock_{tag}"), format!("Lock#{tag}Aa9"));
    let user: Value = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "username": username, "email": format!("{username}@example.test"),
                       "password": password, "full_name": format!("Dr {tag}"), "role": "doctor" }),
        )
        .send()
        .await
        .expect("create user")
        .json()
        .await
        .expect("user json");
    let user_id: Uuid = user["id"].as_str().expect("id").parse().expect("uuid");
    let login: Value = Client::new()
        .post(app.url("/api/auth/login"))
        .header("x-medbrains-client", "mobile-staff")
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let bearer = login["token"].as_str().expect("token").to_owned();
    let attempt = |pw: String| {
        let url = app.url("/api/auth/step-up");
        let bearer = bearer.clone();
        async move {
            let resp = Client::new()
                .post(url)
                .bearer_auth(bearer)
                .json(&json!({ "password": pw }))
                .send()
                .await
                .expect("step-up");
            let status = resp.status();
            let body: Value = resp.json().await.unwrap_or_default();
            (
                status,
                body["detail"].as_str().unwrap_or_default().to_owned(),
            )
        }
    };
    for n in 1..=4 {
        let (status, detail) = attempt("wrong".to_owned()).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "attempt {n}");
        assert_eq!(detail, "That password is not right.", "attempt {n}");
    }
    let (_, fifth) = attempt("wrong".to_owned()).await;
    assert!(
        fifth.starts_with("Too many wrong passwords"),
        "the fifth locks: {fifth}"
    );
    let (status, after) = attempt(password.clone()).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "locked, even with the right password"
    );
    assert!(after.starts_with("Too many wrong passwords"), "{after}");

    let audited: Vec<String> = sqlx::query_scalar(
        "SELECT action FROM audit_log WHERE user_id = $1 \
          AND action IN ('step_up_failed', 'account_locked') ORDER BY created_at",
    )
    .bind(user_id)
    .fetch_all(&app.db)
    .await
    .expect("audit");
    assert_eq!(
        audited.iter().filter(|a| *a == "step_up_failed").count(),
        5,
        "{audited:?}"
    );
    assert_eq!(
        audited.iter().filter(|a| *a == "account_locked").count(),
        1,
        "{audited:?}"
    );
}
