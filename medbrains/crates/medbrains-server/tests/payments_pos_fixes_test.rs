//! Live-money fixes to the card machine adapters (#4878).
//!
//! Each test drives the real server against a stand-in Plutus Cloud, a
//! stand-in Ezetap p2padapter or a stand-in Razorpay — answering in the
//! shapes Pine Labs' spec and Odoo's shipping `pos_pine_labs` /
//! `pos_razorpay` use — and reads the bill back. The rule under test: money
//! the machine took posts exactly once, as the mode it was paid by, and an
//! answer nobody understands is never read as "no money taken".

mod common;
mod payments_world;
mod pos_world;

use std::sync::Arc;
use std::sync::atomic::Ordering;

use axum::http::StatusCode;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use pos_world::{
    Ezetap, P2P_ADAPTER, Plutus, captured_rows, outlive_window, plutus_approval, provider_machine,
    start_as, status,
};

fn rupees(n: i64) -> Decimal {
    Decimal::from(n)
}

fn id_of(sale: &Value) -> String {
    sale["transaction_id"].as_str().expect("id").to_owned()
}

/// A Razorpay POS device serial of the test's own (serials are unique per hospital).
fn serial() -> String {
    format!("7{:09}", Uuid::new_v4().as_u128() % 1_000_000_000)
}

fn uploaded() -> Value {
    json!({ "ResponseCode": 1001, "ResponseMessage": "TXN UPLOADED" })
}

/// Given three machines, When the cashier sends a sale as card, as UPI on
/// the machine, and leaving it open, Then Plutus is asked for mode 1, 10 and
/// "1|10" — never 10 for a card (10 is UPI only).
#[tokio::test]
async fn pine_labs_is_sent_the_mode_the_cashier_picked() {
    let plutus = Arc::new(Plutus::default());
    let w = pos_world::pinelabs_world(Arc::clone(&plutus)).await;
    for tender in ["card", "upi", "either"] {
        let invoice = w.bill(100).await;
        let machine = provider_machine(&w, "pinelabs", &format!("PL-{}", pos_world::tag())).await;
        start_as(&w, machine, invoice, 100, tender).await;
    }
    let modes: Vec<Value> = plutus
        .uploads
        .lock()
        .expect("uploads")
        .iter()
        .map(|u| u["AllowedPaymentMode"].clone())
        .collect();
    assert_eq!(modes, vec![json!(1), json!(10), json!("1|10")]);
}

/// Given a sale on Pine Labs, When Plutus answers codes it reuses for many
/// things ("TRANSACTION NOT FOUND", an unknown code), Then the sale keeps
/// waiting — not declined — and the approval that follows posts once, with
/// the RRN read from `TransactionData`.
#[tokio::test]
async fn pine_labs_unknown_codes_keep_the_sale_waiting_and_the_approval_posts() {
    let plutus = Arc::new(Plutus::default());
    *plutus.answers.lock().expect("answers") = vec![
        json!({ "ResponseCode": 1, "ResponseMessage": "TRANSACTION NOT FOUND" }),
        json!({ "ResponseCode": 4711, "ResponseMessage": "SOMETHING NEW" }),
        plutus_approval("CARD"),
    ];
    let w = pos_world::pinelabs_world(Arc::clone(&plutus)).await;
    let invoice = w.bill(420).await;
    let machine = provider_machine(&w, "pinelabs", &format!("PL-{}", pos_world::tag())).await;
    let id = id_of(&start_as(&w, machine, invoice, 420, "card").await);
    for _ in 0..2 {
        let still = status(&w, &id).await;
        assert_eq!(still["stage"], "waiting", "{still}");
        assert_eq!(still["is_final"], false);
    }
    assert!(w.payments(invoice).await.is_empty());
    let approved = status(&w, &id).await;
    assert_eq!(approved["stage"], "approved", "{approved}");
    assert_eq!(approved["rrn"], "429011223344");
    status(&w, &id).await;
    assert_eq!(
        w.payments(invoice).await,
        vec![(rupees(420), "card".to_owned(), Some("7700123".to_owned()))]
    );
}

