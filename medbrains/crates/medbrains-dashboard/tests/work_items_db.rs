//! The launcher's work counts are the caller's own, fail one at a time, and hide what the
//! caller may not open. Runs as the app role (`medbrains_app`, under RLS) against
//! `DASHBOARD_TEST_DATABASE_URL` (else `DATABASE_URL`); skipped locally when neither is set,
//! failing in CI.

#![allow(clippy::panic)]

use medbrains_dashboard::work::{Status, WorkItem, count_all, plan};
use medbrains_kernel::{Actor, Claims, Outcome};
use uuid::Uuid;

/// Panics with the error's text; tests may not `unwrap`.
fn ok<T, E: std::fmt::Display>(result: Result<T, E>) -> T {
    result.unwrap_or_else(|e| panic!("{e}"))
}

/// The test database, migrated; `None` locally when no database is configured.
async fn database() -> Option<sqlx::PgPool> {
    let url = std::env::var("DASHBOARD_TEST_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok();
    let Some(url) = url else {
        assert!(std::env::var_os("CI").is_none(), "CI must set DATABASE_URL");
        return None;
    };
    let db = ok(sqlx::PgPool::connect(&url).await);
    ok(medbrains_db_migrations::run(&db).await);
    Some(db)
}

/// Plants a hospital with doctors `a` and `b`, a critical value notified to `b` only, and a
/// draft note by `a`. Foreign keys are skipped for the clinical rows (replica mode), so the
/// test needs no orders, encounters or patients behind them.
async fn plant(db: &sqlx::PgPool, tenant: Uuid, (a, b): (Uuid, Uuid)) {
    let code = tenant.simple().to_string()[..8].to_uppercase();
    let users = [a, b]
        .map(|user| {
            let s = &user.simple().to_string()[..12];
            format!("('{user}', '{tenant}', 'w{s}', 'w{s}@example.test', 'Test doctor', 'doctor')")
        })
        .join(", ");
    let (x, y) = (Uuid::new_v4(), Uuid::new_v4());
    let sql = format!(
        "INSERT INTO tenants (id, code, name, hospital_type) \
           VALUES ('{tenant}', 'WK{code}', 'Work counts', 'community_health'); \
         INSERT INTO users (id, tenant_id, username, email, full_name, role) VALUES {users}; \
         BEGIN; SET LOCAL session_replication_role = replica; \
         INSERT INTO lab_critical_alerts (tenant_id, order_id, result_id, patient_id, \
             parameter_name, value, flag, notified_to) \
           VALUES ('{tenant}', '{x}', '{y}', '{x}', 'Potassium', '6.8', 'critical_high', '{b}'); \
         INSERT INTO clinical_notes (tenant_id, patient_id, encounter_id, note_type_id, \
             author_id, author_role) VALUES ('{tenant}', '{x}', '{y}', '{x}', '{a}', 'doctor'); \
         COMMIT;"
    );
    ok(sqlx::raw_sql(&sql).execute(db).await);
}

/// A doctor's claims holding exactly `permissions`.
fn doctor(tenant: Uuid, user: Uuid, permissions: &[&str]) -> Claims {
    let token = serde_json::json!({ "sub": user, "tenant_id": tenant, "role": "doctor", "exp": 0 });
    let mut claims: Claims = ok(serde_json::from_value(token));
    claims.permissions = permissions.iter().map(|p| (*p).to_owned()).collect();
    claims
}

/// Every item's key, permissions held, brick on.
const ALL: &[&str] = &[
    "lab.orders.list",
    "lab.results.update",
    "doctor.signoffs.view_own",
    "opd.queue.list",
    "clinical_notes.write",
];

/// Counts every item for `who` as the app role; `revoke` takes one table away first, so its
/// item's query fails inside the same transaction as the others.
async fn counts(db: &sqlx::PgPool, who: &Claims, revoke: Option<&str>) -> Vec<WorkItem> {
    let planned = plan(db, who).await;
    let mut tx = ok(db.begin().await);
    let setup = format!(
        "{} SET LOCAL ROLE medbrains_app; SELECT set_config('app.tenant_id', '{}', true);",
        revoke.map_or_else(String::new, |t| format!(
            "REVOKE SELECT ON {t} FROM medbrains_app;"
        )),
        who.tenant_id
    );
    ok(sqlx::raw_sql(&setup).execute(&mut *tx).await);
    count_all(&mut tx, Actor::from_claims(who), &planned).await
}

/// The item called `key`, which must be present.
fn item<'a>(items: &'a [WorkItem], key: &str) -> &'a WorkItem {
    items
        .iter()
        .find(|item| item.key == key)
        .unwrap_or_else(|| panic!("no {key} item"))
}

#[tokio::test]
async fn work_counts_are_mine_fail_alone_and_hide_what_i_cannot_open() {
    let Some(db) = database().await else { return };
    let (tenant, a, b) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    plant(&db, tenant, (a, b)).await;

    // Another doctor's critical value never reaches me; it reaches them.
    let mine = counts(&db, &doctor(tenant, a, ALL), None).await;
    assert_eq!(item(&mine, "lab_critical").count, Some(0));
    assert_eq!(item(&mine, "notes_unsigned").count, Some(1));
    let theirs = counts(&db, &doctor(tenant, b, ALL), None).await;
    let critical = item(&theirs, "lab_critical");
    assert_eq!((critical.status, critical.count), (Status::Ok, Some(1)));
    assert!(critical.detail.is_some(), "the critical value is described");

    // One failed query is that item's `failed`, never 0, and the rest still load.
    let broken = counts(&db, &doctor(tenant, a, ALL), Some("opd_queues")).await;
    let opd = item(&broken, "opd_waiting");
    assert_eq!((opd.status, opd.count), (Status::Failed, None));
    assert_eq!(item(&broken, "notes_unsigned").count, Some(1));
    assert_eq!(item(&broken, "approvals").status, Status::Ok);

    // Without the permission, or with the brick off, the item is not there at all.
    let no_lab = plan(&db, &doctor(tenant, b, &["opd.queue.list"])).await;
    assert!(no_lab.iter().all(|(spec, _)| spec.name != "lab_critical"));
    ok(sqlx::raw_sql(&format!(
        "INSERT INTO module_config (tenant_id, code, name, status) \
           VALUES ('{tenant}', 'lab', 'Laboratory', 'disabled') \
         ON CONFLICT (tenant_id, code) DO UPDATE SET status = 'disabled'"
    ))
    .execute(&db)
    .await);
    medbrains_server_core::middleware::entitlement::invalidate_modules(tenant);
    let lab_off = plan(&db, &doctor(tenant, b, ALL)).await;
    assert!(lab_off.iter().all(|(spec, _)| spec.name != "lab_critical"));
    assert!(lab_off.iter().all(|&(_, switch)| switch == Outcome::Allow));
}
