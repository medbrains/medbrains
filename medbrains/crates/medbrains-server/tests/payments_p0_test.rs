//! Payments P0 (#4870): online checkout works and money posts exactly once.
//!
//! Against a stand-in Razorpay (`payments_world`): the order is made in the
//! request, verify and the webhook settle through one path whichever comes
//! first, the captured amount and real method post through billing's own
//! balance check, money that cannot honestly post goes to finance, refunds
//! come off the bill once, and a forged signature is refused.

use crate::payments_world;

use std::sync::atomic::Ordering;

use axum::http::StatusCode;
use payments_world::{World, captured, world};
use rust_decimal::Decimal;
use serde_json::json;
use tokio::sync::Mutex;

/// The tests share the tenant's Razorpay settings.
static SERIAL: Mutex<()> = Mutex::const_new(());

fn rupees(n: i64) -> Decimal {
    Decimal::from(n)
}

async fn status_of(w: &World, txn: uuid::Uuid) -> serde_json::Value {
    let (status, body) = w
        .call("GET", &format!("/api/payments/{txn}/status"), json!(null))
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["transaction"].clone()
}

/// Given an issued ₹1,000 bill, When the cashier starts an online payment,
/// Then Razorpay is asked for a ₹1,000 order named after our row, and the
/// row reads `created` with that order's id — checkout can open at once.
#[tokio::test]
async fn the_order_is_made_in_the_request_and_reads_created() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let invoice = w.bill(1000).await;
    let (txn, order) = w.order(invoice, 1000).await;
    assert!(order.starts_with("order_"), "{order}");
    let row = status_of(&w, txn).await;
    assert_eq!(row["status"], "created");
    assert_eq!(row["gateway_order_id"], order.as_str());
    let asked = w
        .razorpay
        .orders
        .lock()
        .expect("orders")
        .last()
        .cloned()
        .expect("an order");
    assert_eq!(asked["amount"], 100_000);
    assert_eq!(asked["receipt"], txn.to_string());
}

/// Given Razorpay refuses the order (bad keys), When the cashier starts an
/// online payment, Then they get a 503 naming Razorpay's reason, the row is
/// `failed`, and nothing is posted.
#[tokio::test]
async fn a_refused_order_says_why_and_posts_nothing() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let invoice = w.bill(400).await;
    w.razorpay.refuse_orders.store(true, Ordering::SeqCst);
    let (status, body) = w
        .call(
            "POST",
            "/api/payments/create-order",
            json!({ "invoice_id": invoice, "amount": 400 }),
        )
        .await;
    w.razorpay.refuse_orders.store(false, Ordering::SeqCst);
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert!(
        body.to_string().contains("The api key provided is invalid"),
        "{body}"
    );
    let failed: String =
        sqlx::query_scalar("SELECT status FROM payment_gateway_transactions WHERE invoice_id = $1")
            .bind(invoice)
            .fetch_one(&w.app.db)
            .await
            .expect("row");
    assert_eq!(failed, "failed");
    assert!(w.payments(invoice).await.is_empty());
}

/// Given a captured ₹1,000 card payment, When verify arrives and then the
/// webhook, Then exactly one ₹1,000 card payment is on the bill, filed under
/// Razorpay's payment id, and the bill is paid.
#[tokio::test]
async fn verify_then_webhook_posts_once_as_card() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let invoice = w.bill(1000).await;
    let (_, order) = w.order(invoice, 1000).await;
    let pay = w.paid(&order, 100_000, "card");
    let (status, txn) = w.verify(&order, &pay).await;
    assert_eq!(status, StatusCode::OK, "{txn}");
    assert_eq!(txn["status"], "captured");
    assert_eq!(
        w.webhook(&captured(&order, &pay, 100_000, "card")).await,
        StatusCode::OK
    );
    assert_eq!(
        w.payments(invoice).await,
        vec![(rupees(1000), "card".to_owned(), Some(pay))]
    );
    assert_eq!(w.invoice(invoice).await, (rupees(1000), "paid".to_owned()));
}

