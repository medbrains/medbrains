#![allow(dead_code, unreachable_pub)]

//! The world the storefront tests run in: the delivery-choice world (a
//! tenant, patients signed in the way patients are) with the storefront
//! open — licence, pharmacist in charge, grievance officer — and medicines
//! listed online with stock in date.

use reqwest::StatusCode;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::common;
use crate::delivery_choice_world::{Setup, setting};

/// Tests share the tenant's storefront settings; they run one at a time.
pub static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// A signed-in patient's call, any method.
pub async fn call(
    app: &common::TestApp,
    token: Option<&str>,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let client = reqwest::Client::new();
    let mut req = match method {
        "PUT" => client.put(app.url(path)),
        "POST" => client.post(app.url(path)),
        _ => client.get(app.url(path)),
    };
    if let Some(b) = body {
        req = req.json(&b);
    }
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let resp = req.send().await.expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Open the storefront: switched on, licence and pharmacist in charge on
/// record, a grievance officer named.
pub async fn open_store(app: &common::TestApp, setup: &Setup) {
    let admin: Uuid = sqlx::query_scalar(
        "UPDATE users SET registration_number = 'KA-PH-12345' WHERE username = 'admin' RETURNING id",
    )
    .fetch_one(&app.db)
    .await
    .expect("pharmacist");
    setting(
        app,
        setup,
        "billing",
        "drug_licence",
        json!("KA-20-1234, KA-21-1234"),
    )
    .await;
    setting(app, setup, "pharmacy", "storefront_enabled", json!(true)).await;
    setting(
        app,
        setup,
        "pharmacy",
        "pharmacist_in_charge",
        json!(admin.to_string()),
    )
    .await;
    setting(
        app,
        setup,
        "pharmacy",
        "grievance_officer",
        json!({ "name": "R. Officer", "email": "grievance@example.test", "phone": "9000000099" }),
    )
    .await;
    setting(app, setup, "pharmacy", "home_delivery_enabled", json!(true)).await;
}

/// A medicine listed online: `schedule` H, H1, X… or none; cold-chain or
/// not; 500 units in date, at ₹`price` a unit.
pub async fn listed(
    app: &common::TestApp,
    setup: &Setup,
    name: &str,
    schedule: Option<&str>,
    cold: bool,
) -> Uuid {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, drug_schedule, \
             needs_cold_chain, sold_online, base_price, mrp, tax_percent, current_stock, \
             reorder_level, category) \
         VALUES ($1, $2, $3, $3, $4, $5, true, 10, 12, 5, 500, 20, 'analgesics') RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!("SF-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(name)
    .bind(schedule)
    .bind(cold)
    .fetch_one(&app.db)
    .await
    .expect("drug");
    sqlx::query(
        "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, expiry_date, \
             quantity_received, quantity_on_hand, quarantine_status, selling_rate, mrp) \
         VALUES ($1, $2, 'B1', CURRENT_DATE + 400, 500, 500, 'cleared', 10, 12)",
    )
    .bind(setup.tenant)
    .bind(id)
    .execute(&app.db)
    .await
    .expect("batch");
    id
}

/// Units on hand across the item's batches — what dispense alone moves.
pub async fn on_hand(app: &common::TestApp, item: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(quantity_on_hand), 0)::bigint FROM pharmacy_batches \
          WHERE catalog_item_id = $1",
    )
    .bind(item)
    .fetch_one(&app.db)
    .await
    .expect("stock")
}

/// Plant a sign-in code for `phone`, as the SMS would bring it.
pub async fn plant_code(app: &common::TestApp, setup: &Setup, phone: &str) -> &'static str {
    let code = "424242";
    sqlx::query(
        "INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + interval '5 minutes')",
    )
    .bind(setup.tenant)
    .bind(phone)
    .bind(format!("{:x}", Sha256::digest(code.as_bytes())))
    .execute(&app.db)
    .await
    .expect("otp");
    code
}

pub fn new_phone() -> String {
    format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9])
}

pub async fn add(
    app: &common::TestApp,
    token: &str,
    item: Uuid,
    quantity: i32,
) -> (StatusCode, Value) {
    call(
        app,
        Some(token),
        "PUT",
        &format!("/api/portal/store/cart/items/{item}"),
        Some(json!({ "quantity": quantity })),
    )
    .await
}

pub async fn checkout(app: &common::TestApp, token: &str, body: Value) -> (StatusCode, Value) {
    call(
        app,
        Some(token),
        "POST",
        "/api/portal/store/checkout",
        Some(body),
    )
    .await
}

/// A small valid PNG, base64.
pub const PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
