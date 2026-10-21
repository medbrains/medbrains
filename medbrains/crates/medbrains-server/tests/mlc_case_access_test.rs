//! An MLC's documents and injuries are read only by those on the case —
//! holding the module permission is not being on that case.

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A doctor in a department this case has nothing to do with.
async fn unrelated_doctor(app: &common::TestApp, admin_csrf: &str) -> Client {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("mlcdoc_{tag}"), format!("MlcDoc#{tag}Aa9"));
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("MLCX{}", tag[..6].to_uppercase()))
    .bind(format!("Unrelated {tag}"))
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, body) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": "Unrelated Doctor",
            "role": "doctor",
            "department_ids": [department],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    client
}

/// Given an assault case the doctor is not on, When they ask for its
/// documents or injuries, Then the case answers as not found.
#[tokio::test]
async fn a_doctor_not_on_the_case_cannot_read_its_documents_or_injuries() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Private', 'Case', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-MA-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let (status, case) = send(
        &csrf,
        app.client
            .post(app.url("/api/emergency/mlc"))
            .json(&json!({ "patient_id": patient, "case_type": "assault" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{case}");
    let id = case["id"].as_str().expect("mlc id");

    let doctor = unrelated_doctor(&app, &csrf).await;
    for path in ["documents", "injuries"] {
        let status = doctor
            .get(app.url(&format!("/api/emergency/mlc/{id}/{path}")))
            .send()
            .await
            .expect("request")
            .status();
        assert_eq!(
            status,
            StatusCode::NOT_FOUND,
            "{path} of a case they are not on"
        );
    }
}
