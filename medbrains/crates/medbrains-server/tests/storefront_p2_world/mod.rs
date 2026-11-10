#![allow(dead_code, unreachable_pub)]

//! The world the storefront part-2 tests run in: the storefront world, plus
//! pharmacy locations switched on for online orders with their pincodes,
//! items with stock placed where a test wants it, and the shortcut that
//! marks an order dispensed (dispensing has its own tests).

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;
use crate::delivery_choice_world::{Setup, staff};
use crate::storefront_world::call;

/// A pharmacy location.
pub async fn location(app: &common::TestApp, setup: &Setup, name: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO store_locations (tenant_id, code, name, location_type) \
         VALUES ($1, $2, $3, 'pharmacy') RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!(
        "PH-{}",
        &Uuid::new_v4().simple().to_string()[..8].to_uppercase()
    ))
    .bind(name)
    .fetch_one(&app.db)
    .await
    .expect("location")
}

/// Switch a location on for online orders, through the settings screen's API.
pub async fn online_store(
    app: &common::TestApp,
    setup: &Setup,
    location: Uuid,
    pincode: &str,
    serves: &[&str],
) {
    let (status, body) = staff(
        app,
        setup,
        "PUT",
        &format!("/api/pharmacy/storefront/stores/{location}"),
        json!({ "enabled": true, "pincode": pincode, "serviceable_pincodes": serves }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// Switch every location off again, so the next test starts from one pharmacy.
pub async fn stores_off(app: &common::TestApp, setup: &Setup) {
    sqlx::query("UPDATE pharmacy_online_stores SET enabled = false WHERE tenant_id = $1")
        .bind(setup.tenant)
        .execute(&app.db)
        .await
        .expect("stores off");
}

/// What an item is, for the tests that care.
pub struct Item<'a> {
    pub name: &'a str,
    pub schedule: Option<&'a str>,
    pub inn: &'a str,
    pub cold: bool,
    /// Units kept back for the wards and the counter.
    pub floor: i32,
}

/// A listed item with no stock yet.
pub async fn item(app: &common::TestApp, setup: &Setup, it: &Item<'_>) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, inn_name, strength, \
             dosage_form, drug_schedule, needs_cold_chain, sold_online, base_price, mrp, \
             tax_percent, gst_rate, hsn_code, current_stock, reorder_level, online_reserve_floor) \
         VALUES ($1, $2, $3, $4, $4, '500 mg', 'tablet', $5, $6, true, 10, 12, 5, 5, '3004', 0, \
                 $7, $7) RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!("P2-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(it.name)
    .bind(it.inn)
    .bind(it.schedule)
    .bind(it.cold)
    .bind(it.floor)
    .fetch_one(&app.db)
    .await
    .expect("item")
}

/// `qty` units of `item` at `location` (none: the whole pharmacy), expiring
/// in `days`. Returns the batch.
pub async fn stock(
    app: &common::TestApp,
    setup: &Setup,
    item: Uuid,
    location: Option<Uuid>,
    qty: i32,
    days: i32,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, store_location_id, \
             batch_number, expiry_date, quantity_received, quantity_on_hand, quarantine_status, \
             selling_rate, mrp) \
         VALUES ($1, $2, $3, $4, CURRENT_DATE + $5::int, $6, $6, 'cleared', 10, 12) RETURNING id",
    )
    .bind(setup.tenant)
    .bind(item)
    .bind(location)
    .bind(format!("B-{}", &Uuid::new_v4().simple().to_string()[..6]))
    .bind(days)
    .bind(qty)
    .fetch_one(&app.db)
    .await
    .expect("batch")
}

/// Units on one batch.
pub async fn batch_on_hand(app: &common::TestApp, batch: Uuid) -> i32 {
    sqlx::query_scalar("SELECT quantity_on_hand FROM pharmacy_batches WHERE id = $1")
        .bind(batch)
        .fetch_one(&app.db)
        .await
        .expect("batch on hand")
}

/// Ask for checkout's hold on the patient's cart.
pub async fn hold(app: &common::TestApp, token: &str, body: Value) -> (StatusCode, Value) {
    call(
        app,
        Some(token),
        "POST",
        "/api/portal/store/cart/hold",
        Some(body),
    )
    .await
}

/// Minutes each live hold of `item` lasts, newest first.
pub async fn hold_minutes(app: &common::TestApp, item: Uuid) -> Vec<f64> {
    sqlx::query_scalar(
        "SELECT (EXTRACT(EPOCH FROM expires_at - created_at) / 60)::float8 \
           FROM pharmacy_stock_holds WHERE catalog_item_id = $1 AND released_at IS NULL \
          ORDER BY created_at DESC",
    )
    .bind(item)
    .fetch_all(&app.db)
    .await
    .expect("holds")
}

/// Mark a released online order dispensed from `batch`, as the pharmacy's
/// dispensing would: the order, its lines, and the batch.
pub async fn dispensed(app: &common::TestApp, store_order: &str, batch: Uuid) {
    sqlx::query(
        "WITH o AS (UPDATE pharmacy_orders SET status = 'dispensed', dispensed_at = now() \
                     WHERE id = (SELECT pharmacy_order_id FROM pharmacy_store_orders \
                                  WHERE id = $1::uuid) RETURNING id), \
              i AS (UPDATE pharmacy_order_items SET quantity_dispensed = quantity, \
                           batch_stock_id = $2 \
                     WHERE order_id = (SELECT id FROM o) \
                       AND catalog_item_id = (SELECT catalog_item_id FROM pharmacy_batches \
                                               WHERE id = $2) RETURNING quantity) \
         UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand - (SELECT SUM(quantity) FROM i), \
                quantity_dispensed = quantity_dispensed + (SELECT SUM(quantity) FROM i) \
          WHERE id = $2",
    )
    .bind(store_order)
    .bind(batch)
    .execute(&app.db)
    .await
    .expect("dispensed");
}

/// The store order's id from a portal answer.
pub fn id_of(order: &Value) -> String {
    order["id"].as_str().unwrap_or_default().to_owned()
}
