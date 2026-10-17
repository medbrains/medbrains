//! A video consultation is a real visit (#229): the visit opens when the
//! call starts, is marked a teleconsultation, the doctor's fee is billed once
//! when it completes, and the patient sees the call — with its link — on the
//! portal until it ends.

mod common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

async fn call(
    app: &common::TestApp,
    csrf: &str,
    m: Method,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut req = app
        .client
        .request(m, app.url(path))
        .header("x-csrf-token", csrf);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req.send().await.expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn portal_token(app: &common::TestApp, tenant: Uuid, phone: &str) -> String {
    let code = "424242";
    sqlx::query(
        "INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + interval '5 minutes')",
    )
    .bind(tenant)
    .bind(phone)
    .bind(format!("{:x}", Sha256::digest(code.as_bytes())))
    .execute(&app.db)
    .await
    .expect("otp");
    let tenant_code: String = sqlx::query_scalar("SELECT code FROM tenants WHERE id = $1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("tenant code");
    let resp: Value = reqwest::Client::new()
        .post(app.url("/api/portal/auth/verify"))
        .json(&json!({ "tenant_code": tenant_code, "phone": phone, "code": code }))
        .send()
        .await
        .expect("verify")
        .json()
        .await
        .expect("verify json");
    resp["token"].as_str().unwrap_or_default().to_owned()
}

async fn portal_calls(app: &common::TestApp, token: &str) -> Vec<Value> {
    reqwest::Client::new()
        .get(app.url("/api/portal/teleconsults"))
        .bearer_auth(token)
        .send()
        .await
        .expect("portal")
        .json::<Vec<Value>>()
        .await
        .expect("portal json")
}

#[tokio::test]
async fn a_video_consult_opens_a_visit_bills_once_and_shows_on_the_portal() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let phone = format!("6{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Tele', 'Patient', 'male', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-TC-{}",
        &Uuid::new_v4().simple().to_string()[..10]
    ))
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let before: Option<rust_decimal::Decimal> =
        sqlx::query_scalar("SELECT consultation_fee FROM users WHERE id = $1")
            .bind(admin)
            .fetch_one(&app.db)
            .await
            .expect("fee");
    sqlx::query("UPDATE users SET consultation_fee = 600 WHERE id = $1")
        .bind(admin)
        .execute(&app.db)
        .await
        .expect("set fee");

    let (status, consult) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/telemedicine/consultations",
        Some(json!({ "patient_id": patient, "doctor_id": admin })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{consult}");
    let id = consult["id"].as_str().expect("id").to_owned();

    let token = portal_token(&app, tenant, &phone).await;
    let calls = portal_calls(&app, &token).await;
    assert_eq!(calls.len(), 1, "the patient sees their call");
    assert!(
        calls[0]["join_url"]
            .as_str()
            .unwrap_or_default()
            .starts_with("http")
    );

    let status_path = format!("/api/telemedicine/consultations/{id}/status");
    let (_, started) = call(
        &app,
        &csrf,
        Method::PUT,
        &status_path,
        Some(json!({ "status": "in_progress" })),
    )
    .await;
    let encounter: Uuid = started["encounter_id"]
        .as_str()
        .expect("the visit exists from the booking")
        .parse()
        .expect("uuid");
    let visit_type: String = sqlx::query_scalar("SELECT visit_type FROM encounters WHERE id = $1")
        .bind(encounter)
        .fetch_one(&app.db)
        .await
        .expect("visit");
    assert_eq!(visit_type, "teleconsultation");

    call(
        &app,
        &csrf,
        Method::PUT,
        &status_path,
        Some(json!({ "status": "completed" })),
    )
    .await;
    call(
        &app,
        &csrf,
        Method::PUT,
        &status_path,
        Some(json!({ "status": "completed" })),
    )
    .await;
    let fees: Vec<rust_decimal::Decimal> = sqlx::query_scalar(
        "SELECT ii.unit_price FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id \
          WHERE i.encounter_id = $1 AND ii.charge_code = 'TELECONSULT'",
    )
    .bind(encounter)
    .fetch_all(&app.db)
    .await
    .expect("fees");
    assert_eq!(fees, vec![rust_decimal::Decimal::from(600)], "billed once");
    let closed: String = sqlx::query_scalar("SELECT status::text FROM encounters WHERE id = $1")
        .bind(encounter)
        .fetch_one(&app.db)
        .await
        .expect("visit status");
    assert_eq!(closed, "completed", "the visit closes with the call");
    assert!(
        portal_calls(&app, &token).await.is_empty(),
        "an ended call leaves the portal"
    );

    sqlx::query("UPDATE users SET consultation_fee = $1 WHERE id = $2")
        .bind(before)
        .bind(admin)
        .execute(&app.db)
        .await
        .expect("restore fee");
}
