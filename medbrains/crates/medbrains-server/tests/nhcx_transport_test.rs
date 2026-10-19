//! NHCX transport, end to end against a stand-in gateway.
//!
//! A claim submitted with the settings saved reaches the gateway as a JWE that
//! only the payer's key opens, with the HCX routing headers in its protected
//! header; the payer's answer, encrypted to our certificate and carrying a
//! valid gateway JWT, lands on the claim; a callback with a forged JWT is
//! refused and changes nothing.

mod common;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::Path;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::post;
use axum::{Json, Router};
use medbrains_core::nhcx::NhcxOperation;
use medbrains_outbox::Handler;
use medbrains_outbox::handlers::nhcx::NhcxHandler;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use serde_json::{Map, Value, json};
use uuid::Uuid;

struct KeyPair {
    private_pem: String,
    public_pem: String,
    key: PKey<Private>,
}

fn key_pair() -> KeyPair {
    let key = PKey::from_rsa(Rsa::generate(2048).expect("rsa")).expect("pkey");
    KeyPair {
        private_pem: String::from_utf8(key.private_key_to_pem_pkcs8().expect("pem")).expect("utf8"),
        public_pem: String::from_utf8(key.public_key_to_pem().expect("pem")).expect("utf8"),
        key,
    }
}

fn self_signed_cert(pair: &KeyPair) -> String {
    let mut name = openssl::x509::X509NameBuilder::new().expect("name");
    name.append_entry_by_text("CN", "hospital").expect("cn");
    let name = name.build();
    let mut cert = openssl::x509::X509Builder::new().expect("cert");
    cert.set_subject_name(&name).expect("subject");
    cert.set_issuer_name(&name).expect("issuer");
    cert.set_pubkey(&pair.key).expect("pubkey");
    cert.sign(&pair.key, openssl::hash::MessageDigest::sha256())
        .expect("sign");
    String::from_utf8(cert.build().to_pem().expect("pem")).expect("utf8")
}

/// What the stand-in gateway received: (path, Authorization, body).
type Received = Arc<Mutex<Vec<(String, Option<String>, Value)>>>;

