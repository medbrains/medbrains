#![allow(dead_code, unreachable_pub)]

//! The world the payments P0 tests run in: a stand-in Razorpay (orders,
//! payments, refunds) the server is pointed at through
//! `RAZORPAY_API_BASE_OVERRIDE`, a hospital whose Razorpay keys are set, and
//! issued bills to pay.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use hmac::{Hmac, Mac};
use medbrains_payment_gateway::payment_link::API_BASE_OVERRIDE;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use sha2::Sha256;
use uuid::Uuid;

use crate::common;

pub const KEY_ID: &str = "rzp_test_p0world";
pub const KEY_SECRET: &str = "p0-key-secret";
pub const WEBHOOK_SECRET: &str = "p0-webhook-secret";

/// What the stand-in Razorpay knows and was asked.
#[derive(Default)]
pub struct Razorpay {
    /// Payments by id, as `GET /payments/{id}` returns them.
    pub payments: Mutex<HashMap<String, Value>>,
    pub orders: Mutex<Vec<Value>>,
    pub refunds: Mutex<Vec<(String, Value)>>,
    pub refuse_orders: AtomicBool,
    pub qr_codes: Mutex<Vec<Value>>,
    /// Answer QR requests the way an account without QR Codes does.
    pub refuse_qr: AtomicBool,
}

async fn create_order(
    State(rz): State<Arc<Razorpay>>,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    if rz.refuse_orders.load(Ordering::SeqCst) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": { "description": "The api key provided is invalid" } })),
        );
    }
    let receipt = body["receipt"]
        .as_str()
        .unwrap_or_default()
        .replace('-', "");
    rz.orders.lock().expect("orders").push(body.clone());
    let id = format!("order_{}", &receipt[..14.min(receipt.len())]);
    (
        StatusCode::OK,
        Json(json!({ "id": id, "status": "created", "amount": body["amount"] })),
    )
}

async fn payment(
    State(rz): State<Arc<Razorpay>>,
    Path(id): Path<String>,
) -> (StatusCode, Json<Value>) {
    match rz.payments.lock().expect("payments").get(&id) {
        Some(p) => (StatusCode::OK, Json(p.clone())),
        None => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": { "description": "The id provided does not exist" } })),
        ),
    }
}

async fn refund(
    State(rz): State<Arc<Razorpay>>,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Json<Value> {
    let mut refunds = rz.refunds.lock().expect("refunds");
    refunds.push((id.clone(), body.clone()));
    Json(
        json!({ "id": format!("rfnd_{}", &Uuid::new_v4().simple().to_string()[..14]), "payment_id": id,
                 "amount": body["amount"], "status": "processed" }),
    )
}

async fn create_qr(
    State(rz): State<Arc<Razorpay>>,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    if rz.refuse_qr.load(Ordering::SeqCst) {
        return (
            StatusCode::BAD_REQUEST,
            Json(
                json!({ "error": { "description": "The requested URL was not found on the server." } }),
            ),
        );
    }
    let mut made = rz.qr_codes.lock().expect("qr");
    let id = format!("qr_{}", &Uuid::new_v4().simple().to_string()[..14]);
    made.push(body.clone());
    (
        StatusCode::OK,
        Json(json!({ "id": id, "entity": "qr_code", "status": "active",
                     "image_url": format!("https://rzp.io/i/{id}"),
                     "payment_amount": body["payment_amount"], "close_by": body["close_by"] })),
    )
}

async fn spawn_razorpay(rz: Arc<Razorpay>) -> String {
    let app = Router::new()
        .route("/v1/orders", post(create_order))
        .route("/v1/payments/{id}", get(payment))
        .route("/v1/payments/{id}/refund", post(refund))
        .route("/v1/payments/qr_codes", post(create_qr))
        .with_state(rz);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}/v1")
}

pub struct World {
    pub app: common::TestApp,
    pub csrf: String,
    pub tenant: Uuid,
    pub razorpay: Arc<Razorpay>,
}

