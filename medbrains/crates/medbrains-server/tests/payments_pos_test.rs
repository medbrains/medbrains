//! Payments P4 (#4874): card machines at every counter.
//!
//! Each test drives the real server against the simulated machine, a mock
//! site bridge, or a stand-in Plutus Cloud — the provider only at its
//! boundary — and reads the bill back: the money posts exactly once on an
//! approval, never on a decline, a timeout or a cancel, and an offline
//! machine is refused before anything is charged.

mod common;
mod payments_world;
mod pos_world;

use std::sync::Arc;

use axum::http::StatusCode;
use rust_decimal::Decimal;
use serde_json::{Value, json};

use pos_world::{Plutus, captured_rows, card_does, start, status};

fn rupees(n: i64) -> Decimal {
    Decimal::from(n)
}

/// Given a ₹500 bill and the counter's simulated machine, When the cashier
/// sends it and the card is approved, Then one ₹500 card payment is on the
/// bill under the machine's reference, with the card's last four and the
/// approval code — and asking again posts nothing more.
#[tokio::test]
async fn an_approved_card_posts_once() {
    let w = pos_world::world().await;
    let invoice = w.bill(500).await;
    let terminal = pos_world::simulator_machine(&w).await;
    let (code, sale) = start(&w, terminal, Some(invoice), 500).await;
    assert_eq!(code, StatusCode::OK, "{sale}");
    assert_eq!(sale["stage"], "waiting");
    let id = sale["transaction_id"].as_str().expect("id").to_owned();
    assert_eq!(status(&w, &id).await["stage"], "waiting");
    assert!(
        w.payments(invoice).await.is_empty(),
        "nothing posts while waiting"
    );

    card_does(&w, &id, json!({ "outcome": "approve" })).await;
    let approved = status(&w, &id).await;
    assert_eq!(approved["stage"], "approved", "{approved}");
    assert_eq!(
        (
            approved["card_last4"].as_str(),
            approved["auth_code"].as_str()
        ),
        (Some("4242"), Some("SIM0K1"))
    );
    let again = status(&w, &id).await;
    assert_eq!(again["stage"], "approved");
    let reference = approved["reference"].as_str().map(ToOwned::to_owned);
    assert_eq!(
        w.payments(invoice).await,
        vec![(rupees(500), "card".to_owned(), reference)]
    );
    assert_eq!(w.invoice(invoice).await, (rupees(500), "paid".to_owned()));
}

/// A decline and a timeout at the machine post nothing, say so in plain
/// words, and free the machine for the next try.
#[tokio::test]
async fn a_decline_or_timeout_posts_nothing_and_the_retry_can_go_through() {
    let w = pos_world::world().await;
    let invoice = w.bill(300).await;
    let terminal = pos_world::simulator_machine(&w).await;
    for (outcome, stage) in [("decline", "declined"), ("timeout", "timed_out")] {
        let (_, sale) = start(&w, terminal, Some(invoice), 300).await;
        let id = sale["transaction_id"].as_str().expect("id").to_owned();
        card_does(&w, &id, json!({ "outcome": outcome })).await;
        let done = status(&w, &id).await;
        assert_eq!(done["stage"], stage, "{done}");
        assert!(
            done["message"]
                .as_str()
                .unwrap_or_default()
                .contains("no money was taken"),
            "{done}"
        );
        assert!(w.payments(invoice).await.is_empty());
    }
    let (_, retry) = start(&w, terminal, Some(invoice), 300).await;
    let id = retry["transaction_id"].as_str().expect("id").to_owned();
    card_does(&w, &id, json!({ "outcome": "approve" })).await;
    assert_eq!(status(&w, &id).await["stage"], "approved");
    assert_eq!(w.payments(invoice).await.len(), 1);
}

