#![allow(dead_code, unreachable_pub)]

//! Stand-ins for Razorpay, Cashfree, PhonePe and PayU, mocked only at their
//! HTTP boundary, under one local server: `/razorpay/v1`, `/cashfree/pg`,
//! `/phonepe`, `/payu`. Each answers in its provider's documented shape and,
//! like the real one, rejects a repeated refund key.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use axum::extract::{Form, Path, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{Value, json};
use uuid::Uuid;

type Answer = (StatusCode, Json<Value>);

/// A payment the stand-in holds as paid.
#[derive(Debug, Clone)]
pub struct Paid {
    pub payment_id: String,
    pub paise: i64,
    pub method: String,
}

#[derive(Debug, Default)]
pub struct Stand {
    /// Order references made, with the paise asked.
    pub orders: Mutex<HashMap<String, i64>>,
    pub paid: Mutex<HashMap<String, Paid>>,
    /// (provider, refund key, paise) of each refund made.
    pub refunds: Mutex<Vec<(String, String, i64)>>,
    refund_keys: Mutex<HashSet<String>>,
    /// Providers answering 503 to new orders.
    pub down: Mutex<HashSet<String>>,
    sessions: Mutex<HashMap<String, String>>,
}

impl Stand {
    fn is_down(&self, provider: &str) -> bool {
        self.down.lock().expect("down").contains(provider)
    }
    fn unavailable() -> Answer {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "message": "upstream unavailable" })),
        )
    }
    fn order(&self, order_ref: &str, paise: i64) {
        self.orders
            .lock()
            .expect("orders")
            .insert(order_ref.to_owned(), paise);
    }
    /// The payer pays this order (or a link's own order) in full.
    pub fn pay(&self, order_ref: &str, paise: i64, method: &str) -> String {
        let payment_id = format!("pay{}", &Uuid::new_v4().simple().to_string()[..12]);
        self.paid.lock().expect("paid").insert(
            order_ref.to_owned(),
            Paid {
                payment_id: payment_id.clone(),
                paise,
                method: method.to_owned(),
            },
        );
        payment_id
    }
    fn paid(&self, order_ref: &str) -> Option<Paid> {
        self.paid.lock().expect("paid").get(order_ref).cloned()
    }
    /// A refund, unless its key was seen before.
    fn refund(&self, provider: &str, key: &str, paise: i64) -> bool {
        if !self
            .refund_keys
            .lock()
            .expect("keys")
            .insert(format!("{provider}:{key}"))
        {
            return false;
        }
        self.refunds
            .lock()
            .expect("refunds")
            .push((provider.to_owned(), key.to_owned(), paise));
        true
    }
}

fn rupees(v: &Value) -> i64 {
    let r: f64 = v
        .as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| v.as_f64())
        .unwrap_or(0.0);
    #[allow(clippy::cast_possible_truncation)]
    let paise = (r * 100.0).round() as i64;
    paise
}

fn short() -> String {
    Uuid::new_v4().simple().to_string()[..14].to_owned()
}

// ── Razorpay ───────────────────────────────────────────────

async fn rz_order(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    if s.is_down("razorpay") {
        return Stand::unavailable();
    }
    let id = format!("order_{}", short());
    s.order(&id, b["amount"].as_i64().unwrap_or_default());
    (
        StatusCode::OK,
        Json(json!({ "id": id, "status": "created", "amount": b["amount"] })),
    )
}

async fn rz_payment(State(s): State<Arc<Stand>>, Path(id): Path<String>) -> Answer {
    let paid = s
        .paid
        .lock()
        .expect("paid")
        .iter()
        .find(|(_, p)| p.payment_id == id)
        .map(|(o, p)| (o.clone(), p.clone()));
    match paid {
        Some((order, p)) => (
            StatusCode::OK,
            Json(json!({ "id": id, "order_id": order, "amount": p.paise,
            "status": "captured", "method": p.method, "currency": "INR" })),
        ),
        None => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": { "description": "The id provided does not exist" } })),
        ),
    }
}

