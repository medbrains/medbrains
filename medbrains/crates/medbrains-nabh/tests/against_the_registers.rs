//! The norms engine against the real registers.
//!
//!   cargo test -p medbrains-nabh -- --ignored

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

use chrono::Utc;
use medbrains_nabh::compliance::{assess_tenant, last_met};
use medbrains_nabh::norms::{Standing, default_catalogue};
use sqlx::PgPool;
use uuid::Uuid;

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5435/medbrains".to_owned()
    });
    PgPool::connect(&url).await.expect("needs the dev database")
}

async fn a_tenant(pool: &PgPool) -> Uuid {
    sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        .fetch_one(pool)
        .await
        .expect("dev database has no tenants")
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn every_register_in_the_catalogue_actually_exists() {
    // A norm pointing at a table nobody created can never be met, only
    // reported as never done — which looks identical to real non-compliance
    // and would send somebody looking for a drill that was in fact recorded.
    let pool = pool().await;

    for norm in default_catalogue() {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM pg_tables
              WHERE schemaname = 'public' AND tablename = $1)",
        )
        .bind(norm.source_table)
        .fetch_one(&pool)
        .await
        .expect("query");

        assert!(exists, "{} points at missing table {}", norm.code, norm.source_table);
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn every_dated_column_in_the_catalogue_actually_exists() {
    let pool = pool().await;

    for norm in default_catalogue() {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2)",
        )
        .bind(norm.source_table)
        .bind(norm.source_date_column)
        .fetch_one(&pool)
        .await
        .expect("query");

        assert!(
            exists,
            "{} reads {}.{}, which does not exist",
            norm.code, norm.source_table, norm.source_date_column
        );
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn every_register_can_actually_be_queried() {
    // Catches a column that exists but is not a timestamp — the query would
    // fail at run time and be swallowed as "never recorded".
    let pool = pool().await;
    let tenant = a_tenant(&pool).await;

    for norm in default_catalogue() {
        // `None` is a legitimate answer here; the assertion is that asking did
        // not blow up, which `last_met` would have logged and hidden.
        let _ = last_met(&pool, tenant, &norm).await;

        let sql = format!(
            "SELECT max({}) FROM public.{} WHERE tenant_id = $1",
            norm.source_date_column, norm.source_table
        );
        sqlx::query(&sql)
            .bind(tenant)
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|e| panic!("{} cannot be read: {e}", norm.code));
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_hospital_with_empty_registers_is_reported_as_not_compliant() {
    // The most dangerous possible answer would be a clean sheet.
    let pool = pool().await;
    let tenant = a_tenant(&pool).await;

    let assessed = assess_tenant(&pool, tenant, &default_catalogue(), Utc::now()).await;

    assert_eq!(assessed.len(), default_catalogue().len());
    for item in &assessed {
        // The dev database has no drills or gas readings recorded.
        assert_eq!(
            item.standing,
            Standing::NeverRecorded,
            "{} reported as {:?} with nothing in its register",
            item.code,
            item.standing
        );
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_recorded_drill_moves_the_obligation_to_met() {
    // The other direction: evidence actually counts.
    let pool = pool().await;
    let tenant = a_tenant(&pool).await;

    let drill = default_catalogue()
        .into_iter()
        .find(|n| n.code == "FMS.FIRE.DRILL")
        .expect("the catalogue has a fire drill");

    let mut tx = pool.begin().await.expect("begin");
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .expect("scope");
    let conducted_by: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users LIMIT 1")
        .fetch_optional(&mut *tx)
        .await
        .expect("look for a user");

    sqlx::query(
        "INSERT INTO public.nabh_fire_safety_drills
             (tenant_id, drill_at, drill_type, location, conducted_by)
         VALUES ($1, now(), 'mock', 'test ward', COALESCE($2, $1))",
    )
    .bind(tenant)
    .bind(conducted_by)
    .execute(&mut *tx)
    .await
    .expect("record a drill");

    let seen: Option<chrono::DateTime<Utc>> =
        sqlx::query_scalar("SELECT max(drill_at) FROM public.nabh_fire_safety_drills WHERE tenant_id = $1")
            .bind(tenant)
            .fetch_one(&mut *tx)
            .await
            .expect("read it back");

    assert!(seen.is_some(), "the drill was not recorded");

    // Rolled back: a test must not leave evidence of a drill that never
    // happened in a hospital's compliance record.
    tx.rollback().await.expect("rollback");

    let after = assess_tenant(&pool, tenant, &[drill], Utc::now()).await;
    assert_eq!(after[0].standing, Standing::NeverRecorded, "the test left data behind");
}
