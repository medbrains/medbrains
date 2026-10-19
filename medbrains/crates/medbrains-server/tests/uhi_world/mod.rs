#![allow(dead_code, unreachable_pub)]

//! The stand-in UHI network the HSPA tests run in: a patient app (EUA),
//! gateway and payment provider on one mock server that records every call,
//! the app's signing key (named to the server as the registry's key), and a
//! hospital whose UHI subscription is saved, keyed and switched on through
//! the API.

use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode, Uri},
};
use medbrains_crypto::beckn::{KeyPair, SignatureHeader, generate, sign};
use medbrains_outbox::Handler;
use medbrains_server::routes::uhi::{
    auth, outbox::UhiCallbackHandler, payment_events::RAZORPAY_API_BASE_OVERRIDE, protocol,
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

pub const EUA_ID: &str = "eua.test";

#[derive(Clone, Debug)]
pub struct Call {
    pub path: String,
    pub headers: HeaderMap,
    pub raw: Vec<u8>,
    pub body: Value,
}

pub type Calls = Arc<Mutex<Vec<Call>>>;

async fn spawn_mock(calls: Calls) -> String {
    async fn record(
        State(c): State<Calls>,
        uri: Uri,
        headers: HeaderMap,
        raw: Bytes,
    ) -> Json<Value> {
        let body: Value = serde_json::from_slice(&raw).unwrap_or(Value::Null);
        // The payment provider: a hosted link named after our payment row.
        let answer = if uri.path().ends_with("/payment_links") {
            let reference = body["reference_id"]
                .as_str()
                .unwrap_or_default()
                .replace('-', "");
            json!({ "id": format!("plink_{reference}"),
                    "short_url": format!("https://rzp.test/i/{reference}") })
        } else {
            protocol::ack()
        };
        c.lock().expect("calls").push(Call {
            path: uri.path().to_owned(),
            headers,
            body,
            raw: raw.to_vec(),
        });
        Json(answer)
    }
    let app = Router::new().fallback(record).with_state(calls);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}")
}

#[derive(Debug)]
pub struct World {
    pub app: common::TestApp,
    pub csrf: String,
    pub tenant: Uuid,
    pub calls: Calls,
    pub mock: String,
    pub eua: KeyPair,
    pub subscriber: String,
    /// Our signing key, as Settings → UHI shows it.
    pub public_key: String,
}

impl World {
    pub fn eua_uri(&self) -> String {
        format!("{}/eua", self.mock)
    }

    /// A UHI message from the patient app.
    pub fn message(&self, domain: &str, action: &str, txn: &str, message: Value) -> Value {
        json!({
            "context": {
                "domain": domain, "country": "IND", "city": "std:080", "action": action,
                "core_version": protocol::CORE_VERSION, "transaction_id": txn,
                "message_id": Uuid::new_v4().to_string(), "timestamp": "2026-10-19T10:00:00Z",
                "consumer_id": EUA_ID, "consumer_uri": self.eua_uri(),
            },
            "message": message,
        })
    }

