//! The hospital's online-order rules (storefront part 2), beside the
//! storefront's settings in `tenant_settings` category `pharmacy`: how long
//! stock is held, the supply and repeat-order limits, delivery slots, the
//! free-delivery threshold and the cash-on-delivery cap, and the outside
//! pharmacy partner a hospital may disclose. Defaults are the research
//! brief's (`docs/research-pharmacy-storefront-2026-10.md`, list (b)).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_core::pharmacy_delivery::{DEFAULT_FREE_DELIVERY_ABOVE, DELIVERY_SLOTS};
use medbrains_core::pharmacy_holds::{HoldTiers, tiers_problem};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Days of supply one online order may carry (`max_days_supply_online`).
pub const DEFAULT_MAX_DAYS_SUPPLY: i64 = 30;
/// The same medicine ordered again within this many days is held for the
/// pharmacist. Inferred, not from a spec: a month's supply less 20%, the
/// brief's velocity tolerance.
pub const DEFAULT_REPEAT_FLAG_DAYS: i64 = 24;
/// Cash on delivery only up to this (₹).
const DEFAULT_COD_MAX: i64 = 3000;
/// Orders one delivery slot takes in a day.
const DEFAULT_SLOT_CAPACITY: i32 = 20;

const KEYS: [&str; 7] = [
    "stock_hold_tiers",
    "max_days_supply_online",
    "repeat_order_flag_days",
    "free_delivery_above",
    "cod_max_amount",
    "delivery_slots",
    "outside_partner_pharmacy",
];

/// One delivery window and how many orders it takes a day.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Slot {
    pub slot: String,
    pub capacity: i32,
}

/// A pharmacy the hospital names when printing a prescription for outside
/// purchase, with the disclosure that must sit beside it. Never shown
/// without one.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Partner {
    pub name: String,
    pub address: String,
    pub phone: String,
    /// Why the hospital names it, and that the patient may buy anywhere.
    pub disclosure: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderRules {
    pub hold_tiers: HoldTiers,
    pub max_days_supply: i64,
    pub repeat_flag_days: i64,
    pub free_delivery_above: Decimal,
    pub cod_max_amount: Decimal,
    pub delivery_slots: Vec<Slot>,
    pub outside_partner: Option<Partner>,
}

fn int(v: Option<&Value>, default: i64) -> i64 {
    v.and_then(Value::as_i64).unwrap_or(default)
}

fn money(v: Option<&Value>, default: i64) -> Decimal {
    v.and_then(|v| serde_json::from_value::<Decimal>(v.clone()).ok())
        .unwrap_or_else(|| Decimal::from(default))
}

/// A setting read as `T`, if it is set and reads as one.
fn parsed<T: serde::de::DeserializeOwned>(rows: &[(String, Value)], key: &str) -> Option<T> {
    rows.iter()
        .find(|(k, _)| k == key)
        .and_then(|(_, v)| serde_json::from_value(v.clone()).ok())
}

fn default_slots() -> Vec<Slot> {
    DELIVERY_SLOTS
        .iter()
        .map(|s| Slot {
            slot: (*s).to_owned(),
            capacity: DEFAULT_SLOT_CAPACITY,
        })
        .collect()
}

/// The rules, with defaults for anything unset. One query.
pub async fn load(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<OrderRules, AppError> {
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
    Ok(OrderRules {
        hold_tiers: parsed::<HoldTiers>(&rows, "stock_hold_tiers")
            .filter(|t: &HoldTiers| {
                tiers_problem(&t.checkout)
                    .and(tiers_problem(&t.review))
                    .is_ok()
            })
            .unwrap_or_default(),
        max_days_supply: int(get("max_days_supply_online"), DEFAULT_MAX_DAYS_SUPPLY),
        repeat_flag_days: int(get("repeat_order_flag_days"), DEFAULT_REPEAT_FLAG_DAYS),
        free_delivery_above: money(get("free_delivery_above"), DEFAULT_FREE_DELIVERY_ABOVE),
        cod_max_amount: money(get("cod_max_amount"), DEFAULT_COD_MAX),
        delivery_slots: parsed(&rows, "delivery_slots").unwrap_or_else(default_slots),
        outside_partner: parsed::<Partner>(&rows, "outside_partner_pharmacy")
            .filter(|p: &Partner| !p.name.trim().is_empty() && !p.disclosure.trim().is_empty()),
    })
}

/// What is wrong with rules the hospital typed in.
fn problem(r: &OrderRules) -> Result<(), String> {
    tiers_problem(&r.hold_tiers.checkout)?;
    tiers_problem(&r.hold_tiers.review)?;
    if !(1..=90).contains(&r.max_days_supply) || !(0..=90).contains(&r.repeat_flag_days) {
        return Err("Days of supply is 1 to 90; the repeat window 0 to 90".to_owned());
    }
    if r.free_delivery_above < Decimal::ZERO || r.cod_max_amount < Decimal::ZERO {
        return Err("Amounts can't be negative".to_owned());
    }
    if r.delivery_slots
        .iter()
        .any(|s| !DELIVERY_SLOTS.contains(&s.slot.as_str()) || s.capacity < 1)
    {
        return Err("Slots are morning, afternoon or evening, each taking at least 1".to_owned());
    }
    if r.outside_partner
        .as_ref()
        .is_some_and(|p| p.name.trim().is_empty() || p.disclosure.trim().is_empty())
    {
        return Err(
            "A partner pharmacy needs its name and the disclosure shown with it".to_owned(),
        );
    }
    Ok(())
}

/// `GET /api/pharmacy/storefront/rules`
pub async fn get_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OrderRules>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rules = load(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(rules))
}

/// `PUT /api/pharmacy/storefront/rules`
pub async fn put_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OrderRules>,
) -> Result<Json<OrderRules>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    problem(&body).map_err(AppError::BadRequest)?;
    let to = |v: Result<Value, serde_json::Error>| {
        v.map_err(|e| AppError::Internal(format!("rules not saved: {e}")))
    };
    let values: [Value; 7] = [
        to(serde_json::to_value(&body.hold_tiers))?,
        body.max_days_supply.into(),
        body.repeat_flag_days.into(),
        to(serde_json::to_value(body.free_delivery_above))?,
        to(serde_json::to_value(body.cod_max_amount))?,
        to(serde_json::to_value(&body.delivery_slots))?,
        to(serde_json::to_value(&body.outside_partner))?,
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
    .bind(KEYS.as_slice())
    .bind(values.as_slice())
    .execute(&mut *tx)
    .await?;
    let saved = load(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(saved))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn defaults() -> OrderRules {
        OrderRules {
            hold_tiers: HoldTiers::default(),
            max_days_supply: DEFAULT_MAX_DAYS_SUPPLY,
            repeat_flag_days: DEFAULT_REPEAT_FLAG_DAYS,
            free_delivery_above: Decimal::from(DEFAULT_FREE_DELIVERY_ABOVE),
            cod_max_amount: Decimal::from(DEFAULT_COD_MAX),
            delivery_slots: default_slots(),
            outside_partner: None,
        }
    }

    #[test]
    fn the_defaults_are_valid_and_bad_input_is_refused() {
        assert!(problem(&defaults()).is_ok());
        let mut r = defaults();
        r.delivery_slots[0].slot = "midnight".to_owned();
        assert!(problem(&r).is_err());
        let mut r = defaults();
        r.outside_partner = Some(Partner {
            name: "Lake Pharmacy".to_owned(),
            address: String::new(),
            phone: String::new(),
            disclosure: " ".to_owned(),
        });
        assert!(problem(&r).is_err());
    }
}
