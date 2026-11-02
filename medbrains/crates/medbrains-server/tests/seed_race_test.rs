//! Servers starting together on an empty database: seeding checks for rows and
//! then inserts them, so without its lock all but one exit on a duplicate key.
//! First seen as `tenants_code_key` and `locations_tenant_id_code_key` failures
//! on CI's fresh database.

use crate::common;

use sqlx::postgres::{PgPool, PgPoolOptions};
use uuid::Uuid;

/// Given an empty database, When three servers seed it at once, Then each
/// finishes cleanly and there is one first hospital.
#[tokio::test]
async fn servers_starting_together_seed_one_hospital() {
    let owner = PgPool::connect(&common::database_url())
        .await
        .expect("owner");
    let name = format!("seed_race_{}", Uuid::new_v4().simple());
    sqlx::query(&format!("CREATE DATABASE {name}"))
        .execute(&owner)
        .await
        .expect("create");
    let fresh = PgPoolOptions::new()
        .max_connections(8)
        .connect_with(owner.connect_options().as_ref().clone().database(&name))
        .await
        .expect("connect");
    medbrains_db_migrations::run(&fresh)
        .await
        .expect("migrations");

    let (a, b, c) = tokio::join!(
        medbrains_seed::run_seed(&fresh),
        medbrains_seed::run_seed(&fresh),
        medbrains_seed::run_seed(&fresh),
    );
    let failures: Vec<String> = [a, b, c]
        .into_iter()
        .filter_map(|outcome| outcome.err().map(|e| e.to_string()))
        .collect();
    let hospitals: i64 = sqlx::query_scalar("SELECT count(*) FROM tenants")
        .fetch_one(&fresh)
        .await
        .expect("count");

    fresh.close().await;
    sqlx::query(&format!("DROP DATABASE {name} WITH (FORCE)"))
        .execute(&owner)
        .await
        .expect("drop");
    assert!(failures.is_empty(), "{failures:?}");
    assert_eq!(hospitals, 1);
}
