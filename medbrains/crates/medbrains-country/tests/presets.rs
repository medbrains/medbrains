//! Naming a hospital's country: the first time brings its presets, the same
//! country again changes nothing, another is refused (RFC-WORLD-READY §2.4).
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5438/medbrains \
//!   cargo test -p medbrains-country --test presets -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used)]

use medbrains_country::presets::{CountrySet, set_country_once};
use sqlx::PgPool;
use uuid::Uuid;

/// A fresh tenant with no country, and its transaction.
async fn tenant(pool: &PgPool) -> (sqlx::Transaction<'static, sqlx::Postgres>, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let id: Uuid = sqlx::query_scalar(&format!(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ('PR{code}', 'Preset test', 'multi_specialty') RETURNING id"
    ))
    .fetch_one(pool)
    .await
    .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    (tx, id)
}

async fn setting(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    t: Uuid,
    cat: &str,
    key: &str,
) -> Option<String> {
    sqlx::query_scalar(
        "SELECT value #>> '{}' FROM tenant_settings WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(t)
    .bind(cat)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await
    .unwrap()
}

async fn country(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, code: &str) -> Uuid {
    sqlx::query_scalar("SELECT id FROM geo_countries WHERE code = $1")
        .bind(code)
        .fetch_one(&mut **tx)
        .await
        .unwrap()
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_first_country_brings_its_presets_once() {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let pool = PgPool::connect(&url).await.unwrap();
    let (mut tx, t) = tenant(&pool).await;
    let india = country(&mut tx, "IN").await;
    assert_eq!(
        set_country_once(&mut tx, t, india).await.unwrap(),
        CountrySet::FirstSet
    );
    assert_eq!(
        setting(&mut tx, t, "locale", "country").await.as_deref(),
        Some("IN")
    );
    assert_eq!(
        setting(&mut tx, t, "locale", "timezone").await.as_deref(),
        Some("Asia/Kolkata")
    );
    assert_eq!(
        setting(&mut tx, t, "locale", "currency").await.as_deref(),
        Some("INR")
    );
    assert!(setting(&mut tx, t, "units", "weight_unit").await.is_some());
    let column: String = sqlx::query_scalar("SELECT timezone FROM tenants WHERE id = $1")
        .bind(t)
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    assert_eq!(column, "Asia/Kolkata", "the column follows the profile");

    assert_eq!(
        set_country_once(&mut tx, t, india).await.unwrap(),
        CountrySet::Unchanged
    );
    let uae = country(&mut tx, "AE").await;
    assert_eq!(
        set_country_once(&mut tx, t, uae).await.unwrap(),
        CountrySet::Refused
    );
    assert_eq!(
        setting(&mut tx, t, "locale", "country").await.as_deref(),
        Some("IN")
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_zone_the_admin_chose_survives_the_presets() {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let pool = PgPool::connect(&url).await.unwrap();
    let (mut tx, t) = tenant(&pool).await;
    sqlx::query("UPDATE tenants SET timezone = 'Asia/Dubai' WHERE id = $1")
        .bind(t)
        .execute(&mut *tx)
        .await
        .unwrap();
    let india = country(&mut tx, "IN").await;
    set_country_once(&mut tx, t, india).await.unwrap();
    assert_eq!(
        setting(&mut tx, t, "locale", "timezone").await.as_deref(),
        Some("Asia/Dubai")
    );
}
