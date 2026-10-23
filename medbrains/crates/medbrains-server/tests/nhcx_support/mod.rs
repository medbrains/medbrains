#![allow(dead_code, unreachable_pub)]

//! A stand-in NHCX for integration tests: RSA key pairs and certificates for
//! the hospital, a payer and the gateway; a mock gateway that records what it
//! receives; and the steps every NHCX test takes — save the settings, add
//! the payer, run a queued message through its outbox handler, deliver a
//! payer's encrypted callback.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::Bytes;
use axum::extract::Path;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use medbrains_core::nhcx::NhcxOperation;
use medbrains_outbox::Handler;
use medbrains_outbox::handlers::nhcx::NhcxHandler;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::common;

pub mod claim_seed;
pub mod seed;

pub struct KeyPair {
    pub private_pem: String,
    pub public_pem: String,
    pub key: PKey<Private>,
}

pub fn key_pair() -> KeyPair {
    let key = PKey::from_rsa(Rsa::generate(2048).expect("rsa")).expect("pkey");
    KeyPair {
        private_pem: String::from_utf8(key.private_key_to_pem_pkcs8().expect("pem")).expect("utf8"),
        public_pem: String::from_utf8(key.public_key_to_pem().expect("pem")).expect("utf8"),
        key,
    }
}

pub fn self_signed_cert(pair: &KeyPair) -> String {
    let mut name = openssl::x509::X509NameBuilder::new().expect("name");
    name.append_entry_by_text("CN", "hospital").expect("cn");
    let name = name.build();
    let mut cert = openssl::x509::X509Builder::new().expect("cert");
    cert.set_subject_name(&name).expect("subject");
    cert.set_issuer_name(&name).expect("issuer");
    cert.set_version(2).expect("cert fields");
    cert.set_serial_number(
        &openssl::bn::BigNum::from_u32(1)
            .expect("cert fields")
            .to_asn1_integer()
            .expect("cert fields"),
    )
    .expect("cert fields");
    cert.set_not_before(&openssl::asn1::Asn1Time::days_from_now(0).expect("cert fields"))
        .expect("cert fields");
    cert.set_not_after(&openssl::asn1::Asn1Time::days_from_now(365).expect("cert fields"))
        .expect("cert fields");
    cert.set_pubkey(&pair.key).expect("pubkey");
    cert.sign(&pair.key, openssl::hash::MessageDigest::sha256())
        .expect("sign");
    String::from_utf8(cert.build().to_pem().expect("pem")).expect("utf8")
}

/// What the stand-in gateway received: (path, HTTP headers, body).
pub type Received = Arc<Mutex<Vec<(String, HeaderMap, Value)>>>;

pub async fn spawn_mock_gateway(received: Received) -> String {
    spawn_mock_gateway_with(received, Arc::default()).await
}

/// The stand-in gateway; while `down` is set it records the call and
/// answers 503, as a gateway that took the message but timed out would.
pub async fn spawn_mock_gateway_with(received: Received, down: Arc<AtomicBool>) -> String {
    let app = Router::new()
        .route(
            "/sessions",
            post(|| async { Json(json!({ "accessToken": "mock-session", "expiresIn": 600 })) }),
        )
        .route(
            "/hcx/v1/{*path}",
            post(
                move |Path(path): Path<String>, headers: HeaderMap, Json(body): Json<Value>| {
                    let received = Arc::clone(&received);
                    let down = Arc::clone(&down);
                    async move {
                        received.lock().expect("lock").push((path, headers, body));
                        if down.load(Ordering::SeqCst) {
                            return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({})));
                        }
                        (StatusCode::ACCEPTED, Json(json!({ "timestamp": "now" })))
                    }
                },
            ),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.expect("mock gateway") });
    format!("http://{addr}")
}

/// How the stand-in PDF service behaves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pdf {
    /// Every document renders as a tiny PDF.
    Tiny,
    /// Lab reports render larger than one file may be; the rest are tiny.
    BigLabReports,
    /// Configured, but nothing answers.
    Down,
}

/// The smallest thing a payer would open as a PDF.
pub const TINY_PDF: &[u8] = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n";

/// Every HTML document the stand-in Gotenberg was asked to print.
pub type Rendered = Arc<Mutex<Vec<String>>>;

