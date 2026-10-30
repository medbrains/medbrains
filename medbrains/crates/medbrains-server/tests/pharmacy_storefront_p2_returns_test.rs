//! Storefront part 2, returns by law (#4864, owner decision 5;
//! `docs/compliance/pharmacy-returns.md`): a sealed, in-date pack goes back
//! on its batch; an opened, cold-chain or expired one is quarantined and
//! destroyed on record — biomedical waste through a CBMWTF, a controlled
//! drug before a witness in the NDPS register; a counter return from an
//! expired batch is never re-stocked; a refund is owed once and issued once.

use crate::common;
use crate::delivery_choice_world;
use crate::storefront_p2_world;
use crate::storefront_world;

use delivery_choice_world::{new_patient, patient_token, setup, staff};
use reqwest::StatusCode;
use serde_json::{Value, json};
use storefront_p2_world::{Item, batch_on_hand, dispensed, id_of, item, stock, stores_off};
use storefront_world::{SERIAL, add, call, checkout, open_store};
use uuid::Uuid;

fn otc(name: &str, cold: bool) -> Item<'_> {
    Item {
        name,
        schedule: None,
        inn: "cetirizine",
        cold,
        floor: 0,
    }
}

/// An over-the-counter pickup order of `items` (item, batch, qty), released
/// and dispensed. Returns (patient token, store order).
async fn delivered(
    app: &common::TestApp,
    setup: &delivery_choice_world::Setup,
    items: &[(Uuid, Uuid, i32)],
) -> (String, String) {
    let (_, phone) = new_patient(app, setup).await;
    let token = patient_token(app, setup, &phone).await;
    for (item, _, qty) in items {
        add(app, &token, *item, *qty).await;
    }
    let (status, order) = checkout(app, &token, json!({ "prescription_source": "none" })).await;
    assert_eq!(status, StatusCode::OK, "{order}");
    assert_eq!(order["status"], json!("released"), "{order}");
    for (_, batch, _) in items {
        dispensed(app, &id_of(&order), *batch).await;
    }
    (token, id_of(&order))
}

async fn ask_return(app: &common::TestApp, token: &str, order: &str, lines: Value) -> Value {
    let path = format!("/api/portal/store/orders/{order}/returns");
    let body = json!({ "lines": lines, "reason": "damaged", "note": "Crushed box" });
    let (status, ticket) = call(app, Some(token), "POST", &path, Some(body)).await;
    assert_eq!(status, StatusCode::OK, "{ticket}");
    assert!(
        ticket["complaint_code"]
            .as_str()
            .is_some_and(|c| c.starts_with("GRV-"))
    );
    ticket
}

async fn receive(
    app: &common::TestApp,
    setup: &delivery_choice_world::Setup,
    ticket: &Value,
    sealed: &[bool],
) -> (StatusCode, Value) {
    let id = ticket["id"].as_str().unwrap_or_default();
    let lines: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM pharmacy_store_return_lines WHERE return_id = $1::uuid ORDER BY created_at, drug_name",
    )
    .bind(id)
    .fetch_all(&app.db)
    .await
    .expect("lines");
    let body: Vec<Value> = lines
        .iter()
        .zip(sealed)
        .map(|((line,), s)| json!({ "line_id": line, "sealed": s }))
        .collect();
    let path = format!("/api/pharmacy/storefront/returns/{id}/receive");
    staff(app, setup, "POST", &path, json!({ "lines": body })).await
}

#[tokio::test]
async fn a_sealed_in_date_pack_goes_back_on_its_batch() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let drug = item(&app, &setup, &otc("Sealamol", false)).await;
    let batch = stock(&app, &setup, drug, None, 100, 400).await;
    let (token, order) = delivered(&app, &setup, &[(drug, batch, 3)]).await;
    assert_eq!(batch_on_hand(&app, batch).await, 97);

    let ticket = ask_return(
        &app,
        &token,
        &order,
        json!([{ "catalog_item_id": drug, "quantity": 2 }]),
    )
    .await;
    let (status, received) = receive(&app, &setup, &ticket, &[true]).await;
    assert_eq!(status, StatusCode::OK, "{received}");
    assert_eq!(batch_on_hand(&app, batch).await, 99, "back on its batch");
    let number = received["credit_note_number"].as_str().unwrap_or_default();
    assert!(
        number.len() <= 16 && number.contains('C'),
        "GST credit note: {number}"
    );
    let (disposition, complaint): (String, String) = sqlx::query_as(
        "SELECT l.disposition, c.status::text FROM pharmacy_store_return_lines l \
           JOIN pharmacy_store_returns r ON r.id = l.return_id \
           JOIN comm_complaints c ON c.id = r.complaint_id WHERE r.id = $1::uuid",
    )
    .bind(ticket["id"].as_str().unwrap_or_default())
    .fetch_one(&app.db)
    .await
    .expect("recorded");
    assert_eq!(
        (disposition.as_str(), complaint.as_str()),
        ("restocked", "resolved")
    );
}

