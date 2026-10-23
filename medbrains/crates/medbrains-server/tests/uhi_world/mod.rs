#![allow(dead_code, unreachable_pub)]

//! The stand-in UHI network the HSPA tests run in: a patient app (EUA),
//! gateway, registry and payment provider on one mock server that records
//! every call. The registry answers lookups from its records the way NHA's
//! does (filtering on subscriber, key and subscriber URL; 404 when nothing
//! matches), so every call goes through the real lookup. The gateway signs
//! with its own key, configured for the sandbox. The hospital's UHI
//! subscription is saved, keyed and switched on through the API.

use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode, Uri},
};
use medbrains_crypto::beckn::{KeyPair, SignatureHeader, generate, sign};
use medbrains_outbox::Handler;
use medbrains_payment_gateway::razorpay::API_BASE_OVERRIDE;
use medbrains_server::routes::uhi::{auth, outbox::UhiCallbackHandler, protocol};
use protocol::GatewaySpec;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

pub const EUA_ID: &str = "eua.test";

/// Every UHI test, in every file, sets up UHI for the same hospital; they
/// run one at a time.
pub static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Clone, Debug)]
pub struct Call {
    pub path: String,
    pub headers: HeaderMap,
    pub raw: Vec<u8>,
    pub body: Value,
}

/// What the stand-in network answers; tests change it to stage faults.
#[derive(Debug, Default)]
pub struct Network {
    pub calls: Vec<Call>,
    /// The registry's records, as NHA's lookup returns them.
    pub registry: Vec<Value>,
    /// Set to make the registry fail every lookup with this status.
    pub registry_status: Option<u16>,
    /// Paths answered 200 with a NACK.
    pub nack_paths: Vec<String>,
}

pub type Net = Arc<Mutex<Network>>;

pub const LOOKUP: &str = "/api/v1/networkregistry/lookup";

/// The registry: the records matching every field asked, or 404.
fn lookup(net: &Network, ask: &Value) -> (StatusCode, Value) {
    if let Some(status) = net.registry_status {
        return (StatusCode::from_u16(status).expect("status"), json!({}));
    }
    let matches = |r: &Value, k: &str| ask[k].is_null() || r[k] == ask[k];
    let found: Vec<Value> = net
        .registry
        .iter()
        .filter(|r| {
            ["subscriber_id", "pub_key_id", "subscriber_url", "type"]
                .iter()
                .all(|k| matches(r, k))
        })
        .cloned()
        .collect();
    if found.is_empty() {
        return (
            StatusCode::NOT_FOUND,
            json!({ "message": "No record found!" }),
        );
    }
    (StatusCode::OK, json!(found))
}

async fn spawn_mock(net: Net) -> String {
    async fn record(
        State(net): State<Net>,
        uri: Uri,
        headers: HeaderMap,
        raw: Bytes,
    ) -> (StatusCode, Json<Value>) {
        let body: Value = serde_json::from_slice(&raw).unwrap_or(Value::Null);
        let path = uri.path().to_owned();
        let mut net = net.lock().expect("network");
        // The payment provider: a hosted link named after our payment row.
        let answer = if path.ends_with("/payment_links") {
            let reference = body["reference_id"]
                .as_str()
                .unwrap_or_default()
                .replace('-', "");
            (
                StatusCode::OK,
                json!({ "id": format!("plink_{reference}"),
                    "short_url": format!("https://rzp.test/i/{reference}") }),
            )
        } else if path == LOOKUP {
            lookup(&net, &body)
        } else if net.nack_paths.contains(&path) {
            (
                StatusCode::OK,
                protocol::nack("CONTEXT-ERROR", "UHI-1404", "bad on_search"),
            )
        } else {
            (StatusCode::OK, GatewaySpec::V202.ack())
        };
        net.calls.push(Call {
            path,
            headers,
            body,
            raw: raw.to_vec(),
        });
        (answer.0, Json(answer.1))
    }
    let app = Router::new().fallback(record).with_state(net);
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
    pub net: Net,
    pub mock: String,
    pub eua: KeyPair,
    pub gateway: KeyPair,
    pub subscriber: String,
    /// The hospital code in our callback URL.
    pub hospital: String,
    /// Our signing key, as Settings → UHI shows it.
    pub public_key: String,
}

