//! The row-audit skip a history import uses (migrations 1218, 1219) cannot be
//! used to write unaudited rows. A row is left unaudited only inside the
//! importing transaction, for that hospital's batch, while it is running.
//! A finished batch, a dry run, another hospital's batch, a batch started by
//! another transaction, or a setting left over on a pooled connection all
//! leave the row audited.

use crate::common;

use serde_json::{Value, json};
use sqlx::{PgConnection, Postgres, Transaction};
use uuid::Uuid;

/// Insert one patient row in `tx` and say whether the audit trigger recorded it.
async fn insert_is_audited(tx: &mut Transaction<'_, Postgres>, tenant: Uuid) -> bool {
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut **tx)
        .await
        .expect("tenant");
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Audit', 'Probe', 'female', '9000012345') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("AUD-{}", Uuid::new_v4().simple()))
    .fetch_one(&mut **tx)
    .await
    .expect("patient");
    sqlx::query_scalar::<_, i64>("SELECT count(*) FROM audit_log WHERE entity_id = $1")
        .bind(id)
        .fetch_one(&mut **tx)
        .await
        .expect("audit")
        > 0
}

async fn set_batch(conn: &mut PgConnection, batch: Uuid, local: bool) {
    sqlx::query("SELECT set_config('app.history_import_batch', $1, $2)")
        .bind(batch.to_string())
        .bind(local)
        .execute(conn)
        .await
        .expect("setting");
}

/// A batch row as the importer writes it, running in the current transaction
/// (or, with `other_txid`, claiming some other transaction).
async fn running_batch(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    user: Uuid,
    other_txid: bool,
) -> Uuid {
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut **tx)
        .await
        .expect("tenant");
    sqlx::query_scalar(
        "INSERT INTO history_import_batches (tenant_id, label, dry_run, status, go_live_at, record_count, \
            created_by, import_txid) \
         VALUES ($1, 'probe', false, 'running', now(), 0, $2, txid_current() + $3) RETURNING id",
    )
    .bind(tenant)
    .bind(user)
    .bind(i64::from(other_txid))
    .fetch_one(&mut **tx)
    .await
    .expect("batch")
}

async fn batch_via_api(app: &common::TestApp, csrf: &str, dry_run: bool) -> Uuid {
    let t = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let at = (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339();
    let body = json!({ "label": format!("Skip {t}"), "dry_run": dry_run, "records": [
        { "kind": "patient", "external_id": format!("SP{t}"), "first_name": "Asha", "last_name": "Rao",
          "gender": "female", "phone": "9000012345", "registered_at": at } ] });
    let result: Value = app
        .client
        .post(app.url("/api/history-import/batches"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("batch")
        .json()
        .await
        .expect("json");
    result["batch_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("batch id")
}

#[tokio::test]
async fn only_a_running_import_in_its_own_transaction_skips_row_audit() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let go_live = chrono::Utc::now() - chrono::Duration::days(1);
    app.client
        .put(app.url("/api/history-import/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "go_live_at": go_live }))
        .send()
        .await
        .expect("settings");
    let committed = batch_via_api(&app, &csrf, false).await;
    let dry_run = batch_via_api(&app, &csrf, true).await;

    // The importer's own case: running, this transaction, this hospital -> skipped.
    let mut tx = app.db.begin().await.expect("tx");
    let batch = running_batch(&mut tx, tenant, admin, false).await;
    set_batch(&mut tx, batch, true).await;
    assert!(
        !insert_is_audited(&mut tx, tenant).await,
        "the running import's own rows are batch-audited"
    );
    tx.rollback().await.expect("rollback");

    // A finished batch, and a dry run, switch nothing off.
    for finished in [committed, dry_run] {
        let mut tx = app.db.begin().await.expect("tx");
        set_batch(&mut tx, finished, true).await;
        assert!(
            insert_is_audited(&mut tx, tenant).await,
            "a finished batch {finished} must not skip audit"
        );
        tx.rollback().await.expect("rollback");
    }

    // A running batch claiming another transaction switches nothing off.
    let mut tx = app.db.begin().await.expect("tx");
    let elsewhere = running_batch(&mut tx, tenant, admin, true).await;
    set_batch(&mut tx, elsewhere, true).await;
    assert!(
        insert_is_audited(&mut tx, tenant).await,
        "another transaction's batch must not skip audit"
    );
    tx.rollback().await.expect("rollback");

    // Another hospital's running batch switches nothing off for this one.
    let mut tx = app.db.begin().await.expect("tx");
    let other: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Other Hospital', 'medical_college') RETURNING id",
    )
    .bind(format!("OTH{}", &Uuid::new_v4().simple().to_string()[..6]).to_uppercase())
    .fetch_one(&mut *tx)
    .await
    .expect("tenant");
    let theirs = running_batch(&mut tx, other, admin, false).await;
    set_batch(&mut tx, theirs, true).await;
    assert!(
        insert_is_audited(&mut tx, tenant).await,
        "another hospital's batch must not skip audit"
    );
    tx.rollback().await.expect("rollback");

    // A setting left on a pooled connection (session-level) does not carry the skip
    // into the next, ordinary write.
    let mut conn = app.db.acquire().await.expect("conn");
    set_batch(&mut conn, committed, false).await;
    let mut tx = sqlx::Connection::begin(&mut *conn).await.expect("tx");
    assert!(
        insert_is_audited(&mut tx, tenant).await,
        "a leftover setting must not skip audit"
    );
    tx.rollback().await.expect("rollback");
    sqlx::query("SELECT set_config('app.history_import_batch', '', false)")
        .execute(&mut *conn)
        .await
        .expect("reset");
}