/// A stand-in Gotenberg: `/forms/chromium/convert/html` answers with a PDF,
/// keeping the request (the HTML is in its multipart body) in `rendered`.
pub async fn spawn_mock_gotenberg(mode: Pdf, rendered: Rendered) -> String {
    if mode == Pdf::Down {
        // Port 9 (discard) is never served on the test host: connection refused.
        return "http://127.0.0.1:9".to_owned();
    }
    let app = Router::new()
        .route("/health", get(|| async { StatusCode::OK }))
        .route(
            "/forms/chromium/convert/html",
            post(move |body: Bytes| {
                rendered
                    .lock()
                    .expect("lock")
                    .push(String::from_utf8_lossy(&body).into_owned());
                // The lab report template's own CSS class marks its HTML.
                let is_lab = body.windows(8).any(|w| w == b"lab-head");
                async move {
                    if mode == Pdf::BigLabReports && is_lab {
                        let mut big = TINY_PDF.to_vec();
                        big.resize(
                            medbrains_facilities::nhcx_claim_documents::MAX_FILE_BYTES + 1,
                            b' ',
                        );
                        return big;
                    }
                    TINY_PDF.to_vec()
                }
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.expect("mock gotenberg") });
    format!("http://{addr}")
}

/// A hospital set up for NHCX against the mock gateway, with one payer.
pub struct Nhcx {
    pub app: common::TestApp,
    pub csrf: String,
    pub tenant: Uuid,
    pub tag: String,
    pub hospital: KeyPair,
    pub hospital_cert: String,
    pub payer: KeyPair,
    pub gateway: KeyPair,
    pub hospital_code: String,
    pub payer_code: String,
    pub received: Received,
    /// While set, the mock gateway answers 503.
    pub gateway_down: Arc<AtomicBool>,
    pub mock: String,
    pub rendered: Rendered,
}

/// One delivery from the gateway, as [`Nhcx::deliver`] sends it.
pub struct Delivery<'a> {
    pub path: &'a str,
    pub correlation_id: &'a str,
    pub api_call_id: Uuid,
    /// `x-hcx-workflow_id`; `None` leaves it out.
    pub workflow: Option<&'a str>,
    /// `x-hcx-status`; `None` leaves it out.
    pub status: Option<&'a str>,
    pub answer: &'a Value,
}

impl<'a> Delivery<'a> {
    pub fn new(path: &'a str, correlation_id: &'a str, answer: &'a Value) -> Self {
        Self {
            path,
            correlation_id,
            api_call_id: Uuid::new_v4(),
            workflow: None,
            status: Some("response.complete"),
            answer,
        }
    }
}

impl Nhcx {
    pub fn secrets(&self) -> common::TestSecrets {
        secrets_for(&self.mock)
    }

    /// Run the queued outbox event of `operation` for `correlation_id`
    /// exactly as the worker would, and return what the gateway got.
    pub async fn send(&self, operation: NhcxOperation, correlation_id: &str) -> (String, Value) {
        self.send_attempt(operation, correlation_id, 1)
            .await
            .expect("handler sends");
        let (path, _, body) = self
            .received
            .lock()
            .expect("lock")
            .last()
            .cloned()
            .expect("a POST");
        (path, body)
    }

    /// Run the queued event as the worker's `attempt`-th try.
    pub async fn send_attempt(
        &self,
        operation: NhcxOperation,
        correlation_id: &str,
        attempt: i32,
    ) -> Result<Value, medbrains_outbox::HandlerError> {
        let (event_id, payload): (Uuid, Value) = sqlx::query_as(
            "SELECT id, payload FROM outbox_events \
             WHERE event_type = $1 AND payload->>'correlation_id' = $2 \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(operation.event_type())
        .bind(correlation_id)
        .fetch_one(&self.app.db)
        .await
        .expect("queued event");
        let ctx = medbrains_outbox::HandlerCtx {
            pool: self.app.db.clone(),
            tenant_id: self.tenant,
            event_id,
            event_type: operation.event_type().to_owned(),
            actor_user_id: None,
            attempts: attempt,
            secret_resolver: Arc::new(self.secrets()),
            http_client: reqwest::Client::new(),
            object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
                std::env::temp_dir().join("medbrains-test-docs"),
            )),
        };
        NhcxHandler::new(operation).handle(&ctx, &payload).await
    }

    /// A gateway JWT with the claims NHCX's carries: `iss` = `sub`, `jti`.
    pub fn gateway_jwt(&self) -> String {
        gateway_jwt(&self.gateway)
    }

    /// Open what the payer received: its protected headers and plaintext.
    pub fn open_as_payer(&self, body: &Value) -> (Map<String, Value>, Value) {
        let jwe = body["payload"].as_str().expect("{payload: <JWE>}");
        medbrains_crypto::jwe::decrypt_hcx(jwe, self.payer.private_pem.as_bytes())
            .expect("payer opens it")
    }

    /// The payer answers through the gateway: `answer` encrypted to the
    /// hospital, with a valid gateway JWT.
    pub async fn callback(&self, path: &str, correlation_id: &str, answer: &Value) -> StatusCode {
        self.callback_with(path, correlation_id, Uuid::new_v4(), answer)
            .await
    }

    /// Deliver a payer's message; returns the HTTP status and the receipt.
    pub async fn deliver(&self, d: &Delivery<'_>) -> (StatusCode, Value) {
        let mut routing = Map::new();
        routing.insert("x-hcx-sender_code".into(), json!(self.payer_code));
        routing.insert("x-hcx-recipient_code".into(), json!(self.hospital_code));
        routing.insert("x-hcx-correlation_id".into(), json!(d.correlation_id));
        routing.insert("x-hcx-api_call_id".into(), json!(d.api_call_id));
        if let Some(status) = d.status {
            routing.insert("x-hcx-status".into(), json!(status));
        }
        if let Some(workflow) = d.workflow {
            routing.insert("x-hcx-workflow_id".into(), json!(workflow));
        }
        let reply =
            medbrains_crypto::jwe::encrypt_hcx(d.answer, &routing, self.hospital_cert.as_bytes())
                .expect("encrypt reply");
        let resp = reqwest::Client::new()
            .post(
                self.app
                    .url(&format!("/api/integrations/nhcx/hcx/v1/{}", d.path)),
            )
            .bearer_auth(self.gateway_jwt())
            .json(&json!({ "payload": reply }))
            .send()
            .await
            .expect("callback");
        let status = resp.status();
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    /// As [`Self::callback`], with the payer's api call id — a retried
    /// delivery repeats it.
    pub async fn callback_with(
        &self,
        path: &str,
        correlation_id: &str,
        api_call_id: Uuid,
        answer: &Value,
    ) -> StatusCode {
        let d = Delivery {
            api_call_id,
            ..Delivery::new(path, correlation_id, answer)
        };
        self.deliver(&d).await.0
    }
}