/// The patient app's registry record: SUBSCRIBED, valid now, at `/eua`.
pub fn eua_record(mock: &str, eua: &KeyPair) -> Value {
    json!({ "subscriber_id": EUA_ID, "pub_key_id": "eua.k1", "type": "EUA",
            "domain": protocol::CONSULTATION_DOMAIN, "city": "std:080", "country": "IND",
            "status": "SUBSCRIBED", "encr_public_key": eua.public_key,
            "signing_public_key": eua.public_key, "subscriber_url": format!("{mock}/eua"),
            "valid_from": "2024-06-24T00:00:00", "valid_until": "2099-06-24T00:00:00" })
}

impl World {
    pub fn eua_uri(&self) -> String {
        format!("{}/eua", self.mock)
    }

    /// Every call the stand-in network received, oldest first.
    pub fn calls(&self) -> Vec<Call> {
        self.net.lock().expect("network").calls.clone()
    }

    pub fn net(&self) -> std::sync::MutexGuard<'_, Network> {
        self.net.lock().expect("network")
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

    /// POST `body` to `/{action}` as the app, signed with `key` (the app's,
    /// unless a test forges one; `None` sends it unsigned).
    pub async fn send(
        &self,
        action: &str,
        body: &Value,
        key: Option<&KeyPair>,
        gateway: bool,
    ) -> (StatusCode, Value) {
        if gateway {
            return self
                .forward(action, body, &self.gateway, "x-gateway-authorization")
                .await;
        }
        let raw = serde_json::to_vec(body).expect("json");
        let now = chrono::Utc::now().timestamp();
        let mut req = self.post(action);
        if let Some(key) = key {
            let header =
                sign(EUA_ID, "eua.k1", &key.private_key, &raw, (now, now + 60)).expect("sign");
            req = req.header("authorization", header);
        }
        Self::answer(req.body(raw)).await
    }

    /// POST `body` the way NHA's gateway forwards a search: re-serialised
    /// (here pretty-printed, so no app signature could survive), carrying
    /// only the gateway's signature, in `header`, made with `key`.
    pub async fn forward(
        &self,
        action: &str,
        body: &Value,
        key: &KeyPair,
        header: &str,
    ) -> (StatusCode, Value) {
        let raw = serde_json::to_vec_pretty(body).expect("json");
        let now = chrono::Utc::now().timestamp();
        let gw = sign(
            "gateway-nha",
            "uhi_gateway_pubkeyid",
            &key.private_key,
            &raw,
            (now, now + 60),
        )
        .expect("sign");
        Self::answer(self.post(action).header(header, gw).body(raw)).await
    }

    fn post(&self, action: &str) -> reqwest::RequestBuilder {
        reqwest::Client::new()
            .post(
                self.app
                    .url(&format!("/api/uhi/hspa/{}/{action}", self.hospital)),
            )
            .header("content-type", "application/json")
    }

    async fn answer(req: reqwest::RequestBuilder) -> (StatusCode, Value) {
        let resp = req.send().await.expect("uhi call");
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
        self.try_deliver(txn, on_action)
            .await
            .expect("callback sent");
        let call = self.calls().last().cloned().expect("a call");
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
        if let Some(digest) = call.headers.get("digest").and_then(|v| v.to_str().ok()) {
            assert_eq!(
                digest,
                format!("BLAKE-512={}", medbrains_crypto::beckn::digest(&call.raw)),
                "the Digest header is the body's"
            );
        }
        assert_eq!(call.body["context"]["action"], on_action);
        call
    }

    /// Run the latest queued `on_*` answer for `txn` through the handler.
    pub async fn try_deliver(
        &self,
        txn: &str,
        on_action: &str,
    ) -> Result<Value, medbrains_outbox::HandlerError> {
        let (event_id, payload) = self.queued(txn, on_action).await;
        UhiCallbackHandler
            .handle(&self.handler_ctx(event_id, "uhi.callback"), &payload)
            .await
    }

