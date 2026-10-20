#![allow(dead_code, unreachable_pub)]

//! The world the patient delivery-choice tests run in: a tenant with home
//! delivery on and Razorpay keys set, patients signed in to the portal the
//! way patients are, and refills a pharmacist approves.

use std::sync::{Arc, Mutex};

use chrono::{Duration, Utc};
use medbrains_outbox::Handler;
use reqwest::StatusCode;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::common;

pub const WEBHOOK_SECRET: &str = "whsec_delivery_choice_test";

pub struct Setup {
    pub tenant: Uuid,
    pub tenant_code: String,
    pub csrf: String,
}

pub async fn staff(
    app: &common::TestApp,
    setup: &Setup,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let req = match method {
        "GET" => app.client.get(app.url(path)),
        "PUT" => app.client.put(app.url(path)).json(&body),
        _ => app.client.post(app.url(path)).json(&body),
    };
    let resp = req
        .header("x-csrf-token", &setup.csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

pub async fn portal(
    app: &common::TestApp,
    token: &str,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let client = reqwest::Client::new();
    let req = match body {
        Some(b) => client.post(app.url(path)).json(&b),
        None => client.get(app.url(path)),
    };
    let resp = req.bearer_auth(token).send().await.expect("portal request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Signed in the way a patient is: a one-time code planted for their phone.
pub async fn patient_token(app: &common::TestApp, setup: &Setup, phone: &str) -> String {
    let code = "424242";
    sqlx::query(
        "INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + interval '5 minutes')",
    )
    .bind(setup.tenant)
    .bind(phone)
    .bind(format!("{:x}", Sha256::digest(code.as_bytes())))
    .execute(&app.db)
    .await
    .expect("otp");
    let resp: Value = reqwest::Client::new()
        .post(app.url("/api/portal/auth/verify"))
        .json(&json!({ "tenant_code": setup.tenant_code, "phone": phone, "code": code }))
        .send()
        .await
        .expect("verify")
        .json()
        .await
        .expect("verify json");
    resp["token"].as_str().expect("a portal token").to_owned()
}

pub async fn new_patient(app: &common::TestApp, setup: &Setup) -> (Uuid, String) {
    let phone = format!("7{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let id = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, address) \
         VALUES ($1, $2, 'Home', 'Choice', 'female', $3, \
                 '{\"line1\": \"12 Lake Road\", \"city\": \"Karaikudi\", \"postal_code\": \"630001\"}') \
         RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!("UH-DC-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    (id, phone)
}

pub async fn drug(app: &common::TestApp, setup: &Setup, name: &str, controlled: bool) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, refill_policy, is_controlled, \
                                       base_price, current_stock) \
         VALUES ($1, $2, $3, 'pharmacy', $4, 10, 5000) RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!("DC-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(name)
    .bind(controlled)
    .fetch_one(&app.db)
    .await
    .expect("drug")
}

pub async fn setting(
    app: &common::TestApp,
    setup: &Setup,
    category: &str,
    key: &str,
    value: Value,
) {
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
    )
    .bind(setup.tenant)
    .bind(category)
    .bind(key)
    .bind(value)
    .execute(&app.db)
    .await
    .expect("setting");
}

/// A month-old prescription with refills left, its first supply collected.
pub async fn prescription(
    app: &common::TestApp,
    setup: &Setup,
    patient: Uuid,
    drug: Uuid,
    name: &str,
    refills: i32,
) -> String {
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(setup.tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (_, visit) = staff(
        app,
        setup,
        "POST",
        "/api/opd/encounters",
        json!({ "patient_id": patient, "department_id": department }),
    )
    .await;
    let path = format!(
        "/api/opd/encounters/{}/prescriptions",
        visit["encounter"]["id"].as_str().unwrap_or_default()
    );
    let (status, rx) = staff(app, setup, "POST", &path, json!({
        "items": [{ "drug_name": name, "catalog_item_id": drug, "dosage": "1 tab", "frequency": "OD",
                    "duration": "30 days", "route": "oral" }],
        "repeats_allowed": refills, "repeat_interval_days": 30,
        "valid_until": Utc::now().date_naive() + Duration::days(90) })).await;
    assert_eq!(status, StatusCode::OK, "{rx}");
    let id = rx["prescription"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    sqlx::query(
        "UPDATE prescriptions SET created_at = now() - interval '31 days' WHERE id = $1::uuid",
    )
    .bind(&id)
    .execute(&app.db)
    .await
    .expect("age");
    sqlx::query(
        "UPDATE pharmacy_prescriptions SET status = 'dispensed' WHERE prescription_id = $1::uuid",
    )
    .bind(&id)
    .execute(&app.db)
    .await
    .expect("first supply");
    id
}

pub fn choice(payment: &str) -> Value {
    json!({ "delivery": { "address": "12 Lake Road, Karaikudi", "pincode": "630001",
                          "contact_phone": "9000000002", "preferred_slot": "evening",
                          "payment": payment } })
}

/// The pharmacist approves the refill in the queue; returns its order.
pub async fn approve(app: &common::TestApp, setup: &Setup, rx: &str) -> Uuid {
    let queue: Uuid = sqlx::query_scalar(
        "SELECT id FROM pharmacy_prescriptions WHERE prescription_id = $1::uuid AND repeat_index = 1",
    )
    .bind(rx)
    .fetch_one(&app.db)
    .await
    .expect("refill in the queue");
    let (status, body) = staff(
        app,
        setup,
        "PUT",
        &format!("/api/pharmacy/rx-queue/{queue}/review"),
        json!({ "action": "approved" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    sqlx::query_scalar("SELECT pharmacy_order_id FROM pharmacy_prescriptions WHERE id = $1")
        .bind(queue)
        .fetch_one(&app.db)
        .await
        .expect("order")
}

pub async fn delivery_of(
    app: &common::TestApp,
    request: &str,
) -> Option<(Uuid, String, String, String)> {
    sqlx::query_as(
        "SELECT id, address, payment, status FROM pharmacy_deliveries WHERE refill_request_id = $1::uuid",
    )
    .bind(request)
    .fetch_optional(&app.db)
    .await
    .expect("delivery")
}

pub async fn setup(app: &common::TestApp) -> Setup {
    let csrf = app.login_admin().await;
    let (tenant, tenant_code): (Uuid, String) = sqlx::query_as(
        "SELECT t.id, t.code FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let setup = Setup {
        tenant,
        tenant_code,
        csrf,
    };
    let (status, _) = staff(
        app,
        &setup,
        "POST",
        "/api/auth/step-up",
        json!({ "password": "admin123" }),
    )
    .await;
    assert!(status.is_success());
    setting(
        app,
        &setup,
        "pharmacy",
        "home_delivery_enabled",
        json!(true),
    )
    .await;
    setting(app, &setup, "payments", "razorpay_config",
        json!({ "key_id": "rzp_test_choice", "key_secret": "secret", "webhook_secret": WEBHOOK_SECRET })).await;
    setup
}

/// Two paid deliveries on record earn this patient pay-on-delivery.
pub async fn earn_cash_on_delivery(
    app: &common::TestApp,
    setup: &Setup,
    patient: Uuid,
    drug: Uuid,
) {
    for _ in 0..2 {
        let (status, body) = staff(app, setup, "POST", "/api/pharmacy/orders", json!({
            "patient_id": patient, "dispensing_type": "prescription", "safety_override_reason": "history",
            "items": [{ "catalog_item_id": drug, "drug_name": "Deliverol", "quantity": 1, "unit_price": 10 }] })).await;
        assert_eq!(status, StatusCode::OK, "{body}");
        sqlx::query(
            "INSERT INTO pharmacy_deliveries (tenant_id, order_id, patient_id, mode, address, \
                 contact_phone, payment, status, arranged_by) \
             SELECT $1, $2::uuid, $3, 'runner', 'x', 'x', 'prepaid', 'delivered', id FROM users \
              WHERE username = 'admin'",
        )
        .bind(setup.tenant)
        .bind(body["order"]["id"].as_str().unwrap_or_default())
        .bind(patient)
        .execute(&app.db)
        .await
        .expect("history");
    }
}

/// A stand-in Razorpay that makes a link named after the payment row and
/// keeps the request it was sent.
async fn mock_razorpay(seen: Arc<Mutex<Vec<Value>>>) -> String {
    let app = axum::Router::new().fallback(
        move |uri: axum::http::Uri, axum::Json(body): axum::Json<Value>| {
            let seen = Arc::clone(&seen);
            async move {
                assert!(uri.path().ends_with("/payment_links"), "{uri}");
                let reference = body["reference_id"]
                    .as_str()
                    .unwrap_or_default()
                    .replace('-', "");
                seen.lock().expect("seen").push(body);
                axum::Json(json!({ "id": format!("plink_{reference}"),
                                   "short_url": format!("https://rzp.test/i/{reference}") }))
            }
        },
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}/v1")
}

/// Run the queued payment-link event for `txn` as the outbox worker would,
/// against a stand-in Razorpay. Returns what Razorpay was asked.
pub async fn make_payment_link(app: &common::TestApp, setup: &Setup, txn: Uuid) -> Value {
    let handler = medbrains_payment_gateway::payment_link::PaymentLinkHandler;
    let (event_id, payload): (Uuid, Value) = sqlx::query_as(
        "SELECT id, payload FROM outbox_events WHERE event_type = $1 AND aggregate_id = $2 \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(handler.event_type())
    .bind(txn)
    .fetch_one(&app.db)
    .await
    .expect("the link is queued");
    let seen = Arc::new(Mutex::new(Vec::new()));
    let base = mock_razorpay(Arc::clone(&seen)).await;
    let ctx = medbrains_outbox::HandlerCtx {
        pool: app.db.clone(),
        tenant_id: setup.tenant,
        event_id,
        event_type: handler.event_type().to_owned(),
        actor_user_id: None,
        attempts: 0,
        secret_resolver: Arc::new(common::TestSecrets::default().with(
            medbrains_payment_gateway::razorpay::API_BASE_OVERRIDE,
            base,
        )),
        http_client: reqwest::Client::new(),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-test-docs"),
        )),
    };
    handler
        .handle(&ctx, &payload)
        .await
        .expect("the link is made");
    let asked = seen.lock().expect("seen").pop();
    asked.expect("Razorpay was asked once")
}