/// Cancelling at the counter stops the sale: nothing posts, the machine is
/// free. One machine runs one sale: a second while the first waits is refused.
#[tokio::test]
async fn a_cancel_posts_nothing_and_a_busy_machine_takes_no_second_sale() {
    let w = pos_world::world().await;
    let invoice = w.bill(200).await;
    let terminal = pos_world::simulator_machine(&w).await;
    let (_, sale) = start(&w, terminal, Some(invoice), 200).await;
    let id = sale["transaction_id"].as_str().expect("id").to_owned();
    let (busy, why) = start(&w, terminal, Some(invoice), 200).await;
    assert_eq!(busy, StatusCode::CONFLICT, "{why}");
    assert!(why.to_string().contains("still busy"), "{why}");

    let (code, cancelled) = w
        .call(
            "POST",
            &format!("/api/payments/pos-sale/{id}/cancel"),
            json!({}),
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{cancelled}");
    assert_eq!(cancelled["stage"], "cancelled");
    assert!(w.payments(invoice).await.is_empty());
    let (code, _) = start(&w, terminal, Some(invoice), 200).await;
    assert_eq!(code, StatusCode::OK, "the machine is free again");
}

/// Part of the amount approved (a card with too little on it): that part
/// posts, the bill stays partly paid, the counter is told what is left.
#[tokio::test]
async fn a_partial_approval_posts_what_the_card_covered() {
    let w = pos_world::world().await;
    let invoice = w.bill(1000).await;
    let terminal = pos_world::simulator_machine(&w).await;
    let (_, sale) = start(&w, terminal, Some(invoice), 1000).await;
    let id = sale["transaction_id"].as_str().expect("id").to_owned();
    card_does(
        &w,
        &id,
        json!({ "outcome": "partial", "approved_amount": 600 }),
    )
    .await;
    let done = status(&w, &id).await;
    assert_eq!(done["stage"], "approved");
    assert!(
        done["message"]
            .as_str()
            .unwrap_or_default()
            .contains("remaining ₹400"),
        "{done}"
    );
    assert_eq!(
        w.invoice(invoice).await,
        (rupees(600), "partially_paid".to_owned())
    );
}

/// An unplugged machine is refused before any sale row is made; plugged
/// back in and tested, it takes payments again.
#[tokio::test]
async fn an_offline_machine_is_refused_up_front() {
    let w = pos_world::world().await;
    let invoice = w.bill(150).await;
    let terminal = pos_world::simulator_machine(&w).await;
    let power_path = format!("/api/payments/simulator/terminals/{terminal}/power");
    let power = |on: bool| w.call("POST", &power_path, json!({ "on": on }));
    assert_eq!(power(false).await.0, StatusCode::OK);
    let (code, why) = start(&w, terminal, Some(invoice), 150).await;
    assert_eq!(code, StatusCode::CONFLICT, "{why}");
    assert!(why.to_string().contains("is offline"), "{why}");
    let rows: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM payment_gateway_transactions WHERE terminal_id = $1",
    )
    .bind(terminal)
    .fetch_one(&w.app.db)
    .await
    .expect("rows");
    assert_eq!(rows, 0, "nothing was sent to the machine");
    let (_, pinged) = w
        .call(
            "POST",
            &format!("/api/payments/terminals/{terminal}/ping"),
            json!({}),
        )
        .await;
    assert_eq!(
        pinged["status"], "offline",
        "an unplugged machine does not answer a test"
    );
    assert_eq!(power(true).await.0, StatusCode::OK);
    let (_, pinged) = w
        .call(
            "POST",
            &format!("/api/payments/terminals/{terminal}/ping"),
            json!({}),
        )
        .await;
    assert_eq!(pinged["status"], "online");
    assert_eq!(
        start(&w, terminal, Some(invoice), 150).await.0,
        StatusCode::OK
    );
}

/// A machine wired to a counter PC: the bridge's claim is its heartbeat, it
/// takes the sale, reports waiting and then approved — twice, as a bridge
/// retrying a lost answer would — and the bill is paid once.
#[tokio::test]
async fn the_bridge_runs_the_sale_and_a_repeated_result_posts_once() {
    let w = pos_world::world().await;
    let invoice = w.bill(750).await;
    let station = pos_world::counter(&w).await;
    let t = pos_world::machine(
        &w,
        station,
        json!({ "connection": "bridge", "adapter": "simulator",
                                                    "device_address": "/dev/ttyUSB0" }),
    )
    .await;
    let terminal = t["id"].as_str().expect("id").to_owned();
    assert_eq!(
        t["status"], "offline",
        "a bridge machine is offline until its bridge reports it"
    );
    let claim = || {
        w.call(
            "POST",
            "/api/payments/terminal-jobs/claim",
            json!({ "terminals": [{ "terminal_id": terminal, "online": true }] }),
        )
    };
    let (code, none) = claim().await;
    assert_eq!((code, none), (StatusCode::OK, json!([])));

    let (code, sale) = start(&w, terminal.parse().expect("uuid"), Some(invoice), 750).await;
    assert_eq!(code, StatusCode::OK, "{sale}");
    assert_eq!(sale["stage"], "sent");
    let id = sale["transaction_id"].as_str().expect("id").to_owned();
    let (_, jobs) = claim().await;
    let job = jobs
        .as_array()
        .and_then(|j| j.first())
        .cloned()
        .unwrap_or(Value::Null);
    assert_eq!(
        (job["job_id"].as_str(), job["action"].as_str()),
        (Some(id.as_str()), Some("sale"))
    );
    assert_eq!(
        (job["amount_paise"].as_i64(), job["device_address"].as_str()),
        (Some(75_000), Some("/dev/ttyUSB0"))
    );
    assert_eq!(claim().await.1, json!([]), "a sale is handed out once");

    let result_path = format!("/api/payments/terminal-jobs/{id}/result");
    let report = |body: Value| w.call("POST", &result_path, body);
    assert_eq!(
        report(json!({ "outcome": "waiting" })).await.0,
        StatusCode::OK
    );
    assert_eq!(status(&w, &id).await["stage"], "waiting");
    let approved = json!({ "outcome": "approved", "reference": "BR-77", "approved_paise": 75_000,
                           "card_last4": "1111", "auth_code": "AU77" });
    assert_eq!(report(approved.clone()).await.0, StatusCode::OK);
    assert_eq!(report(approved).await.0, StatusCode::OK);
    assert_eq!(
        w.payments(invoice).await,
        vec![(rupees(750), "card".to_owned(), Some("BR-77".to_owned()))]
    );
    assert_eq!(captured_rows(&w, invoice).await, 1);
    assert_eq!(status(&w, &id).await["card_last4"], "1111");
}

