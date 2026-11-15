//! UHI physical consultation against NHA's current docs
//! (docs.abdm.gov.in/docs/uhi/v1/services/consultation), #5702 and #5704:
//! `select` is refused; the app's `on_update` and `on_message` are taken;
//! search is two-stage with stable slot UUIDs; `init` holds the slot for 15
//! minutes and offers five terms; `confirm` needs them agreed, books once,
//! and answers with a PIN that is kept only as a hash, never logged, and
//! checked at the desk.

use crate::common;
use crate::uhi_world;

use std::fmt::Write as _;
use std::sync::{Arc, Mutex};

use axum::http::StatusCode;
use chrono::{Duration, Utc};
use medbrains_server::routes::uhi::protocol::{CONSULTATION_DOMAIN, CORE_VERSION};
use serde_json::{Value, json};
use tracing::field::{Field, Visit};
use tracing_subscriber::layer::{Context, Layer, SubscriberExt};
use uhi_world::{SERIAL, World, agree, doctor, world};
use uuid::Uuid;

fn txn() -> String {
    Uuid::new_v4().to_string()
}

fn tomorrow() -> chrono::NaiveDate {
    (Utc::now() + Duration::days(1)).date_naive()
}

/// The intent of a search tomorrow for a visit, narrowed by `agent`.
fn intent(agent: Value) -> Value {
    let day = tomorrow();
    json!({ "intent": { "fulfillment": { "type": "Physical", "agent": agent,
        "start": { "time": { "timestamp": format!("{day}T00:00:00") } },
        "end": { "time": { "timestamp": format!("{day}T23:59:59") } } } } })
}

/// The app's direct search for doctor `name`: the slots on_search offers.
async fn slots(w: &World, id: &str, name: &str) -> Vec<Value> {
    let search = w.message(
        CONSULTATION_DOMAIN,
        "search",
        id,
        intent(json!({ "name": name })),
    );
    w.call("search", &search).await;
    let on_search = w.deliver(id, "on_search").await;
    on_search.body["message"]["catalog"]["providers"][0]["fulfillments"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

/// The order an app sends on init and confirm for `slot`.
fn order_for(slot: &Value) -> Value {
    json!({ "order": { "item": { "id": "0", "fulfillment_id": slot["id"] },
        "fulfillment": { "id": slot["id"], "type": "Physical",
            "tags": { "@abdm/gov.in/slot_id": slot["id"] } },
        "billing": { "name": "Asha Rao", "phone": "9876500077" },
        "customer": { "id": "asha.rao@sbx" } } })
}

/// Send init for `slot` in transaction `id`; the on_init order.
async fn init(w: &World, id: &str, slot: &Value) -> Value {
    let message = w.message(CONSULTATION_DOMAIN, "init", id, order_for(slot));
    w.call("init", &message).await;
    w.deliver(id, "on_init").await.body["message"].clone()
}

/// Send confirm with `order`; the on_confirm body.
async fn confirm(w: &World, id: &str, order: Value) -> Value {
    w.call(
        "confirm",
        &w.message(CONSULTATION_DOMAIN, "confirm", id, order),
    )
    .await;
    w.deliver(id, "on_confirm").await.body
}

async fn appointments(w: &World, id: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM uhi_transactions u JOIN appointments a ON a.id = u.appointment_id \
          WHERE u.transaction_id = $1 AND a.status <> 'cancelled'",
    )
    .bind(id)
    .fetch_one(&w.app.db)
    .await
    .expect("count")
}

/// Given a consultation, When the app sends select, Then it is refused with
/// a NACK and nothing is answered; an on_update or on_message about a
/// transaction never seen is refused too.
#[tokio::test]
async fn select_is_refused_and_callbacks_need_a_known_order() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (_, name) = doctor(&w).await;
    let id = txn();
    let open = slots(&w, &id, &name).await;
    let before = w.outbox_count(&id).await;
    let select = w.message(CONSULTATION_DOMAIN, "select", &id, order_for(&open[0]));
    let (status, nack) = w.send("select", &select, Some(&w.eua), false).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{nack}");
    assert_eq!(nack["message"]["ack"]["status"], "NACK");
    assert_eq!(nack["error"]["code"], "UHI-1404");
    assert_eq!(
        w.outbox_count(&id).await,
        before,
        "a refused select is never answered"
    );
    for action in ["on_update", "on_message"] {
        let stray = w.message(CONSULTATION_DOMAIN, action, &txn(), json!({ "order": {} }));
        let (status, _) = w.send(action, &stray, Some(&w.eua), false).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{action} about no order");
    }
}

