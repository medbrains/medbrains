//! What the storefront shows: the items a pharmacist put online, priced at
//! the selling price less the hospital's online discount and never above the
//! batch MRP, with stock as a word. Stock is what online may still take:
//! cleared batches with enough shelf life left, above the online floor that
//! keeps the wards and the counter supplied. And the pharmacist's side:
//! putting an item online.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::pharmacy::PharmacyCatalog;
use medbrains_core::pharmacy_storefront::{
    COUNTER_ONLY, DEFAULT_MAX_QTY, SaleClass, max_units, online_price, stock_level,
};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::settings::StoreSettings;

/// Results one search returns.
const SEARCH_LIMIT: i64 = 40;
/// Same-INN alternatives shown on an item.
const SUBSTITUTE_LIMIT: i64 = 10;
/// Categories listed in the filter.
const CATEGORY_LIMIT: i64 = 50;
/// Shortest search that runs; one letter matches most of a formulary.
const MIN_QUERY_CHARS: usize = 2;
/// Shown on an item that must be collected.
const PICKUP_NOTE: &str = "Collect it at the pharmacy: not delivered";

/// Catalogue facts plus, from its batches, the units online may take and the
/// price and MRP of the batch FEFO would issue to an online order. `$S` is
/// the shelf-life floor in days.
const ITEM_SELECT: &str = "SELECT c.id, c.name, COALESCE(c.inn_name, c.generic_name) AS inn, \
     c.manufacturer, c.category, c.dosage_form, c.strength, c.pack_size, c.unit, \
     c.drug_schedule AS schedule, c.is_controlled, c.habit_forming, c.needs_cold_chain, \
     COALESCE(c.max_order_qty, $MAXQ) AS max_quantity, \
     (c.sold_online AND c.is_active AND c.deleted_at IS NULL) AS on_sale, \
     c.is_active AND c.deleted_at IS NULL AS active, \
     COALESCE(s.on_hand, 0) - COALESCE(c.online_reserve_floor, c.reorder_level) AS available, \
     COALESCE(f.selling_rate, NULLIF(c.base_price, 0), c.mrp) AS selling_price, \
     COALESCE(f.mrp, c.mrp) AS mrp \
   FROM pharmacy_catalog c \
   LEFT JOIN LATERAL (SELECT SUM(b.quantity_on_hand)::int AS on_hand FROM pharmacy_batches b \
        WHERE b.tenant_id = c.tenant_id AND b.catalog_item_id = c.id AND b.deleted_at IS NULL \
          AND b.quarantine_status = 'cleared' AND b.quantity_on_hand > 0 \
          AND b.expiry_date >= CURRENT_DATE + $S) s ON true \
   LEFT JOIN LATERAL (SELECT b.selling_rate, b.mrp FROM pharmacy_batches b \
        WHERE b.tenant_id = c.tenant_id AND b.catalog_item_id = c.id AND b.deleted_at IS NULL \
          AND b.quarantine_status = 'cleared' AND b.quantity_on_hand > 0 \
          AND b.expiry_date >= CURRENT_DATE + $S \
        ORDER BY b.expiry_date, b.created_at, b.id LIMIT 1) f ON true";

#[derive(sqlx::FromRow)]
pub(crate) struct ItemRow {
    pub id: Uuid,
    pub name: String,
    inn: Option<String>,
    manufacturer: Option<String>,
    category: Option<String>,
    dosage_form: Option<String>,
    strength: Option<String>,
    pack_size: Option<i32>,
    unit: Option<String>,
    schedule: Option<String>,
    is_controlled: bool,
    habit_forming: bool,
    needs_cold_chain: bool,
    max_quantity: i32,
    pub on_sale: bool,
    pub active: bool,
    pub available: i32,
    selling_price: Option<Decimal>,
    mrp: Option<Decimal>,
}

impl ItemRow {
    pub(crate) fn class(&self) -> SaleClass {
        SaleClass::of(self.schedule.as_deref(), self.is_controlled)
    }

    /// H1 or habit-forming: pickup only, a unit cap.
    pub(crate) fn restricted(&self) -> bool {
        self.habit_forming || self.schedule.as_deref() == Some("H1")
    }

