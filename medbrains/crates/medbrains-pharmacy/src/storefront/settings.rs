//! The hospital's storefront settings (`tenant_settings`, category
//! `pharmacy`), with the research brief's defaults, and the storefront's
//! gate: it opens only once switched on, with the drug licence, the
//! pharmacist in charge (with their registration) and a grievance officer on
//! record — the details its legal footer shows.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_core::pharmacy_storefront::{
    DEFAULT_MIN_SHELF_LIFE_DAYS, DEFAULT_RESTRICTED_MAX_UNITS, MAX_DISCOUNT_PERCENT, clamp_discount,
};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The keys this module owns, all in category `pharmacy`.
const KEYS: [&str; 7] = [
    "storefront_enabled",
    "online_discount_pct",
    "min_shelf_life_days",
    "habit_forming_max_units",
    "pharmacist_in_charge",
    "grievance_officer",
    "online_return_window_days",
];
/// Days a delivered online order may be returned for a fault of ours.
const DEFAULT_RETURN_WINDOW_DAYS: i64 = 7;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GrievanceOfficer {
    pub name: String,
    pub email: String,
    pub phone: String,
}

/// Discount off the selling price, per kind of item.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Discounts {
    pub rx: Decimal,
    pub otc: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreSettings {
    pub enabled: bool,
    pub discounts: Discounts,
    pub min_shelf_life_days: i32,
    pub restricted_max_units: i32,
    /// The registered pharmacist named on the storefront.
    pub pharmacist_in_charge: Option<Uuid>,
    pub grievance_officer: Option<GrievanceOfficer>,
    pub return_window_days: i64,
}

fn int(v: Option<&Value>, default: i64) -> i64 {
    v.and_then(Value::as_i64).unwrap_or(default)
}

