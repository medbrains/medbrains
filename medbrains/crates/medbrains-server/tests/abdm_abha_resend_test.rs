//! M1 certification rules on the OTP screens (official M1 test sheet,
//! CRT_ABHA_101/106 and VRFY_ABHA_405): "Create ABHA" reaches
//! `/v3/enrollment/enrol/byAadhaar` (that spelling), and "Resend OTP" works
//! only after 60 seconds and at most twice — for creating and verifying alike.

use crate::common;

use axum::{
    Json, Router,
    http::StatusCode as MockStatus,
    routing::{get, post},
};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Tests that save ABDM keys for the same hospital run one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// A stand-in ABHA service: any OTP is accepted, every person already has an
/// ABHA. The session needs `grantType` (gateway swagger).
async fn spawn_mock() -> String {
    let key = openssl::rsa::Rsa::generate(2048).expect("rsa");
    let der = key.public_key_to_der().expect("der");
    let public = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, der);
    let app = Router::new()
        .route(
            "/sessions",
            post(|Json(body): Json<Value>| async move {
                if body["grantType"] == "client_credentials" {
                    (MockStatus::OK, Json(json!({ "accessToken": "session-token", "expiresIn": 1200 })))
                } else {
                    (MockStatus::BAD_REQUEST, Json(json!({ "message": "grantType is required" })))
                }
            }),
        )
        .route(
            "/v3/profile/public/certificate",
            get(move || async move { Json(json!({ "publicKey": public })) }),
        )
        .route(
            "/v3/enrollment/request/otp",
            post(|| async { Json(json!({ "txnId": Uuid::new_v4().to_string(), "message": "OTP sent" })) }),
        )
        .route(
            "/v3/profile/login/request/otp",
            post(|| async { Json(json!({ "txnId": Uuid::new_v4().to_string(), "message": "OTP sent" })) }),
        )
        .route(
            "/v3/enrollment/enrol/byAadhaar",
            post(|| async {
                Json(json!({ "txnId": "t", "isNew": false, "tokens": { "token": "x-token" },
                             "ABHAProfile": { "ABHANumber": "91-7777-8888-9999", "mobile": "9876543210" } }))
            }),
        )
        .route(
            "/v3/profile/account",
            get(|| async {
                Json(json!({ "ABHANumber": "91-7777-8888-9999", "firstName": "Asha", "gender": "F",
                             "yearOfBirth": "1990", "kycVerified": true }))
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}")
}

async fn post_json(
    app: &common::TestApp,
    csrf: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let r = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = r.status();
    (status, r.json().await.unwrap_or(Value::Null))
}

/// As if the last OTP went out two minutes ago.
async fn wait_out_the_pause(app: &common::TestApp, id: &str) {
    sqlx::query("UPDATE abha_verifications SET otp_sent_at = now() - interval '2 minutes' WHERE id = $1::uuid")
        .bind(id)
        .execute(&app.db)
        .await
        .expect("backdate");
}

async fn app_with_keys() -> (common::TestApp, String) {
    let mock = spawn_mock().await;
    let app = common::spawn_app_with_secrets(
        common::TestSecrets::default().with(medbrains_abdm::ABDM_BASE_URL_OVERRIDE, mock),
    )
    .await;
    let csrf = app.login_admin().await;
    let saved = app
        .client
        .put(app.url("/api/abdm/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "environment": "sandbox", "client_id": "sbx-client", "client_secret": "s" }))
        .send()
        .await
        .expect("settings");
    assert_eq!(saved.status(), StatusCode::OK);
    (app, csrf)
}

/// Resend `path` twice after the pause, then a third time: refused.
async fn two_resends_then_refused(
    app: &common::TestApp,
    csrf: &str,
    id: &str,
    path: &str,
    body: &Value,
) {
    for left in [1, 0] {
        wait_out_the_pause(app, id).await;
        let (s, step) = post_json(app, csrf, path, body.clone()).await;
        assert_eq!(s, StatusCode::OK, "{step}");
        assert_eq!(step["resends_left"], left);
        assert_eq!(step["resend_after_seconds"], 60);
    }
    wait_out_the_pause(app, id).await;
    let (s, refused) = post_json(app, csrf, path, body.clone()).await;
    assert_eq!(
        s,
        StatusCode::TOO_MANY_REQUESTS,
        "a third resend: {refused}"
    );
}

/// Given the patient's consent and Aadhaar, When the desk creates an ABHA,
/// Then the OTP can be resent twice after the pause (the Aadhaar typed
/// again), never sooner, never a third time, and the OTP reaches
/// `enrol/byAadhaar`.
#[tokio::test]
async fn creating_an_abha_resends_twice_at_most_and_reaches_by_aadhaar() {
    let _serial = SERIAL.lock().await;
    let (app, csrf) = app_with_keys().await;
    let (s, step) = post_json(
        &app,
        &csrf,
        "/api/abdm/abha/enrolments",
        json!({ "aadhaar": "2345 6789 0123", "consent": true }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{step}");
    assert_eq!(step["resends_left"], 2);
    let id = step["id"].as_str().expect("id").to_owned();
    let resend = format!("/api/abdm/abha/enrolments/{id}/resend");

    let (s, _) = post_json(&app, &csrf, &resend, json!({ "aadhaar": "234567890123" })).await;
    assert_eq!(
        s,
        StatusCode::TOO_MANY_REQUESTS,
        "not inside the 60-second pause"
    );
    wait_out_the_pause(&app, &id).await;
    let (s, _) = post_json(&app, &csrf, &resend, json!({})).await;
    assert_eq!(
        s,
        StatusCode::BAD_REQUEST,
        "the Aadhaar OTP needs the Aadhaar again"
    );
    two_resends_then_refused(
        &app,
        &csrf,
        &id,
        &resend,
        &json!({ "aadhaar": "234567890123" }),
    )
    .await;

    let (s, done) = post_json(
        &app,
        &csrf,
        &format!("/api/abdm/abha/enrolments/{id}/otp"),
        json!({ "otp": "123456", "mobile": "9876543210" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "byAadhaar answered: {done}");
    assert_eq!(done["stage"], "verified");
}

/// Given an ABHA-number verification, Then its OTP too is resent at most twice.
#[tokio::test]
async fn verifying_an_abha_resends_twice_at_most() {
    let _serial = SERIAL.lock().await;
    let (app, csrf) = app_with_keys().await;
    let (s, step) = post_json(
        &app,
        &csrf,
        "/api/abdm/abha/verifications",
        json!({ "method": "abha_number", "value": "91-7777-8888-9999", "otp_via": "aadhaar" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{step}");
    assert_eq!(step["resends_left"], 2);
    let id = step["id"].as_str().expect("id").to_owned();
    let resend = format!("/api/abdm/abha/verifications/{id}/resend");
    two_resends_then_refused(&app, &csrf, &id, &resend, &Value::Null).await;
}
