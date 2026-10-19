//! The whole "Verify ABHA" path against a stand-in ABDM, so the integration is
//! proven before real keys exist: keys saved on Settings → ABDM, a session
//! signed in, fields encrypted to ABDM's key, the OTP checked, the profile
//! fetched, the patient registered with a verified link, the card printed.
//!
//! The mock decrypts what we send with its private key, so a wrong padding or
//! a field sent in clear fails here exactly as it would at ABDM.

mod common;

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use openssl::{pkey::Private, rsa::Padding, rsa::Rsa};
use serde_json::{Value, json};

/// Both tests save ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const OTP: &str = "424242";
const ABHA: &str = "91-1111-2222-3333";

struct Mock {
    key: Rsa<Private>,
}

impl Mock {
    fn decrypt(&self, b64: &str) -> String {
        let cipher = STANDARD.decode(b64).unwrap_or_default();
        let mut out = vec![0_u8; usize::try_from(self.key.size()).unwrap_or(0)];
        let n = self
            .key
            .private_decrypt(&cipher, &mut out, Padding::PKCS1_OAEP)
            .unwrap_or(0);
        String::from_utf8_lossy(&out[..n]).into_owned()
    }
}

fn signed_in(headers: &HeaderMap) -> bool {
    headers.get("authorization").and_then(|v| v.to_str().ok()) == Some("Bearer session-token")
        && headers.contains_key("request-id")
        && headers.contains_key("timestamp")
}

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

fn image_if(
    headers: &HeaderMap,
    token: &str,
) -> (StatusCode, [(&'static str, &'static str); 1], Vec<u8>) {
    let ok = header(headers, "x-token") == Some(token);
    (
        if ok {
            StatusCode::OK
        } else {
            StatusCode::UNAUTHORIZED
        },
        [("content-type", "image/png")],
        b"PNG".to_vec(),
    )
}

