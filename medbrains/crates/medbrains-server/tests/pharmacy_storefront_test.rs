//! The storefront: anyone browses what the hospital's pharmacy lists online;
//! a signed-in patient orders. Over-the-counter goes straight to fulfilment;
//! a prescription line waits for a pharmacist's verdict per line; Schedule X
//! is never sold online; a refrigerated medicine is never delivered. Stock
//! moves only at dispense. Each patient sees only their own orders, and
//! only a pharmacist with the permission verifies.

mod common;
mod delivery_choice_world;
mod storefront_world;

use delivery_choice_world::{new_patient, patient_token, prescription, setup, staff};
use reqwest::StatusCode;
use serde_json::json;
use storefront_world::{PNG, SERIAL, add, call, checkout, listed, on_hand, open_store};
use uuid::Uuid;

#[tokio::test]
async fn a_guest_browses_without_counts_but_cannot_order() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    // A name of its own, so a database kept from an earlier run can't answer first.
    let name = format!("Guestamol {}", &Uuid::new_v4().simple().to_string()[..8]);
    let item = listed(&app, &setup, &name, None, false).await;
    let code = &setup.tenant_code;

    let (status, found) = call(
        &app,
        None,
        "GET",
        &format!("/api/store/{code}/items?q={}", name.replace(' ', "%20")),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{found}");
    let hit = &found["items"][0];
    assert_eq!(hit["id"], json!(item));
    assert_eq!(hit["stock"], json!("available"));
    assert_eq!(hit["prescription_needed"], json!(false));
    assert!(hit.get("current_stock").is_none(), "never a count: {hit}");
    let (status, about) = call(&app, None, "GET", &format!("/api/store/{code}/about"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(about["open"], json!(true), "{about}");
    assert_eq!(about["pharmacist_registration"], json!("KA-PH-12345"));

    let (status, _) = checkout(
        &app,
        "not-a-token",
        json!({ "prescription_source": "none" }),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn an_otc_order_goes_straight_to_fulfilment_and_stock_waits_for_dispense() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let item = listed(&app, &setup, "Otcamol 500", None, false).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;

    let (status, cart) = add(&app, &token, item, 2).await;
    assert_eq!(status, StatusCode::OK, "{cart}");
    assert_eq!(cart["total"], json!("20.00"), "{cart}");
    let (status, order) = checkout(&app, &token, json!({ "prescription_source": "none" })).await;
    assert_eq!(status, StatusCode::OK, "{order}");
    assert_eq!(order["status"], json!("released"), "{order}");
    assert_eq!(order["pharmacy_stage"], json!("ordered"), "{order}");

    let (kind, ordered_by): (String, Option<Uuid>) = sqlx::query_as(
        "SELECT o.dispensing_type::text, o.ordered_by FROM pharmacy_orders o \
           JOIN pharmacy_store_orders s ON s.pharmacy_order_id = o.id WHERE s.id = $1::uuid",
    )
    .bind(order["id"].as_str().unwrap_or_default())
    .fetch_one(&app.db)
    .await
    .expect("pharmacy order");
    assert_eq!((kind.as_str(), ordered_by), ("otc", None));
    assert_eq!(
        on_hand(&app, item).await,
        500,
        "stock moves only at dispense"
    );
}

#[tokio::test]
async fn a_prescription_line_needs_a_prescription_and_a_pharmacist() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let otc = listed(&app, &setup, "Plainamol", None, false).await;
    let rx = listed(&app, &setup, "Azithrocin 500", Some("H"), false).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    add(&app, &token, otc, 1).await;
    add(&app, &token, rx, 3).await;

    let (status, refused) = checkout(&app, &token, json!({ "prescription_source": "none" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    let (status, _) = checkout(&app, &token, json!({ "prescription_source": "upload" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "nothing uploaded yet");

    let (status, cart) = call(
        &app,
        Some(&token),
        "PUT",
        "/api/portal/store/cart/prescription",
        Some(json!({ "data_base64": PNG })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{cart}");
    assert_eq!(cart["prescription_uploaded"], json!(true));
    let (status, waiting) =
        checkout(&app, &token, json!({ "prescription_source": "upload" })).await;
    assert_eq!(status, StatusCode::OK, "{waiting}");
    assert_eq!(
        waiting["status"],
        json!("awaiting_verification"),
        "{waiting}"
    );
    let id = waiting["id"].as_str().unwrap_or_default().to_owned();

    let (status, queue) = staff(
        &app,
        &setup,
        "GET",
        "/api/pharmacy/storefront/orders",
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{queue}");
    assert!(
        queue["orders"]
            .as_array()
            .is_some_and(|o| o.iter().any(|r| r["id"] == json!(id)))
    );
    let path = format!("/api/pharmacy/storefront/orders/{id}/verify");
    // Approving fewer than asked, with every line decided.
    let (status, verified) = staff(
        &app,
        &setup,
        "POST",
        &path,
        json!({
        "lines": [{ "catalog_item_id": rx, "approve": true, "quantity": 2 }],
        "note": "Two days' course on the prescription" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{verified}");
    assert_eq!(verified["status"], json!("released"), "{verified}");
    let qty: i32 = sqlx::query_scalar(
        "SELECT i.quantity FROM pharmacy_order_items i \
           JOIN pharmacy_store_orders s ON s.pharmacy_order_id = i.order_id \
          WHERE s.id = $1::uuid AND i.catalog_item_id = $2",
    )
    .bind(&id)
    .bind(rx)
    .fetch_one(&app.db)
    .await
    .expect("item");
    assert_eq!(qty, 2);
    assert_eq!(on_hand(&app, rx).await, 500);
}

#[tokio::test]
async fn a_rejected_line_needs_a_reason_and_nothing_left_rejects_the_order() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let rx = listed(&app, &setup, "Rejectocin", Some("H"), false).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    add(&app, &token, rx, 1).await;
    call(
        &app,
        Some(&token),
        "PUT",
        "/api/portal/store/cart/prescription",
        Some(json!({ "data_base64": PNG })),
    )
    .await;
    let (_, waiting) = checkout(&app, &token, json!({ "prescription_source": "upload" })).await;
    let path = format!(
        "/api/pharmacy/storefront/orders/{}/verify",
        waiting["id"].as_str().unwrap_or_default()
    );
    let (status, _) = staff(
        &app,
        &setup,
        "POST",
        &path,
        json!({ "lines": [{ "catalog_item_id": rx, "approve": false }] }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a refusal says why");
    let (status, rejected) = staff(
        &app,
        &setup,
        "POST",
        &path,
        json!({
        "lines": [{ "catalog_item_id": rx, "approve": false, "reason": "illegible" }] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{rejected}");
    assert_eq!(rejected["status"], json!("rejected"));
    assert_eq!(rejected["lines"][0]["reject_reason"], json!("illegible"));
}

#[tokio::test]
async fn schedule_x_is_never_sold_online_and_cold_chain_is_never_delivered() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let x = listed(&app, &setup, "Xtrolled", Some("X"), false).await;
    let ndps = listed(&app, &setup, "Narcotol", Some("NDPS"), false).await;
    let cold = listed(&app, &setup, "Coldulin", None, true).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;

    for item in [x, ndps] {
        let (status, body) = add(&app, &token, item, 1).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    }
    add(&app, &token, cold, 1).await;
    let (status, refused) = checkout(
        &app,
        &token,
        json!({ "prescription_source": "none",
        "delivery": { "address": "12 Lake Road, Karaikudi", "contact_phone": "9000000002",
                      "payment": "prepaid" } }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    assert!(refused.to_string().contains("refrigerated"), "{refused}");
}

#[tokio::test]
async fn another_patients_order_is_not_found() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let item = listed(&app, &setup, "Mineamol", None, false).await;
    let (_, mine) = new_patient(&app, &setup).await;
    let (_, theirs) = new_patient(&app, &setup).await;
    let me = patient_token(&app, &setup, &mine).await;
    let them = patient_token(&app, &setup, &theirs).await;
    add(&app, &me, item, 1).await;
    let (_, order) = checkout(&app, &me, json!({ "prescription_source": "none" })).await;
    let path = format!(
        "/api/portal/store/orders/{}",
        order["id"].as_str().unwrap_or_default()
    );

    assert_eq!(
        call(&app, Some(&me), "GET", &path, None).await.0,
        StatusCode::OK
    );
    assert_eq!(
        call(&app, Some(&them), "GET", &path, None).await.0,
        StatusCode::NOT_FOUND
    );
    let (_, their_cart) = call(&app, Some(&them), "GET", "/api/portal/store/cart", None).await;
    assert_eq!(their_cart["lines"], json!([]));
}

#[tokio::test]
async fn verifying_needs_the_permission() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let pharmacist = common::provision_staff(
        &app,
        &setup.csrf,
        "pharmacist",
        &["pharmacy.storefront.verify"],
    )
    .await;
    let id = Uuid::new_v4();
    let queue = pharmacist
        .client
        .get(app.url("/api/pharmacy/storefront/orders"))
        .send()
        .await
        .expect("queue");
    assert_eq!(queue.status(), StatusCode::FORBIDDEN);
    let verify = pharmacist
        .client
        .post(app.url(&format!("/api/pharmacy/storefront/orders/{id}/verify")))
        .header("x-csrf-token", &pharmacist.csrf)
        .json(&json!({ "lines": [] }))
        .send()
        .await
        .expect("verify");
    assert_eq!(verify.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn a_hospital_prescription_fills_the_cart_and_still_meets_a_pharmacist() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let drug = listed(&app, &setup, "Hospitamycin", Some("H"), false).await;
    sqlx::query("UPDATE pharmacy_catalog SET sold_online = false WHERE id = $1")
        .bind(drug)
        .execute(&app.db)
        .await
        .expect("unlisted");
    let (patient, phone) = new_patient(&app, &setup).await;
    let rx = prescription(&app, &setup, patient, drug, "Hospitamycin", 0).await;
    let token = patient_token(&app, &setup, &phone).await;

    let (status, filled) = call(
        &app,
        Some(&token),
        "POST",
        &format!("/api/portal/store/prescriptions/{rx}/order"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{filled}");
    assert_eq!(
        filled["cart"]["lines"][0]["from_prescription"],
        json!(true),
        "{filled}"
    );
    let (status, placed) = checkout(
        &app,
        &token,
        json!({ "prescription_source": "hospital", "prescription_id": rx }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{placed}");
    assert_eq!(placed["status"], json!("awaiting_verification"), "{placed}");
}
