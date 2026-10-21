//! MedBrains as the payments layer over any provider (#4884): the same
//! scenarios against stand-ins for Razorpay, Cashfree, PhonePe and PayU
//! (`online_world`), each mocked only at its own HTTP boundary.
//!
//! Every scenario runs once per provider. Posting rules never depend on the
//! provider: money settles once through `settle.rs`, whichever of the
//! browser and the provider's notice says so first.

use crate::online_world;

use axum::http::StatusCode;
use online_world::notices::{
    captured, card_word, cashfree_link_order, link_paid, qr_credited, refunded,
};
use online_world::{Online, PROVIDERS, online};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use tokio::sync::Mutex;
use uuid::Uuid;

/// The scenarios share the tenant's payment settings.
static SERIAL: Mutex<()> = Mutex::const_new(());

fn rupees(n: i64) -> Decimal {
    Decimal::from(n)
}

async fn row_status(o: &Online, txn: Uuid) -> (String, String) {
    sqlx::query_as("SELECT gateway, status FROM payment_gateway_transactions WHERE id = $1")
        .bind(txn)
        .fetch_one(&o.w.app.db)
        .await
        .expect("row")
}

/// A bill paid online in full by card, through `provider`: (bill, row, order, payment).
async fn paid_bill(o: &Online, provider: &str, total: i64) -> (Uuid, Uuid, String, String) {
    let invoice = o.w.bill(total).await;
    let (txn, order) = o.order(invoice, total).await;
    let payment = o.stand.pay(&order, total * 100, card_word(provider));
    let (status, body) = o.verify(provider, txn, &order, &payment).await;
    assert_eq!(status, StatusCode::OK, "{provider}: {body}");
    assert_eq!(body["status"], "captured", "{provider}: {body}");
    (invoice, txn, order, payment)
}

/// Given each provider, When checkout's verify and the provider's notice
/// both arrive — in either order — Then the bill carries one card payment,
/// under the provider's payment id, and is paid.
#[tokio::test]
async fn checkout_settles_once_whichever_word_arrives_first() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in PROVIDERS {
        o.use_provider(p).await;
        let (invoice, txn, order, payment) = paid_bill(&o, p, 1000).await;
        assert_eq!(
            row_status(&o, txn).await,
            (p.to_owned(), "captured".to_owned())
        );
        let notice = captured(p, &order, &payment, 100_000, card_word(p));
        assert_eq!(o.notify(p, &notice, false).await, StatusCode::OK, "{p}");
        let once = vec![(rupees(1000), "card".to_owned(), Some(payment.clone()))];
        assert_eq!(o.w.payments(invoice).await, once, "{p}: verify then notice");
        assert_eq!(
            o.w.invoice(invoice).await,
            (rupees(1000), "paid".to_owned()),
            "{p}"
        );

        let invoice = o.w.bill(800).await;
        let (txn, order) = o.order(invoice, 800).await;
        let payment = o.stand.pay(&order, 80_000, card_word(p));
        let notice = captured(p, &order, &payment, 80_000, card_word(p));
        assert_eq!(o.notify(p, &notice, false).await, StatusCode::OK, "{p}");
        assert_eq!(
            o.notify(p, &notice, false).await,
            StatusCode::OK,
            "{p}: a repeat"
        );
        let (status, body) = o.verify(p, txn, &order, &payment).await;
        assert_eq!(status, StatusCode::OK, "{p}: {body}");
        let once = vec![(rupees(800), "card".to_owned(), Some(payment))];
        assert_eq!(o.w.payments(invoice).await, once, "{p}: notice then verify");
    }
}

/// Given a paid ₹1,000 bill, When ₹300 is refunded and the provider's own
/// notice of that refund follows, Then the bill shows ₹700 paid, one refund.
#[tokio::test]
async fn a_partial_refund_comes_off_the_bill_once() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in PROVIDERS {
        o.use_provider(p).await;
        let (invoice, txn, order, payment) = paid_bill(&o, p, 1000).await;
        let (status, body) =
            o.w.call(
                "POST",
                "/api/payments/refund",
                json!({ "transaction_id": txn, "amount": 300, "reason": "Test not done" }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{p}: {body}");
        let refund_id = body["refund_id"].as_str().expect("refund id").to_owned();
        let made = o
            .stand
            .refunds
            .lock()
            .expect("refunds")
            .last()
            .cloned()
            .expect("asked");
        assert_eq!((made.0.as_str(), made.2), (p, 30_000), "{p}");
        let after = (rupees(700), "partially_paid".to_owned());
        assert_eq!(o.w.invoice(invoice).await, after, "{p}");
        if let Some(notice) = refunded(p, &order, &payment, &refund_id, 30_000) {
            assert_eq!(o.notify(p, &notice, false).await, StatusCode::OK, "{p}");
        }
        assert_eq!(
            o.w.invoice(invoice).await,
            after,
            "{p}: the notice changed nothing"
        );
        let refunds: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM refunds WHERE invoice_id = $1 AND deleted_at IS NULL",
        )
        .bind(invoice)
        .fetch_one(&o.w.app.db)
        .await
        .expect("refunds");
        assert_eq!(refunds, 1, "{p}");
    }
}

