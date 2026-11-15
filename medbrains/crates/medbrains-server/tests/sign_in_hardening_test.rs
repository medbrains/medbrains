//! A temporary password opens the password change and nothing else, on the API
//! as well as in the browser. An expired lock gives the account a fresh count, so
//! one wrong password cannot lock it again straight away.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;

/// Set the seeded admin's flag or counters, for one test.
async fn set_admin(app: &common::TestApp, assignment: &str) {
    sqlx::query(&format!(
        "UPDATE users SET {assignment} WHERE username = 'admin'"
    ))
    .execute(&app.db)
    .await
    .expect("update admin");
}

#[tokio::test]
async fn a_temporary_password_cannot_use_the_api() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;
    set_admin(&app, "must_change_password = true").await;

    let refused = app.get(&app.client, "/api/patients").await.status();
    let allowed = app.get(&app.client, "/api/auth/me").await.status();

    set_admin(&app, "must_change_password = false").await;
    let afterwards = app.get(&app.client, "/api/patients").await.status();

    assert_eq!(refused, StatusCode::FORBIDDEN);
    assert_eq!(allowed, StatusCode::OK);
    assert_ne!(afterwards, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn one_wrong_password_after_a_lock_expires_does_not_lock_again() {
    let app = common::spawn_app().await;
    set_admin(
        &app,
        "failed_login_attempts = 5, locked_until = now() - interval '1 minute'",
    )
    .await;

    let wrong = json!({ "username": "admin", "password": "not-the-password" });
    let status = app
        .post_json(&app.client, "/api/auth/login", &wrong)
        .await
        .status();
    let (attempts, locked): (i32, bool) = sqlx::query_as(
        "SELECT failed_login_attempts, locked_until IS NOT NULL FROM users \
         WHERE username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("admin");
    set_admin(&app, "failed_login_attempts = 0, locked_until = NULL").await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(attempts, 1, "the count restarts once the lock has expired");
    assert!(
        !locked,
        "one wrong password must not lock the account again"
    );
}