async fn spawn_mock() -> String {
    let mock = Arc::new(Mock {
        key: Rsa::generate(2048).expect("rsa"),
    });
    let app = Router::new()
        .route(
            "/sessions",
            post(|Json(body): Json<Value>| async move {
                if body["clientId"] == "sbx-client" && body["clientSecret"] == "sbx-secret" {
                    (StatusCode::OK, Json(json!({ "accessToken": "session-token", "expiresIn": 1200 })))
                } else {
                    (StatusCode::UNAUTHORIZED, Json(json!({ "message": "Invalid client credentials" })))
                }
            }),
        )
        .route(
            "/v3/profile/public/certificate",
            get(|State(m): State<Arc<Mock>>| async move {
                let der = m.key.public_key_to_der().unwrap_or_default();
                Json(json!({ "publicKey": STANDARD.encode(der) }))
            }),
        )
        .route(
            "/v3/profile/login/request/otp",
            post(|State(m): State<Arc<Mock>>, headers: HeaderMap, Json(body): Json<Value>| async move {
                let id = m.decrypt(body["loginId"].as_str().unwrap_or(""));
                if !signed_in(&headers) || id != ABHA {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "message": "ABHA number not found" })));
                }
                (StatusCode::OK, Json(json!({ "txnId": "txn-1", "message": "OTP sent to ******0161" })))
            }),
        )
        .route(
            "/v3/profile/login/verify",
            post(|State(m): State<Arc<Mock>>, Json(body): Json<Value>| async move {
                let otp = m.decrypt(body["authData"]["otp"]["otpValue"].as_str().unwrap_or(""));
                if otp != OTP {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "message": "Invalid OTP" })));
                }
                (StatusCode::OK, Json(json!({ "txnId": "txn-1", "authResult": "success", "token": "x-token" })))
            }),
        )
        .route(
            "/v3/profile/account",
            get(|headers: HeaderMap| async move {
                if headers.get("x-token").and_then(|v| v.to_str().ok()) != Some("Bearer x-token") {
                    return (StatusCode::UNAUTHORIZED, Json(json!({ "message": "X-token required" })));
                }
                (StatusCode::OK, Json(json!({
                    "ABHANumber": ABHA, "preferredAbhaAddress": "priya@sbx",
                    "firstName": "Priya", "lastName": "Varude", "gender": "F",
                    "dayOfBirth": "26", "monthOfBirth": "11", "yearOfBirth": "1989",
                    "mobile": "******0161", "kycVerified": true
                })))
            }),
        )
        .route(
            "/v3/profile/account/abha-card",
            get(|headers: HeaderMap| async move {
                let ok = headers.get("x-token").and_then(|v| v.to_str().ok()) == Some("Bearer x-token");
                (if ok { StatusCode::OK } else { StatusCode::UNAUTHORIZED }, [("content-type", "image/png")], b"PNG".to_vec())
            }),
        )
        .route(
            "/v3/profile/account/qrCode",
            get(|headers: HeaderMap| async move { image_if(&headers, "Bearer x-token") }),
        )
        .route(
            "/v3/profile/account/request/otp",
            post(|State(m): State<Arc<Mock>>, headers: HeaderMap, Json(body): Json<Value>| async move {
                let mobile = m.decrypt(body["loginId"].as_str().unwrap_or(""));
                if header(&headers, "x-token") != Some("Bearer x-token") || mobile != "9876543210" {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "message": "Invalid request" })));
                }
                (StatusCode::OK, Json(json!({ "txnId": "txn-m", "message": "OTP sent to ******3210" })))
            }),
        )
        .route(
            "/v3/profile/account/verify",
            post(|State(m): State<Arc<Mock>>, Json(body): Json<Value>| async move {
                let otp = m.decrypt(body["authData"]["otp"]["otpValue"].as_str().unwrap_or(""));
                if otp != OTP || body["authData"]["otp"]["txnId"] != "txn-m" {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "message": "Invalid OTP" })));
                }
                (StatusCode::OK, Json(json!({ "authResult": "success", "message": "Mobile Number linked successfully" })))
            }),
        )
        .route(
            "/v3/phr/web/login/abha/request/otp",
            post(|State(m): State<Arc<Mock>>, Json(body): Json<Value>| async move {
                let address = m.decrypt(body["loginId"].as_str().unwrap_or(""));
                if address != "priya.v@sbx" || body["loginHint"] != "abha-address" {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "message": "ABHA address not found" })));
                }
                (StatusCode::OK, Json(json!({ "txnId": "txn-p", "message": "OTP sent to ******9127" })))
            }),
        )
        .route(
            "/v3/phr/web/login/abha/verify",
            post(|State(m): State<Arc<Mock>>, Json(body): Json<Value>| async move {
                let otp = m.decrypt(body["authData"]["otp"]["otpValue"].as_str().unwrap_or(""));
                if otp != OTP {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "message": "Invalid OTP" })));
                }
                (StatusCode::OK, Json(json!({ "authResult": "success", "tokens": { "token": "phr-token" } })))
            }),
        )
        .route(
            "/v3/phr/web/login/profile/abha-profile",
            get(|headers: HeaderMap| async move {
                if header(&headers, "x-token") != Some("Bearer phr-token") {
                    return (StatusCode::UNAUTHORIZED, Json(json!({ "message": "X-token required" })));
                }
                (StatusCode::OK, Json(json!({
                    "abhaAddress": "priya.v@sbx", "abhaNumber": "91-4444-5555-6666",
                    "firstName": "Priya", "lastName": "V", "gender": "F",
                    "dayOfBirth": "1", "monthOfBirth": "2", "yearOfBirth": "1990", "kycStatus": "VERIFIED"
                })))
            }),
        )
        .route(
            "/v3/phr/web/login/profile/abha/qr-code",
            get(|headers: HeaderMap| async move { image_if(&headers, "Bearer phr-token") }),
        )
        .with_state(mock);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}")
}

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (
        StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        resp.json().await.unwrap_or(Value::Null),
    )
}

