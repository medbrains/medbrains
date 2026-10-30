//! Storefront part 2, out of stock (#4864, owner decision 4): a prescription
//! line the pharmacy can't fill still reaches the pharmacist. A substitute
//! goes out only with the prescribing doctor's sign-off and the patient's
//! consent, and lands in the substitution log; one agreed by phone and not
//! confirmed within 24 hours goes back; NTI drugs are never swapped. Or the
//! patient takes the prescription elsewhere: the print is recorded and names
//! no pharmacy unless the hospital has a disclosed partner.

use crate::common;
use crate::delivery_choice_world;
use crate::storefront_p2_world;
use crate::storefront_world;

use delivery_choice_world::{new_patient, patient_token, prescription, setup, staff};
use reqwest::StatusCode;
use serde_json::{Value, json};
use storefront_p2_world::{Item, id_of, item, stock, stores_off};
use storefront_world::{SERIAL, call, checkout, open_store};
use uuid::Uuid;

/// A Schedule H brand of `inn`.
fn brand<'a>(name: &'a str, inn: &'a str) -> Item<'a> {
    Item {
        name,
        schedule: Some("H"),
        inn,
        cold: false,
        floor: 0,
    }
}

/// Two brands of one medicine: the prescribed one out of stock, the other
/// in stock. Same salt, strength, form and release type.
async fn two_brands(
    app: &common::TestApp,
    setup: &delivery_choice_world::Setup,
    inn: &str,
) -> (Uuid, Uuid) {
    let tag = &Uuid::new_v4().simple().to_string()[..6];
    let prescribed_name = format!("Brandone {tag}");
    let other_name = format!("Brandtwo {tag}");
    let prescribed = item(app, setup, &brand(&prescribed_name, inn)).await;
    let other = item(app, setup, &brand(&other_name, inn)).await;
    stock(app, setup, other, None, 100, 400).await;
    (prescribed, other)
}