/// Given the patient has entered the PIN, When the cashier cancels and
/// Plutus answers HTTP 200 "CANNOT CANCEL AS TRANSACTION IS IN PROGRESS",
/// Then the sale is not recorded as cancelled — the screen says the machine
/// is still taking the card — and when the card is then approved it posts
/// exactly once. The cancel was the forced call, with the amount in paise.
#[tokio::test]
async fn pine_labs_refused_cancel_keeps_the_sale_live_and_the_approval_posts_once() {
    let plutus = Arc::new(Plutus::default());
    *plutus.answers.lock().expect("answers") = vec![uploaded()];
    *plutus.cancel_answer.lock().expect("cancel") = Some(json!({ "ResponseCode": 1,
        "ResponseMessage": "CANNOT CANCEL AS TRANSACTION IS IN PROGRESS" }));
    let w = pos_world::pinelabs_world(Arc::clone(&plutus)).await;
    let invoice = w.bill(420).await;
    let machine = provider_machine(&w, "pinelabs", &format!("PL-{}", pos_world::tag())).await;
    let id = id_of(&start_as(&w, machine, invoice, 420, "either").await);
    assert_eq!(status(&w, &id).await["stage"], "waiting");

    let (code, refused) = w
        .call(
            "POST",
            &format!("/api/payments/pos-sale/{id}/cancel"),
            json!({}),
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{refused}");
    assert_eq!(refused["stage"], "cancel_refused", "{refused}");
    assert_eq!(refused["is_final"], false);
    assert!(
        refused["message"]
            .as_str()
            .unwrap_or_default()
            .contains("CANNOT CANCEL"),
        "{refused}"
    );
    let cancel = plutus.cancels.lock().expect("cancels")[0].clone();
    assert_eq!(
        (
            cancel["Amount"].as_i64(),
            cancel["PlutusTransactionReferenceID"].as_i64()
        ),
        (Some(42_000), Some(7_700_123))
    );
    assert_eq!(
        (&cancel["TakeToHomeScreen"], &cancel["ConfirmationRequired"]),
        (&json!(true), &json!(true))
    );
    assert!(w.payments(invoice).await.is_empty());
    assert_eq!(status(&w, &id).await["stage"], "cancel_refused");

    plutus.now_answers(plutus_approval("CARD"));
    assert_eq!(status(&w, &id).await["stage"], "approved");
    status(&w, &id).await;
    let (_, again) = w
        .call(
            "POST",
            &format!("/api/payments/pos-sale/{id}/cancel"),
            json!({}),
        )
        .await;
    assert_eq!(again["stage"], "approved", "a late cancel changes nothing");
    assert_eq!(w.payments(invoice).await.len(), 1);
    assert_eq!(captured_rows(&w, invoice).await, 1);
    assert_eq!(w.invoice(invoice).await, (rupees(420), "paid".to_owned()));
}

/// Given the patient paid by UPI on the Pine Labs machine (`PaymentMode`
/// UPI) on a sale the cashier left open, Then it posts as UPI, not card.
#[tokio::test]
async fn upi_on_the_terminal_posts_as_upi() {
    let plutus = Arc::new(Plutus::default());
    *plutus.answers.lock().expect("answers") = vec![plutus_approval("UPI")];
    let w = pos_world::pinelabs_world(Arc::clone(&plutus)).await;
    let invoice = w.bill(420).await;
    let machine = provider_machine(&w, "pinelabs", &format!("PL-{}", pos_world::tag())).await;
    let id = id_of(&start_as(&w, machine, invoice, 420, "either").await);
    let approved = status(&w, &id).await;
    assert_eq!(
        (&approved["stage"], &approved["method"]),
        (&json!("approved"), &json!("upi")),
        "{approved}"
    );
    assert_eq!(
        w.payments(invoice).await,
        vec![(rupees(420), "upi".to_owned(), Some("7700123".to_owned()))]
    );
}

/// Razorpay POS against a stand-in p2padapter: the sale goes to `…/pay` with
/// the device id `<serial>|ezetap_android`, rupees and the cashier's mode;
/// status `success:false` is neither an approval nor a decline; an
/// AUTHORIZED + P2P_DEVICE_TXN_DONE paid by UPI posts once as UPI.
#[tokio::test]
async fn ezetap_uses_the_p2padapter_and_handles_success_false() {
    let ezetap = Arc::new(Ezetap::default());
    *ezetap.answers.lock().expect("answers") = vec![
        json!({ "success": true, "messageCode": "P2P_DEVICE_RECEIVED" }),
        json!({ "success": false, "errorCode": "EZETAP_0000999",
                "errorMessage": "Something went wrong" }),
        json!({ "success": true, "status": "AUTHORIZED", "messageCode": "P2P_DEVICE_TXN_DONE",
                "txnId": "250102070624795E020088174", "authCode": "D12345",
                "reverseReferenceNumber": "500212345678", "paymentMode": "UPI" }),
    ];
    let w = pos_world::ezetap_world(Arc::clone(&ezetap)).await;
    let invoice = w.bill(250).await;
    let serial = serial();
    let machine = provider_machine(&w, "razorpay_pos", &serial).await;
    let id = id_of(&start_as(&w, machine, invoice, 250, "upi").await);
    let pay = ezetap.asked("pay");
    assert_eq!(pay.len(), 1, "the sale went to {P2P_ADAPTER}/pay");
    assert_eq!(
        pay[0]["pushTo"]["deviceId"],
        json!(format!("{serial}|ezetap_android"))
    );
    assert_eq!(
        (
            &pay[0]["amount"],
            &pay[0]["mode"],
            &pay[0]["externalRefNumber"]
        ),
        (&json!(250), &json!("UPI"), &json!(id))
    );

    for _ in 0..2 {
        let still = status(&w, &id).await;
        assert_eq!(still["is_final"], false, "{still}");
        assert!(w.payments(invoice).await.is_empty());
    }
    assert_eq!(ezetap.asked("status")[0]["origP2pRequestId"], "250102");
    let approved = status(&w, &id).await;
    assert_eq!(approved["stage"], "approved", "{approved}");
    status(&w, &id).await;
    assert_eq!(
        w.payments(invoice).await,
        vec![(
            rupees(250),
            "upi".to_owned(),
            Some("250102070624795E020088174".to_owned())
        )]
    );
}

/// Ezetap answering `pay` with `success:false` (Odoo's EZETAP_0000387
/// payload) is a refusal: nothing was charged and the counter is told so.
#[tokio::test]
async fn ezetap_refusing_the_sale_charges_nothing() {
    let ezetap = Arc::new(Ezetap::default());
    *ezetap.pay_answer.lock().expect("pay") = Some(json!({ "success": false,
        "errorCode": "EZETAP_0000387", "errorMessage": "`externalRefNumber` field is empty." }));
    let w = pos_world::ezetap_world(Arc::clone(&ezetap)).await;
    let invoice = w.bill(250).await;
    let machine = provider_machine(&w, "razorpay_pos", &serial()).await;
    let (code, why) = pos_world::start(&w, machine, Some(invoice), 250).await;
    assert_eq!(code, StatusCode::CONFLICT, "{why}");
    let words = why.to_string();
    assert!(
        words.contains("EZETAP_0000387") && words.contains("Nothing was charged"),
        "{why}"
    );
    assert!(w.payments(invoice).await.is_empty());
}

/// Given a sale the machine never answered definitely and whose cancel it
/// refused, When the answer window passes, Then it is "outcome unknown" —
/// not declined — nothing posts, and the bill cannot be charged again.
/// A clerk without `billing.payments.reconcile` cannot resolve it; paid
/// needs the slip's RRN; resolved paid it posts once, audited, and the
/// machine's own approval arriving later posts nothing more.
#[tokio::test]
async fn an_unknown_outcome_goes_to_a_person_who_resolves_it_once() {
    let plutus = Arc::new(Plutus::default());
    *plutus.answers.lock().expect("answers") = vec![uploaded()];
    *plutus.cancel_answer.lock().expect("cancel") = Some(json!({ "ResponseCode": 1,
        "ResponseMessage": "CANNOT CANCEL AS TRANSACTION IS IN PROGRESS" }));
    let w = pos_world::pinelabs_world(Arc::clone(&plutus)).await;
    let invoice = w.bill(420).await;
    let machine = provider_machine(&w, "pinelabs", &format!("PL-{}", pos_world::tag())).await;
    let id = id_of(&start_as(&w, machine, invoice, 420, "card").await);
    outlive_window(&w, &id).await;
    let unknown = status(&w, &id).await;
    assert_eq!(unknown["stage"], "unknown", "{unknown}");
    assert_eq!(unknown["is_final"], false);
    assert!(w.payments(invoice).await.is_empty());
    let (code, why) = pos_world::start(&w, machine, Some(invoice), 420).await;
    assert_eq!(code, StatusCode::CONFLICT, "{why}");
    assert!(why.to_string().contains("no definite outcome"), "{why}");

    let path = format!("/api/payments/pos-sale/{id}/resolve");
    let paid = json!({ "outcome": "paid", "rrn": "429011223344", "method": "card" });
    let clerk = common::provision_staff(
        &w.app,
        &w.csrf,
        "billing_clerk",
        &["billing.payments.reconcile"],
    )
    .await;
    let denied = clerk
        .client
        .post(w.app.url(&path))
        .header("x-csrf-token", &clerk.csrf)
        .json(&paid)
        .send()
        .await
        .expect("req");
    assert_eq!(denied.status().as_u16(), 403);
    let (code, _) = w.call("POST", &path, json!({ "outcome": "paid" })).await;
    assert_eq!(
        code,
        StatusCode::BAD_REQUEST,
        "paid needs the RRN or approval code"
    );
    assert!(w.payments(invoice).await.is_empty());

    let (code, resolved) = w.call("POST", &path, paid.clone()).await;
    assert_eq!(code, StatusCode::OK, "{resolved}");
    assert_eq!(resolved["stage"], "approved", "{resolved}");
    let (code, _) = w.call("POST", &path, paid).await;
    assert_eq!(code, StatusCode::CONFLICT, "resolved once");
    plutus.now_answers(plutus_approval("CARD"));
    status(&w, &id).await;
    assert_eq!(
        w.payments(invoice).await,
        vec![(
            rupees(420),
            "card".to_owned(),
            Some("429011223344".to_owned())
        )]
    );
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE entity_id = $1 AND action = 'pos_sale.resolve'",
    )
    .bind(id.parse::<Uuid>().expect("uuid"))
    .fetch_one(&w.app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1);
}