async fn rz_refund(
    State(s): State<Arc<Stand>>,
    Path(id): Path<String>,
    Json(b): Json<Value>,
) -> Answer {
    let key = b["receipt"].as_str().unwrap_or_default();
    if !s.refund("razorpay", key, b["amount"].as_i64().unwrap_or_default()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": { "description": "The receipt has already been used" } })),
        );
    }
    (
        StatusCode::OK,
        Json(
            json!({ "id": format!("rfnd_{}", short()), "payment_id": id, "amount": b["amount"], "status": "processed" }),
        ),
    )
}

async fn rz_qr(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    let id = format!("qr_{}", short());
    s.order(&id, b["payment_amount"].as_i64().unwrap_or_default());
    (
        StatusCode::OK,
        Json(
            json!({ "id": id, "image_url": format!("https://rzp.io/i/{id}"), "close_by": b["close_by"] }),
        ),
    )
}

async fn rz_link(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    let id = format!("plink_{}", short());
    s.order(&id, b["amount"].as_i64().unwrap_or_default());
    (
        StatusCode::OK,
        Json(
            json!({ "id": id, "short_url": format!("https://rzp.io/l/{id}"), "reference_id": b["reference_id"] }),
        ),
    )
}

// ── Cashfree (PG API 2023-08-01) ───────────────────────────

async fn cf_order(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    if s.is_down("cashfree") {
        return Stand::unavailable();
    }
    let id = b["order_id"].as_str().unwrap_or_default().to_owned();
    s.order(&id, rupees(&b["order_amount"]));
    let session = format!("session_{}", short());
    s.sessions
        .lock()
        .expect("sessions")
        .insert(session.clone(), id.clone());
    (
        StatusCode::OK,
        Json(
            json!({ "order_id": id, "cf_order_id": short(), "payment_session_id": session, "order_status": "ACTIVE" }),
        ),
    )
}

async fn cf_payments(State(s): State<Arc<Stand>>, Path(id): Path<String>) -> Answer {
    let list = s.paid(&id).map_or_else(Vec::new, |p| vec![json!({ "cf_payment_id": p.payment_id, "order_id": id,
        "payment_status": "SUCCESS", "payment_amount": p.paise as f64 / 100.0, "payment_group": p.method })]);
    (StatusCode::OK, Json(json!(list)))
}

async fn cf_refund(
    State(s): State<Arc<Stand>>,
    Path(_id): Path<String>,
    Json(b): Json<Value>,
) -> Answer {
    let key = b["refund_id"].as_str().unwrap_or_default();
    if !s.refund("cashfree", key, rupees(&b["refund_amount"])) {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "message": "refund_id already exists" })),
        );
    }
    (
        StatusCode::OK,
        Json(json!({ "refund_id": key, "cf_refund_id": short(), "refund_status": "PENDING" })),
    )
}

async fn cf_session(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    let known = s
        .sessions
        .lock()
        .expect("sessions")
        .contains_key(b["payment_session_id"].as_str().unwrap_or_default());
    if !known || b["payment_method"]["upi"]["channel"] != "qrcode" {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "message": "payment_session_id is invalid" })),
        );
    }
    (
        StatusCode::OK,
        Json(
            json!({ "channel": "qrcode", "action": "custom", "data": { "payload": { "qrcode": "iVBORw0KGgo=" } } }),
        ),
    )
}

async fn cf_link(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    let id = b["link_id"].as_str().unwrap_or_default().to_owned();
    s.order(&id, rupees(&b["link_amount"]));
    (
        StatusCode::OK,
        Json(
            json!({ "link_id": id, "cf_link_id": 1, "link_url": format!("https://payments-test.cashfree.com/links/{id}"), "link_status": "ACTIVE" }),
        ),
    )
}

// ── PhonePe (Standard Checkout v2) ─────────────────────────

async fn pp_token() -> Answer {
    (
        StatusCode::OK,
        Json(
            json!({ "access_token": "pp-token", "token_type": "O-Bearer", "expires_at": 4_102_444_800_i64 }),
        ),
    )
}

async fn pp_pay(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    if s.is_down("phonepe") {
        return Stand::unavailable();
    }
    let id = b["merchantOrderId"].as_str().unwrap_or_default().to_owned();
    s.order(&id, b["amount"].as_i64().unwrap_or_default());
    (
        StatusCode::OK,
        Json(
            json!({ "orderId": format!("OMO{}", short()), "state": "PENDING",
        "redirectUrl": format!("https://mercury-uat.phonepe.com/transact/{id}") }),
        ),
    )
}

