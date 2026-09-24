//! Lab → billing — the table-only half.
//!
//! Ordering a test writes a charge keyed to the order; cancelling writes one
//! negative line with `reversal_of_id` set and restores the total, and a
//! second cancel is refused and reverses nothing more. Issuing the bill
//! queues one WhatsApp payment link for the amount on the invoice row —
//! the event carries no amount, and a draft's zero total queues nothing.

mod common;

use serde_json::{Value, json};
use uuid::Uuid;

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert!(status.is_success(), "{path} → {status}: {text}");
    serde_json::from_str(&text).expect("json body")
}

async fn cancel(app: &common::TestApp, csrf: &str, order_id: &str) -> u16 {
    app.client
        .put(app.url(&format!("/api/lab/orders/{order_id}/cancel")))
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("cancel")
        .status()
        .as_u16()
}

async fn items(
    app: &common::TestApp,
    order_id: Uuid,
) -> Vec<(Option<Uuid>, rust_decimal::Decimal)> {
    sqlx::query_as(
        "SELECT reversal_of_id, total_price FROM invoice_items \
          WHERE (source = 'lab' AND source_id = $1) \
             OR (reversal_source_module = 'lab' AND reversal_source_id = $1) \
          ORDER BY created_at",
    )
    .bind(order_id)
    .fetch_all(&app.db)
    .await
    .expect("invoice_items")
}

#[tokio::test]
async fn an_order_is_charged_once_reversed_once_and_the_issued_bill_queues_one_payment_link() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let patient = post(
        &app,
        &csrf,
        "/api/patients",
        json!({ "first_name": "Linkage", "last_name": "Billing", "gender": "female", "phone": "9990000077" }),
    )
    .await;
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant");
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("depts");
    let department_id = depts[0]["id"].as_str().expect("department").to_owned();
    let encounter = post(
        &app,
        &csrf,
        "/api/opd/encounters",
        json!({ "patient_id": patient_id, "department_id": department_id, "encounter_type": "opd" }),
    )
    .await;
    let encounter_id = encounter["encounter"]["id"]
        .as_str()
        .or_else(|| encounter["id"].as_str())
        .expect("encounter id")
        .to_owned();
    let tests: Value = app
        .get(&app.client, "/api/lab/catalog")
        .await
        .json()
        .await
        .expect("catalog");
    let test_id = tests[0]["id"].as_str().expect("a lab test").to_owned();

    let order = post(
        &app,
        &csrf,
        "/api/lab/orders",
        json!({ "patient_id": patient_id, "encounter_id": encounter_id, "test_id": test_id }),
    )
    .await;
    let order_id = order["id"].as_str().expect("order id").to_owned();
    let order_uuid: Uuid = order_id.parse().expect("order uuid");

    let charged = items(&app, order_uuid).await;
    assert_eq!(charged.len(), 1, "one charge for the order");
    assert!(charged[0].1 > rust_decimal::Decimal::ZERO);
    let (invoice_id, total_before): (Uuid, rust_decimal::Decimal) = sqlx::query_as(
        "SELECT i.id, i.total_amount FROM invoices i \
           JOIN invoice_items it ON it.invoice_id = i.id \
          WHERE it.source = 'lab' AND it.source_id = $1",
    )
    .bind(order_uuid)
    .fetch_one(&app.db)
    .await
    .expect("invoice");
    assert!(total_before > rust_decimal::Decimal::ZERO);

    // A draft carries its total, but no link goes out for a bill nobody has issued.
    let event = json!({ "invoice_id": invoice_id, "patient_id": patient_id });
    app.dispatch(tenant_id, "billing.invoice.finalized", &event)
        .await;
    assert_eq!(
        app.outbox_rows("whatsapp.payment_link", &invoice_id.to_string())
            .await
            .len(),
        1
    );
    app.dispatch(tenant_id, "billing.invoice.finalized", &event)
        .await;
    let links = app
        .outbox_rows("whatsapp.payment_link", &invoice_id.to_string())
        .await;
    assert_eq!(links.len(), 1, "delivered twice, queued once");
    assert_eq!(links[0]["amount"], json!(total_before.to_string()));

    assert_eq!(cancel(&app, &csrf, &order_id).await, 200);
    let after = items(&app, order_uuid).await;
    assert_eq!(after.len(), 2);
    let reversal = after
        .iter()
        .find(|(of, _)| of.is_some())
        .expect("a reversal line");
    assert_eq!(reversal.1, -charged[0].1);
    let total_after: rust_decimal::Decimal =
        sqlx::query_scalar("SELECT total_amount FROM invoices WHERE id = $1")
            .bind(invoice_id)
            .fetch_one(&app.db)
            .await
            .expect("total");
    assert_eq!(total_after, total_before - charged[0].1);

    // A bill with nothing on it queues no link, even when issued.
    let empty = post(
        &app,
        &csrf,
        "/api/billing/invoices",
        json!({ "patient_id": patient_id, "encounter_id": encounter_id }),
    )
    .await;
    let empty_id = empty["id"].as_str().expect("invoice id").to_owned();
    app.dispatch(
        tenant_id,
        "billing.invoice.finalized",
        &json!({ "invoice_id": empty_id, "patient_id": patient_id }),
    )
    .await;
    assert!(
        app.outbox_rows("whatsapp.payment_link", &empty_id)
            .await
            .is_empty()
    );

    assert_eq!(
        cancel(&app, &csrf, &order_id).await,
        404,
        "already cancelled"
    );
    assert_eq!(items(&app, order_uuid).await.len(), 2, "still one reversal");
}