    /// POST `body` to `/{action}`, signed with `key` (the app's, unless a
    /// test forges one); `gateway` adds the gateway's signature too.
    pub async fn send(
        &self,
        action: &str,
        body: &Value,
        key: Option<&KeyPair>,
        gateway: bool,
    ) -> (StatusCode, Value) {
        let raw = serde_json::to_vec(body).expect("json");
        let now = chrono::Utc::now().timestamp();
        let mut req = reqwest::Client::new()
            .post(
                self.app
                    .url(&format!("/api/uhi/hspa/{}/{action}", self.subscriber)),
            )
            .header("content-type", "application/json");
        if let Some(key) = key {
            let header =
                sign(EUA_ID, "eua.k1", &key.private_key, &raw, (now, now + 60)).expect("sign");
            req = req.header("authorization", header);
            if gateway {
                let gw = sign(
                    "gateway.test",
                    "gw.k1",
                    &key.private_key,
                    &raw,
                    (now, now + 60),
                )
                .expect("sign");
                req = req.header("x-gateway-authorization", gw);
            }
        }
        let resp = req.body(raw).send().await.expect("uhi call");
        let status = StatusCode::from_u16(resp.status().as_u16()).expect("status");
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    pub async fn call(&self, action: &str, body: &Value) -> Value {
        let (status, ack) = self.send(action, body, Some(&self.eua), false).await;
        assert_eq!(status, StatusCode::OK, "{action}: {ack}");
        assert_eq!(ack["message"]["ack"]["status"], "ACK");
        ack
    }

    /// Run the queued `on_*` answer for `txn` through the outbox handler, as
    /// the worker would, and return what the app (or gateway) received —
    /// after checking our signature on it.
    pub async fn deliver(&self, txn: &str, on_action: &str) -> Call {
        let (event_id, payload): (Uuid, Value) = sqlx::query_as(
            "SELECT id, payload FROM outbox_events WHERE event_type = 'uhi.callback' \
               AND payload->'body'->'context'->>'transaction_id' = $1 \
               AND payload->'body'->'context'->>'action' = $2 \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(txn)
        .bind(on_action)
        .fetch_one(&self.app.db)
        .await
        .expect("an on_* answer is queued for the transaction");
        UhiCallbackHandler
            .handle(&self.handler_ctx(event_id, "uhi.callback"), &payload)
            .await
            .expect("callback sent");
        let call = self
            .calls
            .lock()
            .expect("calls")
            .last()
            .cloned()
            .expect("a call");
        let header = call
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .expect("signed");
        let parsed = SignatureHeader::parse(header).expect("our header parses");
        assert_eq!(parsed.subscriber_id, self.subscriber);
        parsed
            .verify(&call.raw, &self.public_key, chrono::Utc::now().timestamp())
            .expect("our signature verifies with the key registered with NHA");
        assert_eq!(call.body["context"]["action"], on_action);
        call
    }

    fn handler_ctx(&self, event_id: Uuid, event_type: &str) -> medbrains_outbox::HandlerCtx {
        medbrains_outbox::HandlerCtx {
            pool: self.app.db.clone(),
            tenant_id: self.tenant,
            event_id,
            event_type: event_type.to_owned(),
            actor_user_id: None,
            attempts: 0,
            secret_resolver: Arc::new(secrets(&self.mock, &self.eua)),
            http_client: reqwest::Client::new(),
            object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
                std::env::temp_dir().join("medbrains-test-docs"),
            )),
        }
    }

    /// Run the latest queued `handler` event about `aggregate` as the worker
    /// would.
    pub async fn run(&self, handler: &dyn Handler, aggregate: Uuid) -> Value {
        let event_type = handler.event_type();
        let (event_id, payload): (Uuid, Value) = sqlx::query_as(
            "SELECT id, payload FROM outbox_events WHERE event_type = $1 AND aggregate_id = $2 \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(event_type)
        .bind(aggregate)
        .fetch_one(&self.app.db)
        .await
        .expect("the event is queued");
        handler
            .handle(&self.handler_ctx(event_id, event_type), &payload)
            .await
            .expect("the event is handled")
    }

    /// The transaction row of the app's transaction `txn`.
    pub async fn row(&self, txn: &str) -> Uuid {
        sqlx::query_scalar("SELECT id FROM uhi_transactions WHERE transaction_id = $1")
            .bind(txn)
            .fetch_one(&self.app.db)
            .await
            .expect("the transaction is recorded")
    }

    /// Set a hospital setting (undoing a soft delete).
    pub async fn set_setting(&self, category: &str, key: &str, value: Value) {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, $3, $4) \
             ON CONFLICT (tenant_id, category, key) \
             DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
        )
        .bind(self.tenant)
        .bind(category)
        .bind(key)
        .bind(value)
        .execute(&self.app.db)
        .await
        .expect("setting");
    }

    /// Take a setting away again (a soft delete).
    pub async fn clear_setting(&self, category: &str, key: &str) {
        sqlx::query(
            "DELETE FROM tenant_settings WHERE tenant_id = $1 AND category = $2 AND key = $3",
        )
        .bind(self.tenant)
        .bind(category)
        .bind(key)
        .execute(&self.app.db)
        .await
        .expect("clear setting");
    }

    /// The department a doctor from [`doctor`] sees patients in: (id, code).
    pub async fn department_of(&self, doctor: Uuid) -> (Uuid, String) {
        sqlx::query_as(
            "SELECT d.id, d.code FROM doctor_schedules s JOIN departments d ON d.id = s.department_id \
              WHERE s.doctor_id = $1 LIMIT 1",
        )
        .bind(doctor)
        .fetch_one(&self.app.db)
        .await
        .expect("department")
    }

    pub async fn outbox_count(&self, txn: &str) -> i64 {
        sqlx::query_scalar(
            "SELECT count(*) FROM outbox_events WHERE event_type = 'uhi.callback' \
               AND payload->'body'->'context'->>'transaction_id' = $1",
        )
        .bind(txn)
        .fetch_one(&self.app.db)
        .await
        .expect("count")
    }
}

