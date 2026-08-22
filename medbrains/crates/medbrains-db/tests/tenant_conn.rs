//! Tenant identity on a pooled connection.
//!
//!   cargo test -p medbrains-db -- --ignored
//!
//! Against real Postgres, because the whole question is what the database does
//! with a connection it has seen before.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic, clippy::print_stderr)]

use medbrains_db::pool::{create_pool_with_config, tenant_conn, PoolConfig};
use sqlx::Row;
use uuid::Uuid;

async fn pool_of(url_user: &str, max: u32) -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        format!("postgres://{url_user}:medbrains_dev@localhost:5435/medbrains")
    });
    let config = PoolConfig {
        max_connections: max,
        min_connections: 1,
        ..PoolConfig::default()
    };
    create_pool_with_config(&url, &config)
        .await
        .expect("needs the dev database")
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_scoped_connection_carries_the_tenant_across_statements() {
    // The bug this exists for: `set_config(..., true)` is transaction-local,
    // so a second statement on the same connection has no tenant and reads
    // nothing.
    let pool = pool_of("medbrains", 2).await;
    let tenant: Uuid = sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("a tenant");

    let mut conn = tenant_conn(&pool, &tenant).await.expect("scoped connection");

    for _ in 0..3 {
        let seen: Option<String> = sqlx::query("SELECT current_setting('app.tenant_id', true) AS t")
            .fetch_one(&mut *conn)
            .await
            .expect("read the setting")
            .get("t");
        assert_eq!(seen.as_deref(), Some(tenant.to_string().as_str()));
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn one_request_s_tenant_does_not_reach_the_next() {
    // The trap in setting it at session level: the connection goes back to the
    // pool still believing it belongs to somebody. A stale tenant is worse
    // than none — no tenant returns nothing and is obvious, a stale one
    // returns another hospital's rows and looks entirely normal.
    //
    // One connection in the pool, so the second acquire is guaranteed to be
    // the same physical connection the first one used.
    let pool = pool_of("medbrains", 1).await;
    let tenant: Uuid = sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("a tenant");

    {
        let mut scoped = tenant_conn(&pool, &tenant).await.expect("scoped");
        let _ = sqlx::query("SELECT 1").fetch_one(&mut *scoped).await;
    } // released here

    let mut reused = pool.acquire().await.expect("the same connection back");
    let leaked: Option<String> = sqlx::query("SELECT current_setting('app.tenant_id', true) AS t")
        .fetch_one(&mut *reused)
        .await
        .expect("read the setting")
        .get("t");

    assert!(
        leaked.is_none() || leaked.as_deref() == Some(""),
        "a released connection still believed it was tenant {leaked:?}"
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_scoped_connection_is_what_makes_rows_visible_under_rls() {
    // End to end, as the restricted role: the same query returns nothing on a
    // bare pool connection and the real rows on a scoped one.
    let Ok(pool) = sqlx::PgPool::connect(
        "postgres://medbrains_app:medbrains_dev@localhost:5435/medbrains",
    )
    .await
    else {
        eprintln!("medbrains_app role not present — skipping");
        return;
    };

    let tenant: Uuid = {
        let admin = pool_of("medbrains", 1).await;
        sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
            .fetch_one(&admin)
            .await
            .expect("a tenant")
    };

    let blind: i64 = sqlx::query_scalar("SELECT count(*) FROM patients")
        .fetch_one(&pool)
        .await
        .expect("count");

    let mut conn = tenant_conn(&pool, &tenant).await.expect("scoped");
    let scoped: i64 = sqlx::query_scalar("SELECT count(*) FROM patients")
        .fetch_one(&mut *conn)
        .await
        .expect("count");

    assert_eq!(blind, 0, "an unscoped read should see nothing under RLS");
    assert!(scoped > 0, "a scoped read saw nothing — the helper is not working");
}

// ============================================================= group scope

/// Held for the length of any test that changes group membership.
///
/// These tests share the dev database's two tenants, and cargo runs them in
/// parallel. Without this, one test's cleanup pulls the group out from under
/// another's setup and both fail for a reason that has nothing to do with the
/// code — which is exactly what happened the first time they were run.
static GROUP_FIXTURE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Put both dev tenants in one group with a known clinical setting.
///
/// Everything runs inside a transaction the caller rolls back — a test must
/// not leave two hospitals joined into a group that nobody created.
async fn grouped(pool: &sqlx::PgPool, share_clinical: bool) -> (Uuid, Uuid) {
    // Start from a known state. The previous test may have failed before its
    // own cleanup ran, and inheriting a group is how one failure becomes
    // several.
    ungroup(pool).await;

    let first: Uuid = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE code <> 'RLS-PROBE' ORDER BY created_at LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .expect("a tenant");
    let second: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type)
         VALUES ('RLS-PROBE', 'Isolation probe',
                 (SELECT hospital_type FROM tenants WHERE code <> 'RLS-PROBE' LIMIT 1))
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id",
    )
    .fetch_one(pool)
    .await
    .expect("second tenant");

    let group: Uuid = sqlx::query_scalar(
        "INSERT INTO hospital_groups (code, name, share_clinical_records)
         VALUES ('TEST-SCOPE', 'Scope test', $1)
         ON CONFLICT (code) DO UPDATE
             SET share_clinical_records = $1, deleted_at = NULL RETURNING id",
    )
    .bind(share_clinical)
    .fetch_one(pool)
    .await
    .expect("a group");

    sqlx::query("UPDATE tenants SET group_id = $1 WHERE id = ANY($2)")
        .bind(group)
        .bind(vec![first, second])
        .execute(pool)
        .await
        .expect("join the group");

    (first, second)
}

async fn ungroup(pool: &sqlx::PgPool) {
    let _ = sqlx::query("UPDATE tenants SET group_id = NULL WHERE group_id IN (SELECT id FROM hospital_groups WHERE code = 'TEST-SCOPE')")
        .execute(pool)
        .await;
    // `hospital_groups` is soft-deleted by a trigger, so DELETE marks the row
    // rather than removing it — which is the behaviour the application wants
    // and the reason `app_visible_tenants` ignores deleted groups.
    let _ = sqlx::query("DELETE FROM hospital_groups WHERE code = 'TEST-SCOPE'")
        .execute(pool)
        .await;
}

async fn visible_count(pool: &sqlx::PgPool, tenant: Uuid, group_scope: bool) -> usize {
    use medbrains_db::pool::group_conn;
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
#[ignore = "needs-pg"]
async fn an_administrative_screen_sees_the_group_without_clinical_sharing() {
    let _fixture = GROUP_FIXTURE.lock().await;
    // What management actually wants. A consultant works Monday at one
    // location and Tuesday at the other; the rota is one record. Nobody should
    // have to switch on patient record sharing to make an HR screen work.
    let pool = pool_of("medbrains", 2).await;
    let (first, _) = grouped(&pool, false).await;

    let admin = visible_count(&pool, first, true).await;
    let clinical = visible_count(&pool, first, false).await;
    ungroup(&pool).await;

    assert_eq!(admin, 2, "an administrative screen could not see the group");
    assert_eq!(clinical, 1, "a clinical read saw another location's hospital");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn clinical_reads_follow_the_switch_management_sets() {
    let _fixture = GROUP_FIXTURE.lock().await;
    // The one decision management deliberates over: may a clinician here open
    // a chart written there.
    let pool = pool_of("medbrains", 2).await;

    let (first, _) = grouped(&pool, true).await;
    let sharing_on = visible_count(&pool, first, false).await;

    let (first, _) = grouped(&pool, false).await;
    let sharing_off = visible_count(&pool, first, false).await;
    ungroup(&pool).await;

    assert_eq!(sharing_on, 2, "sharing is on and a clinical read stayed narrow");
    assert_eq!(sharing_off, 1, "sharing is off and a clinical read went wide");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_hospital_in_no_group_is_alone_however_it_asks() {
    let _fixture = GROUP_FIXTURE.lock().await;
    // Every tenant today. Asking for group scope when there is no group must
    // not widen anything.
    let pool = pool_of("medbrains", 2).await;
    ungroup(&pool).await;
    let alone: Uuid = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE group_id IS NULL ORDER BY created_at LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .expect("a tenant");

    let asked_wide = visible_count(&pool, alone, true).await;
    let asked_narrow = visible_count(&pool, alone, false).await;
    ungroup(&pool).await;

    assert_eq!(asked_wide, 1, "group scope widened a hospital that is in no group");
    assert_eq!(asked_narrow, 1);
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn group_scope_does_not_survive_the_connection_being_released() {
    let _fixture = GROUP_FIXTURE.lock().await;
    // Worse than a leaked tenant: the next request on this connection would
    // read the whole group without ever asking to.
    let pool = pool_of("medbrains", 1).await;
    let (first, _) = grouped(&pool, false).await;

    {
        let mut scoped = medbrains_db::pool::group_conn(&pool, &first)
            .await
            .expect("group connection");
        let _ = sqlx::query("SELECT 1").fetch_one(&mut *scoped).await;
    } // released

    let mut reused = pool.acquire().await.expect("the same connection back");
    let leaked: Option<String> = sqlx::query("SELECT current_setting('app.scope', true) AS s")
        .fetch_one(&mut *reused)
        .await
        .expect("read the setting")
        .get("s");
    drop(reused);
    ungroup(&pool).await;

    assert!(
        leaked.is_none() || leaked.as_deref() == Some(""),
        "a released connection was still in group scope: {leaked:?}"
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_deleted_group_stops_sharing_anything() {
    // Groups are soft-deleted by a trigger, so a removed group is still a row.
    // Without checking that, management could dissolve a chain and the
    // hospitals would carry on reading each other's records.
    let _fixture = GROUP_FIXTURE.lock().await;
    let pool = pool_of("medbrains", 2).await;
    let (first, _) = grouped(&pool, true).await;

    let while_alive = visible_count(&pool, first, false).await;

    sqlx::query("DELETE FROM hospital_groups WHERE code = 'TEST-SCOPE'")
        .execute(&pool)
        .await
        .expect("soft-delete the group");
    let after_deleting = visible_count(&pool, first, false).await;
    let admin_after = visible_count(&pool, first, true).await;

    ungroup(&pool).await;

    assert_eq!(while_alive, 2, "sharing was on and did not apply");
    assert_eq!(after_deleting, 1, "a deleted group carried on sharing records");
    assert_eq!(admin_after, 1, "a deleted group still answered for group scope");
}

// ========================================================== the two roles

/// Connect as a named role, or skip when the deployment has not created it.
async fn as_role(role: &str) -> Option<sqlx::PgPool> {
    sqlx::PgPool::connect(&format!(
        "postgres://{role}:medbrains_dev@localhost:5435/medbrains"
    ))
    .await
    .ok()
}

#[tokio::test]
#[ignore = "needs-pg"]
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
    let (Some(app), Some(worker)) = (as_role("medbrains_app").await, as_role("medbrains_outbox_worker").await)
    else {
        eprintln!("both roles are needed for this test — skipping");
        return;
    };

    let blind: i64 = sqlx::query_scalar("SELECT count(*) FROM patients")
        .fetch_one(&app)
        .await
        .expect("count");
    let sighted: i64 = sqlx::query_scalar("SELECT count(*) FROM patients")
        .fetch_one(&worker)
        .await
        .expect("count");

    assert_eq!(blind, 0, "the request role read rows without claiming a tenant");
    assert!(
        sighted > 0,
        "the worker role could not see across tenants — background passes would find nothing"
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn neither_working_role_is_a_superuser() {
    // A superuser bypasses row level security for a different reason than the
    // worker role does, and would take the request role with it.
    let Some(admin) = as_role("medbrains").await else {
        eprintln!("dev database unavailable — skipping");
        return;
    };

    let rows: Vec<(String, bool, bool)> = sqlx::query_as(
        "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
          WHERE rolname IN ('medbrains_app', 'medbrains_outbox_worker')",
    )
    .fetch_all(&admin)
    .await
    .expect("read the roles");

    for (name, superuser, bypass) in rows {
        assert!(!superuser, "{name} is a superuser");
        if name == "medbrains_app" {
            assert!(!bypass, "the request role bypasses row level security");
        } else {
            assert!(bypass, "the worker role cannot see across tenants");
        }
    }
}