/// Pine Labs Plutus Cloud, against a stand-in at its boundary: the sale is
/// uploaded in paise under our row's id, "in progress" waits, approval posts
/// once with the card and approval code read from `TransactionData`.
#[tokio::test]
async fn pine_labs_uploads_polls_and_posts_once() {
    let plutus = Arc::new(Plutus::default());
    *plutus.answers.lock().expect("answers") = vec![
        json!({ "ResponseCode": 1001, "ResponseMessage": "TXN UPLOADED" }),
        json!({ "ResponseCode": 0, "ResponseMessage": "APPROVED", "TransactionData": [
            { "Tag": "Card Number", "Value": "************9876" },
            { "Tag": "ApprovalCode", "Value": "PL0042" } ] }),
    ];
    let w = pos_world::pinelabs_world(Arc::clone(&plutus)).await;
    let invoice = w.bill(420).await;
    let station = pos_world::counter(&w).await;
    let t = pos_world::machine(
        &w,
        station,
        json!({ "provider": "pinelabs", "terminal_code": format!("PL-{}", pos_world::tag()) }),
    )
    .await;
    let (code, sale) = start(
        &w,
        t["id"].as_str().expect("id").parse().expect("uuid"),
        Some(invoice),
        420,
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{sale}");
    let id = sale["transaction_id"].as_str().expect("id").to_owned();
    let upload = plutus.uploads.lock().expect("uploads")[0].clone();
    assert_eq!(
        (
            upload["Amount"].as_i64(),
            upload["TransactionNumber"].as_str()
        ),
        (Some(42_000), Some(id.as_str()))
    );
    assert_eq!(upload["MerchantID"], "pl-merchant-id");

    assert_eq!(status(&w, &id).await["stage"], "waiting");
    let approved = status(&w, &id).await;
    assert_eq!(approved["stage"], "approved", "{approved}");
    assert_eq!(
        (
            approved["card_last4"].as_str(),
            approved["auth_code"].as_str()
        ),
        (Some("9876"), Some("PL0042"))
    );
    status(&w, &id).await;
    assert_eq!(
        w.payments(invoice).await,
        vec![(rupees(420), "card".to_owned(), Some("7700123".to_owned()))]
    );
    assert_eq!(
        *plutus.status_polls.lock().expect("polls"),
        2,
        "a settled sale is not asked again"
    );
}

/// Who may do what: a cashier without the collect permission cannot start
/// a sale; a cashier cannot register or test machines, drive them as a
/// bridge, or play the patient at the simulator.
#[tokio::test]
async fn each_door_has_its_own_key() {
    let w = pos_world::world().await;
    let invoice = w.bill(100).await;
    let terminal = pos_world::simulator_machine(&w).await;
    let no_collect = common::provision_staff(
        &w.app,
        &w.csrf,
        "billing_clerk",
        &["billing.payments.create"],
    )
    .await;
    let clerk = common::provision_staff(
        &w.app,
        &w.csrf,
        "billing_clerk",
        &["billing.terminals.manage"],
    )
    .await;
    let post = |s: &common::Staff, path: &str, body: Value| {
        s.client
            .post(w.app.url(path))
            .header("x-csrf-token", &s.csrf)
            .json(&body)
            .send()
    };
    let body = json!({ "terminal_id": terminal, "invoice_id": invoice, "amount": 100 });
    let code = |r: reqwest::Response| r.status().as_u16();
    assert_eq!(
        code(
            post(&no_collect, "/api/payments/pos-sale", body.clone())
                .await
                .expect("req")
        ),
        403
    );
    assert_eq!(
        code(
            post(
                &clerk,
                "/api/payments/terminals",
                json!({ "provider": "simulator", "label": "x" })
            )
            .await
            .expect("req")
        ),
        403
    );
    assert_eq!(
        code(
            post(
                &clerk,
                "/api/payments/terminal-jobs/claim",
                json!({ "terminals": [] })
            )
            .await
            .expect("req")
        ),
        403
    );
    assert_eq!(
        code(
            post(
                &clerk,
                &format!("/api/payments/terminals/{terminal}/ping"),
                json!({})
            )
            .await
            .expect("req")
        ),
        403
    );
    let (_, sale) = start(&w, terminal, Some(invoice), 100).await;
    let id = sale["transaction_id"].as_str().expect("id");
    assert_eq!(
        code(
            post(
                &clerk,
                &format!("/api/payments/simulator/sales/{id}"),
                json!({ "outcome": "approve" })
            )
            .await
            .expect("req")
        ),
        403
    );
    assert!(w.payments(invoice).await.is_empty());
}