    /// The latest queued `on_*` answer for `txn`: (event id, payload).
    pub async fn queued(&self, txn: &str, on_action: &str) -> (Uuid, Value) {
        sqlx::query_as(
            "SELECT id, payload FROM outbox_events WHERE event_type = 'uhi.callback' \
               AND payload->'body'->'context'->>'transaction_id' = $1 \
               AND payload->'body'->'context'->>'action' = $2 \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(txn)
        .bind(on_action)
        .fetch_one(&self.app.db)
        .await
        .expect("an on_* answer is queued for the transaction")
    }

    fn handler_ctx(&self, event_id: Uuid, event_type: &str) -> medbrains_outbox::HandlerCtx {
        medbrains_outbox::HandlerCtx {
            pool: self.app.db.clone(),
            tenant_id: self.tenant,
            event_id,
            event_type: event_type.to_owned(),
            actor_user_id: None,
            attempts: 0,
            secret_resolver: Arc::new(secrets(&self.mock, &self.gateway, true)),
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

fn secrets(mock: &str, gateway: &KeyPair, preview: bool) -> common::TestSecrets {
    let s = common::TestSecrets::default()
        .with(auth::GATEWAY_KEY_SANDBOX, gateway.public_key.clone())
        .with(auth::UHI_GATEWAY_BASE_URL_OVERRIDE, mock.to_owned())
        .with("MEDBRAINS_PUBLIC_BASE_URL", "https://hospital.test")
        .with(API_BASE_OVERRIDE, format!("{mock}/razorpay/v1"));
    if preview {
        s.with(protocol::PREVIEW_SERVICES, "true")
    } else {
        s
    }
}

/// A hospital set up as a UHI provider of every service (previews on),
/// against a fresh mock network.
pub async fn world() -> World {
    world_with(true).await
}

/// As [`world`]; `preview` switches on the services UHI does not support
/// from a provider yet (teleconsultation, lab tests). Without it the
/// hospital offers the three live ones.
pub async fn world_with(preview: bool) -> World {
    let net: Net = Arc::default();
    let mock = spawn_mock(Arc::clone(&net)).await;
    let eua = generate();
    let gateway = generate();
    net.lock()
        .expect("network")
        .registry
        .push(eua_record(&mock, &eua));
    let app = common::spawn_app_with_secrets(secrets(&mock, &gateway, preview)).await;
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
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let subscriber = format!("hspa-{tag}.test").to_lowercase();
    let hospital: String = sqlx::query_scalar("SELECT lower(code) FROM tenants WHERE id = $1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("hospital code");
    // The campus with an HFR ID UHI needs: the tenant's, else a new one.
    let campus: Uuid = sqlx::query_scalar(
        "WITH found AS (SELECT id FROM facilities WHERE tenant_id = $1 \
                          AND hfr_facility_id IS NOT NULL AND deleted_at IS NULL LIMIT 1), \
              made AS (INSERT INTO facilities (tenant_id, code, name, facility_type, \
                          hfr_facility_id, hfr_status) \
                       SELECT $1, $2, 'UHI campus', 'main_hospital', $3, 'verified' \
                        WHERE NOT EXISTS (SELECT 1 FROM found) RETURNING id) \
         SELECT id FROM found UNION ALL SELECT id FROM made",
    )
    .bind(tenant)
    .bind(format!("UHI-{tag}"))
    .bind(format!("IN{tag}UH"))
    .fetch_one(&app.db)
    .await
    .expect("campus with an HFR ID");
    let services = if preview {
        json!([
            "teleconsultation",
            "physical_consultation",
            "lab_tests",
            "blood_bank",
            "ambulance"
        ])
    } else {
        json!(["physical_consultation", "blood_bank", "ambulance"])
    };
    let save = |active: bool, ids: bool| {
        json!({ "environment": "sandbox",
                "subscriber_id": ids.then_some(&subscriber), "unique_key_id": ids.then_some("hspa.k1"),
                "services": services, "city_code": "std:080", "facility_id": campus,
                "is_active": active })
    };
    let put = |body: Value| {
        app.client
            .put(app.url("/api/uhi/settings"))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };
    // NHA's order: services first, no IDs yet; the callback URL is known.
    let saved = put(save(true, false)).await.expect("save");
    assert_eq!(
        saved.status(),
        StatusCode::BAD_REQUEST,
        "no switching on without a key"
    );
    let saved = put(save(false, false)).await.expect("save");
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
        format!("https://hospital.test/api/uhi/hspa/{hospital}"),
        "the callback URL is named by the hospital, before NHA issues any ID"
    );
    let early = put(save(true, false)).await.expect("switch on");
    assert_eq!(
        early.status(),
        StatusCode::BAD_REQUEST,
        "no switching on before NHA issues the subscriber ID"
    );
    let on = put(save(true, true)).await.expect("switch on");
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
        net,
        mock,
        eua,
        gateway,
        subscriber,
        hospital,
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
