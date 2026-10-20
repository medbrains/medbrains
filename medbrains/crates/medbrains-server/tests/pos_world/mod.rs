#![allow(dead_code, unreachable_pub)]

//! The world the card-machine tests (#4874) run in: a hospital with the
//! card-machine simulator on, a counter with a machine, issued bills, and —
//! for Pine Labs and Razorpay POS — a stand-in Plutus Cloud and a stand-in
//! Ezetap p2padapter the server is pointed at through their
//! `*_API_BASE_OVERRIDE` secrets. Only the provider's boundary is stood in,
//! answering in the shapes Pine Labs' spec and Odoo's shipping adapters use.

use std::sync::{Arc, Mutex};

use axum::http::StatusCode;
use axum::{
    Json, Router,
    extract::{Path, State},
    routing::post,
};
use medbrains_payment_gateway::pos::{ezetap, pinelabs, simulator};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;
use crate::payments_world::{Razorpay, World};

pub fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_uppercase()
}

/// A hospital with the simulator on.
pub async fn world() -> World {
    world_with(common::TestSecrets::default()).await
}

pub async fn world_with(secrets: common::TestSecrets) -> World {
    let app = common::spawn_app_with_secrets(secrets.with(simulator::ENV_FLAG, "true")).await;
    let csrf = app.login_admin().await;
    let tenant = admin_tenant(&app).await;
    World {
        app,
        csrf,
        tenant,
        razorpay: Arc::new(Razorpay::default()),
    }
}

pub async fn admin_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar(
        "SELECT t.id FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant")
}