    pub(crate) fn max_units(&self, settings: &StoreSettings) -> i32 {
        max_units(
            self.max_quantity,
            self.restricted(),
            settings.restricted_max_units,
        )
    }

    /// Delivery's view, as part 3 reads it: H1, habit-forming and controlled
    /// drugs are collected.
    pub(crate) fn line_facts(&self) -> medbrains_core::pharmacy_delivery::LineFacts {
        medbrains_core::pharmacy_delivery::LineFacts {
            name: self.name.clone(),
            controlled: self.is_controlled
                || self.restricted()
                || matches!(self.schedule.as_deref(), Some("X" | "NDPS")),
            needs_cold_chain: self.needs_cold_chain,
        }
    }

    /// The price an online order pays, if the item is priced.
    pub(crate) fn price(&self, settings: &StoreSettings) -> Option<Decimal> {
        let discount = if self.class() == SaleClass::Prescription {
            settings.discounts.rx
        } else {
            settings.discounts.otc
        };
        self.selling_price
            .map(|p| online_price(p, discount, self.mrp))
    }
}

/// An item as a patient (or a guest) sees it. Never a stock count.
#[derive(Debug, Clone, Serialize)]
pub struct StoreItem {
    pub id: Uuid,
    pub name: String,
    /// The generic (INN) name.
    pub inn: Option<String>,
    pub manufacturer: Option<String>,
    pub category: Option<String>,
    /// e.g. "500 mg tablet · pack of 10".
    pub pack: Option<String>,
    pub schedule: Option<String>,
    /// `otc`, `prescription` or `counter_only`.
    pub sale_class: &'static str,
    pub prescription_needed: bool,
    /// Why it can't be ordered online, or must be collected.
    pub note: Option<&'static str>,
    pub pickup_only: bool,
    /// `available`, `low` or `out`.
    pub stock: &'static str,
    pub mrp: Option<Decimal>,
    pub price: Option<Decimal>,
    pub max_quantity: i32,
    /// Still sold online; a cart line whose item was taken off says so.
    pub on_sale: bool,
}

fn pack(r: &ItemRow) -> Option<String> {
    let form = [r.strength.as_deref(), r.dosage_form.as_deref()]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" ");
    let size = r.pack_size.map(|n| match r.unit.as_deref() {
        Some(u) => format!("pack of {n} {u}"),
        None => format!("pack of {n}"),
    });
    let parts: Vec<String> = [(!form.is_empty()).then_some(form), size]
        .into_iter()
        .flatten()
        .collect();
    (!parts.is_empty()).then(|| parts.join(" · "))
}

pub(crate) fn present(r: &ItemRow, settings: &StoreSettings) -> StoreItem {
    let class = r.class();
    let pickup_only = r.needs_cold_chain || r.restricted();
    StoreItem {
        id: r.id,
        name: r.name.clone(),
        inn: r.inn.clone(),
        manufacturer: r.manufacturer.clone(),
        category: r.category.clone(),
        pack: pack(r),
        schedule: r.schedule.clone(),
        sale_class: class.as_str(),
        prescription_needed: class == SaleClass::Prescription,
        note: match class {
            SaleClass::CounterOnly => Some(COUNTER_ONLY),
            _ if pickup_only => Some(PICKUP_NOTE),
            _ => None,
        },
        pickup_only,
        stock: stock_level(r.available),
        mrp: r.mrp,
        price: r.price(settings),
        max_quantity: r.max_units(settings),
        on_sale: r.on_sale,
    }
}

fn select(settings: &StoreSettings) -> String {
    ITEM_SELECT
        .replace("$MAXQ", &DEFAULT_MAX_QTY.to_string())
        .replace("$S", &settings.min_shelf_life_days.max(0).to_string())
}

/// Items by id, on sale or not — for a cart or a prescription.
pub(crate) async fn rows_by_ids(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    ids: &[Uuid],
    settings: &StoreSettings,
) -> Result<HashMap<Uuid, ItemRow>, AppError> {
    let rows = sqlx::query_as::<_, ItemRow>(&format!(
        "{} WHERE c.tenant_id = $1 AND c.id = ANY($2)",
        select(settings)
    ))
    .bind(tenant_id)
    .bind(ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(|r| (r.id, r)).collect())
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub items: Vec<StoreItem>,
    pub categories: Vec<String>,
}