#[tokio::test]
async fn opened_cold_chain_and_expired_packs_are_quarantined_then_destroyed_on_record() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let opened = item(&app, &setup, &otc("Aopenamol", false)).await;
    let opened_batch = stock(&app, &setup, opened, None, 50, 400).await;
    let cold = item(&app, &setup, &otc("Bcoldamol", true)).await;
    let cold_batch = stock(&app, &setup, cold, None, 50, 400).await;
    let expiring = item(&app, &setup, &otc("Cexpiramol", false)).await;
    let expiring_batch = stock(&app, &setup, expiring, None, 50, 400).await;
    let lines = [
        (opened, opened_batch, 1),
        (cold, cold_batch, 1),
        (expiring, expiring_batch, 1),
    ];
    let (token, order) = delivered(&app, &setup, &lines).await;
    sqlx::query("UPDATE pharmacy_batches SET expiry_date = CURRENT_DATE - 1 WHERE id = $1")
        .bind(expiring_batch)
        .execute(&app.db)
        .await
        .expect("expired");

    let wanted = json!([{ "catalog_item_id": opened, "quantity": 1 },
                        { "catalog_item_id": cold, "quantity": 1 },
                        { "catalog_item_id": expiring, "quantity": 1 }]);
    let ticket = ask_return(&app, &token, &order, wanted).await;
    let (status, received) = receive(&app, &setup, &ticket, &[false, true, true]).await;
    assert_eq!(status, StatusCode::OK, "{received}");
    for batch in [opened_batch, cold_batch, expiring_batch] {
        assert_eq!(
            batch_on_hand(&app, batch).await,
            49,
            "never back on the shelf"
        );
    }
    let held: Vec<(Uuid, Vec<String>, String)> = sqlx::query_as(
        "SELECT q.id, q.reasons, q.route FROM pharmacy_return_quarantine q \
           JOIN pharmacy_store_return_lines l ON l.id = q.store_return_line_id \
          WHERE l.return_id = $1::uuid ORDER BY q.drug_name",
    )
    .bind(ticket["id"].as_str().unwrap_or_default())
    .fetch_all(&app.db)
    .await
    .expect("quarantine");
    let reasons: Vec<&str> = held.iter().map(|h| h.1[0].as_str()).collect();
    assert_eq!(reasons, ["opened", "cold_chain", "expired"]);
    assert!(held.iter().all(|h| h.2 == "bmw"));

    let ids: Vec<Uuid> = held.iter().map(|h| h.0).collect();
    let destroy = |extra: Value| {
        let mut body = json!({ "ids": ids, "witness_name": "S. Witness" });
        if let (Some(b), Some(e)) = (body.as_object_mut(), extra.as_object()) {
            b.extend(e.clone());
        }
        body
    };
    let (status, _) = staff(
        &app,
        &setup,
        "POST",
        "/api/pharmacy/quarantine/destroy",
        destroy(json!({})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "BMW needs the CBMWTF and its manifest"
    );
    let with_facility =
        json!({ "cbmwtf_name": "Karaikudi CBMWTF", "cbmwtf_manifest_number": "MF-0042" });
    let (status, certificate) = staff(
        &app,
        &setup,
        "POST",
        "/api/pharmacy/quarantine/destroy",
        destroy(with_facility),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{certificate}");
    let (category, colour, destroyed): (Option<String>, Option<String>, i64) = sqlx::query_as(
        "SELECT d.bmw_category, d.bmw_bag_colour, \
                (SELECT COUNT(*) FROM pharmacy_return_quarantine q \
                  WHERE q.destruction_id = d.id AND q.status = 'destroyed') \
           FROM pharmacy_destruction_log d WHERE d.certificate_number = $1",
    )
    .bind(
        certificate["certificate_number"]
            .as_str()
            .unwrap_or_default(),
    )
    .fetch_one(&app.db)
    .await
    .expect("destruction register");
    assert!(category.is_some_and(|c| c.starts_with("Yellow (d)")));
    assert_eq!((colour.as_deref(), destroyed), (Some("yellow"), 3));

    // A controlled drug's destruction needs a second person, in the NDPS register.
    sqlx::query("UPDATE pharmacy_catalog SET is_controlled = true WHERE id = $1")
        .bind(opened)
        .execute(&app.db)
        .await
        .expect("controlled");
    let controlled: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_return_quarantine (tenant_id, source, store_return_line_id, \
             catalog_item_id, drug_name, quantity, reasons, route) \
         SELECT tenant_id, 'online', store_return_line_id, catalog_item_id, drug_name, 1, \
                '{controlled}', 'ndps' FROM pharmacy_return_quarantine WHERE id = $1 RETURNING id",
    )
    .bind(ids[0])
    .fetch_one(&app.db)
    .await
    .expect("controlled pack");
    let body = json!({ "ids": [controlled], "witness_name": "S. Witness" });
    let (status, _) = staff(
        &app,
        &setup,
        "POST",
        "/api/pharmacy/quarantine/destroy",
        body,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "no witness, no destruction"
    );
    let witness = common::provision_staff(&app, &setup.csrf, "pharmacist", &[]).await;
    let body = json!({ "ids": [controlled], "witness_name": "Test pharmacist",
                       "witness_user_id": witness.user_id });
    let (status, done) = staff(
        &app,
        &setup,
        "POST",
        "/api/pharmacy/quarantine/destroy",
        body,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    let witnessed: Option<Uuid> = sqlx::query_scalar(
        "SELECT witnessed_by FROM pharmacy_ndps_register WHERE catalog_item_id = $1 \
            AND action = 'destroyed' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(opened)
    .fetch_one(&app.db)
    .await
    .expect("NDPS register");
    assert_eq!(witnessed, Some(witness.user_id));
}

#[tokio::test]
async fn a_counter_return_from_an_expired_batch_is_never_restocked() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let drug = item(&app, &setup, &otc("Counteramol", false)).await;
    let batch = stock(&app, &setup, drug, None, 10, 400).await;
    let line: Uuid = sqlx::query_scalar(
        "WITH s AS (INSERT INTO pharmacy_pos_sales (tenant_id, sale_number, subtotal, total_amount, \
                        payment_mode, sold_by) \
                    SELECT $1, $2, 10, 10, 'upi', id FROM users WHERE username = 'admin' \
                    RETURNING id) \
         INSERT INTO pharmacy_pos_sale_items (tenant_id, pos_sale_id, catalog_item_id, drug_name, \
              batch_id, batch_number, quantity, mrp, selling_price, line_total) \
         SELECT $1, s.id, $3, 'Counteramol', $4, 'B', 1, 10, 10, 10 FROM s RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!("PH-SALE-T{}", &Uuid::new_v4().simple().to_string()[..6]))
    .bind(drug)
    .bind(batch)
    .fetch_one(&app.db)
    .await
    .expect("a counter sale");
    let sale: Uuid =
        sqlx::query_scalar("SELECT pos_sale_id FROM pharmacy_pos_sale_items WHERE id = $1")
            .bind(line)
            .fetch_one(&app.db)
            .await
            .expect("sale");
    sqlx::query("UPDATE pharmacy_batches SET expiry_date = CURRENT_DATE - 1 WHERE id = $1")
        .bind(batch)
        .execute(&app.db)
        .await
        .expect("the batch expires");

    let body = json!({ "items": [{ "item_id": line, "return_qty": 1, "sealed": true }],
                       "reason": "Customer brought it back",
                       "refund_to": [{ "mode": "upi", "amount": "10.00", "reference": "UPI-RF-1" }] });
    let (status, result) = staff(
        &app,
        &setup,
        "PUT",
        &format!("/api/pharmacy/pos/sales/{sale}/return-items"),
        body,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(
        result["lines"][0]["destination"],
        json!("quarantine"),
        "{result}"
    );
    assert_eq!(
        batch_on_hand(&app, batch).await,
        10,
        "an expired batch never takes stock back"
    );
    let reasons: Vec<String> = sqlx::query_scalar(
        "SELECT reasons FROM pharmacy_return_quarantine WHERE pos_sale_item_id = $1",
    )
    .bind(line)
    .fetch_one(&app.db)
    .await
    .expect("quarantined");
    assert!(reasons.contains(&"expired".to_owned()), "{reasons:?}");
}
