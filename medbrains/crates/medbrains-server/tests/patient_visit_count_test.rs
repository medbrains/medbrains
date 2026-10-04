//! A patient's visit count and last visit follow their encounters: the
//! patient page reads them, and they were never maintained.

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

async fn encounter(app: &common::TestApp, csrf: &str, patient: Option<Uuid>) -> (Uuid, String) {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = if let Some(id) = patient {
        id
    } else {
        sqlx::query_scalar(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Visit', 'Count', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
        )
        .bind(format!("UH-VC-{suffix}"))
        .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
        .fetch_one(&app.db)
        .await
        .expect("patient")
    };
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
    let id = visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned();
    (patient, id)
}

async fn totals(app: &common::TestApp, patient: Uuid) -> (i32, Option<String>) {
    sqlx::query_as("SELECT total_visits, last_visit_date::text FROM patients WHERE id = $1")
        .bind(patient)
        .fetch_one(&app.db)
        .await
        .expect("totals")
}

/// Given a new patient, When two OPD visits are opened, Then the patient
/// reads two visits with today as the last; When one is retired, one.
#[tokio::test]
async fn a_patients_visit_count_follows_their_encounters() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (patient, first) = encounter(&app, &csrf, None).await;
    let today: String = sqlx::query_scalar("SELECT CURRENT_DATE::text")
        .fetch_one(&app.db)
        .await
        .expect("today");
    assert_eq!(totals(&app, patient).await, (1, Some(today.clone())));

    encounter(&app, &csrf, Some(patient)).await;
    assert_eq!(totals(&app, patient).await, (2, Some(today)));

    sqlx::query("UPDATE encounters SET deleted_at = now() WHERE id = $1::uuid")
        .bind(&first)
        .execute(&app.db)
        .await
        .expect("retire");
    assert_eq!(
        totals(&app, patient).await.0,
        1,
        "a retired visit is not counted"
    );
}
