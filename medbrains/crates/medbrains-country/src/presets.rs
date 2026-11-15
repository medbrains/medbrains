//! Setting a hospital's country, once, with the defaults that come with it.
//!
//! Onboarding and the geography screen both name the country. Whichever does
//! it first sets it and brings the country's presets (measurement units, date
//! format, and the profile's zone and currency where the profile has none);
//! naming the same country again changes nothing; naming a different one is
//! refused, because a country switches regulatory rules and changes only
//! through a locale-profile change set (RFC-WORLD-READY §2.4).

use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::pack;

/// What naming a country did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CountrySet {
    /// Set for the first time; its presets were applied.
    FirstSet,
    /// Already this country: nothing changed.
    Unchanged,
    /// A different country is set; nothing was written.
    Refused,
}

/// Name the hospital's country: set it the first time (with its presets),
/// accept the same one again, refuse another. Locks the tenant row, so two
/// first saves cannot both apply presets.
///
/// # Errors
/// The database error.
pub async fn set_country_once(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    country_id: Uuid,
) -> Result<CountrySet, sqlx::Error> {
    let current = sqlx::query_scalar!(
        "SELECT country_id FROM tenants WHERE id = $1 FOR UPDATE",
        tenant_id
    )
    .fetch_one(&mut *conn)
    .await?;
    match current {
        Some(set) if set == country_id => Ok(CountrySet::Unchanged),
        Some(_) => Ok(CountrySet::Refused),
        None => {
            sqlx::query!(
                "UPDATE tenants SET country_id = $2 WHERE id = $1",
                tenant_id,
                country_id
            )
            .execute(&mut *conn)
            .await?;
            apply_presets(conn, tenant_id, country_id).await?;
            Ok(CountrySet::FirstSet)
        }
    }
}

/// One `geo_countries` row: what the country list says about a country.
struct Country {
    code: String,
    currency: Option<String>,
    default_timezone: String,
    date_format: String,
    measurement_system: String,
}

/// The country's presets: the profile's first zone and currency, then units
/// and date format.
async fn apply_presets(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    country_id: Uuid,
) -> Result<(), sqlx::Error> {
    let found = sqlx::query_as!(
        Country,
        "SELECT code, currency, default_timezone, date_format, measurement_system \
           FROM geo_countries WHERE id = $1",
        country_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    let Some(c) = found else {
        return Ok(());
    };
    write_profile_firsts(conn, tenant_id, &c).await?;
    write_units(conn, tenant_id, &c).await
}

/// The zone and currency a country starts with: the pack's when it has them
/// (a zone only when the country has exactly one), else the country list's.
fn starting_values(c: &Country) -> (Vec<String>, Vec<Value>) {
    let defaults = pack::for_country(Some(&c.code)).ok().map(|p| &p.defaults);
    let zone = match defaults.map(|d| d.timezones.as_slice()) {
        Some([only]) => Some(only.clone()),
        _ => Some(c.default_timezone.clone()).filter(|z| z != "UTC"),
    };
    let currency = defaults
        .and_then(|d| d.currency.clone())
        .or_else(|| c.currency.clone());
    [("timezone", zone), ("currency", currency)]
        .into_iter()
        .filter_map(|(k, v)| v.map(|v| (k.to_owned(), Value::String(v))))
        .unzip()
}

/// The profile's first zone and currency; a value already set is a change
/// set's to change, so it is kept.
async fn write_profile_firsts(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    c: &Country,
) -> Result<(), sqlx::Error> {
    let (keys, values) = starting_values(c);
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT $1, 'locale', k, v FROM unnest($2::text[], $3::jsonb[]) AS t(k, v) \
         ON CONFLICT (tenant_id, category, key) DO NOTHING",
        tenant_id,
        &keys,
        &values,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Measurement units and the date format the country uses.
async fn write_units(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    c: &Country,
) -> Result<(), sqlx::Error> {
    let imperial = c.measurement_system == "imperial";
    let pick = |metric: &str, imp: &str| if imperial { imp } else { metric }.to_owned();
    let rows = [
        ("units", "measurement_system", c.measurement_system.clone()),
        ("units", "temperature_unit", pick("celsius", "fahrenheit")),
        ("units", "weight_unit", pick("kg", "lbs")),
        ("units", "height_unit", pick("cm", "in")),
        ("locale", "date_format", c.date_format.clone()),
    ];
    let cats: Vec<String> = rows.iter().map(|r| r.0.to_owned()).collect();
    let keys: Vec<String> = rows.iter().map(|r| r.1.to_owned()).collect();
    let values: Vec<Value> = rows.iter().map(|r| Value::String(r.2.clone())).collect();
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT $1, c, k, v FROM unnest($2::text[], $3::text[], $4::jsonb[]) AS t(c, k, v) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
            deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
        tenant_id,
        &cats,
        &keys,
        &values,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}