/// Resolved as not paid, the sale says so with the supervisor's reason and
/// the bill can be charged again.
#[tokio::test]
async fn an_unknown_outcome_resolved_not_paid_frees_the_bill() {
    let plutus = Arc::new(Plutus::default());
    *plutus.answers.lock().expect("answers") = vec![uploaded()];
    *plutus.cancel_answer.lock().expect("cancel") =
        Some(json!({ "ResponseCode": 2, "ResponseMessage": "INVALID PLUTUS TXN REF ID" }));
    let w = pos_world::pinelabs_world(Arc::clone(&plutus)).await;
    let invoice = w.bill(300).await;
    let machine = provider_machine(&w, "pinelabs", &format!("PL-{}", pos_world::tag())).await;
    let id = id_of(&start_as(&w, machine, invoice, 300, "card").await);
    outlive_window(&w, &id).await;
    assert_eq!(status(&w, &id).await["stage"], "unknown");
    let path = format!("/api/payments/pos-sale/{id}/resolve");
    let (code, _) = w
        .call("POST", &path, json!({ "outcome": "not_paid" }))
        .await;
    assert_eq!(code, StatusCode::BAD_REQUEST, "a reason is required");
    let (code, done) = w
        .call(
            "POST",
            &path,
            json!({ "outcome": "not_paid", "reason": "Slip shows TXN CANCELLED" }),
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{done}");
    assert_eq!(done["stage"], "failed");
    assert!(
        done["message"]
            .as_str()
            .unwrap_or_default()
            .contains("Slip shows TXN CANCELLED"),
        "{done}"
    );
    assert!(w.payments(invoice).await.is_empty());
    let (code, _) = pos_world::start(&w, machine, Some(invoice), 300).await;
    assert_eq!(code, StatusCode::OK, "the bill can be charged again");
}

/// Given Razorpay made a refund but its answer was lost, When the cashier
/// retries the same refund, Then the retry carries the same receipt and
/// Razorpay rejects it — one refund, not two — and the refund comes off
/// the bill once when Razorpay's notice arrives.
#[tokio::test]
async fn a_refund_retry_does_not_refund_twice() {
    let w = payments_world::world().await;
    let invoice = w.bill(1000).await;
    let (_, order) = w.order(invoice, 1000).await;
    let pay = w.paid(&order, 100_000, "card");
    assert_eq!(w.verify(&order, &pay).await.0, StatusCode::OK);
    let payment_id: Uuid = sqlx::query_scalar("SELECT id FROM payments WHERE invoice_id = $1")
        .bind(invoice)
        .fetch_one(&w.app.db)
        .await
        .expect("payment");
    let refund = json!({ "payment_id": payment_id, "amount": 300, "reason": "Test not done" });
    w.razorpay.lose_refund_answer.store(true, Ordering::SeqCst);
    let (code, lost) = w.call("POST", "/api/payments/refund", refund.clone()).await;
    assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE, "{lost}");
    w.razorpay.lose_refund_answer.store(false, Ordering::SeqCst);
    let (code, retried) = w.call("POST", "/api/payments/refund", refund).await;
    assert_eq!(code, StatusCode::BAD_REQUEST, "{retried}");
    let made = w.razorpay.refunds.lock().expect("refunds").clone();
    assert_eq!(made.len(), 1, "Razorpay refunded once");
    assert_eq!(w.razorpay.refund_receipts.lock().expect("r").len(), 1);

    let refund_id = format!("rfnd_{}", &Uuid::new_v4().simple().to_string()[..14]);
    let notice = json!({ "event": "refund.created", "payload": {
        "refund": { "entity": { "id": refund_id, "amount": 30_000, "payment_id": pay } },
        "payment": { "entity": { "id": pay, "order_id": order } } } });
    assert_eq!(w.webhook(&notice).await, StatusCode::OK);
    assert_eq!(w.webhook(&notice).await, StatusCode::OK);
    assert_eq!(
        w.invoice(invoice).await,
        (rupees(700), "partially_paid".to_owned())
    );
}