/// Given a doctor with open visit slots, When a search comes through the
/// gateway, Then it lists the doctor once by HPR ID with no slots; When the
/// app searches directly, Then each slot carries a UUID as its fulfilment id
/// and slot tag, stable across searches, with the docs' constants.
#[tokio::test]
async fn search_is_two_stage_with_stable_slot_uuids() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (_, name) = doctor(&w).await;
    let id = txn();
    let gateway = w.message(
        CONSULTATION_DOMAIN,
        "search",
        &id,
        intent(json!({ "name": name })),
    );
    let (status, _) = w.send("search", &gateway, None, true).await;
    assert_eq!(status, StatusCode::OK);
    let listed = w.deliver(&id, "on_search").await.body;
    let doctors = &listed["message"]["catalog"]["providers"][0]["fulfillments"];
    assert_eq!(doctors.as_array().map(Vec::len), Some(1), "{doctors}");
    assert_eq!(
        doctors[0]["id"], doctors[0]["agent"]["id"],
        "the doctor by HPR ID"
    );
    assert!(
        doctors[0].get("tags").is_none(),
        "no slot named before the direct search"
    );

    let open = slots(&w, &txn(), &name).await;
    let first = &open[0];
    let uuid = first["id"].as_str().expect("slot id");
    assert!(Uuid::parse_str(uuid).is_ok(), "{uuid}");
    assert_eq!(first["tags"]["@abdm/gov.in/slot_id"], uuid);
    assert_eq!(first["type"], "Physical");
    let again = slots(&w, &txn(), &name).await;
    assert_eq!(again[0]["id"], uuid, "the same slot keeps its UUID");

    let id = txn();
    let mut on_search = slots(&w, &id, &name).await;
    let body = w.deliver(&id, "on_search").await.body;
    assert_eq!(body["context"]["domain"], "nic2004:85111");
    assert_eq!(body["context"]["core_version"], CORE_VERSION);
    let item = &body["message"]["catalog"]["providers"][0]["items"][0];
    assert_eq!(
        item["descriptor"],
        json!({ "name": "Consultation", "code": "Consultation" })
    );
    let on_init = init(&w, &id, &on_search.remove(0)).await;
    assert_eq!(on_init["order"]["payment"]["status"], "NOT_PAID");
}

/// Given an init for a slot, Then on_init has the order id and five terms
/// INITIATED, and the slot is held 15 minutes: another app neither sees nor
/// can init it; once the hold lapses, it is offered again.
#[tokio::test]
async fn init_holds_the_slot_for_fifteen_minutes() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (_, name) = doctor(&w).await;
    let id = txn();
    let open = slots(&w, &id, &name).await;
    let on_init = init(&w, &id, &open[0]).await;
    let order = &on_init["order"];
    let row = w.row(&id).await;
    assert_eq!(order["id"], row.to_string());
    let terms = order["terms"].as_array().expect("terms");
    let kinds: Vec<&str> = terms.iter().filter_map(|t| t["type"].as_str()).collect();
    assert_eq!(
        kinds,
        [
            "Commercial",
            "Settlement",
            "Cancellation",
            "Refund",
            "Payment"
        ]
    );
    assert!(
        terms.iter().all(|t| t["termsState"] == "INITIATED"),
        "{terms:?}"
    );
    let minutes: f64 = sqlx::query_scalar(
        "SELECT extract(epoch FROM slot_held_until - now())::float8 / 60 \
           FROM uhi_transactions WHERE id = $1",
    )
    .bind(row)
    .fetch_one(&w.app.db)
    .await
    .expect("hold");
    assert!((14.0..=15.0).contains(&minutes), "held {minutes} minutes");

    let other = txn();
    let seen = slots(&w, &other, &name).await;
    assert!(
        seen.iter().all(|s| s["id"] != open[0]["id"]),
        "a held slot is not offered"
    );
    let refused = init(&w, &other, &open[0]).await;
    assert!(refused["order"].is_null(), "{refused}");

    sqlx::query(
        "UPDATE uhi_transactions SET slot_held_until = now() - interval '1 second' WHERE id = $1",
    )
    .bind(row)
    .execute(&w.app.db)
    .await
    .expect("lapse");
    let freed = slots(&w, &txn(), &name).await;
    assert_eq!(
        freed[0]["id"], open[0]["id"],
        "a lapsed hold frees the slot"
    );
}

