//! Balance payment links and partial payments (#4871).
//!
//! Against the provider stand-ins (`online_world`), for each provider with
//! payment links (Razorpay, Cashfree): a link for a bill's balance, paid in
//! full or in parts with cash for the rest; each part posted once; a link
//! the balance outgrew cancelled at the provider and replaced; money paid on
//! a link after the counter settled the bill handed to finance as a refund
//! due; the message carrying the real URL; a desk without the lane refused;
//! a provider without links answering 422.

mod collect_world;
mod common;
mod online_world;
mod payments_world;

use std::sync::Arc;

use axum::http::StatusCode;
use medbrains_outbox::Handler as _;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use tokio::sync::Mutex;
use uuid::Uuid;

use collect_world::{bill, collect, collect_body, desk, key, money, patient};
use online_world::notices::{cashfree_link_order, link_expired, link_part};
use online_world::{Online, online};

/// The tests share the tenant's payment settings.
static SERIAL: Mutex<()> = Mutex::const_new(());

/// The providers that make payment links.
const LINK_PROVIDERS: [&str; 2] = ["razorpay", "cashfree"];

fn rupees(n: i64) -> Decimal {
    Decimal::from(n)
}

async fn make_link(o: &Online, body: Value) -> (StatusCode, Value) {
    o.w.call("POST", "/api/payments/links", body).await
}

/// A link for the whole of one bill, copied by the cashier: (id, provider ref, url).
async fn link_for(o: &Online, p: Uuid, invoice: Uuid) -> (Uuid, String, String) {
    let (code, link) = make_link(
        o,
        json!({ "patient_id": p, "scope": "all", "invoice_ids": [invoice], "channel": "copy" }),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{link}");
    let id: Uuid = link["id"].as_str().expect("id").parse().expect("uuid");
    (
        id,
        provider_ref(o, id).await,
        link["short_url"].as_str().expect("url").to_owned(),
    )
}

async fn provider_ref(o: &Online, id: Uuid) -> String {
    sqlx::query_scalar("SELECT provider_link_id FROM payment_links WHERE id = $1")
        .bind(id)
        .fetch_one(&o.w.app.db)
        .await
        .expect("provider ref")
}

/// The link as the screens read it.
async fn read(o: &Online, id: Uuid) -> Value {
    let (code, link) =
        o.w.call("GET", &format!("/api/payments/links/{id}"), json!(null))
            .await;
    assert_eq!(code, StatusCode::OK, "{link}");
    link
}

/// The payer pays `paise` on the link; `so_far` includes it.
async fn pay_part(
    o: &Online,
    provider: &str,
    link: &str,
    paise: i64,
    so_far: i64,
    whole: bool,
) -> String {
    let payment = format!("pay{}", &Uuid::new_v4().simple().to_string()[..12]);
    // Cashfree's link notice names no method: its order's payment does.
    o.stand.pay(&cashfree_link_order(link), paise, "upi");
    let body = link_part(provider, link, &payment, paise, so_far, whole);
    assert_eq!(o.notify(provider, &body, false).await, StatusCode::OK);
    payment
}

/// Run the queued `payment.balance_link.refresh` for a link, as the worker would.
async fn refresh(o: &Online, link: Uuid) -> Value {
    let handler = medbrains_payment_gateway::balance_link::refresh::BalanceLinkRefreshHandler;
    let queued: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM outbox_events WHERE event_type = $1 AND aggregate_id = $2",
    )
    .bind(handler.event_type())
    .bind(link)
    .fetch_one(&o.w.app.db)
    .await
    .expect("queued");
    assert_eq!(queued, 1, "the balance change queued one refresh");
    let mut secrets = common::TestSecrets::default();
    for (code, base) in &o.bases {
        secrets = secrets.with(
            &format!("{}_API_BASE_OVERRIDE", code.to_ascii_uppercase()),
            base.clone(),
        );
    }
    let ctx = medbrains_outbox::HandlerCtx {
        pool: o.w.app.db.clone(),
        tenant_id: o.w.tenant,
        event_id: Uuid::new_v4(),
        event_type: handler.event_type().to_owned(),
        actor_user_id: None,
        attempts: 0,
        secret_resolver: Arc::new(secrets),
        http_client: reqwest::Client::new(),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-test-docs"),
        )),
    };
    handler
        .handle(&ctx, &json!({ "link_id": link }))
        .await
        .expect("refreshed")
}

async fn cash(o: &Online, p: Uuid, invoice: Uuid, amount: i64) {
    let body = collect_body(
        p,
        json!({ "scope": "all", "invoice_ids": [invoice] }),
        json!([{ "mode": "cash", "amount": amount }]),
        &key(),
    );
    let (code, done) = collect(&o.w, body).await;
    assert_eq!(code, StatusCode::OK, "{done}");
}

