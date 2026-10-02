//! A deleted master gives its code back: unique keys on masters hold among
//! live rows only. And a master an admin deleted stays deleted — the boot
//! seeds do not bring it back.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a department that was deleted, When the admin creates one with the
/// same code, Then it is created — not refused for a row nobody can see.
#[tokio::test]
async fn a_deleted_department_code_can_be_used_again() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let code = format!(
        "RE{}",
        &Uuid::new_v4().simple().to_string()[..6].to_uppercase()
    );
    let create = || {
        app.client
            .post(app.url("/api/setup/departments"))
            .json(&json!({ "code": code, "name": "Reused Code", "department_type": "clinical" }))
    };

    let (status, first) = send(&csrf, create()).await;
    assert_eq!(status, StatusCode::OK, "{first}");
    let id = first["id"].as_str().expect("department id");
    let (status, body) = send(
        &csrf,
        app.client
            .delete(app.url(&format!("/api/setup/departments/{id}"))),
    )
    .await;
    assert!(status.is_success(), "delete: {status} {body}");

    let (status, second) = send(&csrf, create()).await;
    assert_eq!(status, StatusCode::OK, "{second}");
    assert_ne!(
        second["id"], first["id"],
        "a new department, not the deleted one"
    );
}

/// Given a seeded payment method an admin deleted, When the server boots and
/// the seeds run again, Then it is not re-created.
#[tokio::test]
async fn a_deleted_seeded_master_stays_deleted_across_boots() {
    let app = common::spawn_app().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT id FROM tenants WHERE code = 'DEFAULT'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let live = |db: sqlx::PgPool| async move {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM payment_methods \
             WHERE tenant_id = $1 AND code = 'cheque' AND deleted_at IS NULL",
        )
        .bind(tenant)
        .fetch_one(&db)
        .await
        .expect("count")
    };
    sqlx::query("DELETE FROM payment_methods WHERE tenant_id = $1 AND code = 'cheque'")
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("soft delete");

    let seeded = medbrains_seed::run_seed(&app.db).await;
    let after_boot = live(app.db.clone()).await;

    // Put the shared database back before asserting, whatever happened.
    sqlx::query(
        "UPDATE payment_methods SET deleted_at = NULL, deleted_by = NULL, \
         delete_reason = NULL, is_active = true \
         WHERE tenant_id = $1 AND code = 'cheque' AND deleted_at IS NOT NULL \
           AND NOT EXISTS (SELECT 1 FROM payment_methods \
                           WHERE tenant_id = $1 AND code = 'cheque' AND deleted_at IS NULL)",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("restore");

    assert!(seeded.is_ok(), "the seeds still run: {:?}", seeded.err());
    assert_eq!(
        after_boot, 0,
        "the deleted method was re-created by the seed"
    );
}