/// A patient ordering their hospital prescription for `drug`: the order
/// waits for the pharmacist, flagged out of stock. Returns (token, order, rx).
async fn ordered(
    app: &common::TestApp,
    setup: &delivery_choice_world::Setup,
    drug: Uuid,
) -> (String, String, String) {
    let name: String = sqlx::query_scalar("SELECT name FROM pharmacy_catalog WHERE id = $1")
        .bind(drug)
        .fetch_one(&app.db)
        .await
        .expect("name");
    let (patient, phone) = new_patient(app, setup).await;
    let rx = prescription(app, setup, patient, drug, &name, 0).await;
    let token = patient_token(app, setup, &phone).await;
    let path = format!("/api/portal/store/prescriptions/{rx}/order");
    let (status, filled) = call(app, Some(&token), "POST", &path, None).await;
    assert_eq!(status, StatusCode::OK, "{filled}");
    let (status, order) = checkout(
        app,
        &token,
        json!({ "prescription_source": "hospital", "prescription_id": rx }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{order}");
    assert_eq!(order["status"], json!("awaiting_verification"), "{order}");
    assert!(
        order["flags"].to_string().contains("out_of_stock"),
        "{order}"
    );
    (token, id_of(&order), rx)
}

fn propose(drug: Uuid, substitute: Uuid, method: &str) -> Value {
    json!({ "catalog_item_id": drug, "substitute_item_id": substitute,
            "reason": "Out of stock", "method": method,
            "phone_note": "Dr agreed on the phone at 10:05",
            "patient_agreed_by_phone": "Patient agreed on the phone" })
}

#[tokio::test]
async fn a_substitute_goes_out_with_the_doctors_sign_off_and_the_patients_consent() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let (prescribed, other) = two_brands(&app, &setup, "amoxicillin").await;
    let (token, order, _) = ordered(&app, &setup, prescribed).await;

    let path = format!("/api/pharmacy/storefront/orders/{order}/lines/{prescribed}/substitutes");
    let (status, found) = staff(&app, &setup, "GET", &path, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{found}");
    assert_eq!(found["candidates"][0]["id"], json!(other), "{found}");
    let mut body = propose(prescribed, other, "sign_off");
    body["patient_agreed_by_phone"] = Value::Null;
    let path = format!("/api/pharmacy/storefront/orders/{order}/substitutions");
    let (status, proposed) = staff(&app, &setup, "POST", &path, body).await;
    assert_eq!(status, StatusCode::OK, "{proposed}");
    let request = proposed["lines"][0]["substitution"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    assert_eq!(
        proposed["lines"][0]["substitution"]["status"],
        json!("with_doctor")
    );

    let verify = format!("/api/pharmacy/storefront/orders/{order}/verify");
    let decision = json!({ "lines": [{ "catalog_item_id": prescribed, "approve": true }] });
    let (status, waiting) = staff(&app, &setup, "POST", &verify, decision.clone()).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "the doctor hasn't decided: {waiting}"
    );

    let (status, queue) = staff(
        &app,
        &setup,
        "GET",
        "/api/doctors/me/pending-signoffs",
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{queue}");
    assert!(
        queue
            .as_array()
            .is_some_and(|q| q.iter().any(|e| e["record_id"] == json!(request)
                && e["record_type"] == json!("store_substitution"))),
        "in the doctor's sign-offs: {queue}"
    );
    let decide = format!("/api/doctor/store-substitutions/{request}/decide");
    let (status, decided) = staff(&app, &setup, "POST", &decide, json!({ "approve": true })).await;
    assert_eq!(status, StatusCode::OK, "{decided}");
    let (status, _) = staff(&app, &setup, "POST", &verify, decision.clone()).await;
    assert_eq!(status, StatusCode::CONFLICT, "the patient hasn't consented");

    let consent = format!("/api/portal/store/orders/{order}/substitutions/{request}/consent");
    let (status, mine) = call(
        &app,
        Some(&token),
        "POST",
        &consent,
        Some(json!({ "accept": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{mine}");
    assert!(
        mine["lines"][0]["substitute_name"]
            .as_str()
            .is_some_and(|n| n.starts_with("Brandtwo"))
    );
    let (status, released) = staff(&app, &setup, "POST", &verify, decision).await;
    assert_eq!(status, StatusCode::OK, "{released}");
    assert_eq!(released["status"], json!("released"), "{released}");

    let (went, method, patient): (Uuid, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT i.catalog_item_id, s.prescriber_consent_method, s.patient_consent_method \
           FROM pharmacy_order_items i \
           JOIN pharmacy_store_orders o ON o.pharmacy_order_id = i.order_id \
           JOIN pharmacy_substitutions s ON s.pharmacy_order_item_id = i.id \
          WHERE o.id = $1::uuid",
    )
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("logged in the substitution log");
    assert_eq!(went, other, "the substitute went out");
    assert_eq!(
        (method.as_deref(), patient.as_deref()),
        (Some("sign_off"), Some("portal"))
    );
}

#[tokio::test]
async fn a_phone_agreement_not_confirmed_in_24_hours_goes_back() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let (prescribed, other) = two_brands(&app, &setup, "cefixime").await;
    let (_, order, _) = ordered(&app, &setup, prescribed).await;

    let path = format!("/api/pharmacy/storefront/orders/{order}/substitutions");
    let (status, proposed) = staff(
        &app,
        &setup,
        "POST",
        &path,
        propose(prescribed, other, "phone"),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{proposed}");
    assert!(
        proposed["lines"][0]["substitute_name"].is_string(),
        "agreed now: {proposed}"
    );
    assert!(proposed["lines"][0]["substitution"]["confirm_due_at"].is_string());

    sqlx::query(
        "UPDATE pharmacy_substitution_requests SET confirm_due_at = now() - interval '1 minute' \
          WHERE store_order_id = $1::uuid",
    )
    .bind(&order)
    .execute(&app.db)
    .await
    .expect("24 hours pass");
    let (status, _) = staff(
        &app,
        &setup,
        "GET",
        "/api/pharmacy/storefront/orders",
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, line): (String, Option<Uuid>) = sqlx::query_as(
        "SELECT r.status, l.substitute_item_id FROM pharmacy_substitution_requests r \
           JOIN pharmacy_store_order_lines l ON l.id = r.store_order_line_id \
          WHERE r.store_order_id = $1::uuid",
    )
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("request");
    assert_eq!(status, "reverted");
    assert_eq!(line, None, "the line is back to what was prescribed");
}

#[tokio::test]
async fn a_narrow_therapeutic_index_drug_is_never_substituted() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let (prescribed, other) = two_brands(&app, &setup, "levothyroxine").await;
    let (_, order, _) = ordered(&app, &setup, prescribed).await;

    let path = format!("/api/pharmacy/storefront/orders/{order}/lines/{prescribed}/substitutes");
    let (status, found) = staff(&app, &setup, "GET", &path, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{found}");
    assert!(
        found["blocked"]
            .as_str()
            .is_some_and(|b| b.contains("narrow")),
        "{found}"
    );
    assert_eq!(found["candidates"], json!([]));
    let path = format!("/api/pharmacy/storefront/orders/{order}/substitutions");
    let (status, refused) = staff(
        &app,
        &setup,
        "POST",
        &path,
        propose(prescribed, other, "sign_off"),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{refused}");
}

#[tokio::test]
async fn the_outside_pharmacy_print_is_recorded_and_names_no_pharmacy_without_a_partner() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    sqlx::query(
        "DELETE FROM tenant_settings WHERE tenant_id = $1 AND key = 'outside_partner_pharmacy'",
    )
    .bind(setup.tenant)
    .execute(&app.db)
    .await
    .expect("no partner");
    let (prescribed, _) = two_brands(&app, &setup, "azithromycin").await;
    let (token, order, rx) = ordered(&app, &setup, prescribed).await;

    let path = format!("/api/portal/store/orders/{order}/outside-print");
    let (status, printed) = call(&app, Some(&token), "POST", &path, Some(json!({}))).await;
    assert_eq!(status, StatusCode::OK, "{printed}");
    assert_eq!(
        printed["partner"],
        Value::Null,
        "no pharmacy named: {printed}"
    );
    assert!(
        printed["any_pharmacy"]
            .as_str()
            .is_some_and(|t| t.contains("any licensed pharmacy"))
    );
    assert_eq!(
        printed["items"].as_array().map(Vec::len),
        Some(1),
        "{printed}"
    );
    let (by_patient, on_rx, order_status): (bool, Option<Uuid>, String) = sqlx::query_as(
        "SELECT p.requested_by_patient, p.prescription_id, o.status \
           FROM prescription_outside_prints p JOIN pharmacy_store_orders o ON o.id = p.store_order_id \
          WHERE p.store_order_id = $1::uuid",
    )
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("recorded");
    assert!(by_patient);
    assert_eq!(
        on_rx.map(|u| u.to_string()),
        Some(rx),
        "recorded on the prescription"
    );
    assert_eq!(order_status, "closed", "nothing left to send");

    // With a disclosed partner, it is named — beside its disclosure.
    let (_, mut rules) = staff(
        &app,
        &setup,
        "GET",
        "/api/pharmacy/storefront/rules",
        json!({}),
    )
    .await;
    rules["outside_partner"] = json!({ "name": "Lake Pharmacy", "address": "3 Lake Rd",
        "phone": "9000000011", "disclosure": "Run by the hospital's trust. Buy anywhere you like." });
    let (status, _) = staff(&app, &setup, "PUT", "/api/pharmacy/storefront/rules", rules).await;
    assert_eq!(status, StatusCode::OK);
    let (again, _) = two_brands(&app, &setup, "doxycycline").await;
    let (token, order, _) = ordered(&app, &setup, again).await;
    let path = format!("/api/portal/store/orders/{order}/outside-print");
    let (status, printed) = call(&app, Some(&token), "POST", &path, Some(json!({}))).await;
    assert_eq!(status, StatusCode::OK, "{printed}");
    assert_eq!(printed["partner"]["name"], json!("Lake Pharmacy"));
    assert!(
        printed["partner"]["disclosure"]
            .as_str()
            .is_some_and(|d| !d.is_empty())
    );
    sqlx::query(
        "DELETE FROM tenant_settings WHERE tenant_id = $1 AND key = 'outside_partner_pharmacy'",
    )
    .bind(setup.tenant)
    .execute(&app.db)
    .await
    .expect("partner off again");
}