/// Given a ₹1,000 bill, When the cashier makes a link and the patient pays
/// it in full, Then ₹1,000 posts once in the mode it was paid by, the bill is
/// paid and the link reads paid — for every provider with links.
#[tokio::test]
async fn a_link_paid_in_full_pays_the_bill() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for provider in LINK_PROVIDERS {
        o.use_provider(provider).await;
        let p = patient(&o.w).await;
        let invoice = bill(&o.w, p, "opd", 1000, true).await;
        let (id, link, url) = link_for(&o, p, invoice).await;
        assert!(url.starts_with("https://"), "{url}");
        pay_part(&o, provider, &link, 100_000, 100_000, true).await;
        assert_eq!(
            o.w.invoice(invoice).await,
            (rupees(1000), "paid".to_owned()),
            "{provider}"
        );
        let payments = o.w.payments(invoice).await;
        assert_eq!(payments.len(), 1, "{provider}");
        assert_eq!(payments[0].1, "upi", "{provider}");
        assert_eq!(read(&o, id).await["status"], "paid", "{provider}");
    }
}

/// Given a ₹1,000 bill and a link that accepts parts, When the patient pays
/// ₹300 and then ₹200 by link, Then each part posts once and the bill is
/// part-paid ₹500 of ₹1,000; When the counter takes the last ₹500 in cash,
/// Then the bill is paid and the link is cancelled at the provider, so it
/// can never be paid again.
#[tokio::test]
async fn two_parts_by_link_then_cash_for_the_rest_closes_the_link() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for provider in LINK_PROVIDERS {
        o.use_provider(provider).await;
        let p = patient(&o.w).await;
        let invoice = bill(&o.w, p, "opd", 1000, true).await;
        let (id, link, _) = link_for(&o, p, invoice).await;
        let asked = o
            .stand
            .links
            .lock()
            .expect("links")
            .last()
            .cloned()
            .expect("asked");
        let partial = if provider == "cashfree" {
            asked["link_partial_payments"].clone()
        } else {
            asked["accept_partial"].clone()
        };
        assert_eq!(
            partial,
            json!(true),
            "{provider} link accepts parts: {asked}"
        );

        pay_part(&o, provider, &link, 30_000, 30_000, false).await;
        pay_part(&o, provider, &link, 20_000, 50_000, false).await;
        assert_eq!(
            o.w.invoice(invoice).await,
            (rupees(500), "partially_paid".to_owned())
        );
        let view = read(&o, id).await;
        assert_eq!(view["status"], "partially_paid", "{provider}");
        assert_eq!(money(&view["amount_paid"]), rupees(500));

        cash(&o, p, invoice, 500).await;
        assert_eq!(
            o.w.invoice(invoice).await,
            (rupees(1000), "paid".to_owned())
        );
        refresh(&o, id).await;
        assert!(
            o.stand.cancelled.lock().expect("c").contains(&link),
            "{provider}"
        );
        let view = read(&o, id).await;
        assert_eq!(view["status"], "cancelled");
        assert_eq!(view["end_reason"], "settled");
        assert_eq!(
            o.w.payments(invoice).await.len(),
            3,
            "two parts and the cash"
        );
    }
}

/// Given a ₹1,000 link, When ₹400 is taken at the counter, Then the old link
/// is cancelled at the provider and a ₹600 link replaces it — a stale ₹1,000
/// can never be paid.
#[tokio::test]
async fn a_balance_change_replaces_the_link() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for provider in LINK_PROVIDERS {
        o.use_provider(provider).await;
        let p = patient(&o.w).await;
        let invoice = bill(&o.w, p, "opd", 1000, true).await;
        let (id, link, _) = link_for(&o, p, invoice).await;
        cash(&o, p, invoice, 400).await;
        let done = refresh(&o, id).await;
        assert!(o.stand.cancelled.lock().expect("c").contains(&link));
        let new_id: Uuid = done["replaced_by"]
            .as_str()
            .expect("replaced")
            .parse()
            .expect("uuid");
        let new = read(&o, new_id).await;
        assert_eq!(money(&new["amount"]), rupees(600), "{provider}");
        assert_eq!(new["replaces_id"], json!(id));
        assert_eq!(read(&o, id).await["status"], "cancelled");
    }
}

