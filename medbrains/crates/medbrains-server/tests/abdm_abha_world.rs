#![allow(dead_code, unreachable_pub)]

//! A stand-in ABHA service for the M1 P1 tests (`abdm_m1_find_test`,
//! `abdm_m1_profile_test`): it decrypts what we send, the way ABDM does, and
//! records every call. One hospital's ABDM keys point at it, so the tests
//! that use it run one at a time on [`SERIAL`].

use std::sync::{Arc, Mutex};

use crate::common;

use axum::{
    Json, Router,
    extract::State,
    http::{StatusCode as MockStatus, Uri},
    routing::{get, post},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use openssl::{pkey::Private, rsa::Rsa};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Tests that save ABDM keys for the same hospital run one at a time.
pub static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// An Aadhaar with no ABHA behind it (VRFY_ABHA_403).
pub const NO_ABHA_AADHAAR: &str = "999999999999";
/// An OTP the stand-in refuses with ABDM-1017.
pub const EXPIRED_OTP: &str = "000000";
pub const NUMBER: &str = "91-1111-2222-3333";

#[derive(Clone)]
pub struct Mock {
    key: Arc<Rsa<Private>>,
    calls: Arc<Mutex<Vec<(String, Value)>>>,
}

impl Mock {
    pub fn decrypt(&self, cipher: &Value) -> String {
        let bytes = STANDARD
            .decode(cipher.as_str().unwrap_or_default())
            .unwrap_or_default();
        let mut out = vec![0; self.key.size() as usize];
        let n = self
            .key
            .private_decrypt(&bytes, &mut out, openssl::rsa::Padding::PKCS1_OAEP)
            .unwrap_or(0);
        String::from_utf8_lossy(&out[..n]).into_owned()
    }

    fn record(&self, uri: &Uri, body: &Value) {
        self.calls
            .lock()
            .expect("calls")
            .push((uri.path().to_owned(), body.clone()));
    }

    pub fn sent(&self, path: &str) -> Vec<Value> {
        let calls = self.calls.lock().expect("calls");
        calls
            .iter()
            .filter(|(p, _)| p == path)
            .map(|(_, b)| b.clone())
            .collect()
    }
}

async fn request_otp(State(m): State<Mock>, uri: Uri, Json(body): Json<Value>) -> Json<Value> {
    m.record(&uri, &body);
    let txn = match body["loginHint"].as_str() {
        Some("aadhaar") if m.decrypt(&body["loginId"]) == NO_ABHA_AADHAAR => "otp-none",
        Some("aadhaar") => "otp-aadhaar",
        Some("index") => "otp-found",
        _ => "otp-number",
    };
    Json(json!({ "txnId": txn, "message": "OTP sent to mobile ending ******3210" }))
}

async fn login_verify(
    State(m): State<Mock>,
    uri: Uri,
    Json(body): Json<Value>,
) -> (MockStatus, Json<Value>) {
    m.record(&uri, &body);
    if m.decrypt(&body["authData"]["otp"]["otpValue"]) == EXPIRED_OTP {
        let refused =
            json!({ "error": { "code": "ABDM-1017: ", "message": "Invalid TransactionId" } });
        return (MockStatus::BAD_REQUEST, Json(refused));
    }
    let accounts = match body["authData"]["otp"]["txnId"].as_str() {
        Some("otp-number") | Some("otp-none") => json!([]),
        _ => json!([{ "ABHANumber": NUMBER, "preferredAbhaAddress": "asha@sbx", "name": "Asha" }]),
    };
    let answer = json!({ "txnId": "verified-txn", "authResult": "success", "token": "person-token",
                         "accounts": accounts });
    (MockStatus::OK, Json(answer))
}

async fn record_ok(State(m): State<Mock>, uri: Uri, Json(body): Json<Value>) -> Json<Value> {
    m.record(&uri, &body);
    Json(
        json!({ "txnId": "acct-txn", "authResult": "success", "message": "Done at ABDM",
                 "token": "x-token" }),
    )
}

pub async fn spawn_mock() -> (String, Mock) {
    let key = Rsa::generate(2048).expect("rsa");
    let public = STANDARD.encode(key.public_key_to_der().expect("der"));
    let mock = Mock {
        key: Arc::new(key),
        calls: Arc::new(Mutex::new(Vec::new())),
    };
    let app = Router::new()
        .route(
            "/sessions",
            post(|| async { Json(json!({ "accessToken": "session-token", "expiresIn": 1200 })) }),
        )
        .route(
            "/v3/profile/public/certificate",
            get(move || async move { Json(json!({ "publicKey": public })) }),
        )
        .route(
            "/v3/profile/account/abha/search",
            post(|State(m): State<Mock>, uri: Uri, Json(body): Json<Value>| async move {
                m.record(&uri, &body);
                Json(json!([{ "txnId": "search-txn", "ABHA": [
                    { "index": 1, "ABHANumber": "xx-xxxx-xxxx-1111", "name": "Asha", "gender": "F" },
                    { "index": 2, "ABHANumber": "xx-xxxx-xxxx-2222", "name": "Ravi", "gender": "M" }] }]))
            }),
        )
        .route("/v3/profile/login/request/otp", post(request_otp))
        .route("/v3/profile/login/verify", post(login_verify))
        .route("/v3/profile/login/verify/user", post(record_ok))
        .route("/v3/profile/account/request/otp", post(record_ok))
        .route("/v3/profile/account/verify", post(record_ok))
        .route(
            "/v3/profile/account",
            get(|| async {
                Json(json!({ "ABHANumber": NUMBER, "preferredAbhaAddress": "asha@sbx",
                             "firstName": "Asha", "gender": "F", "yearOfBirth": "1990",
                             "kycVerified": true }))
            })
            .patch(record_ok),
        )
        .with_state(mock.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    (format!("http://{addr}"), mock)
}

pub async fn app_with_keys() -> (common::TestApp, String, Mock) {
    let (url, mock) = spawn_mock().await;
    let app = common::spawn_app_with_secrets(
        common::TestSecrets::default().with(medbrains_abdm::ABDM_BASE_URL_OVERRIDE, url),
    )
    .await;
    let csrf = app.login_admin().await;
    let (s, _) = send(
        &app,
        &csrf,
        "/api/abdm/settings",
        json!({ "environment": "sandbox",
        "client_id": "sbx-client", "client_secret": "s" }),
        true,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    // A number verified in an earlier test is on a patient; free it.
    sqlx::query(
        "UPDATE patient_abha_links SET deleted_at = now() WHERE abha_number = '91111122223333'",
    )
    .execute(&app.db)
    .await
    .expect("free the ABHA");
    (app, csrf, mock)
}

pub async fn send(
    app: &common::TestApp,
    csrf: &str,
    path: &str,
    body: Value,
    put: bool,
) -> (StatusCode, Value) {
    let builder = if put {
        app.client.put(app.url(path))
    } else {
        app.client.post(app.url(path))
    };
    let r = builder
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = r.status();
    (status, r.json().await.unwrap_or(Value::Null))
}

pub async fn call(
    app: &common::TestApp,
    csrf: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    send(app, csrf, path, body, false).await
}

/// Verify by ABHA number, end to end, and return the verification id.
pub async fn verified(app: &common::TestApp, csrf: &str) -> String {
    let (s, step) = call(
        app,
        csrf,
        "/api/abdm/abha/verifications",
        json!({ "method": "abha_number", "value": NUMBER, "otp_via": "aadhaar" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{step}");
    let id = step["id"].as_str().expect("id").to_owned();
    let (s, done) = call(
        app,
        csrf,
        &format!("/api/abdm/abha/verifications/{id}/otp"),
        json!({ "otp": "123456" }),
    )
    .await;
    assert_eq!(
        (s, done["stage"].as_str()),
        (StatusCode::OK, Some("verified")),
        "{done}"
    );
    id
}

/// A patient registered with the verified ABHA, holding one HIP consent.
pub async fn patient_with_the_abha(app: &common::TestApp, csrf: &str, id: &str) -> Uuid {
    let resp = app.client.post(app.url("/api/patients")).header("x-csrf-token", csrf)
        .json(&json!({ "first_name": "Asha", "last_name": "Rao", "gender": "female",
            "date_of_birth": "1990-01-01", "phone": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
            "abha_number": NUMBER, "abha_verification_id": id }))
        .send().await.expect("register");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: Value = resp.json().await.expect("patient");
    let patient: Uuid = body["id"]
        .as_str()
        .or(body["patient"]["id"].as_str())
        .and_then(|s| s.parse().ok())
        .expect("patient id");
    sqlx::query(
        "INSERT INTO abdm_consent_artefacts (tenant_id, consent_id, role, patient_id, status) \
                 SELECT tenant_id, $2, 'hip', id, 'GRANTED' FROM patients WHERE id = $1",
    )
    .bind(patient)
    .bind(Uuid::new_v4().to_string())
    .execute(&app.db)
    .await
    .expect("consent");
    patient
}