/// A token signed by `key` with the claims NHCX's gateway token carries.
pub fn gateway_jwt(key: &KeyPair) -> String {
    let mut claims = Map::new();
    claims.insert("iss".into(), json!("nhcx-gateway"));
    claims.insert("sub".into(), json!("nhcx-gateway"));
    claims.insert("jti".into(), json!(Uuid::new_v4()));
    medbrains_crypto::jws::sign_rs256(claims, Duration::from_secs(300), key.private_pem.as_bytes())
        .expect("gateway jwt")
}

fn secrets_for(mock: &str) -> common::TestSecrets {
    common::TestSecrets(HashMap::from([(
        "NHCX_BASE_URL_OVERRIDE".to_owned(),
        mock.to_owned(),
    )]))
}

/// A server whose NHCX calls go to a fresh mock gateway, signed in as admin,
/// with the hospital's NHCX settings saved and one payer in the directory.
pub async fn onboard() -> Nhcx {
    onboard_with(Pdf::Tiny).await
}

/// [`onboard`], with the PDF service behaving as `pdf`.
pub async fn onboard_with(pdf: Pdf) -> Nhcx {
    let hospital = key_pair();
    let hospital_cert = self_signed_cert(&hospital);
    let payer = key_pair();
    let gateway = key_pair();
    let received: Received = Arc::default();
    let gateway_down: Arc<AtomicBool> = Arc::default();
    let mock = spawn_mock_gateway_with(Arc::clone(&received), Arc::clone(&gateway_down)).await;
    let rendered: Rendered = Arc::default();
    let gotenberg = spawn_mock_gotenberg(pdf, Arc::clone(&rendered)).await;
    let app =
        common::spawn_app_with_secrets(secrets_for(&mock).with("GOTENBERG_URL", gotenberg)).await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let hospital_code = format!("hosp-{tag}@sbx");
    let payer_code = format!("payer-{tag}@sbx");

    let saved = app
        .client
        .put(app.url("/api/integrations/nhcx/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "environment": "sandbox",
            "participant_code": hospital_code,
            "client_id": "mock-client",
            "client_secret": "mock-secret",
            "private_key_pem": hospital.private_pem,
            "public_cert_pem": hospital_cert,
            "gateway_jwt_public_key_pem": gateway.public_pem,
        }))
        .send()
        .await
        .expect("save settings");
    assert_eq!(
        saved.status(),
        StatusCode::OK,
        "{}",
        saved.text().await.unwrap_or_default()
    );
    let payer_saved = app
        .client
        .post(app.url("/api/nhcx/participants"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "participant_code": payer_code,
            "participant_name": "Mock Payer",
            "encryption_cert": payer.public_pem,
        }))
        .send()
        .await
        .expect("add payer");
    assert_eq!(payer_saved.status(), StatusCode::OK);

    Nhcx {
        app,
        csrf,
        tenant,
        tag,
        hospital,
        hospital_cert,
        payer,
        gateway,
        hospital_code,
        payer_code,
        received,
        gateway_down,
        mock,
        rendered,
    }
}