/// Given a link, When the counter settles the bill in cash and the patient
/// then pays the link anyway (before it could be cancelled), Then nothing
/// more lands on the bill and the money goes to finance as a refund due.
#[tokio::test]
async fn a_link_paid_after_the_counter_settled_is_a_refund_due() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for provider in LINK_PROVIDERS {
        o.use_provider(provider).await;
        let p = patient(&o.w).await;
        let invoice = bill(&o.w, p, "opd", 1000, true).await;
        let (_, link, _) = link_for(&o, p, invoice).await;
        cash(&o, p, invoice, 1000).await;
        pay_part(&o, provider, &link, 100_000, 100_000, true).await;
        assert_eq!(
            o.w.invoice(invoice).await,
            (rupees(1000), "paid".to_owned())
        );
        assert_eq!(o.w.payments(invoice).await.len(), 1, "only the cash");
        assert_eq!(
            o.w.exceptions(&link).await,
            vec![("refund_due".to_owned(), Some(rupees(1000)))],
            "{provider}"
        );
    }
}

/// Given a part paid by link, When the provider delivers its notice twice,
/// Then the part posts once.
#[tokio::test]
async fn a_repeated_notice_posts_once() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    for provider in LINK_PROVIDERS {
        o.use_provider(provider).await;
        let p = patient(&o.w).await;
        let invoice = bill(&o.w, p, "opd", 1000, true).await;
        let (_, link, _) = link_for(&o, p, invoice).await;
        o.stand.pay(&cashfree_link_order(&link), 40_000, "upi");
        let payment = format!("pay{}", &Uuid::new_v4().simple().to_string()[..12]);
        let body = link_part(provider, &link, &payment, 40_000, 40_000, false);
        assert_eq!(o.notify(provider, &body, false).await, StatusCode::OK);
        assert_eq!(o.notify(provider, &body, false).await, StatusCode::OK);
        assert_eq!(o.w.payments(invoice).await.len(), 1, "{provider}");
        assert_eq!(o.w.invoice(invoice).await.0, rupees(400));
    }
}

/// Given a link sent by SMS, Then the queued SMS carries the link's real URL
/// and the amount; When the provider says the link expired, Then it reads
/// expired.
#[tokio::test]
async fn the_sms_carries_the_url_and_an_expired_link_reads_expired() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    o.use_provider("razorpay").await;
    let p = patient(&o.w).await;
    let invoice = bill(&o.w, p, "opd", 750, true).await;
    let (code, link) = make_link(
        &o,
        json!({ "patient_id": p, "scope": "all", "invoice_ids": [invoice], "channel": "sms" }),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{link}");
    let id = link["id"].as_str().expect("id");
    let url = link["short_url"].as_str().expect("url");
    let sent = o.w.app.outbox_rows("sms.payment_link", id).await;
    assert_eq!(sent.len(), 1);
    let text = sent[0]["body"].as_str().unwrap_or_default();
    assert!(text.contains(url) && text.contains("750"), "{text}");
    assert!(
        sent[0]["to"]
            .as_str()
            .unwrap_or_default()
            .starts_with("+91")
    );

    // WhatsApp without the patient's yes is refused before any link is made.
    let (code, why) = make_link(
        &o,
        json!({ "patient_id": p, "scope": "all", "invoice_ids": [invoice], "channel": "whatsapp" }),
    )
    .await;
    assert_eq!(code, StatusCode::BAD_REQUEST, "{why}");

    let plink = provider_ref(&o, id.parse().expect("uuid")).await;
    assert_eq!(
        o.notify("razorpay", &link_expired("razorpay", &plink), false)
            .await,
        StatusCode::OK
    );
    assert_eq!(
        read(&o, id.parse().expect("uuid")).await["status"],
        "expired"
    );
}

/// A pharmacy desk cannot send a link for an OPD bill (403, nothing made);
/// a provider without links answers 422 naming it.
#[tokio::test]
async fn a_desk_without_the_lane_and_a_provider_without_links_are_refused() {
    let _serial = SERIAL.lock().await;
    let o = online().await;
    o.use_provider("razorpay").await;
    let p = patient(&o.w).await;
    let invoice = bill(&o.w, p, "opd", 500, true).await;
    let pharmacy = desk(&o.w, "pharmacist", &[], &[p]).await;
    let made = o.stand.links.lock().expect("links").len();
    let body =
        json!({ "patient_id": p, "scope": "all", "invoice_ids": [invoice], "channel": "copy" });
    let (code, why) =
        collect_world::as_staff(&o.w, &pharmacy, "POST", "/api/payments/links", body.clone()).await;
    assert_eq!(code, StatusCode::FORBIDDEN, "{why}");
    assert_eq!(
        o.stand.links.lock().expect("links").len(),
        made,
        "no link was made"
    );

    o.use_provider("phonepe").await;
    let (code, why) = make_link(&o, body).await;
    assert_eq!(code, StatusCode::UNPROCESSABLE_ENTITY, "{why}");
    assert_eq!(why["capability"], "payment_links");
}
