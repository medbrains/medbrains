//! No free text where medicine is sold (owner, 2026-11-09).
//!
//! Every OTC and POS sale line, and every camp dispense line, is a catalogue
//! item. A line without one is refused with "Pick the item from the
//! catalogue. If it is not there, ask a pharmacist to add it with its
//! schedule.", whatever it says: a gated drug, a disguised one, or cotton
//! wool. A catalogue item still sells. The database refuses the same lines
//! when a path forgets (migration 1453). The camp's refusal is in
//! `camp_pharmacy_sync_gate_test`.
//!
//! A doctor may still prescribe a medicine the hospital does not stock,
//! marked buy outside: it is listed on the pharmacy order as such, never
//! dispensed here, and never blocks dispensing the catalogue lines. The
//! marker's billing, review and MAR rules are in `pharmacy_buy_outside_test`.

use crate::dispense_world::{self, Desk};

use medbrains_pharmacy::schedule_gate::PICK_FROM_CATALOGUE;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// POSTs `body` to `path` as the admin and returns the status and text.
async fn post(d: &Desk, path: &str, body: Value) -> (StatusCode, String) {
    let resp = d
        .app
        .client
        .post(d.app.url(path))
        .header("x-csrf-token", &d.admin_csrf)
        .json(&body)
        .send()
        .await
        .expect("post");
    (resp.status(), resp.text().await.unwrap_or_default())
}

/// A one-line OTC sale of `drug_name`, on `item` when given.
fn otc(item: Option<Uuid>, drug_name: &str) -> Value {
    json!({ "items": [{ "catalog_item_id": item, "drug_name": drug_name, "quantity": 1,
                        "unit_price": 10 }] })
}

/// A one-line POS sale of `drug_name`, on `item` when given, paid by UPI so
/// no cash drawer is needed.
fn pos(item: Option<Uuid>, drug_name: &str) -> Value {
    json!({
        "items": [{
            "catalog_item_id": item, "drug_name": drug_name, "quantity": 1,
            "gst_rate": 12, "mrp": 10, "selling_price": 10,
        }],
        "payment_mode": "upi",
        "payment_reference": "UPI-CAT-1",
    })
}

#[tokio::test]
async fn an_otc_line_without_a_catalogue_item_is_refused_and_a_catalogue_item_sells() {
    let d = dispense_world::desk().await;
    let plain = d.drug(None, false).await;
    for typed in ["Cotton roll", "Mor\u{200B}phine", "50mg tramadol"] {
        let (status, text) = post(&d, "/api/pharmacy/otc-sale", otc(None, typed)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{typed}: {text}");
        assert!(text.contains(PICK_FROM_CATALOGUE), "{typed}: {text}");
    }
    let (status, text) = post(&d, "/api/pharmacy/otc-sale", otc(Some(plain), "Plain")).await;
    assert_eq!(status, StatusCode::OK, "{text}");
}

#[tokio::test]
async fn a_pos_line_without_a_catalogue_item_is_refused_and_a_catalogue_item_sells() {
    let d = dispense_world::desk().await;
    let plain = d.drug(None, false).await;
    let (status, text) = post(&d, "/api/pharmacy/pos/sales", pos(None, "Glycerin soap")).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{text}");
    assert!(text.contains(PICK_FROM_CATALOGUE), "{text}");

    let (status, text) = post(&d, "/api/pharmacy/pos/sales", pos(Some(plain), "Plain")).await;
    assert_eq!(status, StatusCode::OK, "{text}");
}

#[tokio::test]
async fn the_database_refuses_a_sold_line_without_a_catalogue_item() {
    let d = dispense_world::desk().await;
    let sold: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_orders (tenant_id, patient_id, ordered_by, status, \
                                      dispensing_type) \
         VALUES ($1, $2, $3, 'dispensed', 'otc') RETURNING id",
    )
    .bind(d.tenant)
    .bind(d.patient)
    .bind(d.doctor)
    .fetch_one(&d.app.db)
    .await
    .expect("order");
    let line = sqlx::query(
        "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, quantity, unit_price, \
                                           total_price) VALUES ($1, $2, 'Typed', 1, 1, 1)",
    )
    .bind(d.tenant)
    .bind(sold)
    .execute(&d.app.db)
    .await;
    let err = line.err().map(|e| e.to_string()).unwrap_or_default();
    assert!(err.contains(PICK_FROM_CATALOGUE), "{err}");
}

