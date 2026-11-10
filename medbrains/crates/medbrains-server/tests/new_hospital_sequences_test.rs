//! A hospital created after install can run its first OPD visit.
//!
//! Only the seeded hospital used to get number sequences. A trial or onboarded
//! hospital had no OPD_TOKEN row, so its first OPD visit answered 500.
//! Migration 1214 seeds the defaults from the tenants trigger.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(client: &reqwest::Client, app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert!(status.is_success(), "{path} → {status}: {text}");
    serde_json::from_str(&text).expect("json body")
}

/// Given a hospital whose row is inserted today, When its administrator
/// registers a patient and opens an OPD visit, Then both succeed and the
/// visit gets token 1 — no hand-made sequence rows needed.
#[tokio::test]
async fn a_new_hospital_can_register_a_patient_and_open_an_opd_visit() {
    let app = common::spawn_app().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let code = format!("SQ{suffix}");
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Sequence Check Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("new hospital");

    let seq_types: Vec<String> = sqlx::query_scalar(
        "SELECT seq_type FROM sequences WHERE tenant_id = $1 ORDER BY seq_type",
    )
    .bind(tenant)
    .fetch_all(&app.db)
    .await
    .expect("sequences");
    for required in ["ADVANCE", "CORPORATE_INVOICE", "INDENT", "INVOICE", "OPD_TOKEN", "UHID"] {
        assert!(seq_types.iter().any(|s| s == required), "{required} missing: {seq_types:?}");
    }

    let username = format!("sqadmin_{}", suffix.to_lowercase());
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
         SELECT $1, $2, $2 || '@sequence-check.example.org', 'Sequence Admin', 'hospital_admin', \
                password_hash FROM users WHERE username = 'admin'",
    )
    .bind(tenant)
    .bind(&username)
    .execute(&app.db)
    .await
    .expect("admin");
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, 'GM', 'General Medicine', 'clinical') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");

    let client = reqwest::Client::builder().cookie_store(true).build().expect("client");
    let resp = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": "admin123", "hospital_code": code }))
        .send()
        .await
        .expect("login");
    assert_eq!(resp.status(), StatusCode::OK);
    let login: Value = resp.json().await.expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();

    let patient = post(
        &client,
        &app,
        &csrf,
        "/api/patients",
        json!({ "first_name": "First", "last_name": "Patient", "gender": "female", "date_of_birth": "1990-03-03", "phone": "9990000213" }),
    )
    .await;
    let visit = post(
        &client,
        &app,
        &csrf,
        "/api/opd/encounters",
        json!({ "patient_id": patient["id"], "department_id": department, "encounter_type": "opd" }),
    )
    .await;
    let token = visit["queue"]["token_number"]
        .as_i64()
        .or_else(|| visit["token_number"].as_i64());
    assert_eq!(token, Some(1), "{visit}");
}
