//! Storefront part 2, money and gates (#4864): a refund goes back the way
//! the patient paid — the online payment, or cash against the bill — and is
//! owed once and issued once however often it is asked for; a patient
//! cancels free before dispatch. And every new screen's endpoint refuses a
//! user without its permission.

use crate::common;
use crate::delivery_choice_world;
use crate::storefront_p2_world;
use crate::storefront_world;

use delivery_choice_world::{new_patient, patient_token, setup, staff};
use reqwest::StatusCode;
use serde_json::json;
use storefront_p2_world::{Item, dispensed, id_of, item, stock, stores_off};
use storefront_world::{PNG, SERIAL, add, call, checkout, open_store};
use uuid::Uuid;

fn otc(name: &str) -> Item<'_> {
    Item {
        name,
        schedule: None,
        inn: "loratadine",
        cold: false,
        floor: 0,
    }
}

#[tokio::test]
async fn a_cancelled_online_payment_is_owed_back_to_that_payment_once() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let drug = item(
        &app,
        &setup,
        &Item {
            schedule: Some("H"),
            ..otc("Paidonlinamol")
        },
    )
    .await;
    stock(&app, &setup, drug, None, 50, 400).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    add(&app, &token, drug, 2).await;
    call(
        &app,
        Some(&token),
        "PUT",
        "/api/portal/store/cart/prescription",
        Some(json!({ "data_base64": PNG })),
    )
    .await;
    let (status, order) = checkout(&app, &token, json!({ "prescription_source": "upload" })).await;
    assert_eq!(status, StatusCode::OK, "{order}");
    let order = id_of(&order);
    let txn: Uuid = sqlx::query_scalar(
        "WITH t AS (INSERT INTO payment_gateway_transactions \
                      (tenant_id, gateway, gateway_order_id, amount, currency, status, \
                       gateway_payment_id, idempotency_key) \
                    VALUES ($1, 'razorpay', 'order_t', 20, 'INR', 'captured', 'pay_t', $2) \
                    RETURNING id) \
         UPDATE pharmacy_store_orders SET payment_txn_id = (SELECT id FROM t) \
          WHERE id = $3::uuid RETURNING payment_txn_id",
    )
    .bind(setup.tenant)
    .bind(format!("test:{}", Uuid::new_v4()))
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("paid online");

    let path = format!("/api/portal/store/orders/{order}/cancel");
    let (status, cancelled) = call(&app, Some(&token), "POST", &path, None).await;
    assert_eq!(status, StatusCode::OK, "{cancelled}");
    assert_eq!(cancelled["status"], json!("cancelled"));
    let (status, _) = call(&app, Some(&token), "POST", &path, None).await;
    assert_eq!(status, StatusCode::CONFLICT, "cancelled already");
    let refunds: Vec<(String, Option<Uuid>, String)> = sqlx::query_as(
        "SELECT method, payment_txn_id, amount::text FROM pharmacy_store_refunds \
          WHERE store_order_id = $1::uuid",
    )
    .bind(&order)
    .fetch_all(&app.db)
    .await
    .expect("refunds");
    assert_eq!(refunds.len(), 1, "owed once: {refunds:?}");
    assert_eq!(refunds[0].0, "online");
    assert_eq!(refunds[0].1, Some(txn), "back to the payment it came from");
    let held: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_stock_holds \
          WHERE store_order_id = $1::uuid AND released_at IS NULL",
    )
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("holds");
    assert_eq!(held, 0, "the hold let go");
}