/// The admin's PUT or POST of `body` to `path`, returning status and JSON.
async fn send(d: &Desk, method: &str, path: &str, body: Value) -> (StatusCode, Value) {
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

#[tokio::test]
async fn a_doctor_prescribes_a_medicine_bought_outside_and_the_rest_is_dispensed() {
    let d = dispense_world::desk().await;
    d.app
        .step_up(&d.app.client, &d.admin_csrf, "admin123")
        .await;
    let plain = d.drug(None, false).await;
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(d.tenant)
    .fetch_one(&d.app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        &d,
        "POST",
        "/api/opd/encounters",
        json!({ "patient_id": d.patient, "department_id": department }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let visit_id = visit["encounter"]["id"].as_str().unwrap_or_default();

    // The doctor writes one stocked medicine and one the hospital does not
    // stock, for the patient to buy outside: the prescription saves.
    let line = |name: &str, item: Option<Uuid>| {
        json!({ "drug_name": name, "catalog_item_id": item, "dosage": "1 tab",
                "frequency": "OD", "duration": "5 days", "route": "oral",
                "buy_outside": item.is_none() })
    };
    let (status, rx) = send(
        &d,
        "POST",
        &format!("/api/opd/encounters/{visit_id}/prescriptions"),
        json!({ "items": [line("Stocked", Some(plain)), line("Zincovit Syrup", None)] }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "a doctor may prescribe outside the catalogue: {rx}"
    );
    let queue = rx["pharmacy_rx_queue_id"].as_str().unwrap_or_default();

    // The pharmacist approves: the stocked line is ordered, the outside one is
    // on the order as bought outside, not an error.
    let (status, body) = send(
        &d,
        "PUT",
        &format!("/api/pharmacy/rx-queue/{queue}/review"),
        json!({ "action": "approved" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let order: Uuid = sqlx::query_scalar(
        "SELECT pharmacy_order_id FROM pharmacy_prescriptions WHERE id = $1::uuid",
    )
    .bind(queue)
    .fetch_one(&d.app.db)
    .await
    .expect("order");
    let outside: bool = sqlx::query_scalar(
        "SELECT buy_outside FROM pharmacy_order_items \
          WHERE order_id = $1 AND drug_name = 'Zincovit Syrup'",
    )
    .bind(order)
    .fetch_one(&d.app.db)
    .await
    .expect("the outside line is on the order");
    assert!(outside, "marked buy outside on the order");

    // A typed line on the order too (as an order raised elsewhere can carry)
    // is skipped, not refused: the catalogue line is dispensed.
    sqlx::query(
        "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, quantity, unit_price, \
                                           total_price) VALUES ($1, $2, 'Outside tonic', 1, 0, 0)",
    )
    .bind(d.tenant)
    .bind(order)
    .execute(&d.app.db)
    .await
    .expect("an order may hold a typed line");
    let (status, body) = d.dispense(order, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let lines: Vec<(Option<Uuid>, i32)> = sqlx::query_as(
        "SELECT catalog_item_id, quantity_dispensed FROM pharmacy_order_items \
          WHERE order_id = $1 ORDER BY drug_name",
    )
    .bind(order)
    .fetch_all(&d.app.db)
    .await
    .expect("lines");
    assert_eq!(lines.len(), 3, "{lines:?}");
    assert!(
        lines.iter().any(|(id, n)| *id == Some(plain) && *n > 0),
        "the stocked medicine went out: {lines:?}"
    );
    assert!(
        lines
            .iter()
            .filter(|(id, _)| id.is_none())
            .all(|(_, n)| *n == 0),
        "nothing left the shelf for the outside ones: {lines:?}"
    );
}