/// Captures every event field and span attribute, to prove what never
/// reaches a log.
#[derive(Clone, Default)]
struct Capture(Arc<Mutex<String>>);

struct Fields<'a>(&'a mut String);

impl Visit for Fields<'_> {
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        let _ = write!(self.0, " {}={value:?}", field.name());
    }
}

impl<S: tracing::Subscriber> Layer<S> for Capture {
    fn on_event(&self, event: &tracing::Event<'_>, _ctx: Context<'_, S>) {
        if let Ok(mut log) = self.0.lock() {
            event.record(&mut Fields(&mut log));
        }
    }

    fn on_new_span(
        &self,
        attrs: &tracing::span::Attributes<'_>,
        _id: &tracing::span::Id,
        _ctx: Context<'_, S>,
    ) {
        if let Ok(mut log) = self.0.lock() {
            attrs.record(&mut Fields(&mut log));
        }
    }
}

/// Given a held slot, When confirm leaves a term INITIATED or names another
/// order, Then it is refused and nothing is booked; with all AGREED, Then
/// on_confirm is CONFIRMED with a GENERATED PIN and the messaging and
/// helpline tags; a repeated confirm books nothing more. The PIN is in no
/// log, no stored order and, once delivered, not in the outbox; the desk
/// checks it; the app's DOCTOR_NO_SHOW reaches the staff screen.
#[tokio::test]
async fn confirm_needs_agreed_terms_and_answers_with_a_pin() {
    let _serial = SERIAL.lock().await;
    let capture = Capture::default();
    let _logs =
        tracing::subscriber::set_default(tracing_subscriber::registry().with(capture.clone()));
    let w = world().await;
    let (_, name) = doctor(&w).await;
    let id = txn();
    let open = slots(&w, &id, &name).await;
    let base = order_for(&open[0]);
    let on_init = init(&w, &id, &open[0]).await["order"].clone();

    let mut half = agree(&base, &on_init);
    half["order"]["terms"][2]["termsState"] = json!("INITIATED");
    let refused = confirm(&w, &id, half).await;
    assert!(
        refused["error"]["message"]
            .as_str()
            .is_some_and(|m| m.contains("Cancellation"))
    );
    let mut stranger = agree(&base, &on_init);
    stranger["order"]["id"] = json!(Uuid::new_v4());
    assert!(confirm(&w, &id, stranger).await["error"].is_object());
    assert_eq!(
        appointments(&w, &id).await,
        0,
        "a refused confirm books nothing"
    );

    let confirmed = confirm(&w, &id, agree(&base, &on_init)).await["message"]["order"].clone();
    assert_eq!(confirmed["state"], "CONFIRMED", "{confirmed}");
    let auth = &confirmed["authorization"];
    assert_eq!(
        (auth["type"].as_str(), auth["status"].as_str()),
        (Some("PIN"), Some("GENERATED"))
    );
    let pin = auth["token"].as_str().expect("pin").to_owned();
    assert!(
        pin.len() == 4 && pin.bytes().all(|b| b.is_ascii_digit()),
        "{pin}"
    );
    let tags = &confirmed["fulfillment"]["tags"];
    assert!(tags["@abdm/gov.in/messaging_support"].is_string(), "{tags}");
    assert!(tags["@abdm/gov.in/helpline_number"].is_string(), "{tags}");
    assert_eq!(tags["@abdm/gov.in/slot_id"], open[0]["id"]);

    let again = confirm(&w, &id, agree(&base, &on_init)).await["message"]["order"].clone();
    assert_eq!(again["id"], confirmed["id"]);
    assert!(
        again["authorization"].get("token").is_none(),
        "a retry never repeats the PIN"
    );
    assert_eq!(appointments(&w, &id).await, 1, "booked once");

    let row = w.row(&id).await;
    let (stored, hash): (Value, String) =
        sqlx::query_as("SELECT order_details, pin_hash FROM uhi_transactions WHERE id = $1")
            .bind(row)
            .fetch_one(&w.app.db)
            .await
            .expect("row");
    assert!(stored["authorization"].get("token").is_none(), "{stored}");
    assert!(hash.starts_with("$argon2") && !hash.contains(&pin));
    let outbox: Vec<Value> = sqlx::query_scalar(
        "SELECT payload FROM outbox_events WHERE event_type = 'uhi.callback' \
           AND payload->'body'->'context'->>'transaction_id' = $1",
    )
    .bind(&id)
    .fetch_all(&w.app.db)
    .await
    .expect("outbox");
    assert!(
        outbox.iter().all(|p| p
            .pointer("/body/message/order/authorization/token")
            .is_none()),
        "a delivered on_confirm no longer holds the PIN"
    );

    check_pin_at_the_desk(&w, row, &pin).await;
    no_show_reaches_the_staff_screen(&w, &id, row).await;

    let uuid = regex::Regex::new(r"[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}").expect("regex");
    let logged = capture
        .0
        .lock()
        .map(|l| uuid.replace_all(&l, "").into_owned())
        .unwrap_or_default();
    assert!(logged.len() > 100, "the capture saw the flow");
    let leaked = regex::Regex::new(&format!(r"\b{pin}\b")).expect("regex");
    assert!(!leaked.is_match(&logged), "the PIN reached a log");
}

