//! Prints take their zone from the locale profile (RFC-WORLD-READY §2.3):
//! the hospital's own, else its country pack's only zone, else no print —
//! never a default country's.
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5438/medbrains \
//!   cargo test -p medbrains-print-data --test print_zone -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_server_core::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

/// A tenant with the given `locale/*` rows, in a transaction scoped to it.
async fn tenant_with(
    pool: &PgPool,
    rows: &[(&str, &str)],
) -> (sqlx::Transaction<'static, sqlx::Postgres>, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(&format!(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ('PZ{code}', 'Print zone', 'multi_specialty') RETURNING id"
    ))
    .fetch_one(pool)
    .await
    .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    for (key, value) in rows {
        sqlx::query("INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'locale', $2, to_jsonb($3::text))")
            .bind(tenant)
            .bind(key)
            .bind(value)
            .execute(&mut *tx)
            .await
            .unwrap();
    }
    (tx, tenant)
}

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5438/medbrains".to_owned()
    });
    PgPool::connect(&url)
        .await
        .expect("needs a migrated database")
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_profiles_zone_prints_and_none_refuses() {
    let pool = pool().await;
    let (mut tx, tenant) = tenant_with(&pool, &[("timezone", "Asia/Dubai")]).await;
    let dubai = medbrains_print_data::set_print_timezone(&mut tx, &tenant)
        .await
        .unwrap();
    assert_eq!(dubai.local_minus_utc(), 4 * 3600);

    // India's pack has one zone, so a country is enough.
    let (mut tx, tenant) = tenant_with(&pool, &[("country", "IN")]).await;
    let india = medbrains_print_data::set_print_timezone(&mut tx, &tenant)
        .await
        .unwrap();
    assert_eq!(india.local_minus_utc(), 5 * 3600 + 1800);

    // No zone anywhere: no print, and never the old India default.
    let (mut tx, tenant) = tenant_with(&pool, &[]).await;
    let refused = medbrains_print_data::set_print_timezone(&mut tx, &tenant).await;
    assert!(matches!(refused, Err(AppError::BadRequest(m)) if m.contains("time zone")));
}
