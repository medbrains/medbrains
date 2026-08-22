//! Tenant identity on a pooled connection.
//!
//!   cargo test -p medbrains-db -- --ignored
//!
//! Against real Postgres, because the whole question is what the database does
//! with a connection it has seen before.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

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
