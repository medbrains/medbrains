//! Tenant identity on a pooled connection.
//!
//!   `make test-db && cargo test -p medbrains-db --test tenant_conn`
//!
//! Against real Postgres, because the whole question is what the database does
//! with a connection it has seen before. Each test gets its own copy of the
//! migrated schema (`medbrains_db_migrations::testing`), with two hospitals and
//! a patient each, and observes through the production pool as the request
//! role, so row level security is really on.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_db::pool::{PoolConfig, create_pool_with_config, group_conn, tenant_conn};
use medbrains_db_migrations::testing::{
    APP_ROLE, TestDb, WORKER_ROLE, add_patient, add_tenant, fresh_db,
};
use sqlx::Row;
use uuid::Uuid;

/// A fresh copy with two hospitals and one patient each, plus an owner pool
/// for fixtures. The tenants are returned in insertion order.
async fn two_hospitals() -> (TestDb, sqlx::PgPool, Uuid, Uuid) {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let first = add_tenant(&owner, "FIRST").await.expect("tenant");
    let second = add_tenant(&owner, "SECOND").await.expect("tenant");
    add_patient(&owner, first, "UH-1").await.expect("patient");
    add_patient(&owner, second, "UH-2").await.expect("patient");
    (db, owner, first, second)
}

/// The server's own pool (with its `after_release` hook), as the request role.
async fn app_pool(db: &TestDb, max: u32) -> sqlx::PgPool {
    let config = PoolConfig {
        max_connections: max,
        min_connections: 1,
        ..PoolConfig::default()
    };
    create_pool_with_config(&db.url(APP_ROLE), &config)
        .await
        .expect("the request role can connect")
}

#[tokio::test]
async fn a_scoped_connection_carries_the_tenant_across_statements() {
    // The bug this exists for: `set_config(..., true)` is transaction-local,
    // so a second statement on the same connection has no tenant and reads
    // nothing.
    let (db, _owner, tenant, _) = two_hospitals().await;
    let pool = app_pool(&db, 2).await;
    let mut conn = tenant_conn(&pool, &tenant)
        .await
        .expect("scoped connection");

    for _ in 0..3 {
        let seen: Option<String> =
            sqlx::query("SELECT current_setting('app.tenant_id', true) AS t")
                .fetch_one(&mut *conn)
                .await
                .expect("read the setting")
                .get("t");
        assert_eq!(seen.as_deref(), Some(tenant.to_string().as_str()));
    }
}

/// The named session setting on the next connection a one-connection pool
/// hands out — necessarily the one just released.
async fn setting_after_release(pool: &sqlx::PgPool, name: &str) -> Option<String> {
    let mut reused = pool.acquire().await.expect("the same connection back");
    sqlx::query("SELECT current_setting($1, true) AS s")
        .bind(name)
        .fetch_one(&mut *reused)
        .await
        .expect("read the setting")
        .get("s")
}

#[tokio::test]
async fn one_request_s_tenant_does_not_reach_the_next() {
    // The trap in setting it at session level: the connection goes back to the
    // pool still believing it belongs to somebody. A stale tenant is worse
    // than none — no tenant returns nothing and is obvious, a stale one
    // returns another hospital's rows and looks entirely normal.
    let (db, _owner, tenant, _) = two_hospitals().await;
    let pool = app_pool(&db, 1).await;
    {
        let mut scoped = tenant_conn(&pool, &tenant).await.expect("scoped");
        let _ = sqlx::query("SELECT 1").fetch_one(&mut *scoped).await;
    } // released here

    let leaked = setting_after_release(&pool, "app.tenant_id").await;
    assert!(
        leaked.is_none() || leaked.as_deref() == Some(""),
        "a released connection still believed it was tenant {leaked:?}"
    );
}

/// Patients the request role can count, unscoped and scoped to `tenant`.
async fn patients_seen(pool: &sqlx::PgPool, tenant: Uuid) -> (i64, i64) {
    let count = "SELECT count(*) FROM patients";
    let blind: i64 = sqlx::query_scalar(count).fetch_one(pool).await.unwrap();
    let mut conn = tenant_conn(pool, &tenant).await.expect("scoped");
    let scoped: i64 = sqlx::query_scalar(count)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
    (blind, scoped)
}