/// A billing counter of the test's own.
pub async fn counter(w: &World) -> Uuid {
    let t = tag();
    let (status, station) = w
        .call(
            "POST",
            "/api/stations",
            json!({ "code": format!("POS-{t}"), "name": format!("Counter {t}"),
                    "station_type": "billing_counter" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{station}");
    station["id"]
        .as_str()
        .expect("station")
        .parse()
        .expect("uuid")
}

/// A card machine at `station`, registered through the settings API.
pub async fn machine(w: &World, station: Uuid, body: Value) -> Value {
    let mut req = json!({ "kind": "pos", "label": format!("Card machine {}", tag()),
                          "station_id": station });
    if let (Some(r), Value::Object(extra)) = (req.as_object_mut(), body) {
        r.extend(extra);
    }
    let (status, terminal) = w.call("POST", "/api/payments/terminals", req).await;
    assert_eq!(status, StatusCode::OK, "{terminal}");
    terminal
}

pub async fn simulator_machine(w: &World) -> Uuid {
    let station = counter(w).await;
    let t = machine(
        w,
        station,
        json!({ "provider": "simulator", "connection": "cloud" }),
    )
    .await;
    t["id"].as_str().expect("id").parse().expect("uuid")
}

/// Start a card sale for `amount` rupees on `terminal`.
pub async fn start(
    w: &World,
    terminal: Uuid,
    invoice: Option<Uuid>,
    amount: i64,
) -> (StatusCode, Value) {
    w.call(
        "POST",
        "/api/payments/pos-sale",
        json!({ "terminal_id": terminal, "invoice_id": invoice, "amount": amount }),
    )
    .await
}

/// Start a sale for a bill with the cashier's tender (card | upi | either).
pub async fn start_as(
    w: &World,
    terminal: Uuid,
    invoice: Uuid,
    amount: i64,
    tender: &str,
) -> Value {
    let (code, sale) = w
        .call(
            "POST",
            "/api/payments/pos-sale",
            json!({ "terminal_id": terminal, "invoice_id": invoice, "amount": amount,
                    "tender": tender }),
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{sale}");
    sale
}

/// A card machine of `provider` at a counter of its own; its id.
pub async fn provider_machine(w: &World, provider: &str, serial: &str) -> Uuid {
    let station = counter(w).await;
    let t = machine(
        w,
        station,
        json!({ "provider": provider, "terminal_code": serial }),
    )
    .await;
    t["id"].as_str().expect("id").parse().expect("uuid")
}

/// The sale's age moved past the answer window, as if the machine never answered.
pub async fn outlive_window(w: &World, sale: &str) {
    sqlx::query(
        "UPDATE payment_gateway_transactions SET created_at = now() - interval '7 minutes' \
          WHERE id = $1::uuid",
    )
    .bind(sale)
    .execute(&w.app.db)
    .await
    .expect("backdate");
}

pub async fn status(w: &World, sale: &str) -> Value {
    let (code, body) = w
        .call(
            "GET",
            &format!("/api/payments/pos-sale/{sale}"),
            Value::Null,
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{body}");
    body
}

/// The person at the simulated machine.
pub async fn card_does(w: &World, sale: &str, outcome: Value) {
    let (code, body) = w
        .call(
            "POST",
            &format!("/api/payments/simulator/sales/{sale}"),
            outcome,
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{body}");
}

/// How many payments the gateway rows of this bill hold, and its paid amount.
pub async fn captured_rows(w: &World, invoice: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM payment_gateway_transactions WHERE invoice_id = $1 AND status = 'captured'",
    )
    .bind(invoice)
    .fetch_one(&w.app.db)
    .await
    .expect("rows")
}

// ── A stand-in Plutus Cloud ────────────────────────────────────────────────

/// What the stand-in Plutus was asked, and how it answers status polls.
#[derive(Default)]
pub struct Plutus {
    pub uploads: Mutex<Vec<Value>>,
    pub status_polls: Mutex<u32>,
    /// Status answers, in order; the last repeats.
    pub answers: Mutex<Vec<Value>>,
    pub cancels: Mutex<Vec<Value>>,
    /// How `CancelTransactionForced` answers; accepted when unset.
    pub cancel_answer: Mutex<Option<Value>>,
}

impl Plutus {
    /// From the next poll on, status answers `answer`.
    pub fn now_answers(&self, answer: Value) {
        let polls = *self.status_polls.lock().expect("polls") as usize;
        let mut answers = self.answers.lock().expect("answers");
        answers.truncate(polls);
        answers.resize(polls, json!({ "ResponseCode": 1001 }));
        answers.push(answer);
    }
}

/// Plutus's approval, with the spec's `TransactionData` tags.
pub fn plutus_approval(mode: &str) -> Value {
    json!({ "ResponseCode": 0, "ResponseMessage": "TXN APPROVED",
            "PlutusTransactionReferenceID": 7_700_123, "TransactionData": [
        { "Tag": "Card Number", "Value": "************9876" },
        { "Tag": "ApprovalCode", "Value": "PL0042" },
        { "Tag": "RRN", "Value": "429011223344" },
        { "Tag": "PaymentMode", "Value": mode },
        { "Tag": "AmountInPaisa", "Value": "42000" } ] })
}

async fn plutus_cancel(State(p): State<Arc<Plutus>>, Json(body): Json<Value>) -> Json<Value> {
    p.cancels.lock().expect("cancels").push(body);
    Json(
        p.cancel_answer
            .lock()
            .expect("cancel answer")
            .clone()
            .unwrap_or_else(|| json!({ "ResponseCode": 0, "ResponseMessage": "APPROVED" })),
    )
}

async fn upload(State(p): State<Arc<Plutus>>, Json(body): Json<Value>) -> Json<Value> {
    p.uploads.lock().expect("uploads").push(body);
    Json(json!({ "ResponseCode": 0, "ResponseMessage": "APPROVED",
                 "PlutusTransactionReferenceID": 7_700_123 }))
}

async fn txn_status(State(p): State<Arc<Plutus>>, Json(_): Json<Value>) -> Json<Value> {
    let mut polls = p.status_polls.lock().expect("polls");
    *polls += 1;
    let answers = p.answers.lock().expect("answers");
    let i = (*polls as usize - 1).min(answers.len().saturating_sub(1));
    Json(
        answers
            .get(i)
            .cloned()
            .unwrap_or_else(|| json!({ "ResponseCode": 1001 })),
    )
}

pub async fn spawn_plutus(p: Arc<Plutus>) -> String {
    let app = Router::new()
        .route("/UploadBilledTransaction", post(upload))
        .route("/GetCloudBasedTxnStatus", post(txn_status))
        .route("/CancelTransactionForced", post(plutus_cancel))
        .with_state(p);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}")
}

/// A hospital whose Pine Labs keys are set and whose Plutus is the stand-in.
pub async fn pinelabs_world(plutus: Arc<Plutus>) -> World {
    let base = spawn_plutus(plutus).await;
    // Spawned once to learn the hospital's id the keys are filed under.
    let first = common::spawn_app().await;
    let tenant = admin_tenant(&first).await;
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    let mut secrets = common::TestSecrets::default().with(pinelabs::API_BASE_OVERRIDE, base);
    for name in ["merchant-id", "security-token", "client-id", "store-id"] {
        secrets = secrets.with(
            &format!("medbrains/{env}/{tenant}/pinelabs-{name}"),
            format!("pl-{name}"),
        );
    }
    world_with(secrets).await
}

// ── A stand-in Ezetap p2padapter (Razorpay POS) ───────────────────────────

/// The path the stand-in serves, as Ezetap's own hosts do.
pub const P2P_ADAPTER: &str = "/api/3.0/p2padapter";

/// What the stand-in Ezetap was asked (path, body), and how it answers.
#[derive(Default)]
pub struct Ezetap {
    pub calls: Mutex<Vec<(String, Value)>>,
    /// How `pay` answers; a numeric `p2pRequestId` when unset (as Odoo's test).
    pub pay_answer: Mutex<Option<Value>>,
    /// Status answers, in order; the last repeats.
    pub answers: Mutex<Vec<Value>>,
}

async fn ezetap_call(
    State(e): State<Arc<Ezetap>>,
    Path(endpoint): Path<String>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let polls = {
        let mut calls = e.calls.lock().expect("calls");
        calls.push((endpoint.clone(), body));
        calls.iter().filter(|(p, _)| p == "status").count()
    };
    Json(match endpoint.as_str() {
        "pay" => e
            .pay_answer
            .lock()
            .expect("pay")
            .clone()
            .unwrap_or_else(|| json!({ "success": true, "p2pRequestId": 250_102 })),
        "status" => {
            let answers = e.answers.lock().expect("answers");
            answers
                .get((polls - 1).min(answers.len().saturating_sub(1)))
                .cloned()
                .unwrap_or_else(|| json!({ "success": true, "messageCode": "P2P_DEVICE_SENT" }))
        }
        "cancel" => json!({ "success": true }),
        _ => json!({ "success": false, "errorMessage": "not found" }),
    })
}

impl Ezetap {
    /// (endpoint, body) of every call to `endpoint`.
    pub fn asked(&self, endpoint: &str) -> Vec<Value> {
        self.calls
            .lock()
            .expect("calls")
            .iter()
            .filter(|(p, _)| p == endpoint)
            .map(|(_, b)| b.clone())
            .collect()
    }
}

/// A hospital whose Razorpay POS keys are set and whose Ezetap is the stand-in.
pub async fn ezetap_world(e: Arc<Ezetap>) -> World {
    let app = Router::new()
        .route(&format!("{P2P_ADAPTER}/{{endpoint}}"), post(ezetap_call))
        .with_state(e);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    let first = common::spawn_app().await;
    let tenant = admin_tenant(&first).await;
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    let secrets = common::TestSecrets::default()
        .with(
            ezetap::API_BASE_OVERRIDE,
            format!("http://{addr}{P2P_ADAPTER}"),
        )
        .with(
            &format!("medbrains/{env}/{tenant}/ezetap-app-key"),
            "ez-app-key",
        )
        .with(
            &format!("medbrains/{env}/{tenant}/ezetap-username"),
            "1234500121",
        );
    world_with(secrets).await
}
