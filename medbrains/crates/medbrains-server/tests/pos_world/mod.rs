#![allow(dead_code, unreachable_pub)]

//! The world the card-machine tests (#4874) run in: a hospital with the
//! card-machine simulator on, a counter with a machine, issued bills, and —
//! for Pine Labs — a stand-in Plutus Cloud the server is pointed at through
//! `PINELABS_API_BASE_OVERRIDE`. Only the provider's boundary is stood in.

use std::sync::{Arc, Mutex};

use axum::http::StatusCode;
use axum::{Json, Router, extract::State, routing::post};
use medbrains_payment_gateway::pos::{pinelabs, simulator};
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
        .route(
            "/CancelTransaction",
            post(|| async { Json(json!({ "ResponseCode": 0 })) }),
        )
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
