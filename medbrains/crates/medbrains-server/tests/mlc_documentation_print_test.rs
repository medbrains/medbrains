//! The MLC documentation packet prints from what the case screen records: the
//! police intimation as a police visit, each MLC document as a certificate
//! issued, and both on the timeline of important dates.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    assert_eq!(resp.status(), StatusCode::OK, "{path}");
    resp.json().await.expect("json")
}

#[tokio::test]
async fn the_packet_prints_the_intimation_and_documents_the_case_recorded() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Packet', 'Case', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-MD-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let case = post(
        &app,
        &csrf,
        "/api/emergency/mlc",
        json!({ "patient_id": patient, "case_type": "assault" }),
    )
    .await;
    let id = case["id"].as_str().expect("mlc id");
    post(
        &app,
        &csrf,
        &format!("/api/emergency/mlc/{id}/police-intimations"),
        json!({ "police_station": "Karaikudi North", "officer_name": "S. Kumar", "officer_designation": "SI" }),
    )
    .await;
    post(
        &app,
        &csrf,
        &format!("/api/emergency/mlc/{id}/documents"),
        json!({ "document_type": "age_estimation", "title": "Age estimation certificate", "content": {} }),
    )
    .await;

    let resp = app
        .get(
            &app.client,
            &format!("/api/print-data/mlc-documentation/{id}"),
        )
        .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let packet: Value = resp.json().await.expect("json");
    let visits = packet["police_visits"].as_array().expect("visits");
    assert_eq!(visits.len(), 1, "{packet}");
    assert_eq!(visits[0]["officer_name"], "S. Kumar");
    assert_eq!(
        visits[0]["statement_recorded"],
        Value::Null,
        "an intimation receipt is not a recorded statement"
    );
    assert_eq!(
        packet["certificates_issued"],
        json!(["Age estimation certificate"])
    );
    let dates = packet["important_dates"].as_array().expect("dates");
    assert_eq!(
        dates.len(),
        2,
        "intimation and document both dated: {packet}"
    );
    assert_eq!(
        dates[0]["event_description"],
        "Police intimated: Karaikudi North"
    );
}