/// Given a payment already partly refunded, When a second refund is asked
/// of a provider that takes one refund per payment, Then a clear 422 names
/// the capability and nothing more comes off the bill; providers that take
/// several refund again.
#[tokio::test]
async fn a_refund_the_provider_cannot_make_is_a_clear_422() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in PROVIDERS {
        o.use_provider(p).await;
        let (invoice, txn, _, _) = paid_bill(&o, p, 1000).await;
        let refund =
            |amount: i64| json!({ "transaction_id": txn, "amount": amount, "reason": "Returned" });
        let (status, body) = o.w.call("POST", "/api/payments/refund", refund(300)).await;
        assert_eq!(status, StatusCode::OK, "{p}: {body}");
        let (status, body) = o.w.call("POST", "/api/payments/refund", refund(100)).await;
        if matches!(p, "razorpay" | "cashfree") {
            assert_eq!(status, StatusCode::OK, "{p}: {body}");
            assert_eq!(o.w.invoice(invoice).await.0, rupees(600), "{p}");
        } else {
            assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{p}: {body}");
            assert_eq!(body["error"], "unsupported_capability", "{p}");
            assert_eq!(body["capability"], "multiple_refunds", "{p}");
            assert_eq!(o.w.invoice(invoice).await.0, rupees(700), "{p}");
        }
    }
}

/// Given a delivery's pay-now payment row, When the outbox makes its link
/// and the payer pays it (the notice arriving twice), Then one payment
/// posts — or, at a provider without links, the row fails with nothing posted.
#[tokio::test]
async fn a_paid_link_posts_once() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in PROVIDERS {
        o.use_provider(p).await;
        let invoice = o.w.bill(500).await;
        let row = o.pending_row(invoice, 500).await;
        let (gateway, link, status) = o.make_link(row).await;
        if matches!(p, "phonepe" | "payu") {
            assert_eq!(status, "failed", "{p}: no links, no link");
            assert!(o.w.payments(invoice).await.is_empty(), "{p}");
            continue;
        }
        assert_eq!((gateway.as_str(), status.as_str()), (p, "created"), "{p}");
        let payment = o.stand.pay(&cashfree_link_order(&link), 50_000, "upi");
        let notice = link_paid(p, &link, &payment, 50_000);
        assert_eq!(o.notify(p, &notice, false).await, StatusCode::OK, "{p}");
        assert_eq!(
            o.notify(p, &notice, false).await,
            StatusCode::OK,
            "{p}: a repeat"
        );
        let once = vec![(rupees(500), "upi".to_owned(), Some(payment))];
        assert_eq!(o.w.payments(invoice).await, once, "{p}");
    }
}

