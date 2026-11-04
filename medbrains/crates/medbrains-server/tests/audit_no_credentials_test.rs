//! The audit log records that an account changed, never its credentials
//! (migration 1404). Anyone who can read the log must not be able to read a
//! password hash, an MFA secret or recovery codes.

use crate::common;

use serde_json::Value;
use uuid::Uuid;

#[tokio::test]
async fn changing_a_password_is_audited_without_the_credentials() {
    let app = common::spawn_app().await;
    let (user, tenant): (Uuid, Uuid) = sqlx::query_as(
        "SELECT id, tenant_id FROM users WHERE username = 'admin' ORDER BY created_at LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("admin");

    // Rolled back at the end, so the real account is left as it was.
    let mut tx = app.db.begin().await.expect("begin");
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant)
        .await
        .expect("context");
    sqlx::query(
        "UPDATE users SET password_hash = 'changed', mfa_secret = 'changed', \
         mfa_recovery_codes = '[\"changed\"]'::jsonb WHERE id = $1",
    )
    .bind(user)
    .execute(&mut *tx)
    .await
    .expect("update");

    let rows: Vec<(Option<Value>, Option<Value>)> = sqlx::query_as(
        "SELECT old_values, new_values FROM audit_log \
          WHERE entity_type = 'users' AND entity_id = $1 AND action = 'UPDATE' \
            AND created_at >= now()",
    )
    .bind(user)
    .fetch_all(&mut *tx)
    .await
    .expect("audit rows");
    tx.rollback().await.expect("rollback");

    assert_eq!(rows.len(), 1, "the change itself is still audited");
    let (old, new) = rows.into_iter().next().expect("one row");
    for values in [old.expect("old"), new.expect("new")] {
        for key in ["password_hash", "mfa_secret", "mfa_recovery_codes"] {
            assert!(values.get(key).is_none(), "{key} reached the audit log");
        }
    }
}
