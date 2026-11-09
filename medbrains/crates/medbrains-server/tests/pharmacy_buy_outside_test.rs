//! "Buy outside" is chosen, never inferred (owner, 2026-11-09).
//!
//! A doctor, or a nurse entering an order for one, marks a prescription line
//! the hospital does not stock as bought outside; a pharmacist may confirm an
//! unmapped line as such at review, and is otherwise told to map it. The line
//! is on the order as "buy outside", never dispensed, picked or verified,
//! never billed, never asked for at the payment gate, and it goes on the MAR
//! as the patient's own. An order with nothing in the catalogue cannot be
//! dispensed. The pick, the catalogue schedule and the database backstops
//! are in `pharmacy_buy_outside_db_test`.

use crate::dispense_world::{self, Desk, staff};

use medbrains_pharmacy::NOTHING_SOLD_HERE;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// The admin's PUT or POST of `body` to `path`, returning status and JSON.
pub(crate) async fn send(d: &Desk, method: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let request = if method == "PUT" {
        d.app.client.put(d.app.url(path))
    } else {
        d.app.client.post(d.app.url(path))
    };
    let resp = request
        .header("x-csrf-token", &d.admin_csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// One prescription line; `item` names the catalogue item, `outside` marks
/// it bought outside.
fn line(name: &str, item: Option<Uuid>, outside: bool) -> Value {
    json!({ "drug_name": name, "catalog_item_id": item, "dosage": "1 tab",
            "frequency": "OD", "duration": "5 days", "route": "oral",
            "buy_outside": outside })
}

/// The admin's user id: the doctor in these tests.
async fn admin_id(d: &Desk) -> Uuid {
    sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&d.app.db)
        .await
        .expect("admin")
}

/// An OPD visit in the desk's department, through the API.
async fn visit(d: &Desk) -> Uuid {
    let (status, visit) = send(
        d,
        "POST",
        "/api/opd/encounters",
        json!({ "patient_id": d.patient, "department_id": d.department }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    visit["encounter"]["id"]
        .as_str()
        .and_then(|v| v.parse().ok())
        .expect("visit id")
}

/// The admin prescribes `items` on `visit` (stepped up first); returns the
/// response: the prescription, its items and its Rx-queue id.
async fn prescribe(d: &Desk, visit: Uuid, items: Value) -> Value {
    d.app
        .step_up(&d.app.client, &d.admin_csrf, "admin123")
        .await;
    let (status, rx) = send(
        d,
        "POST",
        &format!("/api/opd/encounters/{visit}/prescriptions"),
        json!({ "items": items }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{rx}");
    rx
}

/// The admin reviews the Rx-queue entry with `body`.
async fn review(d: &Desk, rx: &Value, body: Value) -> (StatusCode, Value) {
    let queue = rx["pharmacy_rx_queue_id"].as_str().unwrap_or_default();
    send(
        d,
        "PUT",
        &format!("/api/pharmacy/rx-queue/{queue}/review"),
        body,
    )
    .await
}

/// The order the Rx-queue entry was approved into.
async fn order_of(d: &Desk, rx: &Value) -> Uuid {
    sqlx::query_scalar("SELECT pharmacy_order_id FROM pharmacy_prescriptions WHERE id = $1::uuid")
        .bind(rx["pharmacy_rx_queue_id"].as_str().unwrap_or_default())
        .fetch_one(&d.app.db)
        .await
        .expect("order")
}

/// The id of the order line named `name`.
pub(crate) async fn line_id(d: &Desk, order: Uuid, name: &str) -> Uuid {
    sqlx::query_scalar("SELECT id FROM pharmacy_order_items WHERE order_id = $1 AND drug_name = $2")
        .bind(order)
        .bind(name)
        .fetch_one(&d.app.db)
        .await
        .expect("line")
}

/// The prescription item id of `name` on the prescription response.
fn rx_item(rx: &Value, name: &str) -> String {
    rx["items"]
        .as_array()
        .and_then(|items| items.iter().find(|i| i["drug_name"] == name))
        .and_then(|i| i["id"].as_str())
        .unwrap_or_default()
        .to_owned()
}

#[tokio::test]
async fn a_buy_outside_line_is_never_billed_nor_asked_for_at_the_payment_gate() {
    let d = dispense_world::desk().await;
    let stocked = d.drug(None, false).await;
    let visit = visit(&d).await;
    let rx = prescribe(
        &d,
        visit,
        json!([
            line("Stocked", Some(stocked), false),
            line("Zincovit", None, true)
        ]),
    )
    .await;
    let admin = admin_id(&d).await;
    let marked: (bool, Option<Uuid>) = sqlx::query_as(
        "SELECT buy_outside, buy_outside_by FROM prescription_items WHERE id = $1::uuid",
    )
    .bind(rx_item(&rx, "Zincovit"))
    .fetch_one(&d.app.db)
    .await
    .expect("rx item");
    assert_eq!(
        marked,
        (true, Some(admin)),
        "the doctor's mark, and who made it"
    );

    // The doctor's mark needs no confirmation at review.
    let (status, body) = review(&d, &rx, json!({ "action": "approved" })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let order = order_of(&d, &rx).await;
    let outside = line_id(&d, order, "Zincovit").await;
    let row: (Option<Uuid>, String, String, bool, Option<Uuid>) = sqlx::query_as(
        "SELECT catalog_item_id, unit_price::text, total_price::text, buy_outside, \
                buy_outside_by FROM pharmacy_order_items WHERE id = $1",
    )
    .bind(outside)
    .fetch_one(&d.app.db)
    .await
    .expect("outside line");
    assert_eq!(
        row,
        (None, "0.00".into(), "0.00".into(), true, Some(admin)),
        "on the order, unpriced, with who chose it"
    );

    // The invoice charges the stocked line only.
    let charged: Vec<Uuid> =
        sqlx::query_scalar("SELECT source_id FROM invoice_items WHERE pharmacy_order_id = $1")
            .bind(order)
            .fetch_all(&d.app.db)
            .await
            .expect("invoice items");
    assert_eq!(
        charged,
        vec![line_id(&d, order, "Stocked").await],
        "one charge, the stocked line"
    );

    // Settle the stocked line's bill: the gate asks nothing more, so the
    // dispense needs no unpaid reason.
    sqlx::query(
        "UPDATE invoices SET paid_amount = total_amount, status = 'paid' \
          WHERE id IN (SELECT invoice_id FROM invoice_items WHERE pharmacy_order_id = $1)",
    )
    .bind(order)
    .execute(&d.app.db)
    .await
    .expect("paid");
    let (status, body) = d
        .dispense(order, json!({ "unpaid_override_reason": null }))
        .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "paid in full, nothing else asked: {body}"
    );

    // The encounter's billing sweep does not charge it either.
    let (status, body) = send(
        &d,
        "POST",
        "/api/billing/auto-charge",
        json!({ "encounter_id": visit, "modules": ["pharmacy"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let outside_charges: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM invoice_items WHERE source_id = $1")
            .bind(outside)
            .fetch_one(&d.app.db)
            .await
            .expect("charges");
    assert_eq!(outside_charges, 0, "never billed: {body}");
}

#[tokio::test]
async fn review_needs_a_mapping_or_a_confirmed_buy_outside_for_every_unmapped_line() {
    let d = dispense_world::desk().await;
    let stocked = d.drug(None, false).await;
    let retired = d.drug(None, false).await;
    sqlx::query("UPDATE pharmacy_catalog SET is_active = false WHERE id = $1")
        .bind(retired)
        .execute(&d.app.db)
        .await
        .expect("retired");
    let typed = format!("Typed tonic {}", dispense_world::tag());
    let visit = visit(&d).await;
    let rx = prescribe(
        &d,
        visit,
        json!([
            line("Stocked", Some(stocked), false),
            line(&typed, None, false)
        ]),
    )
    .await;
    let typed_id = rx_item(&rx, &typed);

    // Typed, unmarked, unmapped: never taken as bought outside.
    let (status, body) = review(&d, &rx, json!({ "action": "approved" })).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body.to_string().contains("or mark it buy outside"),
        "{body}"
    );

    // Mapped to an item that is not active: refused, not rescued by name.
    let mapped = json!({ "action": "approved", "items": [{
        "prescription_item_id": typed_id, "catalog_item_id": retired,
        "quantity": 1, "unit_price": 10 }] });
    let (status, body) = review(&d, &rx, mapped).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains("is not active"), "{body}");

    // Confirmed buy outside: approved, and the confirmation is recorded.
    let confirmed = json!({ "action": "approved", "items": [{
        "prescription_item_id": typed_id, "buy_outside": true,
        "quantity": 1, "unit_price": 0 }] });
    let (status, body) = review(&d, &rx, confirmed).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let order = order_of(&d, &rx).await;
    let by: (bool, Option<Uuid>) = sqlx::query_as(
        "SELECT buy_outside, buy_outside_by FROM pharmacy_order_items WHERE id = $1",
    )
    .bind(line_id(&d, order, &typed).await)
    .fetch_one(&d.app.db)
    .await
    .expect("line");
    assert_eq!(by, (true, Some(admin_id(&d).await)), "who confirmed it");
    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log \
          WHERE entity_id = $1 AND action = 'pharmacy.rx_review.buy_outside_confirmed'",
    )
    .bind(order)
    .fetch_one(&d.app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1);
}

#[tokio::test]
async fn nothing_in_the_catalogue_is_refused_at_review_and_at_the_counter() {
    let d = dispense_world::desk().await;
    let visit = visit(&d).await;
    let rx = prescribe(&d, visit, json!([line("Zincovit", None, true)])).await;
    let (status, body) = review(&d, &rx, json!({ "action": "approved" })).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body.to_string()
            .contains("Nothing on this prescription is in the catalogue"),
        "{body}"
    );

    // An order raised elsewhere: a typed line carries no price.
    let order = |price: i32| {
        json!({ "patient_id": d.patient, "encounter_id": visit,
                "items": [{ "drug_name": "Typed tonic", "quantity": 1,
                            "unit_price": price }] })
    };
    let (status, body) = send(&d, "POST", "/api/pharmacy/orders", order(5)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body.to_string().contains("carries no price"), "{body}");
    let (status, body) = send(&d, "POST", "/api/pharmacy/orders", order(0)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let id: Uuid = body["order"]["id"]
        .as_str()
        .and_then(|v| v.parse().ok())
        .expect("order id");
    let (status, body) = d.dispense(id, json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains(NOTHING_SOLD_HERE), "{body}");
}

#[tokio::test]
async fn a_buy_outside_medicine_goes_on_the_mar_as_the_patients_own() {
    let d = dispense_world::desk().await;
    let stocked = d.drug(None, false).await;
    let visit = visit(&d).await;
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(d.tenant)
    .bind(visit)
    .bind(d.patient)
    .bind(d.doctor)
    .fetch_one(&d.app.db)
    .await
    .expect("admission");
    let rx = prescribe(
        &d,
        visit,
        json!([
            line("Stocked", Some(stocked), false),
            line("Own inhaler", None, true)
        ]),
    )
    .await;
    let (status, body) = review(&d, &rx, json!({ "action": "approved" })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = d.dispense(order_of(&d, &rx).await, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let resp = d
        .app
        .get(
            &d.app.client,
            &format!("/api/ipd/admissions/{admission}/mar"),
        )
        .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let mar: Value = resp.json().await.expect("mar");
    let doses = mar.as_array().cloned().unwrap_or_default();
    let own: Vec<&Value> = doses
        .iter()
        .filter(|m| m["drug_name"] == "Own inhaler")
        .collect();
    assert!(!own.is_empty(), "the outside medicine is charted: {mar}");
    assert!(
        own.iter()
            .all(|m| m["patients_own"] == true && m["batch_number"].is_null()),
        "as the patient's own, with no batch: {mar}"
    );
    assert!(
        doses
            .iter()
            .filter(|m| m["drug_name"] == "Stocked")
            .all(|m| m["patients_own"] == false),
        "{mar}"
    );
}

#[tokio::test]
async fn a_nurse_marks_a_line_buy_outside_on_a_doctors_verbal_order() {
    let d = dispense_world::desk().await;
    let nurse = staff(&d.app, &d.admin_csrf, ("nurse", d.department), &[]).await;
    let visit = visit(&d).await;
    d.app
        .step_up(&nurse.client, &nurse.csrf, &nurse.password)
        .await;
    let resp = nurse
        .client
        .post(
            d.app
                .url(&format!("/api/opd/encounters/{visit}/prescriptions")),
        )
        .header("x-csrf-token", &nurse.csrf)
        .json(&json!({
            "items": [line("Zincovit", None, true)],
            "order_mode": "verbal",
            "ordering_doctor_id": d.doctor,
            "read_back_confirmed": true,
        }))
        .send()
        .await
        .expect("nurse prescribes");
    let status = resp.status();
    let rx: Value = resp.json().await.unwrap_or(Value::Null);
    assert_eq!(status, StatusCode::OK, "{rx}");
    assert_eq!(
        rx["prescription"]["doctor_id"],
        json!(d.doctor),
        "the doctor is recorded"
    );
    assert_eq!(rx["items"][0]["buy_outside"], true, "{rx}");
    assert_eq!(
        rx["items"][0]["buy_outside_by"],
        json!(nurse.user_id),
        "{rx}"
    );

    // A buy-outside line that names a catalogue item is refused.
    let drug = d.drug(None, false).await;
    let resp = nurse
        .client
        .post(
            d.app
                .url(&format!("/api/opd/encounters/{visit}/prescriptions")),
        )
        .header("x-csrf-token", &nurse.csrf)
        .json(&json!({
            "items": [line("Mixed", Some(drug), true)],
            "order_mode": "verbal",
            "ordering_doctor_id": d.doctor,
            "read_back_confirmed": true,
        }))
        .send()
        .await
        .expect("nurse prescribes");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
