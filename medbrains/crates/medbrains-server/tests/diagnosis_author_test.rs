//! A diagnosis says who made it, and an edit says who changed it and when
//! (RFC-MODULE-clinical-notes, phase 1c).

mod common;

use reqwest::StatusCode;
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

async fn encounter(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Diag', 'Nosis', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-DA-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": department })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned()
}

/// Given a doctor records a diagnosis and later changes it, Then the
/// diagnosis keeps who made it and who changed it, and the patient's
/// diagnosis list names its author rather than the visit's doctor.
#[tokio::test]
async fn a_diagnosis_keeps_who_made_it_and_who_changed_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let url = app.url(&format!("/api/opd/encounters/{encounter}/diagnoses"));
    let (status, made) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&json!({ "description": "Acute bronchitis", "is_primary": true })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{made}");
    let admin: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    assert_eq!(made["recorded_by"], json!(admin));
    assert!(made["updated_by"].is_null(), "not changed yet");

    let id = made["id"].as_str().expect("diagnosis id");
    let (status, changed) = send(
        &csrf,
        app.client
            .put(format!("{url}/{id}"))
            .json(&json!({ "certainty": "confirmed" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{changed}");
    assert_eq!(changed["updated_by"], json!(admin));
    assert!(changed["updated_at"].is_string());

    let patient: Uuid = sqlx::query_scalar("SELECT patient_id FROM encounters WHERE id = $1::uuid")
        .bind(&encounter)
        .fetch_one(&app.db)
        .await
        .expect("patient");
    let (status, listed) = send(
        &csrf,
        app.client
            .get(app.url(&format!("/api/opd/patients/{patient}/diagnoses"))),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let row = listed
        .as_array()
        .expect("rows")
        .iter()
        .find(|r| r["id"] == json!(id))
        .expect("listed");
    assert!(
        row["recorded_by_name"].is_string(),
        "the list names the author: {row}"
    );
}
