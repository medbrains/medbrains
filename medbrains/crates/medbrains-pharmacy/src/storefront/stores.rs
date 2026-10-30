//! Which pharmacy locations fill online orders, where each delivers, and how
//! much each can still sell online (owner decisions 2 and 3). A hospital that
//! has switched no location on runs as one pharmacy: all its stock, no
//! pincode limit — how part 1 behaved.
//!
//! What online may sell at a store = cleared stock with enough shelf life
//! there, less the item's online floor, less live holds there. The counter
//! and the wards are never limited by it.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::pharmacy_holds::{StoreCandidate, Unchosen, choose_store, is_pincode};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Locations listed on the settings screen, at most.
const LOCATION_LIMIT: i64 = 200;
/// Serviceable pincodes one store may list, at most.
const MAX_PINCODES: usize = 500;

/// A location as the settings screen shows it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OnlineStore {
    pub store_location_id: Uuid,
    pub code: String,
    pub name: String,
    pub location_type: String,
    /// It is one of the hospital's pharmacies (hub or spoke).
    pub is_pharmacy: bool,
    pub enabled: bool,
    pub pincode: Option<String>,
    pub serviceable_pincodes: Vec<String>,
}

/// `GET /api/pharmacy/storefront/stores`
pub async fn list_stores(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OnlineStore>>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, OnlineStore>(
        "SELECT l.id AS store_location_id, l.code, l.name, l.location_type, \
                EXISTS (SELECT 1 FROM pharmacy_store_assignments a WHERE a.tenant_id = l.tenant_id \
                          AND a.store_location_id = l.id AND a.deleted_at IS NULL) AS is_pharmacy, \
                COALESCE(o.enabled, false) AS enabled, o.pincode, \
                COALESCE(o.serviceable_pincodes, '{}') AS serviceable_pincodes \
           FROM store_locations l \
           LEFT JOIN pharmacy_online_stores o ON o.tenant_id = l.tenant_id \
                AND o.store_location_id = l.id AND o.deleted_at IS NULL \
          WHERE l.tenant_id = $1 AND l.is_active AND l.deleted_at IS NULL \
          ORDER BY 5 DESC, 6 DESC, l.name LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(LOCATION_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct StoreUpdate {
    pub enabled: bool,
    pub pincode: Option<String>,
    pub serviceable_pincodes: Vec<String>,
}

/// The pincodes, trimmed, checked and de-duplicated.
fn clean_pincodes(raw: &[String]) -> Result<Vec<String>, AppError> {
    let mut out: Vec<String> = raw
        .iter()
        .map(|p| p.trim().to_owned())
        .filter(|p| !p.is_empty())
        .collect();
    if let Some(bad) = out.iter().find(|p| !is_pincode(p)) {
        return Err(AppError::BadRequest(format!(
            "{bad} isn't a pincode: six digits, not starting with 0"
        )));
    }
    out.sort();
    out.dedup();
    if out.len() > MAX_PINCODES {
        return Err(AppError::BadRequest(format!(
            "At most {MAX_PINCODES} pincodes per store"
        )));
    }
    Ok(out)
}

/// `PUT /api/pharmacy/storefront/stores/{location_id}` — switch a location's
/// online fulfilment on or off and set where it delivers.
pub async fn put_store(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(location_id): Path<Uuid>,
    Json(body): Json<StoreUpdate>,
) -> Result<Json<Vec<OnlineStore>>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let pincodes = clean_pincodes(&body.serviceable_pincodes)?;
    let pincode = body
        .pincode
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty());
    if pincode.is_some_and(|p| !is_pincode(p)) {
        return Err(AppError::BadRequest(
            "The store's pincode is six digits, not starting with 0".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let saved = sqlx::query(
        "INSERT INTO pharmacy_online_stores \
           (tenant_id, store_location_id, enabled, pincode, serviceable_pincodes, created_by) \
         SELECT $1, l.id, $3, $4, $5, $6 FROM store_locations l \
          WHERE l.id = $2 AND l.tenant_id = $1 AND l.is_active AND l.deleted_at IS NULL \
         ON CONFLICT (tenant_id, store_location_id) WHERE deleted_at IS NULL \
         DO UPDATE SET enabled = EXCLUDED.enabled, pincode = EXCLUDED.pincode, \
                       serviceable_pincodes = EXCLUDED.serviceable_pincodes",
    )
    .bind(claims.tenant_id)
    .bind(location_id)
    .bind(body.enabled)
    .bind(pincode)
    .bind(&pincodes)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if saved.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    list_stores(State(state), Extension(claims)).await
}

/// A location filling online orders.
#[derive(Debug, Clone, sqlx::FromRow)]
pub(crate) struct Enabled {
    pub id: Uuid,
    pub name: String,
    pub address: Option<String>,
    pub pincode: Option<String>,
    pub serviceable_pincodes: Vec<String>,
}

/// The locations switched on; empty when the hospital runs as one pharmacy.
pub(crate) async fn enabled(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<Enabled>, AppError> {
    Ok(sqlx::query_as::<_, Enabled>(
        "SELECT l.id, l.name, l.address, o.pincode, o.serviceable_pincodes \
           FROM pharmacy_online_stores o \
           JOIN store_locations l ON l.id = o.store_location_id AND l.tenant_id = o.tenant_id \
          WHERE o.tenant_id = $1 AND o.enabled AND o.deleted_at IS NULL \
            AND l.is_active AND l.deleted_at IS NULL \
          ORDER BY l.name LIMIT $2",
    )
    .bind(tenant_id)
    .bind(LOCATION_LIMIT)
    .fetch_all(&mut **tx)
    .await?)
}

/// Units on hand and held, per (store, item). The store is `None` when no
/// location is switched on: the whole pharmacy counts as one.
pub(crate) type Stock = HashMap<(Option<Uuid>, Uuid), (i32, i32)>;

/// Stock per store for `items`, with `shelf_days` of shelf life left; holds
/// of `own_order` are not counted against it. Two queries, any number of
/// items.
pub(crate) async fn stock(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    items: &[Uuid],
    shelf_days: i32,
    own_order: Option<Uuid>,
) -> Result<Stock, AppError> {
    let stores: Vec<Option<Uuid>> = {
        let ids: Vec<Option<Uuid>> = enabled(tx, tenant_id)
            .await?
            .into_iter()
            .map(|s| Some(s.id))
            .collect();
        if ids.is_empty() { vec![None] } else { ids }
    };
    let multi = stores.iter().any(Option::is_some);
    let on_hand: Vec<(Option<Uuid>, Uuid, i64)> = sqlx::query_as(
        "SELECT CASE WHEN $4 THEN b.store_location_id END, b.catalog_item_id, \
                SUM(b.quantity_on_hand)::bigint \
           FROM pharmacy_batches b \
          WHERE b.tenant_id = $1 AND b.catalog_item_id = ANY($2) AND b.deleted_at IS NULL \
            AND b.quarantine_status = 'cleared' AND b.quantity_on_hand > 0 \
            AND b.expiry_date >= CURRENT_DATE + $3::int \
          GROUP BY 1, 2",
    )
    .bind(tenant_id)
    .bind(items)
    .bind(shelf_days.max(0))
    .bind(multi)
    .fetch_all(&mut **tx)
    .await?;
    let held: Vec<(Option<Uuid>, Uuid, i64)> = sqlx::query_as(
        "SELECT CASE WHEN $4 THEN h.store_location_id END, h.catalog_item_id, \
                SUM(h.quantity)::bigint \
           FROM pharmacy_stock_holds h \
          WHERE h.tenant_id = $1 AND h.catalog_item_id = ANY($2) AND h.released_at IS NULL \
            AND h.deleted_at IS NULL AND h.expires_at > now() \
            AND h.store_order_id IS DISTINCT FROM $3 \
          GROUP BY 1, 2",
    )
    .bind(tenant_id)
    .bind(items)
    .bind(own_order)
    .bind(multi)
    .fetch_all(&mut **tx)
    .await?;
    let to_i32 = |n: i64| i32::try_from(n).unwrap_or(i32::MAX);
    let mut out: Stock = HashMap::new();
    for store in &stores {
        for item in items {
            out.insert((*store, *item), (0, 0));
        }
    }
    for (store, item, n) in on_hand {
        if let Some(e) = out.get_mut(&(store, item)) {
            e.0 = to_i32(n);
        }
    }
    for (store, item, n) in held {
        if let Some(e) = out.get_mut(&(store, item)) {
            e.1 = to_i32(n);
        }
    }
    Ok(out)
}

/// What online may still sell of `item` at `store`, given its floor.
pub(crate) fn available(stock: &Stock, store: Option<Uuid>, item: Uuid, floor: i32) -> i32 {
    stock
        .get(&(store, item))
        .map_or(0, |(on_hand, held)| on_hand - floor.max(0) - held)
}

/// The best any store can do for `item`: what a patient browsing sees.
pub(crate) fn best_available(stock: &Stock, item: Uuid, floor: i32) -> i32 {
    stock
        .keys()
        .filter(|(_, i)| *i == item)
        .map(|(store, _)| available(stock, *store, item, floor))
        .max()
        .unwrap_or(0)
}

/// One order line as selection weighs it: item, units, its online floor.
pub(crate) struct Want {
    pub item: Uuid,
    pub quantity: i32,
    pub floor: i32,
}

/// The store to fill an order from (`None` when the hospital runs as one
/// pharmacy), by the owner's order: enabled, serving the pincode, holding
/// every line, nearest.
pub(crate) fn choose(
    stores: &[Enabled],
    stock: &Stock,
    wants: &[Want],
    delivery_pincode: Option<&str>,
    near: Option<&str>,
) -> Result<Option<Uuid>, AppError> {
    let fills = |store: Option<Uuid>| {
        wants
            .iter()
            .all(|w| available(stock, store, w.item, w.floor) >= w.quantity)
    };
    if stores.is_empty() {
        return if fills(None) {
            Ok(None)
        } else {
            Err(AppError::Conflict(
                "Something in your cart is out of stock for online orders".to_owned(),
            ))
        };
    }
    let candidates: Vec<StoreCandidate> = stores
        .iter()
        .map(|s| StoreCandidate {
            id: s.id,
            pincode: s.pincode.clone(),
            serviceable: s.serviceable_pincodes.clone(),
            fills_all: fills(Some(s.id)),
        })
        .collect();
    match choose_store(&candidates, delivery_pincode, near) {
        Ok(id) => Ok(Some(id)),
        Err(Unchosen::NotDeliveredHere) => Err(AppError::BadRequest(
            "We don't deliver to that pincode yet: choose pickup at the pharmacy".to_owned(),
        )),
        Err(Unchosen::OutOfStock) => Err(AppError::Conflict(
            "No one pharmacy has everything in your cart in stock: remove what's out, or \
             collect it"
                .to_owned(),
        )),
    }
}

/// Whether the hospital delivers to a pincode, and where it can be picked
/// up, for the patient's cart.
#[derive(Debug, Serialize)]
pub struct Serviceability {
    /// Some location is switched on; otherwise the hospital is one pharmacy.
    pub multi_store: bool,
    pub delivers: bool,
    pub pickup_stores: Vec<PickupStore>,
}

#[derive(Debug, Serialize)]
pub struct PickupStore {
    pub id: Uuid,
    pub name: String,
    pub address: Option<String>,
}

/// Delivery to `pincode` (any, when none given), and the pickup stores.
pub async fn serviceability(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    pincode: Option<&str>,
) -> Result<Serviceability, AppError> {
    let stores = enabled(tx, tenant_id).await?;
    let pincode = pincode.map(str::trim).filter(|p| !p.is_empty());
    Ok(Serviceability {
        multi_store: !stores.is_empty(),
        delivers: stores.is_empty()
            || pincode.is_none_or(|p| {
                stores
                    .iter()
                    .any(|s| s.serviceable_pincodes.iter().any(|x| x == p))
            }),
        pickup_stores: stores
            .into_iter()
            .map(|s| PickupStore {
                id: s.id,
                name: s.name,
                address: s.address,
            })
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pincodes_are_cleaned_and_checked() {
        let ok = clean_pincodes(&[" 560034".to_owned(), "560034".to_owned(), String::new()]);
        assert_eq!(ok.ok(), Some(vec!["560034".to_owned()]));
        assert!(clean_pincodes(&["12345".to_owned()]).is_err());
    }

    #[test]
    fn holds_and_the_floor_come_out_of_what_online_sells() {
        let item = Uuid::from_u128(1);
        let mut stock: Stock = HashMap::new();
        stock.insert((None, item), (30, 4));
        assert_eq!(available(&stock, None, item, 20), 6);
        assert_eq!(best_available(&stock, item, 40), -14);
    }
}