/// Given sandbox keys saved on the settings screen, When the desk verifies an
/// ABHA and registers the patient, Then every ABDM call is signed in and
/// encrypted, the secret is never shown, and the patient's ABHA is verified.
#[tokio::test]
async fn an_abha_is_verified_end_to_end_against_abdm() {
    let _serial = SERIAL.lock().await;
    let mock = spawn_mock().await;
    let app = common::spawn_app_with_secrets(common::TestSecrets(
        [(medbrains_abdm::ABDM_BASE_URL_OVERRIDE.to_owned(), mock)].into(),
    ))
    .await;
    let csrf = app.login_admin().await;

    let (status, _) = send(&csrf, app.client.put(app.url("/api/abdm/settings"))
        .json(&json!({ "environment": "sandbox", "client_id": "sbx-client", "client_secret": "wrong" }))).await;
    assert_eq!(status, StatusCode::OK);
    let (_, test) = send(&csrf, app.client.post(app.url("/api/abdm/settings/test"))).await;
    assert_eq!(
        test["ok"], false,
        "wrong keys are reported, not hidden: {test}"
    );

    let (_, saved) = send(&csrf, app.client.put(app.url("/api/abdm/settings"))
        .json(&json!({ "environment": "sandbox", "client_id": "sbx-client", "client_secret": "sbx-secret" }))).await;
    assert_eq!(saved["has_secret"], true);
    assert!(
        saved.get("client_secret").is_none(),
        "the secret is never sent back"
    );
    let stored: Value = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE category = 'abdm' AND key = 'abha_config' \
           AND tenant_id = (SELECT tenant_id FROM users WHERE username = 'admin')",
    )
    .fetch_one(&app.db)
    .await
    .expect("stored config");
    assert!(
        !stored.to_string().contains("sbx-secret"),
        "the secret is stored sealed"
    );
    let (_, test) = send(&csrf, app.client.post(app.url("/api/abdm/settings/test"))).await;
    assert_eq!(test["ok"], true, "{test}");

    let (status, step) = send(&csrf, app.client.post(app.url("/api/abdm/abha/verifications"))
        .json(&json!({ "method": "abha_number", "value": "91 1111 2222 3333", "otp_via": "aadhaar" }))).await;
    assert_eq!(status, StatusCode::OK, "{step}");
    let id = step["id"].as_str().expect("id").to_owned();

    let (wrong, _) = send(
        &csrf,
        app.client
            .post(app.url(&format!("/api/abdm/abha/verifications/{id}/otp")))
            .json(&json!({ "otp": "000000" })),
    )
    .await;
    assert_eq!(
        wrong,
        StatusCode::BAD_REQUEST,
        "a wrong OTP is ABDM's refusal"
    );

    let (status, done) = send(
        &csrf,
        app.client
            .post(app.url(&format!("/api/abdm/abha/verifications/{id}/otp")))
            .json(&json!({ "otp": OTP })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["stage"], "verified");
    assert_eq!(done["profile"]["date_of_birth"], "1989-11-26");

    let card = app
        .client
        .get(app.url(&format!("/api/abdm/abha/verifications/{id}/card")))
        .send()
        .await
        .expect("card");
    assert_eq!(card.status().as_u16(), 200);
    let qr = app
        .client
        .get(app.url(&format!("/api/abdm/abha/verifications/{id}/qr")))
        .send()
        .await
        .expect("qr");
    assert_eq!(qr.status().as_u16(), 200);
    let (status, sent) = send(
        &csrf,
        app.client
            .post(app.url(&format!("/api/abdm/abha/verifications/{id}/mobile")))
            .json(&json!({ "mobile": "98765 43210" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{sent}");
    let (status, changed) = send(
        &csrf,
        app.client
            .post(app.url(&format!("/api/abdm/abha/verifications/{id}/mobile/verify")))
            .json(&json!({ "otp": OTP })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{changed}");
    assert_eq!(changed["message"], "Mobile Number linked successfully");

    let (status, patient) = send(&csrf, app.client.post(app.url("/api/patients")).json(&json!({
        "first_name": "Priya", "last_name": "Varude", "gender": "female", "date_of_birth": "1989-11-26",
        "phone": format!("9{:09}", uuid::Uuid::new_v4().as_u128() % 1_000_000_000),
        "abha_number": "91111122223333", "abha_verification_id": id,
    }))).await;
    assert!(status.is_success(), "{patient}");
    let kyc: bool = sqlx::query_scalar(
        "SELECT kyc_verified FROM patient_abha_links WHERE patient_id = $1::uuid",
    )
    .bind(patient["id"].as_str().expect("id"))
    .fetch_one(&app.db)
    .await
    .expect("link");
    assert!(kyc);
}

/// Given only the patient's ABHA address, When the desk verifies it, Then the
/// PHR APIs are used end to end and the QR comes from the PHR API too.
#[tokio::test]
async fn an_abha_address_is_verified_through_the_phr_apis() {
    let _serial = SERIAL.lock().await;
    let mock = spawn_mock().await;
    let app = common::spawn_app_with_secrets(common::TestSecrets(
        [(medbrains_abdm::ABDM_BASE_URL_OVERRIDE.to_owned(), mock)].into(),
    ))
    .await;
    let csrf = app.login_admin().await;
    let (_, _) = send(&csrf, app.client.put(app.url("/api/abdm/settings"))
        .json(&json!({ "environment": "sandbox", "client_id": "sbx-client", "client_secret": "sbx-secret" }))).await;

    let (status, step) = send(
        &csrf,
        app.client
            .post(app.url("/api/abdm/abha/verifications"))
            .json(&json!({ "method": "abha_address", "value": "Priya.V" })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "a bare name gets the sandbox domain: {step}"
    );
    let id = step["id"].as_str().expect("id").to_owned();
    let (status, done) = send(
        &csrf,
        app.client
            .post(app.url(&format!("/api/abdm/abha/verifications/{id}/otp")))
            .json(&json!({ "otp": OTP })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["profile"]["abha_address"], "priya.v@sbx");
    assert_eq!(done["profile"]["kyc_verified"], true);
    let qr = app
        .client
        .get(app.url(&format!("/api/abdm/abha/verifications/{id}/qr")))
        .send()
        .await
        .expect("qr");
    assert_eq!(qr.status().as_u16(), 200, "the PHR token opens the PHR QR");
}