/// Given the webhook beats the browser, When verify arrives second, Then it
/// answers captured and posts nothing more: one payment, posted as UPI.
#[tokio::test]
async fn webhook_then_verify_posts_once() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let invoice = w.bill(750).await;
    let (_, order) = w.order(invoice, 750).await;
    let pay = w.paid(&order, 75_000, "upi");
    assert_eq!(
        w.webhook(&captured(&order, &pay, 75_000, "upi")).await,
        StatusCode::OK
    );
    let (status, txn) = w.verify(&order, &pay).await;
    assert_eq!(status, StatusCode::OK, "{txn}");
    assert_eq!(txn["status"], "captured");
    // order.paid for the same payment is a third notice of the same money.
    let order_paid = json!({ "event": "order.paid", "payload": {
        "order": { "entity": { "id": order, "amount_paid": 75_000 } },
        "payment": { "entity": { "id": pay, "order_id": order, "amount": 75_000, "method": "upi" } } } });
    assert_eq!(w.webhook(&order_paid).await, StatusCode::OK);
    assert_eq!(
        w.payments(invoice).await,
        vec![(rupees(750), "upi".to_owned(), Some(pay))]
    );
    assert_eq!(w.invoice(invoice).await, (rupees(750), "paid".to_owned()));
}

/// Given `order.paid` is the only notice (no browser, no payment.captured),
/// Then it settles and posts the payment.
#[tokio::test]
async fn order_paid_alone_settles_the_bill() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    // Its own id each run: a reused database remembers every payment it has posted.
    let orderpaidonly_id = format!(
        "pay_orderpaidonly{}",
        &uuid::Uuid::new_v4().simple().to_string()[..8]
    );
    let invoice = w.bill(300).await;
    let (_, order) = w.order(invoice, 300).await;
    let body = json!({ "event": "order.paid", "payload": {
        "order": { "entity": { "id": order } },
        "payment": { "entity": { "id": orderpaidonly_id.as_str(), "order_id": order,
                                 "amount": 30_000, "method": "netbanking" } } } });
    assert_eq!(w.webhook(&body).await, StatusCode::OK);
    assert_eq!(
        w.payments(invoice).await,
        vec![(
            rupees(300),
            "bank_transfer".to_owned(),
            Some(orderpaidonly_id.as_str().to_owned())
        )]
    );
}

