//! A hospital binding QR binds exactly as many devices as it was issued for,
//! only while it is valid, only as signed, and only by someone allowed to
//! print one.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use crate::common;

use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use ed25519_dalek::{Signature, SigningKey, Verifier};
use reqwest::StatusCode;
use serde_json::{Value, json};

const SEED: [u8; 32] = [9; 32];

async fn app() -> common::TestApp {
    common::spawn_app_with_secrets(
        common::TestSecrets::default()
            .with("MEDBRAINS_BINDING_SIGNING_KEY", STANDARD.encode(SEED))
            .with("MEDBRAINS_PUBLIC_BASE_URL", "https://hospital.test")
            .with("MEDBRAINS_TLS_SPKI_SHA256", STANDARD.encode([3u8; 32])),
    )
    .await
}

async fn issue(app: &common::TestApp, csrf: &str, max_uses: i32) -> Value {
    let resp = app
        .client
        .post(app.url("/api/admin/device-binding-codes"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "label": "Ward 3 phones", "expires_in_hours": 24, "max_uses": max_uses }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    resp.json().await.unwrap()
}

fn payload(qr: &str) -> Value {
    let token = qr.strip_prefix("medbrains://bind?t=").unwrap();
    let part = token.split('.').nth(1).unwrap();
    serde_json::from_slice(&URL_SAFE_NO_PAD.decode(part).unwrap()).unwrap()
}

/// Redeem as a fresh device; answers status and body.
async fn redeem(app: &common::TestApp, qr: &str) -> (StatusCode, Value) {
    let device = uuid::Uuid::new_v4();
    let challenge = URL_SAFE_NO_PAD.encode([5u8; 32]);
    let resp = reqwest::Client::new()
        .post(app.url("/api/device-binding/redeem"))
        .json(&json!({
            "token": qr,
            "device_label": "Nurse phone",
            "app_variant": "Mobile-Staff",
            "public_key_pem": format!("-----BEGIN PUBLIC KEY-----\n{device}\n-----END PUBLIC KEY-----"),
            "challenge": challenge,
        }))
        .send()
        .await
        .unwrap();
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn a_single_use_code_binds_once_and_proves_the_server_holds_its_key() {
    let app = app().await;
    let csrf = app.login_admin().await;
    let code = issue(&app, &csrf, 1).await;
    let qr = code["qr"].as_str().unwrap();
    let claims = payload(qr);
    assert_eq!(claims["api_base"], "https://hospital.test");
    assert_eq!(claims["spki"], STANDARD.encode([3u8; 32]));
    let key = SigningKey::from_bytes(&SEED);
    assert_eq!(
        claims["ik"],
        URL_SAFE_NO_PAD.encode(key.verifying_key().as_bytes())
    );

    let (status, body) = redeem(&app, qr).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["tenant"], claims["tenant"]);
    let proof: [u8; 64] = URL_SAFE_NO_PAD
        .decode(body["proof"].as_str().unwrap())
        .unwrap()
        .try_into()
        .unwrap();
    let message = format!(
        "mb-binding-proof:v1:{}:{}",
        claims["jti"].as_str().unwrap(),
        URL_SAFE_NO_PAD.encode([5u8; 32])
    );
    assert!(
        key.verifying_key()
            .verify(message.as_bytes(), &Signature::from_bytes(&proof))
            .is_ok()
    );

    let (again, _) = redeem(&app, qr).await;
    assert_eq!(again, StatusCode::CONFLICT);

    let list: Value = app
        .get(&app.client, "/api/admin/device-binding-codes")
        .await
        .json()
        .await
        .unwrap();
    let row = list
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == code["id"])
        .unwrap();
    assert_eq!(row["use_count"], 1);
}

#[tokio::test]
async fn an_expired_a_tampered_and_a_revoked_code_bind_nothing() {
    let app = app().await;
    let csrf = app.login_admin().await;

    // Expired.
    let expired = issue(&app, &csrf, 5).await;
    let tenant: uuid::Uuid =
        sqlx::query_scalar("SELECT id FROM tenants WHERE upper(code) = upper($1)")
            .bind(
                payload(expired["qr"].as_str().unwrap())["tenant"]
                    .as_str()
                    .unwrap(),
            )
            .fetch_one(&app.db)
            .await
            .unwrap();
    let mut tx = app.db.begin().await.unwrap();
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant)
        .await
        .unwrap();
    let moved = sqlx::query(
        "UPDATE device_binding_codes \
            SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' \
          WHERE id = $1",
    )
    .bind(uuid::Uuid::parse_str(expired["id"].as_str().unwrap()).unwrap())
    .execute(&mut *tx)
    .await
    .unwrap();
    assert_eq!(moved.rows_affected(), 1);
    tx.commit().await.unwrap();
    let (status, body) = redeem(&app, expired["qr"].as_str().unwrap()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body.to_string().contains("expired"), "{body}");

    // Tampered: the payload sends the app elsewhere; the signature no longer fits.
    let good = issue(&app, &csrf, 5).await;
    let qr = good["qr"].as_str().unwrap();
    let mut claims = payload(qr);
    claims["api_base"] = json!("https://evil.test");
    let mut parts: Vec<String> = qr.split('.').map(str::to_owned).collect();
    parts[1] = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&claims).unwrap());
    let (status, _) = redeem(&app, &parts.join(".")).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Revoked.
    let resp = app
        .client
        .post(app.url(&format!(
            "/api/admin/device-binding-codes/{}/revoke",
            good["id"].as_str().unwrap()
        )))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "reason": "photographed" }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let (status, body) = redeem(&app, qr).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body.to_string().contains("revoked"), "{body}");
}

#[tokio::test]
async fn only_someone_allowed_to_issue_can_print_a_code() {
    let app = app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let resp = nurse
        .client
        .post(app.url("/api/admin/device-binding-codes"))
        .header("x-csrf-token", &nurse.csrf)
        .json(&json!({ "label": "x", "expires_in_hours": 1, "max_uses": 1 }))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}
