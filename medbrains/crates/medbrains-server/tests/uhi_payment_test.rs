//! UHI provider (HSPA): what a consultation costs and how it is paid.
//! A quote carries the doctor's fee, or the charge master's, or says it is
//! paid at the hospital — never ₹0. With Razorpay set up, a teleconsultation
//! with a fee is held until the payment link is paid: the gateway's webhook
//! confirms it, bills it and tells the app; an unpaid hold is let go.

use crate::uhi_world;

use axum::http::StatusCode;
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use medbrains_server::routes::uhi::{
    fees::FEE_AT_HOSPITAL,
    payment_events::{UhiPaymentCapturedHandler, UhiPaymentLinkHandler},
    protocol::CONSULTATION_DOMAIN,
};
use serde_json::{Value, json};
use sha2::Sha256;
use uhi_world::{World, doctor, world};
use uuid::Uuid;

/// Every test sets up UHI for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const WEBHOOK_SECRET: &str = "uhi-test-webhook-secret";

fn txn() -> String {
    Uuid::new_v4().to_string()
}

fn tomorrow() -> chrono::NaiveDate {
    (Utc::now() + Duration::days(1)).date_naive()
}

/// Search tomorrow for `name`, online or at the hospital; the slots offered.
async fn slots(w: &World, id: &str, name: &str, kind: &str) -> Vec<Value> {
    let day = tomorrow();
    let search = w.message(
        CONSULTATION_DOMAIN,
        "search",
        id,
        json!({ "intent": { "fulfillment": { "type": kind, "agent": { "name": name },
            "start": { "time": { "timestamp": format!("{day}T00:00:00") } },
            "end": { "time": { "timestamp": format!("{day}T23:59:59") } } } } }),
    );
    w.call("search", &search).await;
    let on_search = w.deliver(id, "on_search").await;
    on_search.body["message"]["catalog"]["providers"][0]["items"]
        .as_array()
        .expect("items")
        .clone()
}

async fn set_fee(w: &World, doctor: Uuid, fee: Option<i64>) {
    sqlx::query("UPDATE users SET consultation_fee = $2 WHERE id = $1")
        .bind(doctor)
        .bind(fee.map(rust_decimal::Decimal::from))
        .execute(&w.app.db)
        .await
        .expect("fee");
}

/// Given a doctor with their own fee of ₹500, a quote for their slot says
/// 500.00; given a doctor with none and no charge-master rate, the quote
/// says the fee is paid at the hospital and names no price; once the
/// department's OPD-CONSULT rate is set, a visit is quoted at it.
#[tokio::test]
async fn a_quote_carries_the_fee_or_says_it_is_paid_at_the_hospital() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (with_fee, name) = doctor(&w).await;
    set_fee(&w, with_fee, Some(500)).await;
    let id = txn();
    let items = slots(&w, &id, &name, "Online").await;
    assert_eq!(items[0]["price"]["value"], "500.00");
    let select = w.message(
        CONSULTATION_DOMAIN,
        "select",
        &id,
        json!({ "order": { "items": [{ "id": items[0]["id"] }] } }),
    );
    w.call("select", &select).await;
    let quote = w.deliver(&id, "on_select").await.body["message"]["order"]["quote"].clone();
    assert_eq!(quote["price"]["value"], "500.00", "{quote}");

    let (no_fee, other) = doctor(&w).await;
    let id = txn();
    let items = slots(&w, &id, &other, "Physical").await;
    assert!(
        items[0]["price"].get("value").is_none(),
        "never ₹0: {items:?}"
    );
    let select = w.message(
        CONSULTATION_DOMAIN,
        "select",
        &id,
        json!({ "order": { "items": [{ "id": items[0]["id"] }] } }),
    );
    w.call("select", &select).await;
    let quote = w.deliver(&id, "on_select").await.body["message"]["order"]["quote"].clone();
    assert!(quote["price"].get("value").is_none());
    assert_eq!(quote["breakup"][0]["title"], FEE_AT_HOSPITAL);

    let (_, code) = w.department_of(no_fee).await;
    sqlx::query(
        "INSERT INTO charge_master (tenant_id, code, name, category, base_price, tax_percent) \
         VALUES ($1, $2, 'OPD consultation', 'consultation', 400, 0)",
    )
    .bind(w.tenant)
    .bind(format!("OPD-CONSULT-{code}"))
    .execute(&w.app.db)
    .await
    .expect("charge master rate");
    let items = slots(&w, &txn(), &other, "Physical").await;
    assert_eq!(items[0]["price"]["value"], "400.00");
}

