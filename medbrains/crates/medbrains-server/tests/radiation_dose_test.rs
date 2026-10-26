//! Radiation dose on an imaging order: who may record it, what counts as a
//! dose, and how a wrong figure leaves the patient's cumulative total without
//! leaving the record.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

struct Exam {
    patient: Uuid,
    order: String,
}

async fn ct_order(app: &common::TestApp, csrf: &str) -> Exam {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Arun', 'Kumar', 'male', '9000000228') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-RD-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'CT') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CT{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("modality");
    let (status, order) = send(
        app.client.post(app.url("/api/radiology/orders")).json(
            &json!({ "patient_id": patient, "modality_id": modality, "body_part": "Abdomen" }),
        ),
        csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{order}");
    Exam {
        patient,
        order: order["id"].as_str().expect("order id").to_owned(),
    }
}

async fn send(req: reqwest::RequestBuilder, csrf: &str) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn cumulative(app: &common::TestApp, csrf: &str, patient: Uuid) -> Value {
    let (status, body) = send(
        app.client.get(app.url(&format!(
            "/api/radiology/cumulative-dose?patient_id={patient}"
        ))),
        csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body
}

#[tokio::test]
async fn only_someone_who_records_dose_and_may_see_the_patient_records_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let exam = ct_order(&app, &csrf).await;
    let dose = app.url(&format!("/api/radiology/orders/{}/dose", exam.order));
    let body = json!({ "dlp": 812.4, "ctdi_vol": 14.9 });

    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let (status, _) = send(nurse.client.post(&dose).json(&body), &nurse.csrf).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a nurse does not hold radiology.dose.record"
    );

    let tech = common::provision_staff(&app, &csrf, "radiology_tech", &[]).await;
    let (status, _) = send(tech.client.post(&dose).json(&body), &tech.csrf).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "the permission alone does not reach this patient"
    );

    let records: i64 =
        sqlx::query_scalar("SELECT count(*) FROM radiation_dose_records WHERE order_id = $1::uuid")
            .bind(&exam.order)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(records, 0);
}

#[tokio::test]
async fn a_recorded_dose_counts_until_it_is_marked_entered_in_error() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let exam = ct_order(&app, &csrf).await;
    let dose = app.url(&format!("/api/radiology/orders/{}/dose", exam.order));

    for bad in [
        json!({}),
        json!({ "dlp": 81_240 }),
        json!({ "dap": -1 }),
        json!({ "kvp": 8, "exposure_count": 1 }),
    ] {
        let (status, body) = send(app.client.post(&dose).json(&bad), &csrf).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{bad} -> {body}");
    }

    let (status, record) = send(
        app.client
            .post(&dose)
            .json(&json!({ "dlp": 812.4, "ctdi_vol": 14.9 })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{record}");
    assert_eq!(record["source"], "manual");
    assert_eq!(
        record["modality_code"]
            .as_str()
            .map(|m| m.starts_with("CT")),
        Some(true)
    );

    let total = cumulative(&app, &csrf, exam.patient).await;
    assert_eq!(
        (
            total["study_count"].as_i64(),
            total["cumulative_dlp"].as_f64()
        ),
        (Some(1), Some(812.4))
    );

    let (status, history) = send(
        app.client.get(app.url(&format!(
            "/api/radiology/patients/{}/dose-records",
            exam.patient
        ))),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{history}");
    assert_eq!(history.as_array().map(Vec::len), Some(1), "{history}");
    assert!(history[0]["exam"].as_str().is_some(), "{history}");

    let wrong = app.url(&format!(
        "/api/radiology/dose-records/{}/entered-in-error",
        record["id"].as_str().expect("id")
    ));
    let (status, _) = send(
        app.client.post(&wrong).json(&json!({ "reason": " " })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a reason is required");
    let (status, _) = send(
        app.client
            .post(&wrong)
            .json(&json!({ "reason": "Another patient's scan" })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let total = cumulative(&app, &csrf, exam.patient).await;
    assert_eq!(total["study_count"].as_i64(), Some(0), "{total}");
    let kept: Option<String> =
        sqlx::query_scalar("SELECT delete_reason FROM radiation_dose_records WHERE id = $1::uuid")
            .bind(record["id"].as_str())
            .fetch_one(&app.db)
            .await
            .expect("kept");
    assert_eq!(
        kept.as_deref(),
        Some("Another patient's scan"),
        "kept, with its reason"
    );
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE entity_id = $1::uuid \
           AND action IN ('radiology.dose.record', 'radiology.dose.entered_in_error')",
    )
    .bind(record["id"].as_str())
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 2);
}
