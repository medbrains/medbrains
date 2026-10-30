//! Storefront part 2, stock (#4864, owner decisions 1-3): a hold's length
//! follows the hospital's ladder and how much is left; a lapsed hold lets
//! the stock go; holds only ever come out of what online may sell, never the
//! floor the wards and the counter keep; the store that fills an order is
//! the one serving the pincode that holds every line; and a pincode no store
//! serves is told so and offered pickup.

use crate::common;
use crate::delivery_choice_world;
use crate::storefront_p2_world;
use crate::storefront_world;

use delivery_choice_world::{choice, new_patient, patient_token, setup};
use reqwest::StatusCode;
use serde_json::json;
use storefront_p2_world::{
    Item, batch_on_hand, hold, hold_minutes, id_of, item, location, online_store, stock, stores_off,
};
use storefront_world::{SERIAL, add, call, checkout, open_store};
use uuid::Uuid;

fn plain(name: &str, floor: i32) -> Item<'_> {
    Item {
        name,
        schedule: None,
        inn: "paracetamol",
        cold: false,
        floor,
    }
}

#[tokio::test]
async fn the_hold_is_shorter_when_stock_is_scarce() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let plenty = item(&app, &setup, &plain("Plentamol", 20)).await;
    stock(&app, &setup, plenty, None, 500, 400).await;
    let scarce = item(&app, &setup, &plain("Scarcamol", 20)).await;
    stock(&app, &setup, scarce, None, 25, 400).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    add(&app, &token, plenty, 2).await;
    add(&app, &token, scarce, 2).await;

    let (status, held) = hold(&app, &token, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{held}");
    assert!(held["held_until"].is_string(), "{held}");
    // Default ladder: 15 minutes with plenty left, 10 when 10 or fewer remain.
    let long = hold_minutes(&app, plenty).await;
    let short = hold_minutes(&app, scarce).await;
    assert!((long[0] - 15.0).abs() < 0.1, "{long:?}");
    assert!((short[0] - 10.0).abs() < 0.1, "{short:?}");

    // The hospital's own ladder is what applies.
    let (status, rules) = delivery_choice_world::staff(
        &app,
        &setup,
        "GET",
        "/api/pharmacy/storefront/rules",
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{rules}");
    let mut rules = rules;
    rules["hold_tiers"]["checkout"] = json!([
        { "max_available": 100, "minutes": 3 }, { "max_available": null, "minutes": 30 }
    ]);
    let (status, saved) =
        delivery_choice_world::staff(&app, &setup, "PUT", "/api/pharmacy/storefront/rules", rules)
            .await;
    assert_eq!(status, StatusCode::OK, "{saved}");
    hold(&app, &token, json!({})).await;
    assert!((hold_minutes(&app, plenty).await[0] - 30.0).abs() < 0.1);
    assert!((hold_minutes(&app, scarce).await[0] - 3.0).abs() < 0.1);
    sqlx::query("DELETE FROM tenant_settings WHERE tenant_id = $1 AND key = 'stock_hold_tiers'")
        .bind(setup.tenant)
        .execute(&app.db)
        .await
        .expect("ladder back to default");
}

#[tokio::test]
async fn a_lapsed_hold_lets_the_stock_go() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    // 25 on hand, 20 kept back: 5 for online.
    let drug = item(&app, &setup, &plain("Lapsamol", 20)).await;
    stock(&app, &setup, drug, None, 25, 400).await;
    let (_, first_phone) = new_patient(&app, &setup).await;
    let first = patient_token(&app, &setup, &first_phone).await;
    let (_, second_phone) = new_patient(&app, &setup).await;
    let second = patient_token(&app, &setup, &second_phone).await;
    add(&app, &first, drug, 5).await;
    add(&app, &second, drug, 5).await;

    let (status, _) = hold(&app, &first, json!({})).await;
    assert_eq!(status, StatusCode::OK);
    let (status, refused) = hold(&app, &second, json!({})).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "the first hold has it: {refused}"
    );

    sqlx::query(
        "UPDATE pharmacy_stock_holds SET expires_at = now() - interval '1 second' \
          WHERE catalog_item_id = $1 AND released_at IS NULL",
    )
    .bind(drug)
    .execute(&app.db)
    .await
    .expect("lapse");
    let (status, held) = hold(&app, &second, json!({})).await;
    assert_eq!(status, StatusCode::OK, "the lapsed hold let go: {held}");
    let swept: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_stock_holds \
          WHERE catalog_item_id = $1 AND release_reason = 'expired'",
    )
    .bind(drug)
    .fetch_one(&app.db)
    .await
    .expect("swept");
    assert_eq!(swept, 1, "the sweep marked the lapsed hold released");
}