/// The desk: a wrong PIN says how many tries are left, the right one
/// matches; a role without the permission is refused.
async fn check_pin_at_the_desk(w: &World, row: Uuid, pin: &str) {
    let url = w.app.url(&format!("/api/uhi/requests/{row}/check-pin"));
    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let check = |code: &str| {
        desk.client
            .post(url.clone())
            .header("x-csrf-token", &desk.csrf)
            .json(&json!({ "pin": code }))
            .send()
    };
    let wrong = if pin == "0000" { "1111" } else { "0000" };
    let missed: Value = check(wrong)
        .await
        .expect("check")
        .json()
        .await
        .expect("json");
    assert_eq!(missed, json!({ "matched": false, "tries_left": 4 }));
    let matched: Value = check(pin).await.expect("check").json().await.expect("json");
    assert_eq!(matched["matched"], true);
    let lab = common::provision_staff(&w.app, &w.csrf, "lab_technician", &[]).await;
    let refused = lab
        .client
        .post(url)
        .header("x-csrf-token", &lab.csrf)
        .json(&json!({ "pin": pin }))
        .send()
        .await
        .expect("check");
    assert_eq!(refused.status().as_u16(), 403);
}

/// The app reports the doctor did not see the patient: ACKed, kept, shown
/// on the requests screen; a chat message is ACKed and not answered.
async fn no_show_reaches_the_staff_screen(w: &World, id: &str, row: Uuid) {
    let update = w.message(
        CONSULTATION_DOMAIN,
        "on_update",
        id,
        json!({ "order": { "id": row, "state": "DOCTOR_NO_SHOW" } }),
    );
    w.call("on_update", &update).await;
    let before = w.outbox_count(id).await;
    let chat = json!({ "intent": { "chat": { "content": {
        "content_value": "aGVsbG8=", "content_type": "text" } } } });
    w.call(
        "on_message",
        &w.message(CONSULTATION_DOMAIN, "on_message", id, chat),
    )
    .await;
    assert_eq!(
        w.outbox_count(id).await,
        before,
        "the app's callbacks are not answered"
    );
    let listed: Vec<Value> = w
        .app
        .client
        .get(w.app.url("/api/uhi/requests"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    let mine = listed
        .iter()
        .find(|r| r["id"] == row.to_string())
        .expect("listed");
    assert!(mine["doctor_no_show_at"].is_string(), "{mine}");
    assert_eq!(mine["has_pin"], true);
    assert!(mine["pin_verified_at"].is_string());
}