/// Given a counter asks for a live UPI QR, When the provider makes one and
/// its credit notice arrives twice, Then one UPI payment posts; a provider
/// with no dynamic QR falls back to the hospital's UPI ID and says why.
#[tokio::test]
async fn a_credited_counter_qr_posts_once_where_supported() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in PROVIDERS {
        o.use_provider(p).await;
        let invoice = o.w.bill(600).await;
        let (status, qr) =
            o.w.call(
                "POST",
                "/api/payments/upi-qr",
                json!({ "invoice_id": invoice, "amount": 600, "live": true }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{p}: {qr}");
        if matches!(p, "phonepe" | "payu") {
            assert_eq!(qr["source"], "upi_id", "{p}: {qr}");
            assert!(
                qr["fallback_reason"]
                    .as_str()
                    .is_some_and(|r| r.contains("no UPI QR")),
                "{p}: {qr}"
            );
            continue;
        }
        assert_eq!(qr["source"], p, "{p}: {qr}");
        let qr_ref = qr["transaction_ref"].as_str().expect("qr").to_owned();
        let payment = format!("pay{}", &Uuid::new_v4().simple().to_string()[..12]);
        let notice = qr_credited(p, &qr_ref, &payment, 60_000);
        assert_eq!(o.notify(p, &notice, false).await, StatusCode::OK, "{p}");
        assert_eq!(
            o.notify(p, &notice, false).await,
            StatusCode::OK,
            "{p}: a repeat"
        );
        let once = vec![(rupees(600), "upi".to_owned(), Some(payment))];
        assert_eq!(o.w.payments(invoice).await, once, "{p}");
    }
}

/// Given a payment the provider holds as paid, When a notice arrives signed
/// with the wrong secret, Then it is refused and nothing posts.
#[tokio::test]
async fn a_forged_notice_is_refused() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in PROVIDERS {
        o.use_provider(p).await;
        let invoice = o.w.bill(400).await;
        let (txn, order) = o.order(invoice, 400).await;
        let payment = o.stand.pay(&order, 40_000, card_word(p));
        let notice = captured(p, &order, &payment, 40_000, card_word(p));
        assert_eq!(
            o.notify(p, &notice, true).await,
            StatusCode::BAD_REQUEST,
            "{p}"
        );
        assert!(o.w.payments(invoice).await.is_empty(), "{p}");
        assert_ne!(row_status(&o, txn).await.1, "captured", "{p}");
    }
}

/// Given a hospital whose provider is down and which named a fallback, When
/// the cashier starts an online payment, Then a 503 offers the fallback and
/// nothing switches on its own; choosing it opens the payment there. A
/// provider never named is refused.
#[tokio::test]
async fn a_down_provider_offers_the_fallback_and_never_switches_silently() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in ["razorpay", "cashfree", "phonepe"] {
        let backup = if p == "razorpay" {
            "cashfree"
        } else {
            "razorpay"
        };
        o.use_provider(p).await;
        o.w.setting("fallback_provider", json!(backup)).await;
        o.stand.down.lock().expect("down").insert(p.to_owned());
        let invoice = o.w.bill(300).await;
        let (status, body) = o.create(invoice, 300, None).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{p}: {body}");
        assert_eq!(body["error"], "provider_unavailable", "{p}");
        assert_eq!(body["fallback"]["provider"], backup, "{p}: {body}");
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT gateway, status FROM payment_gateway_transactions WHERE invoice_id = $1",
        )
        .bind(invoice)
        .fetch_all(&o.w.app.db)
        .await
        .expect("rows");
        assert_eq!(
            rows,
            vec![(p.to_owned(), "failed".to_owned())],
            "{p}: no silent switch"
        );

        let (status, body) = o.create(invoice, 300, Some("payu")).await;
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "{p}: only the named fallback: {body}"
        );
        let (status, body) = o.create(invoice, 300, Some(backup)).await;
        assert_eq!(status, StatusCode::OK, "{p}: {body}");
        assert_eq!(body["provider"], backup, "{p}");
        assert_eq!(body["checkout"]["kind"], checkout_kind(backup), "{p}");
    }
}

fn checkout_kind(provider: &str) -> Value {
    json!(match provider {
        "razorpay" => "razorpay_js",
        "cashfree" => "cashfree_js",
        "phonepe" => "redirect",
        _ => "form_post",
    })
}

/// Given each provider, When the cashier starts a payment, Then the browser
/// is told how to pay it in that provider's own way, and the counter's
/// capabilities say what it offers.
#[tokio::test]
async fn each_provider_opens_its_own_checkout_and_says_what_it_can_do() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for p in PROVIDERS {
        o.use_provider(p).await;
        let invoice = o.w.bill(200).await;
        let (status, body) = o.create(invoice, 200, None).await;
        assert_eq!(status, StatusCode::OK, "{p}: {body}");
        assert_eq!(body["checkout"]["kind"], checkout_kind(p), "{p}: {body}");
        let (status, caps) =
            o.w.call("GET", "/api/payments/capabilities", json!(null))
                .await;
        assert_eq!(status, StatusCode::OK, "{caps}");
        assert_eq!(caps["active"]["provider"], p);
        assert_eq!(caps["active"]["configured"], true, "{p}");
        let links = matches!(p, "razorpay" | "cashfree");
        assert_eq!(
            caps["active"]["capabilities"]["payment_links"], links,
            "{p}"
        );
        assert_eq!(caps["active"]["capabilities"]["dynamic_qr"], links, "{p}");
    }
}