#[tokio::test]
async fn holds_never_reach_the_floor_the_wards_and_counter_keep() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let drug = item(&app, &setup, &plain("Floramol", 20)).await;
    let batch = stock(&app, &setup, drug, None, 30, 400).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    let (_, other_phone) = new_patient(&app, &setup).await;
    let other = patient_token(&app, &setup, &other_phone).await;

    add(&app, &token, drug, 10).await;
    let (status, _) = hold(&app, &token, json!({})).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "10 above the floor of 20 may be held"
    );
    add(&app, &other, drug, 1).await;
    let (status, _) = hold(&app, &other, json!({})).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "nothing is held into the floor"
    );
    assert_eq!(
        batch_on_hand(&app, batch).await,
        30,
        "a hold never moves stock: the counter and the wards still have all 30"
    );
    let held: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(quantity), 0) FROM pharmacy_stock_holds \
          WHERE catalog_item_id = $1 AND released_at IS NULL",
    )
    .bind(drug)
    .fetch_one(&app.db)
    .await
    .expect("held");
    assert_eq!(held, 10);
}

#[tokio::test]
async fn the_store_is_chosen_by_pincode_then_stock() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let drug = item(&app, &setup, &plain("Routamol", 0)).await;
    // Serves the patient's pincode but holds none.
    let empty = location(&app, &setup, "Town pharmacy").await;
    online_store(&app, &setup, empty, "630002", &["630001"]).await;
    // Serves it and holds it.
    let stocked = location(&app, &setup, "Main pharmacy").await;
    online_store(&app, &setup, stocked, "630005", &["630001", "630005"]).await;
    stock(&app, &setup, drug, Some(stocked), 50, 400).await;
    // Holds plenty, and is nearest, but doesn't serve the pincode.
    let elsewhere = location(&app, &setup, "City pharmacy").await;
    online_store(&app, &setup, elsewhere, "630001", &["600001"]).await;
    stock(&app, &setup, drug, Some(elsewhere), 500, 400).await;

    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    add(&app, &token, drug, 2).await;
    let (status, order) = checkout(
        &app,
        &token,
        json!({ "prescription_source": "none", "delivery": choice("prepaid")["delivery"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{order}");
    let chosen: Option<Uuid> = sqlx::query_scalar(
        "SELECT store_location_id FROM pharmacy_store_orders WHERE id = $1::uuid",
    )
    .bind(id_of(&order))
    .fetch_one(&app.db)
    .await
    .expect("store");
    assert_eq!(chosen, Some(stocked));
    let filled: Option<Uuid> = sqlx::query_scalar(
        "SELECT o.store_location_id FROM pharmacy_orders o \
           JOIN pharmacy_store_orders s ON s.pharmacy_order_id = o.id WHERE s.id = $1::uuid",
    )
    .bind(id_of(&order))
    .fetch_one(&app.db)
    .await
    .expect("pharmacy order");
    assert_eq!(
        filled,
        Some(stocked),
        "the pharmacy order goes to that store"
    );
    stores_off(&app, &setup).await;
}

#[tokio::test]
async fn a_pincode_no_store_serves_is_pickup_only() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let drug = item(&app, &setup, &plain("Farawaymol", 0)).await;
    let store = location(&app, &setup, "Hospital pharmacy").await;
    online_store(&app, &setup, store, "630001", &["630001"]).await;
    stock(&app, &setup, drug, Some(store), 50, 400).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    add(&app, &token, drug, 1).await;

    let (status, answer) = call(
        &app,
        Some(&token),
        "GET",
        "/api/portal/store/serviceability?pincode=110001",
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(answer["delivers"], json!(false), "{answer}");
    assert_eq!(answer["pickup_stores"][0]["id"], json!(store), "{answer}");

    let mut far = choice("prepaid")["delivery"].clone();
    far["pincode"] = json!("110001");
    let (status, refused) = checkout(
        &app,
        &token,
        json!({ "prescription_source": "none", "delivery": far }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    assert!(refused.to_string().contains("pickup"), "{refused}");
    let (status, collected) = checkout(
        &app,
        &token,
        json!({ "prescription_source": "none", "pickup_store_id": store }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "pickup is still offered: {collected}"
    );
    assert_eq!(collected["fulfilment"], json!("pickup"));
    stores_off(&app, &setup).await;
}
