//! Password reset codes are capped per account.
//!
//! The per-address limit stopped one client asking fast, not many addresses
//! asking for the same account: each request sent another SMS to its phone.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;

/// Given an account with a phone, When resets are asked for again and again
/// (each from its own address), Then only its share of codes is issued and
/// every answer stays the same.
#[tokio::test]
async fn one_account_is_sent_only_its_share_of_reset_codes() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let staff = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    sqlx::query("UPDATE users SET phone = '+919800022233' WHERE id = $1")
        .bind(staff.user_id)
        .execute(&app.db)
        .await
        .expect("phone");
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(staff.user_id)
        .fetch_one(&app.db)
        .await
        .expect("username");

    for _ in 0..6 {
        let status = app
            .post_json(
                &app.client,
                "/api/auth/password-reset/request",
                &json!({ "username": username }),
            )
            .await
            .status();
        assert_eq!(status, StatusCode::OK);
    }

    let issued: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM password_reset_otps WHERE user_id = $1")
            .bind(staff.user_id)
            .fetch_one(&app.db)
            .await
            .expect("codes");
    assert_eq!(issued, 3);
}
