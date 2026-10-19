//! Somebody who isn't a patient yet orders medicines: a mobile and a code
//! make them a light pharmacy-customer record, never a duplicate of a
//! patient already registered under that mobile; a family sharing one
//! mobile picks who is ordering, never chosen for them; the desk later
//! completes the record into a registration, and the orders stay with it.
//! At the counter, an H1 sale names the patient or is refused.

mod common;
mod delivery_choice_world;
mod storefront_world;

use delivery_choice_world::{new_patient, setup, staff};
use reqwest::StatusCode;
use serde_json::json;
use storefront_world::{SERIAL, add, call, checkout, listed, new_phone, open_store, plant_code};

#[tokio::test]
async fn a_new_mobile_becomes_a_pharmacy_customer_who_can_order() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let item = listed(&app, &setup, "Newcomol", None, false).await;
    let phone = new_phone();
    let code = plant_code(&app, &setup, &phone).await;
    let sign_in = format!("/api/store/{}/sign-in", setup.tenant_code);

    let (status, first) = call(
        &app,
        None,
        "POST",
        &sign_in,
        Some(json!({ "phone": phone, "code": code })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(first["needs_details"], json!(true), "{first}");
    let (status, done) = call(&app, None, "POST", &sign_in, Some(json!({
        "phone": phone, "code": code,
        "customer": { "name": "Meena Raman", "address": "4 Temple St, Karaikudi", "pincode": "630001" } })))
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    let token = done["session"]["token"]
        .as_str()
        .expect("signed in")
        .to_owned();
    let (uhid, light): (String, bool) = sqlx::query_as(
        "SELECT uhid, pharmacy_customer FROM patients WHERE tenant_id = $1 AND phone = $2",
    )
    .bind(setup.tenant)
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("light record");
    assert!(light && uhid.starts_with("PC-"), "{uhid}");

    add(&app, &token, item, 1).await;
    let (status, order) = checkout(&app, &token, json!({ "prescription_source": "none" })).await;
    assert_eq!(status, StatusCode::OK, "{order}");
}

#[tokio::test]
async fn a_registered_patients_mobile_signs_them_in_without_a_duplicate() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let (patient, phone) = new_patient(&app, &setup).await;
    let code = plant_code(&app, &setup, &phone).await;
    let (status, done) = call(
        &app,
        None,
        "POST",
        &format!("/api/store/{}/sign-in", setup.tenant_code),
        Some(json!({ "phone": phone, "code": code,
                     "customer": { "name": "Someone Else", "address": "x" } })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["session"]["patient_id"], json!(patient));
    let records: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND phone = $2")
            .bind(setup.tenant)
            .bind(&phone)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(records, 1);
}

#[tokio::test]
async fn a_family_sharing_a_mobile_chooses_who_is_signing_in() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let (mother, phone) = new_patient(&app, &setup).await;
    let (son, _) = new_patient(&app, &setup).await;
    sqlx::query("UPDATE patients SET phone = $1, first_name = 'Arun' WHERE id = $2")
        .bind(&phone)
        .bind(son)
        .execute(&app.db)
        .await
        .expect("shared mobile");
    let code = plant_code(&app, &setup, &phone).await;
    let verify = json!({ "tenant_code": setup.tenant_code, "phone": phone, "code": code });

    let (status, asked) = call(
        &app,
        None,
        "POST",
        "/api/portal/auth/verify",
        Some(verify.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{asked}");
    let people = asked["choose"].as_array().expect("asked to choose");
    assert_eq!(people.len(), 2, "{asked}");
    assert!(asked.get("token").is_none(), "nobody is picked silently");

    let mut chosen = verify;
    chosen["patient_id"] = json!(son);
    let (status, session) = call(&app, None, "POST", "/api/portal/auth/verify", Some(chosen)).await;
    assert_eq!(status, StatusCode::OK, "{session}");
    assert_eq!(session["patient_id"], json!(son));
    assert_ne!(session["patient_id"], json!(mother));
}

#[tokio::test]
async fn the_desk_completes_a_pharmacy_customer_and_their_orders_stay() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    let item = listed(&app, &setup, "Keepamol", None, false).await;
    let phone = new_phone();
    let code = plant_code(&app, &setup, &phone).await;
    let (_, done) = call(
        &app,
        None,
        "POST",
        &format!("/api/store/{}/sign-in", setup.tenant_code),
        Some(json!({ "phone": phone, "code": code,
                     "customer": { "name": "Lakshmi Iyer", "address": "9 Fort Rd" } })),
    )
    .await;
    let token = done["session"]["token"]
        .as_str()
        .expect("signed in")
        .to_owned();
    let patient = done["session"]["patient_id"]
        .as_str()
        .expect("patient")
        .to_owned();
    add(&app, &token, item, 1).await;
    checkout(&app, &token, json!({ "prescription_source": "none" })).await;

    let (status, matches) = staff(
        &app,
        &setup,
        "POST",
        "/api/patients/match",
        json!({ "first_name": "Lakshmi", "last_name": "Iyer", "phone": phone }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{matches}");
    assert!(
        matches.as_array().is_some_and(|m| m
            .iter()
            .any(|r| r["id"] == json!(patient) && r["pharmacy_customer"] == json!(true))),
        "{matches}"
    );
    let (status, completed) = staff(
        &app,
        &setup,
        "POST",
        &format!("/api/patients/{patient}/complete-registration"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{completed}");
    assert!(
        !completed["uhid"]
            .as_str()
            .unwrap_or("PC-")
            .starts_with("PC-"),
        "{completed}"
    );
    let orders: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_store_orders WHERE patient_id = $1::uuid AND status <> 'cart'",
    )
    .bind(&patient)
    .fetch_one(&app.db)
    .await
    .expect("orders");
    assert_eq!(orders, 1, "the same row keeps its orders");
    let (status, _) = staff(
        &app,
        &setup,
        "POST",
        &format!("/api/patients/{patient}/complete-registration"),
        json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a full registration isn't completed twice"
    );
}

#[tokio::test]
async fn a_counter_h1_sale_names_the_patient_or_is_refused() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let h1 = listed(&app, &setup, "Counterzolam", Some("H1"), false).await;
    let sale = |extra: serde_json::Value| {
        let mut body = json!({ "items": [{ "catalog_item_id": h1, "drug_name": "Counterzolam",
                               "quantity": 1, "gst_rate": 5, "mrp": 12, "selling_price": 10 }],
                               "payment_mode": "upi", "payment_reference": "UPI-TEST-1" });
        if let (Some(b), Some(e)) = (body.as_object_mut(), extra.as_object()) {
            b.extend(e.clone());
        }
        body
    };
    let (status, refused) = staff(
        &app,
        &setup,
        "POST",
        "/api/pharmacy/pos/sales",
        sale(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    let phone = new_phone();
    let (status, sold) = staff(
        &app,
        &setup,
        "POST",
        "/api/pharmacy/pos/sales",
        sale(json!({
        "patient_name": "Walk In", "patient_phone": phone, "patient_address": "2 Bazaar St",
        "prescriber_name": "Dr Outside", "prescriber_registration": "TN-55" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{sold}");
    let light: bool = sqlx::query_scalar(
        "SELECT pharmacy_customer FROM patients WHERE tenant_id = $1 AND phone = $2",
    )
    .bind(setup.tenant)
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("light record");
    assert!(light);
}
