//! A body site picked on the anatomy model is kept as a code and a side,
//! next to the words a chart prints.

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

/// A visit to record the wound against.
async fn encounter(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Coded', 'Site', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-BS-{suffix}"))
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

/// Given a nurse picks "Left femur" on the body, When the wound is saved,
/// Then the FMA code and the side are kept with the printed words; an
/// unknown side is refused rather than stored.
#[tokio::test]
async fn a_picked_wound_site_keeps_its_code_and_side() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter_id = encounter(&app, &csrf).await;

    let (status, wound) = send(
        &csrf,
        app.client.post(app.url("/api/nurse/wounds")).json(&json!({
            "encounter_id": encounter_id,
            "body_site": "Left femur",
            "body_site_code": "FMA24474",
            "body_site_laterality": "left",
            "classification": "pressure_injury",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{wound}");
    assert_eq!(wound["body_site"], "Left femur");
    assert_eq!(wound["body_site_code"], "FMA24474");
    assert_eq!(wound["body_site_laterality"], "left");

    let (status, _) = send(
        &csrf,
        app.client.post(app.url("/api/nurse/wounds")).json(&json!({
            "encounter_id": encounter_id,
            "body_site": "Heel",
            "body_site_laterality": "upper",
        })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "an unknown side is refused"
    );
}