#[tokio::test]
async fn the_scoped_connection_is_what_makes_rows_visible_under_rls() {
    // End to end, as the restricted role: the same query returns nothing on a
    // bare pool connection and exactly the one hospital's rows on a scoped one.
    let (db, _owner, tenant, _) = two_hospitals().await;
    let (blind, scoped) = patients_seen(&app_pool(&db, 2).await, tenant).await;
    assert_eq!(blind, 0, "an unscoped read should see nothing under RLS");
    assert_eq!(
        scoped, 1,
        "a scoped read must see its own patient and only that"
    );
}

// ============================================================= group scope

/// Put both hospitals in one group with a known clinical setting.
async fn grouped(owner: &sqlx::PgPool, tenants: [Uuid; 2], share_clinical: bool) -> Uuid {
    let group: Uuid = sqlx::query_scalar(
        "INSERT INTO hospital_groups (code, name, share_clinical_records)
         VALUES ('TEST-SCOPE', 'Scope test', $1) RETURNING id",
    )
    .bind(share_clinical)
    .fetch_one(owner)
    .await
    .expect("a group");
    sqlx::query("UPDATE tenants SET group_id = $1 WHERE id = ANY($2)")
        .bind(group)
        .bind(tenants.to_vec())
        .execute(owner)
        .await
        .expect("join the group");
    group
}

/// How many hospitals `tenant`'s session may see, as the request role.
async fn visible_count(pool: &sqlx::PgPool, tenant: Uuid, group_scope: bool) -> usize {
    let mut conn = if group_scope {
        group_conn(pool, &tenant).await.expect("group connection")
    } else {
        tenant_conn(pool, &tenant).await.expect("tenant connection")
    };
    let ids: Vec<Uuid> = sqlx::query_scalar("SELECT unnest(public.app_visible_tenants())")
        .fetch_all(&mut *conn)
        .await
        .expect("visibility");
    ids.len()
}

#[tokio::test]
async fn an_administrative_screen_sees_the_group_without_clinical_sharing() {
    // What management actually wants. A consultant works Monday at one
    // location and Tuesday at the other; the rota is one record. Nobody should
    // have to switch on patient record sharing to make an HR screen work.
    let (db, owner, first, second) = two_hospitals().await;
    grouped(&owner, [first, second], false).await;
    let pool = app_pool(&db, 2).await;

    assert_eq!(
        visible_count(&pool, first, true).await,
        2,
        "an administrative screen could not see the group"
    );
    assert_eq!(
        visible_count(&pool, first, false).await,
        1,
        "a clinical read saw another location's hospital"
    );
}

#[tokio::test]
async fn clinical_reads_follow_the_switch_management_sets() {
    // The one decision management deliberates over: may a clinician here open
    // a chart written there.
    let (db, owner, first, second) = two_hospitals().await;
    let group = grouped(&owner, [first, second], true).await;
    let pool = app_pool(&db, 2).await;
    let sharing_on = visible_count(&pool, first, false).await;

    sqlx::query("UPDATE hospital_groups SET share_clinical_records = false WHERE id = $1")
        .bind(group)
        .execute(&owner)
        .await
        .expect("switch sharing off");
    let sharing_off = visible_count(&pool, first, false).await;

    assert_eq!(
        sharing_on, 2,
        "sharing is on and a clinical read stayed narrow"
    );
    assert_eq!(
        sharing_off, 1,
        "sharing is off and a clinical read went wide"
    );
}

#[tokio::test]
async fn a_hospital_in_no_group_is_alone_however_it_asks() {
    // Every tenant today. Asking for group scope when there is no group must
    // not widen anything.
    let (db, _owner, alone, _) = two_hospitals().await;
    let pool = app_pool(&db, 2).await;
    assert_eq!(
        visible_count(&pool, alone, true).await,
        1,
        "group scope widened a hospital that is in no group"
    );
    assert_eq!(visible_count(&pool, alone, false).await, 1);
}

#[tokio::test]
async fn group_scope_does_not_survive_the_connection_being_released() {
    // Worse than a leaked tenant: the next request on this connection would
    // read the whole group without ever asking to.
    let (db, owner, first, second) = two_hospitals().await;
    grouped(&owner, [first, second], false).await;
    let pool = app_pool(&db, 1).await;
    {
        let mut scoped = group_conn(&pool, &first).await.expect("group connection");
        let _ = sqlx::query("SELECT 1").fetch_one(&mut *scoped).await;
    } // released

    let leaked = setting_after_release(&pool, "app.scope").await;
    assert!(
        leaked.is_none() || leaked.as_deref() == Some(""),
        "a released connection was still in group scope: {leaked:?}"
    );
}