/// The settings, with defaults for anything unset. One query.
pub async fn load(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<StoreSettings, AppError> {
    let rows: Vec<(String, Value)> = sqlx::query_as(
        "SELECT key, value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'pharmacy' AND key = ANY($2) \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(KEYS.as_slice())
    .fetch_all(&mut **tx)
    .await?;
    let get = |k: &str| rows.iter().find(|(key, _)| key == k).map(|(_, v)| v);
    let discounts: Discounts = get("online_discount_pct")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    Ok(StoreSettings {
        enabled: get("storefront_enabled")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        discounts: Discounts {
            rx: clamp_discount(discounts.rx),
            otc: clamp_discount(discounts.otc),
        },
        min_shelf_life_days: i32::try_from(int(
            get("min_shelf_life_days"),
            DEFAULT_MIN_SHELF_LIFE_DAYS.into(),
        ))
        .unwrap_or(DEFAULT_MIN_SHELF_LIFE_DAYS),
        restricted_max_units: i32::try_from(int(
            get("habit_forming_max_units"),
            DEFAULT_RESTRICTED_MAX_UNITS.into(),
        ))
        .unwrap_or(DEFAULT_RESTRICTED_MAX_UNITS),
        pharmacist_in_charge: get("pharmacist_in_charge")
            .and_then(Value::as_str)
            .and_then(|s| s.parse().ok()),
        grievance_officer: get("grievance_officer")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .filter(|g: &GrievanceOfficer| !g.name.trim().is_empty()),
        return_window_days: int(get("online_return_window_days"), DEFAULT_RETURN_WINDOW_DAYS),
    })
}

/// The storefront's legal footer and whether it is open.
#[derive(Debug, Serialize)]
pub struct About {
    pub open: bool,
    /// What still has to be recorded before it can open.
    pub missing: Vec<&'static str>,
    pub pharmacy_name: String,
    pub address: Option<String>,
    pub drug_licence: Option<String>,
    pub gstin: Option<String>,
    pub pharmacist_name: Option<String>,
    pub pharmacist_registration: Option<String>,
    pub grievance_officer: Option<GrievanceOfficer>,
    pub return_window_days: i64,
}

/// Hospital name, then address, drug licence, GSTIN, pharmacist and registration.
type AboutRow = (
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

/// The footer, read in one query beside the settings.
pub async fn about(tx: &mut Transaction<'_, Postgres>, tenant_id: Uuid) -> Result<About, AppError> {
    let settings = load(tx, tenant_id).await?;
    let (name, address, licence, gstin, pharmacist, registration): AboutRow = sqlx::query_as(
        "SELECT t.name, \
                (SELECT NULLIF(value #>> '{}', '') FROM tenant_settings WHERE tenant_id = t.id \
                    AND category = 'billing' AND key = 'bill_address' AND deleted_at IS NULL), \
                (SELECT NULLIF(value #>> '{}', '') FROM tenant_settings WHERE tenant_id = t.id \
                    AND category = 'billing' AND key = 'drug_licence' AND deleted_at IS NULL), \
                (SELECT NULLIF(value #>> '{}', '') FROM tenant_settings WHERE tenant_id = t.id \
                    AND category = 'billing' AND key = 'gst_number' AND deleted_at IS NULL), \
                u.full_name, NULLIF(u.registration_number, '') \
           FROM tenants t \
           LEFT JOIN users u ON u.id = $2 AND u.tenant_id = t.id AND u.is_active \
          WHERE t.id = $1",
    )
    .bind(tenant_id)
    .bind(settings.pharmacist_in_charge)
    .fetch_one(&mut **tx)
    .await?;
    let missing: Vec<&'static str> = [
        (!settings.enabled, "switched on"),
        (licence.is_none(), "drug licence numbers"),
        (
            registration.is_none(),
            "pharmacist in charge with registration",
        ),
        (settings.grievance_officer.is_none(), "grievance officer"),
    ]
    .into_iter()
    .filter_map(|(gap, what)| gap.then_some(what))
    .collect();
    Ok(About {
        open: missing.is_empty(),
        missing,
        pharmacy_name: name,
        address,
        drug_licence: licence,
        gstin,
        pharmacist_name: pharmacist,
        pharmacist_registration: registration,
        grievance_officer: settings.grievance_officer,
        return_window_days: settings.return_window_days,
    })
}

/// The settings, or 404 when the storefront isn't open: a closed store
/// takes no orders and shows nothing for sale.
pub async fn require_open(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<StoreSettings, AppError> {
    if !about(tx, tenant_id).await?.open {
        return Err(AppError::NotFound);
    }
    load(tx, tenant_id).await
}

/// The settings as the pharmacy edits them, with whether the storefront
/// is open and what it still lacks.
#[derive(Debug, Serialize)]
pub struct SettingsView {
    #[serde(flatten)]
    pub settings: StoreSettings,
    pub open: bool,
    pub missing: Vec<&'static str>,
}

/// `GET /api/pharmacy/storefront/settings`
pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SettingsView>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let settings = load(&mut tx, claims.tenant_id).await?;
    let gate = about(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(SettingsView {
        settings,
        open: gate.open,
        missing: gate.missing,
    }))
}

/// `PUT /api/pharmacy/storefront/settings`
pub async fn put_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<StoreSettings>,
) -> Result<Json<StoreSettings>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let cap = Decimal::from(MAX_DISCOUNT_PERCENT);
    if [body.discounts.rx, body.discounts.otc]
        .iter()
        .any(|d| *d < Decimal::ZERO || *d > cap)
    {
        return Err(AppError::BadRequest(format!(
            "The online discount is 0 to {MAX_DISCOUNT_PERCENT}%"
        )));
    }
    if body.min_shelf_life_days < 0 || body.restricted_max_units < 1 || body.return_window_days < 0
    {
        return Err(AppError::BadRequest(
            "Shelf life and return window can't be negative; the unit cap is at least 1".to_owned(),
        ));
    }
    let values: [(&str, Value); 7] = [
        ("storefront_enabled", Value::Bool(body.enabled)),
        (
            "online_discount_pct",
            serde_json::to_value(body.discounts).unwrap_or_default(),
        ),
        ("min_shelf_life_days", body.min_shelf_life_days.into()),
        ("habit_forming_max_units", body.restricted_max_units.into()),
        (
            "pharmacist_in_charge",
            body.pharmacist_in_charge
                .map_or(Value::Null, |u| u.to_string().into()),
        ),
        (
            "grievance_officer",
            serde_json::to_value(&body.grievance_officer).unwrap_or_default(),
        ),
        ("online_return_window_days", body.return_window_days.into()),
    ];
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT $1, 'pharmacy', k, v FROM unnest($2::text[], $3::jsonb[]) AS x(k, v) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(values.iter().map(|(k, _)| *k).collect::<Vec<_>>())
    .bind(values.iter().map(|(_, v)| v.clone()).collect::<Vec<_>>())
    .execute(&mut *tx)
    .await?;
    let saved = load(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(saved))
}

/// Days of shelf life a batch dispensed against `order_id` must have left:
/// the storefront's floor for an order placed online, 0 for any other.
pub(crate) async fn min_shelf_days_for_order(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<i32, AppError> {
    let online: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pharmacy_store_orders \
          WHERE tenant_id = $1 AND pharmacy_order_id = $2 AND deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_one(&mut **tx)
    .await?;
    if online {
        Ok(load(tx, tenant_id).await?.min_shelf_life_days.max(0))
    } else {
        Ok(0)
    }
}

/// Who may be named pharmacist in charge.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Pharmacist {
    pub id: Uuid,
    pub full_name: String,
    pub registration_number: Option<String>,
}

/// Pharmacists listed, at most.
const PHARMACIST_LIMIT: i64 = 200;

/// `GET /api/pharmacy/storefront/pharmacists` — the hospital's active
/// pharmacists, for the storefront's pharmacist in charge.
pub async fn pharmacists(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Pharmacist>>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Pharmacist>(
        "SELECT id, full_name, NULLIF(registration_number, '') AS registration_number \
           FROM users WHERE tenant_id = $1 AND role::text = 'pharmacist' AND is_active \
          ORDER BY full_name LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(PHARMACIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
