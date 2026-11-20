//! The locale and geography steps of `POST /api/onboarding/setup`: refuse a
//! zone or currency no screen could format, and set the country through the
//! one shared path that brings its pack's presets.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::{SetupGeo, SetupHospitalDetails};

/// Refuse a zone or currency every screen could not format, before writing.
/// The fiscal month and the currency length are checked with the other field
/// errors at the top of `setup`.
pub(crate) fn check_locale_choices(details: &SetupHospitalDetails) -> Result<(), AppError> {
    use medbrains_country::{Field, validate::check_value};
    let pairs = [
        (Field::Timezone, details.timezone.as_deref()),
        (Field::Currency, details.currency.as_deref()),
    ];
    for (field, value) in pairs {
        if let Some(v) = value {
            check_value(field, &serde_json::Value::String(v.to_owned()))
                .map_err(AppError::BadRequest)?;
        }
    }
    Ok(())
}

/// Write the tenant's geography. The country goes through the one shared
/// path: the first set brings the country's presets, a different one is
/// refused with a pointer to the locale profile screen.
pub(crate) async fn write_geo(
    tx: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    geo: &SetupGeo,
) -> Result<(), AppError> {
    if let Some(country_id) = geo.country_id {
        let set = medbrains_country::presets::set_country_once(tx, tenant_id, country_id).await?;
        if set == medbrains_country::presets::CountrySet::Refused {
            return Err(AppError::Conflict(
                "The country is already set; change it in Settings, Locale profile".to_owned(),
            ));
        }
    }
    sqlx::query!(
        "UPDATE tenants SET state_id = $1, district_id = $2 WHERE id = $3",
        geo.state_id,
        geo.district_id,
        tenant_id,
    )
    .execute(&mut *tx)
    .await?;
    Ok(())
}
