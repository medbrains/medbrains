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

/// The offset a print zone gives at one UTC instant, in seconds.
fn offset_at(zone: medbrains_print_data::PrintZone, y: i32, m: u32, d: u32) -> i32 {
    use chrono::{Offset, TimeZone, Utc};
    Utc.with_ymd_and_hms(y, m, d, 12, 0, 0)
        .unwrap()
        .with_timezone(&zone)
        .offset()
        .fix()
        .local_minus_utc()
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_profiles_zone_prints_and_none_refuses() {
    let pool = pool().await;
    let (mut tx, tenant) = tenant_with(&pool, &[("timezone", "Asia/Dubai")]).await;
    let dubai = medbrains_print_data::set_print_timezone(&mut tx, &tenant, None)
        .await
        .unwrap();
    assert_eq!(offset_at(dubai, 2026, 1, 10), 4 * 3600);

    // India's pack has one zone, so a country is enough.
    let (mut tx, tenant) = tenant_with(&pool, &[("country", "IN")]).await;
    let india = medbrains_print_data::set_print_timezone(&mut tx, &tenant, None)
        .await
        .unwrap();
    assert_eq!(offset_at(india, 2026, 1, 10), 5 * 3600 + 1800);

    // No zone anywhere: no print, and never the old India default.
    let (mut tx, tenant) = tenant_with(&pool, &[]).await;
    let refused = medbrains_print_data::set_print_timezone(&mut tx, &tenant, None).await;
    assert!(matches!(refused, Err(AppError::BadRequest(m)) if m.contains("time zone")));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn each_timestamp_gets_the_offset_of_its_own_date() {
    let pool = pool().await;
    let (mut tx, tenant) = tenant_with(&pool, &[("timezone", "Europe/London")]).await;
    let london = medbrains_print_data::set_print_timezone(&mut tx, &tenant, None)
        .await
        .unwrap();
    assert_eq!(offset_at(london, 2026, 1, 10), 0, "GMT in winter");
    assert_eq!(offset_at(london, 2026, 7, 10), 3600, "BST in summer");
    assert_eq!(
        offset_at(london, 1995, 7, 10),
        3600,
        "and in years long past"
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_print_takes_the_printing_users_facility_zone() {
    let pool = pool().await;
    // Only the facility sets a zone: the print must not refuse.
    let (mut tx, tenant) = tenant_with(&pool, &[("country", "AE")]).await;
    let facility: Uuid = sqlx::query_scalar(
        "INSERT INTO facilities (tenant_id, code, name, facility_type) \
         VALUES ($1, 'PZ-1', 'Satellite', 'day_care_center') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let user: Uuid = sqlx::query_scalar(&format!(
        "INSERT INTO users (tenant_id, username, email, full_name, role) VALUES \
         ('{tenant}', 'pz{}', 'pz{}@pz.test', 'Printer', 'receptionist') RETURNING id",
        &tenant.simple().to_string()[..8],
        &tenant.simple().to_string()[..8]
    ))
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO user_facility_assignments (tenant_id, user_id, facility_id, is_primary) VALUES ($1, $2, $3, true)",
    )
    .bind(tenant)
    .bind(user)
    .bind(facility)
    .execute(&mut *tx)
    .await
    .unwrap();
    sqlx::query("SELECT set_config('medbrains.locale_profile_writer', 'change_set', true)")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO scoped_settings (tenant_id, scope, scope_id, category, key, value) \
         VALUES ($1, 'facility', $2, 'locale', 'timezone', '\"Asia/Dubai\"')",
    )
    .bind(tenant)
    .bind(facility)
    .execute(&mut *tx)
    .await
    .unwrap();
    let zone = medbrains_print_data::set_print_timezone(&mut tx, &tenant, Some(user))
        .await
        .unwrap();
    assert_eq!(offset_at(zone, 2026, 1, 10), 4 * 3600);
    let hospital_only = medbrains_print_data::set_print_timezone(&mut tx, &tenant, None).await;
    assert!(
        hospital_only.is_err(),
        "without the user, the hospital has no zone"
    );
}