/// Given an order for ₹1,000, When Razorpay reports ₹1,200 captured, Then
/// nothing is posted and finance gets an `amount_mismatch` for ₹1,200.
/// Given the cashier took ₹500 cash after the order was made, When the full
/// ₹1,000 is captured, Then it is not posted past the bill's total: finance
/// gets an `over_capture`.
#[tokio::test]
async fn money_that_cannot_post_goes_to_finance() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    // Its own id each run: a reused database remembers every payment it has posted.
    let pastbalance_id = format!(
        "pay_pastbalance{}",
        &uuid::Uuid::new_v4().simple().to_string()[..8]
    );
    // Its own id each run: a reused database remembers every payment it has posted.
    let overcapture_id = format!(
        "pay_overcapture{}",
        &uuid::Uuid::new_v4().simple().to_string()[..8]
    );
    let invoice = w.bill(1000).await;
    let (_, order) = w.order(invoice, 1000).await;
    let body = captured(&order, overcapture_id.as_str(), 120_000, "card");
    assert_eq!(w.webhook(&body).await, StatusCode::OK);
    assert!(w.payments(invoice).await.is_empty());
    assert_eq!(
        w.exceptions(&order).await,
        vec![("amount_mismatch".to_owned(), Some(rupees(1200)))]
    );
    assert_eq!(w.invoice(invoice).await, (rupees(0), "issued".to_owned()));
    // The row says so, for the cashier's screen.
    let held: Option<bool> = sqlx::query_scalar(
        "SELECT (notes->>'held_for_finance')::bool FROM payment_gateway_transactions \
          WHERE gateway_order_id = $1",
    )
    .bind(&order)
    .fetch_one(&w.app.db)
    .await
    .expect("row");
    assert_eq!(held, Some(true));

    let second = w.bill(1000).await;
    let (_, order) = w.order(second, 1000).await;
    let (status, cash) = w
        .call(
            "POST",
            &format!("/api/billing/invoices/{second}/payments"),
            json!({ "amount": 500, "mode": "cash" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{cash}");
    assert_eq!(
        w.webhook(&captured(&order, pastbalance_id.as_str(), 100_000, "card"))
            .await,
        StatusCode::OK
    );
    assert_eq!(
        w.exceptions(&order).await,
        vec![("over_capture".to_owned(), Some(rupees(1000)))]
    );
    assert_eq!(
        w.invoice(second).await,
        (rupees(500), "partially_paid".to_owned())
    );
}

/// Given a ₹1,000 card payment posted, When the cashier refunds ₹300 of it,
/// Then Razorpay is asked for 30,000 paise, the bill's paid amount falls to
/// ₹700 and it is partially paid again; Razorpay's `refund.created` for the
/// same refund changes nothing.
#[tokio::test]
async fn a_partial_refund_comes_off_the_bill_once() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let invoice = w.bill(1000).await;
    let (_, order) = w.order(invoice, 1000).await;
    let pay = w.paid(&order, 100_000, "card");
    let (status, _) = w.verify(&order, &pay).await;
    assert_eq!(status, StatusCode::OK);
    let payment_id: uuid::Uuid =
        sqlx::query_scalar("SELECT id FROM payments WHERE invoice_id = $1")
            .bind(invoice)
            .fetch_one(&w.app.db)
            .await
            .expect("payment");
    let (status, refund) = w
        .call(
            "POST",
            "/api/payments/refund",
            json!({ "payment_id": payment_id, "amount": 300, "reason": "Test not done" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{refund}");
    let refund_id = refund["refund_id"].as_str().expect("refund id").to_owned();
    let asked = w
        .razorpay
        .refunds
        .lock()
        .expect("refunds")
        .last()
        .cloned()
        .expect("asked");
    assert_eq!(asked.0, pay);
    assert_eq!(asked.1["amount"], 30_000);
    assert_eq!(
        w.invoice(invoice).await,
        (rupees(700), "partially_paid".to_owned())
    );

    let notice = json!({ "event": "refund.created", "payload": {
        "refund": { "entity": { "id": refund_id, "amount": 30_000, "payment_id": pay } },
        "payment": { "entity": { "id": pay, "order_id": order } } } });
    assert_eq!(w.webhook(&notice).await, StatusCode::OK);
    assert_eq!(
        w.invoice(invoice).await,
        (rupees(700), "partially_paid".to_owned())
    );
    let refunds: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM refunds WHERE invoice_id = $1 AND deleted_at IS NULL",
    )
    .bind(invoice)
    .fetch_one(&w.app.db)
    .await
    .expect("refunds");
    assert_eq!(refunds, 1);

    // More than is left on the payment is refused before Razorpay is asked.
    let (status, _) = w
        .call(
            "POST",
            "/api/payments/refund",
            json!({ "payment_id": payment_id, "amount": 800, "reason": "Too much" }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(w.razorpay.refunds.lock().expect("refunds").len(), 1);
}

/// Given a webhook signed with the wrong secret, or a verify call with a
/// forged signature, Then both are refused and nothing is posted.
#[tokio::test]
async fn a_bad_signature_is_refused() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let invoice = w.bill(500).await;
    let (_, order) = w.order(invoice, 500).await;
    let pay = w.paid(&order, 50_000, "card");
    let forged = w
        .webhook_signed(&captured(&order, &pay, 50_000, "card"), "not-the-secret")
        .await;
    assert_eq!(forged, StatusCode::BAD_REQUEST);
    let (status, _) = w
        .call(
            "POST",
            "/api/payments/verify",
            json!({
            "razorpay_order_id": order, "razorpay_payment_id": pay,
            "razorpay_signature": "00ff" }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(w.payments(invoice).await.is_empty());
    assert_eq!(w.invoice(invoice).await, (rupees(0), "issued".to_owned()));
}

/// Given Razorpay as the provider, When the cashier asks for a counter QR,
/// Then Razorpay makes a single-use QR fixed to the amount due, and its
/// `qr_code.credited` posts the bill once, as UPI — no UTR typed.
#[tokio::test]
async fn a_razorpay_counter_qr_settles_the_bill_on_its_webhook() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    // Its own id each run: a reused database remembers every payment it has posted.
    let qrcounter1_id = format!(
        "pay_qrcounter1{}",
        &uuid::Uuid::new_v4().simple().to_string()[..8]
    );
    let invoice = w.bill(600).await;
    let (status, qr) = w
        .call(
            "POST",
            "/api/payments/upi-qr",
            json!({ "invoice_id": invoice, "amount": 600, "live": true }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{qr}");
    assert_eq!(qr["source"], "razorpay");
    let qr_id = qr["transaction_ref"].as_str().expect("qr id").to_owned();
    let asked = w
        .razorpay
        .qr_codes
        .lock()
        .expect("qr")
        .last()
        .cloned()
        .expect("asked");
    assert_eq!(asked["usage"], "single_use");
    assert_eq!(asked["fixed_amount"], true);
    assert_eq!(asked["payment_amount"], 60_000);
    let txn: uuid::Uuid = qr["transaction_id"]
        .as_str()
        .expect("txn")
        .parse()
        .expect("uuid");
    assert_eq!(status_of(&w, txn).await["gateway_order_id"], qr_id.as_str());

    let credited = json!({ "event": "qr_code.credited", "payload": {
        "payment": { "entity": { "id": qrcounter1_id.as_str(), "amount": 60_000, "method": "upi",
                                 "status": "captured", "vpa": "patient@okaxis" } },
        "qr_code": { "entity": { "id": qr_id, "payments_amount_received": 60_000 } } } });
    assert_eq!(w.webhook(&credited).await, StatusCode::OK);
    assert_eq!(w.webhook(&credited).await, StatusCode::OK);
    assert_eq!(
        w.payments(invoice).await,
        vec![(
            rupees(600),
            "upi".to_owned(),
            Some(qrcounter1_id.as_str().to_owned())
        )]
    );
    assert_eq!(w.invoice(invoice).await, (rupees(600), "paid".to_owned()));
}

/// Given an account without Razorpay QR Codes and a hospital UPI ID, When
/// the cashier asks for a counter QR, Then they get the UPI ID QR and the
/// reason; with no UPI ID either, a 400 says both.
#[tokio::test]
async fn without_razorpay_qr_the_counter_falls_back_and_says_why() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let invoice = w.bill(200).await;
    w.razorpay.refuse_qr.store(true, Ordering::SeqCst);
    w.setting("upi_vpa", json!("hospital@okaxis")).await;
    let (status, qr) = w
        .call(
            "POST",
            "/api/payments/upi-qr",
            json!({ "invoice_id": invoice, "amount": 200, "live": true }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{qr}");
    assert_eq!(qr["source"], "upi_id");
    assert!(
        qr["upi_uri"]
            .as_str()
            .is_some_and(|u| u.starts_with("upi://pay?pa=hospital@okaxis"))
    );
    assert!(
        qr["fallback_reason"]
            .as_str()
            .is_some_and(|r| r.contains("not found")),
        "{qr}"
    );

    w.setting("upi_vpa", json!(null)).await;
    let (status, body) = w
        .call(
            "POST",
            "/api/payments/upi-qr",
            json!({ "invoice_id": invoice, "amount": 200, "live": true }),
        )
        .await;
    w.razorpay.refuse_qr.store(false, Ordering::SeqCst);
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(
        body["detail"]
            .as_str()
            .is_some_and(|d| d.contains("UPI ID is not set")),
        "{body}"
    );
}