#[tokio::test]
async fn a_deleted_group_stops_sharing_anything() {
    // Groups are soft-deleted by a trigger, so a removed group is still a row.
    // Without checking that, management could dissolve a chain and the
    // hospitals would carry on reading each other's records.
    let (db, owner, first, second) = two_hospitals().await;
    let group = grouped(&owner, [first, second], true).await;
    let pool = app_pool(&db, 2).await;
    let while_alive = visible_count(&pool, first, false).await;

    sqlx::query("DELETE FROM hospital_groups WHERE id = $1")
        .bind(group)
        .execute(&owner)
        .await
        .expect("soft-delete the group");

    assert_eq!(while_alive, 2, "sharing was on and did not apply");
    assert_eq!(
        visible_count(&pool, first, false).await,
        1,
        "a deleted group carried on sharing records"
    );
    assert_eq!(
        visible_count(&pool, first, true).await,
        1,
        "a deleted group still answered for group scope"
    );
}

// ========================================================== the two roles

#[tokio::test]
async fn the_request_role_sees_nothing_without_a_tenant_and_the_worker_role_sees_everything() {
    // The two halves of the same decision, and the reason there are two roles.
    //
    // A request always knows which hospital it is for, so the request role is
    // held to it: a query that forgets returns nothing, loudly wrong rather
    // than quietly broad.
    //
    // A background pass does not. The outbox drains one queue for every
    // hospital and the escalation passes have to find overdue work before they
    // can act on it per tenant. On the request role their discovery query
    // returns an empty list — so the pass runs, reports success, and escalates
    // nobody.
    let (db, ..) = two_hospitals().await;
    let count = "SELECT count(*) FROM patients";
    let app = db.connect(APP_ROLE).await.expect("request role");
    let worker = db.connect(WORKER_ROLE).await.expect("worker role");
    let blind: i64 = sqlx::query_scalar(count).fetch_one(&app).await.unwrap();
    let sighted: i64 = sqlx::query_scalar(count).fetch_one(&worker).await.unwrap();

    assert_eq!(
        blind, 0,
        "the request role read rows without claiming a tenant"
    );
    assert_eq!(
        sighted, 2,
        "the worker role could not see across tenants — background passes would find nothing"
    );
}

#[tokio::test]
async fn neither_working_role_is_a_superuser() {
    // A superuser bypasses row level security for a different reason than the
    // worker role does, and would take the request role with it.
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let rows: Vec<(String, bool, bool)> = sqlx::query_as(
        "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
          WHERE rolname IN ('medbrains_app', 'medbrains_outbox_worker')",
    )
    .fetch_all(&owner)
    .await
    .expect("read the roles");

    assert_eq!(
        rows.len(),
        2,
        "the migrations must create both roles: {rows:?}"
    );
    for (name, superuser, bypass) in rows {
        assert!(!superuser, "{name} is a superuser");
        assert_eq!(bypass, name == WORKER_ROLE, "{name}: wrong BYPASSRLS");
    }
}

/// The `after_release` hook must survive its own eight-statement RESET.
///
/// `after_release` returning an error makes sqlx discard the connection on
/// *every* release: the pool never holds a spare, every acquire waits out the
/// full `acquire_timeout`, and the service reports itself degraded while
/// Postgres sits there idle. That is not hypothetical — it took `MedBrains`
/// down on 2026-09-01, because the RESET chain went over the extended
/// protocol and Postgres refused multiple commands.
///
/// With `max_connections = 1` the question answers itself: reuse means the
/// hook succeeded, a fresh backend pid means it did not. (This replaces two
/// tests that asserted the same thing.)
#[tokio::test]
async fn releasing_a_connection_does_not_discard_it() {
    let db = fresh_db().await.expect("test database");
    let pool = app_pool(&db, 1).await;
    let mut pids = Vec::new();
    for _ in 0..4 {
        let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&pool)
            .await
            .expect("the pool must hand out a connection");
        pids.push(pid);
    }
    assert!(
        pids.iter().all(|p| *p == pids[0]),
        "the pool opened a new backend, so after_release errored and sqlx \
         discarded the connection: {pids:?}"
    );
}