pub fn hmac_hex(secret: &str, message: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("hmac");
    mac.update(message.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

pub async fn world() -> World {
    let razorpay = Arc::new(Razorpay::default());
    let base = spawn_razorpay(Arc::clone(&razorpay)).await;
    let app = common::spawn_app_with_secrets(
        common::TestSecrets::default().with(API_BASE_OVERRIDE, base),
    )
    .await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar(
        "SELECT t.id FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let w = World {
        app,
        csrf,
        tenant,
        razorpay,
    };
    w.setting(
        "razorpay_config",
        json!({ "key_id": KEY_ID, "key_secret": KEY_SECRET,
                                          "webhook_secret": WEBHOOK_SECRET }),
    )
    .await;
    w.setting("active_provider", json!("razorpay")).await;
    w
}

impl World {
    pub async fn setting(&self, key: &str, value: Value) {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ($1, 'payments', $2, $3) \
             ON CONFLICT (tenant_id, category, key) \
             DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
        )
        .bind(self.tenant)
        .bind(key)
        .bind(value)
        .execute(&self.app.db)
        .await
        .expect("setting");
    }

    pub async fn call(&self, method: &str, path: &str, body: Value) -> (StatusCode, Value) {
        let req = match method {
            "GET" => self.app.client.get(self.app.url(path)),
            _ => self.app.client.post(self.app.url(path)).json(&body),
        };
        let resp = req
            .header("x-csrf-token", &self.csrf)
            .send()
            .await
            .expect("request");
        let status = StatusCode::from_u16(resp.status().as_u16()).expect("status");
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    /// An issued bill for a new patient, for `total` rupees.
    pub async fn bill(&self, total: i64) -> Uuid {
        let patient: Uuid = sqlx::query_scalar(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
             VALUES ($1, $2, 'Pay', 'Online', 'female', $3) RETURNING id",
        )
        .bind(self.tenant)
        .bind(format!(
            "UH-P0-{}",
            &Uuid::new_v4().simple().to_string()[..10]
        ))
        .bind(format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000))
        .fetch_one(&self.app.db)
        .await
        .expect("patient");
        let (status, invoice) = self
            .call(
                "POST",
                "/api/billing/invoices",
                json!({ "patient_id": patient }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{invoice}");
        let id = invoice["id"].as_str().expect("invoice id").to_owned();
        let (status, item) = self
            .call(
                "POST",
                &format!("/api/billing/invoices/{id}/items"),
                json!({
                "charge_code": "MISC", "description": "Consultation", "source": "manual",
                "quantity": 1, "unit_price": total, "tax_percent": 0 }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{item}");
        let (status, issued) = self
            .call(
                "POST",
                &format!("/api/billing/invoices/{id}/issue"),
                json!({}),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{issued}");
        id.parse().expect("uuid")
    }

    /// An order for `amount` rupees on `invoice`: (transaction id, order id).
    pub async fn order(&self, invoice: Uuid, amount: i64) -> (Uuid, String) {
        let (status, order) = self
            .call(
                "POST",
                "/api/payments/create-order",
                json!({ "invoice_id": invoice, "amount": amount }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{order}");
        (
            order["transaction_id"]
                .as_str()
                .expect("txn")
                .parse()
                .expect("uuid"),
            order["order_id"].as_str().expect("order id").to_owned(),
        )
    }

    /// Razorpay holds a captured payment of `paise` on `order`.
    pub fn paid(&self, order: &str, paise: i64, method: &str) -> String {
        let id = format!("pay_{}", &Uuid::new_v4().simple().to_string()[..14]);
        self.razorpay.payments.lock().expect("payments").insert(
            id.clone(),
            json!({ "id": id, "order_id": order, "amount": paise, "currency": "INR",
                    "status": "captured", "method": method }),
        );
        id
    }

    /// The checkout's success handler, as the browser posts it.
    pub async fn verify(&self, order: &str, payment: &str) -> (StatusCode, Value) {
        let signature = hmac_hex(KEY_SECRET, &format!("{order}|{payment}"));
        self.call(
            "POST",
            "/api/payments/verify",
            json!({
            "razorpay_order_id": order, "razorpay_payment_id": payment,
            "razorpay_signature": signature }),
        )
        .await
    }

    /// A Razorpay webhook, signed with `secret`.
    pub async fn webhook_signed(&self, body: &Value, secret: &str) -> StatusCode {
        let raw = body.to_string();
        let resp = reqwest::Client::new()
            .post(self.app.url("/api/webhooks/razorpay"))
            .header("content-type", "application/json")
            .header("x-razorpay-signature", hmac_hex(secret, &raw))
            .header(
                "x-razorpay-event-id",
                format!("evt_{}", Uuid::new_v4().simple()),
            )
            .body(raw)
            .send()
            .await
            .expect("webhook");
        StatusCode::from_u16(resp.status().as_u16()).expect("status")
    }

    pub async fn webhook(&self, body: &Value) -> StatusCode {
        self.webhook_signed(body, WEBHOOK_SECRET).await
    }

    /// The bill's payments: (amount, mode, reference).
    pub async fn payments(&self, invoice: Uuid) -> Vec<(Decimal, String, Option<String>)> {
        sqlx::query_as(
            "SELECT amount, mode::text, reference_number FROM payments \
             WHERE invoice_id = $1 AND deleted_at IS NULL ORDER BY created_at",
        )
        .bind(invoice)
        .fetch_all(&self.app.db)
        .await
        .expect("payments")
    }

    /// (paid amount, status) of a bill.
    pub async fn invoice(&self, invoice: Uuid) -> (Decimal, String) {
        sqlx::query_as("SELECT paid_amount, status::text FROM invoices WHERE id = $1")
            .bind(invoice)
            .fetch_one(&self.app.db)
            .await
            .expect("invoice")
    }

    /// Reasons finance was handed for this order reference.
    pub async fn exceptions(&self, order_ref: &str) -> Vec<(String, Option<Decimal>)> {
        sqlx::query_as(
            "SELECT reason, amount FROM payment_webhook_exceptions \
             WHERE order_ref = $1 AND tenant_id = $2 ORDER BY created_at",
        )
        .bind(order_ref)
        .bind(self.tenant)
        .fetch_all(&self.app.db)
        .await
        .expect("exceptions")
    }
}

/// Razorpay's `payment.captured` for a payment on an order.
pub fn captured(order: &str, payment: &str, paise: i64, method: &str) -> Value {
    json!({ "event": "payment.captured", "payload": { "payment": { "entity": {
        "id": payment, "order_id": order, "amount": paise, "method": method,
        "status": "captured" } } } })
}