/// Search what is sold online by brand or INN, optionally in one category.
pub async fn search(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    query: &SearchQuery,
) -> Result<SearchResult, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let escaped = query
        .q
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| s.chars().count() >= MIN_QUERY_CHARS)
        .map(|s| {
            s.replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_")
        });
    let category = query
        .category
        .as_deref()
        .map(str::trim)
        .filter(|c| !c.is_empty());
    let rows = sqlx::query_as::<_, ItemRow>(&format!(
        "{} WHERE c.tenant_id = $1 AND c.sold_online AND c.is_active AND c.deleted_at IS NULL \
            AND ($2::text IS NULL OR lower(c.name) LIKE '%' || $2 || '%' \
                 OR lower(COALESCE(c.inn_name, c.generic_name, '')) LIKE '%' || $2 || '%') \
            AND ($3::text IS NULL OR c.category = $3) \
          ORDER BY ($2::text IS NOT NULL AND lower(c.name) LIKE $2 || '%') DESC, c.name \
          LIMIT $4",
        select(&settings)
    ))
    .bind(tenant_id)
    .bind(escaped)
    .bind(category)
    .bind(SEARCH_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let categories: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT category FROM pharmacy_catalog \
          WHERE tenant_id = $1 AND sold_online AND is_active AND deleted_at IS NULL \
            AND category IS NOT NULL ORDER BY category LIMIT $2",
    )
    .bind(tenant_id)
    .bind(CATEGORY_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    Ok(SearchResult {
        items: rows.iter().map(|r| present(r, &settings)).collect(),
        categories,
    })
}

#[derive(Debug, Serialize)]
pub struct ItemPage {
    pub item: StoreItem,
    /// Other items sold online with the same INN, cheapest first. Shown for
    /// comparison only: nothing is substituted without the prescriber's and
    /// the patient's consent.
    pub substitutes: Vec<StoreItem>,
}

/// One item sold online, and its same-INN alternatives; 404 when it isn't
/// sold online.
pub async fn item_page(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<ItemPage, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    // ponytail: same INN only; strength/form/release matching and the
    // no-substitute list come with substitution (research §4).
    let rows = sqlx::query_as::<_, ItemRow>(&format!(
        "{} WHERE c.tenant_id = $1 AND c.sold_online AND c.is_active AND c.deleted_at IS NULL \
            AND (c.id = $2 OR (lower(COALESCE(c.inn_name, c.generic_name, '')) <> '' \
                 AND lower(COALESCE(c.inn_name, c.generic_name, '')) = ( \
                     SELECT lower(COALESCE(o.inn_name, o.generic_name, '')) \
                       FROM pharmacy_catalog o WHERE o.tenant_id = $1 AND o.id = $2))) \
          ORDER BY c.id = $2 DESC, c.name LIMIT $3",
        select(&settings)
    ))
    .bind(tenant_id)
    .bind(id)
    .bind(SUBSTITUTE_LIMIT + 1)
    .fetch_all(&mut **tx)
    .await?;
    let mut items = rows.iter().map(|r| present(r, &settings));
    let item = items
        .next()
        .filter(|i| i.id == id)
        .ok_or(AppError::NotFound)?;
    let mut substitutes: Vec<StoreItem> = items.collect();
    substitutes.sort_by_key(|s| s.price);
    Ok(ItemPage { item, substitutes })
}

#[derive(Debug, Deserialize)]
pub struct OnlineListing {
    pub sold_online: Option<bool>,
    pub habit_forming: Option<bool>,
}

/// `PUT /api/pharmacy/storefront/catalog/{id}` — put an item online or take
/// it off, or mark it habit-forming (pickup only, a unit cap).
pub async fn set_listing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<OnlineListing>,
) -> Result<Json<PharmacyCatalog>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let restricted = crate::resolve_pharmacy_restricted_fields(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, PharmacyCatalog>(
        "UPDATE pharmacy_catalog \
            SET sold_online = COALESCE($3, sold_online), \
                habit_forming = COALESCE($4, habit_forming), updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.sold_online)
    .bind(body.habit_forming)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(crate::filter_pharmacy_catalog_response(
        row,
        &restricted,
    )))
}