async fn pp_status(State(s): State<Arc<Stand>>, Path(id): Path<String>) -> Answer {
    let asked = s
        .orders
        .lock()
        .expect("orders")
        .get(&id)
        .copied()
        .unwrap_or_default();
    let body = match s.paid(&id) {
        Some(p) => json!({ "state": "COMPLETED", "amount": p.paise,
            "paymentDetails": [{ "transactionId": p.payment_id, "paymentMode": p.method, "state": "COMPLETED", "amount": p.paise }] }),
        None => json!({ "state": "PENDING", "amount": asked, "paymentDetails": [] }),
    };
    (StatusCode::OK, Json(body))
}

async fn pp_refund(State(s): State<Arc<Stand>>, Json(b): Json<Value>) -> Answer {
    let key = b["merchantRefundId"].as_str().unwrap_or_default();
    if !s.refund("phonepe", key, b["amount"].as_i64().unwrap_or_default()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "message": "Duplicate merchantRefundId" })),
        );
    }
    (
        StatusCode::OK,
        Json(
            json!({ "refundId": format!("OMR{}", short()), "amount": b["amount"], "state": "PENDING" }),
        ),
    )
}

// ── PayU (command API) ─────────────────────────────────────

async fn payu_command(
    State(s): State<Arc<Stand>>,
    Form(f): Form<HashMap<String, String>>,
) -> Answer {
    let var = |k: &str| f.get(k).cloned().unwrap_or_default();
    match var("command").as_str() {
        "verify_payment" => {
            let txnid = var("var1");
            let detail = match s.paid(&txnid) {
                Some(p) => {
                    json!({ "status": "success", "mihpayid": p.payment_id, "amt": format!("{:.2}", p.paise as f64 / 100.0), "mode": p.method })
                }
                None => json!({ "status": "pending" }),
            };
            (
                StatusCode::OK,
                Json(json!({ "status": 1, "transaction_details": { txnid: detail } })),
            )
        }
        "cancel_refund_transaction" => {
            if !s.refund("payu", &var("var2"), rupees(&json!(var("var3")))) {
                return (
                    StatusCode::OK,
                    Json(json!({ "status": 0, "msg": "Duplicate token" })),
                );
            }
            (
                StatusCode::OK,
                Json(
                    json!({ "status": 1, "msg": "Refund Request Queued", "request_id": short(), "mihpayid": var("var1") }),
                ),
            )
        }
        _ => (
            StatusCode::OK,
            Json(json!({ "status": 0, "msg": "Invalid command" })),
        ),
    }
}

/// Start the stand-ins; the base URL each is reached at, by provider.
pub async fn spawn(stand: Arc<Stand>) -> HashMap<&'static str, String> {
    let app = Router::new()
        .route("/razorpay/v1/orders", post(rz_order))
        .route("/razorpay/v1/payments/{id}", get(rz_payment))
        .route("/razorpay/v1/payments/{id}/refund", post(rz_refund))
        .route("/razorpay/v1/payments/qr_codes", post(rz_qr))
        .route("/razorpay/v1/payment_links", post(rz_link))
        .route("/cashfree/pg/orders", post(cf_order))
        .route("/cashfree/pg/orders/sessions", post(cf_session))
        .route("/cashfree/pg/orders/{id}/payments", get(cf_payments))
        .route("/cashfree/pg/orders/{id}/refunds", post(cf_refund))
        .route("/cashfree/pg/links", post(cf_link))
        .route("/phonepe/v1/oauth/token", post(pp_token))
        .route("/phonepe/checkout/v2/pay", post(pp_pay))
        .route("/phonepe/checkout/v2/order/{id}/status", get(pp_status))
        .route("/phonepe/payments/v2/refund", post(pp_refund))
        .route("/payu/merchant/postservice.php", post(payu_command))
        .with_state(stand);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    let base = format!("http://{addr}");
    HashMap::from([
        ("razorpay", format!("{base}/razorpay/v1")),
        ("cashfree", format!("{base}/cashfree/pg")),
        ("phonepe", format!("{base}/phonepe")),
        ("payu", format!("{base}/payu")),
    ])
}