async fn spawn_mock_gateway(received: Received) -> String {
    let app = Router::new()
        .route(
            "/sessions",
            post(|| async { Json(json!({ "accessToken": "mock-session", "expiresIn": 600 })) }),
        )
        .route(
            "/hcx/v1/{resource}/{action}",
            post(
                move |Path((resource, action)): Path<(String, String)>,
                      headers: HeaderMap,
                      Json(body): Json<Value>| {
                    let received = Arc::clone(&received);
                    async move {
                        let auth = headers
                            .get("authorization")
                            .and_then(|v| v.to_str().ok())
                            .map(str::to_owned);
                        received.lock().expect("lock").push((
                            format!("{resource}/{action}"),
                            auth,
                            body,
                        ));
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

#[tokio::test]
async fn a_claim_goes_to_nhcx_encrypted_and_the_payers_answer_lands_on_it() {
    let hospital = key_pair();
    let hospital_cert = self_signed_cert(&hospital);
    let payer = key_pair();
    let gateway = key_pair();
    let received: Received = Arc::default();
    let mock = spawn_mock_gateway(Arc::clone(&received)).await;

    let secrets = || {
        common::TestSecrets(HashMap::from([(
            "NHCX_BASE_URL_OVERRIDE".to_owned(),
            mock.clone(),
        )]))
    };
    let app = common::spawn_app_with_secrets(secrets()).await;
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
    let view: Value = app
        .client
        .get(app.url("/api/integrations/nhcx/settings"))
        .send()
        .await
        .expect("get settings")
        .json()
        .await
        .expect("json");
    assert_eq!(view["has_private_key"], json!(true));
    assert!(
        view.get("private_key_pem").is_none(),
        "the private key is never returned"
    );
    assert!(
        !view.to_string().contains("mock-secret"),
        "nor the client secret"
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

    let claim_id = seed_claim(&app, tenant, &tag).await;
    let submitted = app
        .client
        .post(app.url(&format!(
            "/api/billing/insurance-claims/{claim_id}/submit-to-nhcx"
        )))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "recipient_code": payer_code, "use": "claim" }))
        .send()
        .await
        .expect("submit");
    assert_eq!(
        submitted.status(),
        StatusCode::OK,
        "{}",
        submitted.text().await.unwrap_or_default()
    );
    let submitted: Value = submitted.json().await.expect("json");
    let correlation_id = submitted["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned();

    // The correlation id was saved on the claim in the same transaction.
    let (saved_correlation, status): (Option<Uuid>, Option<String>) = sqlx::query_as(
        "SELECT nhcx_correlation_id, nhcx_status FROM insurance_claims WHERE id = $1",
    )
    .bind(claim_id)
    .fetch_one(&app.db)
    .await
    .expect("claim");
    assert_eq!(
        saved_correlation.map(|c| c.to_string()),
        Some(correlation_id.clone())
    );
    assert_eq!(status.as_deref(), Some("queued"));

    // Run the outbox event exactly as the worker would.
    let (event_id, payload): (Uuid, Value) = sqlx::query_as(
        "SELECT id, payload FROM outbox_events \
         WHERE event_type = 'nhcx.claim_submit' AND payload->>'correlation_id' = $1",
    )
    .bind(&correlation_id)
    .fetch_one(&app.db)
    .await
    .expect("queued event");
    let ctx = medbrains_outbox::HandlerCtx {
        pool: app.db.clone(),
        tenant_id: tenant,
        event_id,
        event_type: "nhcx.claim_submit".to_owned(),
        actor_user_id: None,
        attempts: 0,
        secret_resolver: Arc::new(secrets()),
        http_client: reqwest::Client::new(),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-test-docs"),
        )),
    };
    NhcxHandler::new(NhcxOperation::Claim)
        .handle(&ctx, &payload)
        .await
        .expect("handler sends");

    let (path, auth, body) = received
        .lock()
        .expect("lock")
        .first()
        .cloned()
        .expect("a POST");
    assert_eq!(path, "claim/submit");
    assert_eq!(auth.as_deref(), Some("Bearer mock-session"));
    let jwe = body["payload"]
        .as_str()
        .expect("the body is {payload: <JWE>}");
    assert!(
        medbrains_crypto::jwe::decrypt_hcx(jwe, hospital.private_pem.as_bytes()).is_err(),
        "only the payer can read it"
    );
    let (headers, bundle) = medbrains_crypto::jwe::decrypt_hcx(jwe, payer.private_pem.as_bytes())
        .expect("payer opens it");
    assert_eq!(headers["x-hcx-sender_code"], json!(hospital_code));
    assert_eq!(headers["x-hcx-recipient_code"], json!(payer_code));
    assert_eq!(headers["x-hcx-correlation_id"], json!(correlation_id));
    assert!(headers.contains_key("x-hcx-api_call_id") && headers.contains_key("x-hcx-workflow_id"));
    assert_eq!(
        bundle["resourceType"],
        json!("Bundle"),
        "the plaintext is the bundle, no inner JWS"
    );
    assert_eq!(claim_status(&app, claim_id).await.as_deref(), Some("sent"));

    // The payer answers through the gateway.
    let mut routing = Map::new();
    routing.insert("x-hcx-sender_code".into(), json!(payer_code));
    routing.insert("x-hcx-recipient_code".into(), json!(hospital_code));
    routing.insert("x-hcx-correlation_id".into(), json!(correlation_id));
    routing.insert("x-hcx-api_call_id".into(), json!(Uuid::new_v4()));
    routing.insert("x-hcx-status".into(), json!("response.complete"));
    let answer = json!({ "resourceType": "Bundle", "entry": [{ "resource": {
        "resourceType": "ClaimResponse", "outcome": "complete",
        "total": [{ "category": { "coding": [{ "code": "benefit" }] }, "amount": { "value": 4500 } }]
    }}]});
    let reply = medbrains_crypto::jwe::encrypt_hcx(&answer, &routing, hospital_cert.as_bytes())
        .expect("encrypt reply");
    let callback = app.url("/api/integrations/nhcx/hcx/v1/claim/on_submit");
    let gateway_client = reqwest::Client::new();

    let forged = medbrains_crypto::jws::sign_rs256(
        Map::new(),
        Duration::from_secs(300),
        key_pair().private_pem.as_bytes(),
    )
    .expect("forged jwt");
    let refused = gateway_client
        .post(&callback)
        .bearer_auth(forged)
        .json(&json!({ "payload": reply }))
        .send()
        .await
        .expect("forged callback");
    assert_eq!(refused.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        claim_status(&app, claim_id).await.as_deref(),
        Some("sent"),
        "nothing changed"
    );

    let jwt = medbrains_crypto::jws::sign_rs256(
        Map::new(),
        Duration::from_secs(300),
        gateway.private_pem.as_bytes(),
    )
    .expect("gateway jwt");
    let accepted = gateway_client
        .post(&callback)
        .bearer_auth(jwt)
        .json(&json!({ "payload": reply }))
        .send()
        .await
        .expect("callback");
    assert_eq!(accepted.status(), StatusCode::ACCEPTED);
    let ack: Value = accepted.json().await.expect("ack");
    assert_eq!(ack["correlation_id"], json!(correlation_id));
    assert!(ack.get("timestamp").is_some() && ack.get("api_call_id").is_some());

    let (status, outcome, approved): (
        Option<String>,
        Option<String>,
        Option<rust_decimal::Decimal>,
    ) = sqlx::query_as(
        "SELECT nhcx_status, nhcx_outcome, approved_amount FROM insurance_claims WHERE id = $1",
    )
    .bind(claim_id)
    .fetch_one(&app.db)
    .await
    .expect("claim");
    assert_eq!(status.as_deref(), Some("response.complete"));
    assert_eq!(outcome.as_deref(), Some("complete"));
    assert_eq!(approved, Some(rust_decimal::Decimal::from(4500)));
}

async fn claim_status(app: &common::TestApp, claim_id: Uuid) -> Option<String> {
    sqlx::query_scalar("SELECT nhcx_status FROM insurance_claims WHERE id = $1")
        .bind(claim_id)
        .fetch_one(&app.db)
        .await
        .expect("claim status")
}

async fn seed_claim(app: &common::TestApp, tenant: Uuid, tag: &str) -> Uuid {
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Nhcx', 'Patient', 'female'::gender, '9000000103') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-NHCX-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, subtotal, total_amount) \
         VALUES ($1, $2, $3, 5000, 5000) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-NHCX-{tag}"))
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("invoice");
    sqlx::query(
        "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, unit_price, \
             total_price, source) \
         VALUES ($1, $2, 'X', 'Room rent', 5000, 5000, 'manual')",
    )
    .bind(tenant)
    .bind(invoice)
    .execute(&app.db)
    .await
    .expect("item");
    sqlx::query_scalar(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, status) \
         VALUES ($1, $2, $3, 'Mock Payer', 'claim_submitted') RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("claim")
}
