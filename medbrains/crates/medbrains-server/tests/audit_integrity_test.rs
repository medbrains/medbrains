//! The audit trail is evidence: a refused request and a failed sign-in are on
//! it with the caller's address, and nothing on it can be edited or removed.

mod common;

use reqwest::StatusCode;
use serde_json::json;

#[tokio::test]
async fn refusals_and_failed_sign_ins_are_audited_and_the_trail_cannot_be_edited() {
    let app = common::spawn_app().await;
    let tenant: uuid::Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let code: String = sqlx::query_scalar("SELECT code FROM tenants WHERE id = $1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("code");
    let count = |action: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM audit_log WHERE tenant_id = $1 AND action = $2")
                .bind(tenant)
                .bind(action)
                .fetch_one(&db)
                .await
                .expect("count")
        }
    };

    // A wrong password, and a name no account has, are both on the trail.
    let (wrong, unknown) = (count("login_failed").await, count("login_failed_unknown_account").await);
    for username in ["admin", "nobody-by-this-name"] {
        let resp = app
            .client
            .post(app.url("/api/auth/login"))
            .json(&json!({ "username": username, "password": "not-the-password", "hospital_code": code }))
            .send()
            .await
            .expect("login");
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }
    assert_eq!(count("login_failed").await, wrong + 1);
    assert_eq!(count("login_failed_unknown_account").await, unknown + 1);
    // Reset the counter the wrong password raised, so other tests can sign in.
    sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = 'admin'")
        .execute(&app.db)
        .await
        .expect("reset");

    // Nothing on the trail can be changed or removed — not even by the owner role.
    let edit = sqlx::query("UPDATE audit_log SET action = 'edited' WHERE tenant_id = $1")
        .bind(tenant)
        .execute(&app.db)
        .await;
    assert!(edit.is_err(), "an audit row was edited");
    let remove = sqlx::query("DELETE FROM audit_log WHERE tenant_id = $1").bind(tenant).execute(&app.db).await;
    assert!(remove.is_err(), "an audit row was removed");
    let billing = sqlx::query("DELETE FROM billing_audit_log").execute(&app.db).await;
    assert!(billing.is_err() || billing.is_ok_and(|r| r.rows_affected() == 0));
}