#[tokio::test]
async fn a_cash_refund_for_a_return_is_issued_once() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    open_store(&app, &setup).await;
    stores_off(&app, &setup).await;
    let drug = item(&app, &setup, &otc("Cashbackamol")).await;
    let batch = stock(&app, &setup, drug, None, 50, 400).await;
    let (_, phone) = new_patient(&app, &setup).await;
    let token = patient_token(&app, &setup, &phone).await;
    add(&app, &token, drug, 2).await;
    let (status, order) = checkout(&app, &token, json!({ "prescription_source": "none" })).await;
    assert_eq!(status, StatusCode::OK, "{order}");
    let order = id_of(&order);
    // Paid in cash at the pharmacy when collected.
    let invoice: Uuid = sqlx::query_scalar(
        "UPDATE invoices SET paid_amount = total_amount, status = 'paid' \
          WHERE id = (SELECT ii.invoice_id FROM invoice_items ii JOIN pharmacy_store_orders s \
                        ON s.pharmacy_order_id = ii.pharmacy_order_id WHERE s.id = $1::uuid LIMIT 1) \
         RETURNING id",
    )
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("an online order carries its tax invoice");
    dispensed(&app, &order, batch).await;
    let path = format!("/api/portal/store/orders/{order}/returns");
    let body = json!({ "lines": [{ "catalog_item_id": drug, "quantity": 1 }], "reason": "excess" });
    let (status, ticket) = call(&app, Some(&token), "POST", &path, Some(body)).await;
    assert_eq!(status, StatusCode::OK, "{ticket}");
    let ticket_id = ticket["id"].as_str().unwrap_or_default().to_owned();
    let line: Uuid =
        sqlx::query_scalar("SELECT id FROM pharmacy_store_return_lines WHERE return_id = $1::uuid")
            .bind(&ticket_id)
            .fetch_one(&app.db)
            .await
            .expect("line");
    let receive = format!("/api/pharmacy/storefront/returns/{ticket_id}/receive");
    let body = json!({ "lines": [{ "line_id": line, "sealed": true }] });
    let (status, received) = staff(&app, &setup, "POST", &receive, body.clone()).await;
    assert_eq!(status, StatusCode::OK, "{received}");
    let (status, _) = staff(&app, &setup, "POST", &receive, body).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "received once");
    let refund = received["refund_id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    assert!(!refund.is_empty(), "{received}");

    let issue = format!("/api/pharmacy/storefront/refunds/{refund}/issue");
    let (status, first) = staff(&app, &setup, "POST", &issue, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(
        (first["status"].as_str(), first["method"].as_str()),
        (Some("issued"), Some("cash"))
    );
    let (status, second) = staff(&app, &setup, "POST", &issue, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{second}");
    assert_eq!(first["refund_reference"], second["refund_reference"]);
    let posted: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM refunds WHERE invoice_id = $1 AND reference_number = $2",
    )
    .bind(invoice)
    .bind(first["refund_reference"].as_str().unwrap_or_default())
    .fetch_one(&app.db)
    .await
    .expect("billing refunds");
    assert_eq!(posted, 1, "one refund on the bill, however often issued");
}

#[tokio::test]
async fn every_new_endpoint_refuses_a_user_without_its_permission() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let setup = setup(&app).await;
    let pharmacist = common::provision_staff(
        &app,
        &setup.csrf,
        "pharmacist",
        &[
            "pharmacy.storefront.substitute",
            "pharmacy.storefront.returns",
            "pharmacy.storefront.manage",
            "pharmacy.quarantine.manage",
            "pharmacy.nppa.manage",
        ],
    )
    .await;
    let id = Uuid::new_v4();
    let gets = [
        "/api/pharmacy/storefront/returns".to_owned(),
        "/api/pharmacy/storefront/refunds".to_owned(),
        "/api/pharmacy/storefront/stores".to_owned(),
        "/api/pharmacy/storefront/rules".to_owned(),
        "/api/pharmacy/storefront/floors".to_owned(),
        "/api/pharmacy/quarantine".to_owned(),
        "/api/pharmacy/nppa-ceilings".to_owned(),
        format!("/api/pharmacy/storefront/orders/{id}/lines/{id}/substitutes"),
    ];
    for path in &gets {
        let resp = pharmacist
            .client
            .get(app.url(path))
            .send()
            .await
            .expect("get");
        assert_eq!(resp.status(), StatusCode::FORBIDDEN, "{path}");
    }
    // Bodies of the right shape, so the refusal is the permission's.
    let posts = [
        (
            format!("/api/pharmacy/storefront/orders/{id}/substitutions"),
            json!({ "catalog_item_id": id, "substitute_item_id": id, "reason": "x",
                    "method": "sign_off" }),
        ),
        (
            format!("/api/pharmacy/storefront/returns/{id}/receive"),
            json!({ "lines": [] }),
        ),
        (
            format!("/api/pharmacy/storefront/refunds/{id}/issue"),
            json!({}),
        ),
        (
            "/api/pharmacy/quarantine/destroy".to_owned(),
            json!({ "ids": [id], "witness_name": "x" }),
        ),
        (
            "/api/pharmacy/nppa-ceilings/import".to_owned(),
            json!({ "rows": [] }),
        ),
    ];
    for (path, body) in &posts {
        let resp = pharmacist
            .client
            .post(app.url(path))
            .header("x-csrf-token", &pharmacist.csrf)
            .json(body)
            .send()
            .await
            .expect("post");
        assert_eq!(resp.status(), StatusCode::FORBIDDEN, "{path}");
    }
    let doctor = common::provision_staff(
        &app,
        &setup.csrf,
        "doctor",
        &["doctor.store_substitutions.decide"],
    )
    .await;
    let resp = doctor
        .client
        .post(app.url(&format!("/api/doctor/store-substitutions/{id}/decide")))
        .header("x-csrf-token", &doctor.csrf)
        .json(&json!({ "approve": true }))
        .send()
        .await
        .expect("decide");
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}