fn secrets(mock: &str, eua: &KeyPair) -> common::TestSecrets {
    common::TestSecrets::default()
        .with(
            auth::UHI_REGISTRY_PUBLIC_KEY_OVERRIDE,
            eua.public_key.clone(),
        )
        .with(auth::UHI_GATEWAY_BASE_URL_OVERRIDE, mock.to_owned())
        .with("MEDBRAINS_PUBLIC_BASE_URL", "https://hospital.test")
        .with(RAZORPAY_API_BASE_OVERRIDE, format!("{mock}/razorpay/v1"))
}

/// A hospital set up as a UHI provider of every service, against a fresh mock.
pub async fn world() -> World {
    let calls: Calls = Arc::default();
    let mock = spawn_mock(calls.clone()).await;
    let eua = generate();
    let app = common::spawn_app_with_secrets(secrets(&mock, &eua)).await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    // Each test registers the hospital afresh (the delete is a soft delete).
    sqlx::query("DELETE FROM uhi_subscriptions WHERE tenant_id = $1")
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("clear the previous test's subscription");
    let subscriber = format!("hspa-{}.test", &Uuid::new_v4().simple().to_string()[..8]);
    let save = |active: bool| {
        json!({ "environment": "sandbox", "subscriber_id": subscriber, "unique_key_id": "hspa.k1",
                "services": ["teleconsultation", "physical_consultation", "lab_tests",
                             "blood_bank", "ambulance"], "city_code": "std:080",
                "is_active": active })
    };
    let put = |body: Value| {
        app.client
            .put(app.url("/api/uhi/settings"))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };
    let saved = put(save(true)).await.expect("save");
    assert_eq!(
        saved.status(),
        StatusCode::BAD_REQUEST,
        "no switching on without a key"
    );
    let saved = put(save(false)).await.expect("save");
    assert_eq!(
        saved.status(),
        StatusCode::OK,
        "{}",
        saved.text().await.unwrap_or_default()
    );
    let keyed: Value = app
        .client
        .post(app.url("/api/uhi/settings/keys"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("keys")
        .json()
        .await
        .expect("json");
    let public_key = keyed["signing_public_key"]
        .as_str()
        .expect("public key shown")
        .to_owned();
    assert!(
        keyed.get("signing_private_key").is_none(),
        "the private key never leaves"
    );
    assert_eq!(
        keyed["subscriber_url"],
        format!("https://hospital.test/api/uhi/hspa/{subscriber}")
    );
    let on = put(save(true)).await.expect("switch on");
    assert_eq!(
        on.status(),
        StatusCode::OK,
        "{}",
        on.text().await.unwrap_or_default()
    );
    World {
        app,
        csrf,
        tenant,
        calls,
        mock,
        eua,
        subscriber,
        public_key,
    }
}

/// A doctor with an HPR ID who sees patients every day, 09:00–13:00 in
/// 30-minute slots, one patient each. Returns (doctor id, name).
pub async fn doctor(w: &World) -> (Uuid, String) {
    let staff = common::provision_staff(&w.app, &w.csrf, "doctor", &[]).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let name = format!("Dr Uhi {tag}");
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, 'Teleconsultation', 'clinical') RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("UHI-{}", tag.to_uppercase()))
    .fetch_one(&w.app.db)
    .await
    .expect("department");
    sqlx::query(
        "INSERT INTO doctor_profiles (tenant_id, user_id, display_name, hpr_id) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(w.tenant)
    .bind(staff.user_id)
    .bind(&name)
    .bind({
        let n = Uuid::new_v4().as_u128() % 1_000_000_000_000;
        format!(
            "71-{:04}-{:04}-{:04}",
            n / 100_000_000,
            n / 10_000 % 10_000,
            n % 10_000
        )
    })
    .execute(&w.app.db)
    .await
    .expect("profile");
    sqlx::query(
        "INSERT INTO doctor_schedules (tenant_id, doctor_id, department_id, day_of_week, \
            start_time, end_time, slot_duration_mins, max_patients) \
         SELECT $1, $2, $3, d, '09:00', '13:00', 30, 1 FROM generate_series(0, 6) d",
    )
    .bind(w.tenant)
    .bind(staff.user_id)
    .bind(department)
    .execute(&w.app.db)
    .await
    .expect("schedule");
    (staff.user_id, name)
}