fn signed(body: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(WEBHOOK_SECRET.as_bytes()).expect("hmac");
    mac.update(body.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Razorpay's webhook for a paid payment link, as the provider sends it.
async fn pay(w: &World, link_id: &str) -> StatusCode {
    let body = json!({ "event": "payment_link.paid", "payload": {
        "payment_link": { "entity": { "id": link_id, "status": "paid" } },
        "payment": { "entity": { "id": format!("pay_{}", &txn()[..8]), "method": "upi" } } } })
    .to_string();
    let resp = reqwest::Client::new()
        .post(w.app.url("/api/webhooks/razorpay"))
        .header("content-type", "application/json")
        .header("x-razorpay-signature", signed(&body))
        .header("x-razorpay-event-id", txn())
        .body(body)
        .send()
        .await
        .expect("webhook");
    StatusCode::from_u16(resp.status().as_u16()).expect("status")
}

/// A phone no earlier run has used, so the patient — and their bill — is new.
fn fresh_phone() -> String {
    format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000)
}

async fn confirm(w: &World, id: &str, slot: &Value) {
    let order = json!({ "order": { "items": [{ "id": slot }], "fulfillment": { "id": slot },
        "billing": { "name": "Meena Iyer", "phone": fresh_phone() } } });
    w.call(
        "confirm",
        &w.message(CONSULTATION_DOMAIN, "confirm", id, order),
    )
    .await;
}

async fn appointment_status(w: &World, row: Uuid) -> String {
    sqlx::query_scalar(
        "SELECT a.status::text FROM uhi_transactions u JOIN appointments a ON a.id = u.appointment_id \
          WHERE u.id = $1",
    )
    .bind(row)
    .fetch_one(&w.app.db)
    .await
    .expect("appointment")
}

/// Given Razorpay as the online provider and a ₹500 doctor, When the app
/// confirms, Then the slot is held and on_confirm carries a payment link
/// (ON-ORDER, NOT-PAID); When the webhook says the link is paid, Then the
/// appointment is confirmed, the ₹500 is posted to the patient's bill, and
/// on_confirm and on_status say PAID. A second hold left unpaid past its
/// time is let go by the next call, and the app is told.
#[tokio::test]
async fn paying_online_holds_the_booking_until_the_webhook_and_an_unpaid_hold_lapses() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    w.set_setting("payments", "active_provider", json!("razorpay"))
        .await;
    w.set_setting(
        "payments",
        "razorpay_config",
        json!({ "key_id": "rzp_test_uhi", "key_secret": "uhi-key-secret",
                "webhook_secret": WEBHOOK_SECRET }),
    )
    .await;
    let (doctor_id, name) = doctor(&w).await;
    set_fee(&w, doctor_id, Some(500)).await;
    let id = txn();
    let items = slots(&w, &id, &name, "Online").await;
    let init = w.message(
        CONSULTATION_DOMAIN,
        "init",
        &id,
        json!({ "order": { "items": [{ "id": items[0]["id"] }] } }),
    );
    w.call("init", &init).await;
    let payment = w.deliver(&id, "on_init").await.body["message"]["order"]["payment"].clone();
    assert_eq!(payment["type"], "ON-ORDER", "{payment}");
    assert_eq!(payment["params"]["amount"], "500.00");

    confirm(&w, &id, &items[0]["id"]).await;
    let row = w.row(&id).await;
    assert_eq!(
        appointment_status(&w, row).await,
        "scheduled",
        "held, not confirmed"
    );
    w.run(&UhiPaymentLinkHandler, row).await;
    let on_confirm = w.deliver(&id, "on_confirm").await;
    let order = &on_confirm.body["message"]["order"];
    assert_eq!(order["state"], "PENDING", "{order}");
    assert_eq!(order["payment"]["status"], "NOT-PAID");
    assert!(
        order["payment"]["uri"]
            .as_str()
            .is_some_and(|u| u.starts_with("https://rzp.test/i/")),
        "{order}"
    );
    let (link_id, paying): (String, Uuid) = sqlx::query_as(
        "SELECT p.gateway_order_id, p.id FROM uhi_transactions u \
           JOIN payment_gateway_transactions p ON p.id = u.payment_transaction_id WHERE u.id = $1",
    )
    .bind(row)
    .fetch_one(&w.app.db)
    .await
    .expect("payment row");

    assert_eq!(pay(&w, &link_id).await, StatusCode::OK);
    w.run(&UhiPaymentCapturedHandler, paying).await;
    let on_confirm = w.deliver(&id, "on_confirm").await;
    assert_eq!(on_confirm.body["message"]["order"]["state"], "CONFIRMED");
    assert_eq!(
        on_confirm.body["message"]["order"]["payment"]["status"],
        "PAID"
    );
    let on_status = w.deliver(&id, "on_status").await;
    assert_eq!(
        on_status.body["message"]["order"]["payment"]["status"],
        "PAID"
    );
    assert_eq!(appointment_status(&w, row).await, "confirmed");
    let (paid, invoice_status): (rust_decimal::Decimal, String) = sqlx::query_as(
        "SELECT p.amount, i.status::text FROM uhi_transactions u \
           JOIN invoices i ON i.id = u.invoice_id \
           JOIN payments p ON p.invoice_id = i.id WHERE u.id = $1",
    )
    .bind(row)
    .fetch_one(&w.app.db)
    .await
    .expect("the payment is on the patient's bill");
    assert_eq!(paid, rust_decimal::Decimal::from(500));
    assert_eq!(invoice_status, "paid");

    let lapsing = txn();
    let more = slots(&w, &lapsing, &name, "Online").await;
    confirm(&w, &lapsing, &more[0]["id"]).await;
    let held = w.row(&lapsing).await;
    sqlx::query(
        "UPDATE uhi_transactions SET hold_expires_at = now() - interval '1 minute' WHERE id = $1",
    )
    .bind(held)
    .execute(&w.app.db)
    .await
    .expect("time passes");
    w.call(
        "status",
        &w.message(CONSULTATION_DOMAIN, "status", &lapsing, json!({})),
    )
    .await;
    let told = w.deliver(&lapsing, "on_status").await;
    assert_eq!(told.body["message"]["order"]["state"], "CANCELLED");
    assert_eq!(
        appointment_status(&w, held).await,
        "cancelled",
        "the slot is free again"
    );
    let state: String = sqlx::query_scalar("SELECT state FROM uhi_transactions WHERE id = $1")
        .bind(held)
        .fetch_one(&w.app.db)
        .await
        .expect("state");
    assert_eq!(state, "expired");

    w.clear_setting("payments", "razorpay_config").await;
    w.clear_setting("payments", "active_provider").await;
}
