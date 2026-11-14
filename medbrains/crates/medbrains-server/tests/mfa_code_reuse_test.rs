//! An authenticator code works once, and turning MFA off is not a free guess.
//!
//! A code stays valid for about 90 seconds, and nothing stopped the same code
//! signing in again inside that window. `/api/auth/mfa/disable` checked a code
//! with no limit on wrong ones, from any open session.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;
use totp_rs::{Algorithm, Secret, TOTP};

/// A staff member with MFA on, and the authenticator that matches it.
async fn staff_with_mfa(app: &common::TestApp) -> (common::Staff, String, TOTP) {
    let csrf = app.login_admin().await;
    let staff = common::provision_staff(app, &csrf, "receptionist", &[]).await;
    let secret = Secret::Raw(b"medbrains-mfa-test-k".to_vec());
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().expect("secret"),
        Some("MedBrains".to_owned()),
        "staff".to_owned(),
    )
    .expect("totp");
    let username: String = sqlx::query_scalar(
        "UPDATE users SET mfa_secret = $2, mfa_enabled = true WHERE id = $1 RETURNING username",
    )
    .bind(staff.user_id)
    .bind(secret.to_encoded().to_string())
    .fetch_one(&app.db)
    .await
    .expect("mfa on");
    (staff, username, totp)
}

/// Given a code has signed in once, When the same code is sent again, Then the
/// second sign-in is refused.
#[tokio::test]
async fn an_authenticator_code_signs_in_only_once() {
    let app = common::spawn_app().await;
    let (staff, username, totp) = staff_with_mfa(&app).await;
    let code = totp.generate_current().expect("code");
    let body = json!({ "username": username, "password": staff.password, "mfa_code": code });

    let client = reqwest::Client::new();
    let first = app.post_json(&client, "/api/auth/login", &body).await.status();
    let again = app.post_json(&client, "/api/auth/login", &body).await.status();

    assert_eq!(first, StatusCode::OK);
    assert_eq!(again, StatusCode::UNAUTHORIZED, "a used code is spent");
}

/// Given an open session, When wrong codes are sent to turn MFA off, Then the
/// account locks and even the right code no longer turns it off.
#[tokio::test]
async fn wrong_codes_to_turn_mfa_off_lock_the_account() {
    let app = common::spawn_app().await;
    let (staff, _, totp) = staff_with_mfa(&app).await;
    let right = totp.generate_current().expect("code");
    let wrong = if right == "000000" { "111111" } else { "000000" };

    let disable = |code: &str| {
        staff
            .client
            .post(app.url("/api/auth/mfa/disable"))
            .header("x-csrf-token", &staff.csrf)
            .json(&json!({ "code": code }))
            .send()
    };
    for _ in 0..5 {
        let status = disable(wrong).await.expect("disable").status();
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
    let status = disable(&right).await.expect("disable").status();
    let still_on: bool = sqlx::query_scalar("SELECT mfa_enabled FROM users WHERE id = $1")
        .bind(staff.user_id)
        .fetch_one(&app.db)
        .await
        .expect("mfa");

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(still_on, "a locked account cannot turn MFA off");
}
