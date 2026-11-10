//! Studies the PACS could not file reach the radiology desk's queue, and are
//! filed only under an order a person confirmed — never matched by name.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const ORTHANC: &str = "http://127.0.0.1:8042";

async fn send(req: reqwest::RequestBuilder, csrf: &str) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn admin_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

/// A patient (UHID returned) and a DX order for them.
async fn patient_with_order(app: &common::TestApp, csrf: &str) -> (Uuid, String, String) {
    let tenant = admin_tenant(app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let uhid = format!("UH-UM-{tag}");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, 'Meena', 'Rao', 'female', '9000000229', '1980-03-09') RETURNING id",
    )
    .bind(tenant)
    .bind(&uhid)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, 'DX', 'Digital X-ray') \
         ON CONFLICT DO NOTHING RETURNING id",
    )
    .bind(tenant)
    .fetch_optional(&app.db)
    .await
    .expect("modality")
    .unwrap_or_default();
    let modality = if modality.is_nil() {
        sqlx::query_scalar(
            "SELECT id FROM radiology_modalities WHERE tenant_id = $1 AND code = 'DX' AND deleted_at IS NULL LIMIT 1",
        )
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("dx")
    } else {
        modality
    };
    let (status, order) = send(
        app.client
            .post(app.url("/api/radiology/orders"))
            .json(&json!({ "patient_id": patient, "modality_id": modality, "body_part": "Chest" })),
        csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{order}");
    (patient, uhid, order["id"].as_str().expect("id").to_owned())
}

async fn queued_study(app: &common::TestApp, dicom_patient_id: &str) -> String {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_unmatched_studies \
           (tenant_id, orthanc_id, study_instance_uid, dicom_patient_id, dicom_birth_date, \
            dicom_sex, modality, instance_count, series_count) \
         VALUES ($1, $2, $3, $4, '1980-03-09', 'F', 'DX', 1, 1) RETURNING id",
    )
    .bind(admin_tenant(app).await)
    .bind(Uuid::new_v4().to_string())
    .bind(format!("1.2.826.0.1.{}", Uuid::new_v4().as_u128()))
    .bind(dicom_patient_id)
    .fetch_one(&app.db)
    .await
    .expect("queued");
    id.to_string()
}

#[tokio::test]
async fn a_study_is_filed_only_under_an_order_a_person_confirmed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, uhid, order) = patient_with_order(&app, &csrf).await;
    let (_, _, other_order) = patient_with_order(&app, &csrf).await;
    let study = queued_study(&app, &uhid).await;
    let link = app.url(&format!("/api/radiology/unmatched-studies/{study}/link"));

    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let (status, _) = send(
        nurse
            .client
            .get(app.url("/api/radiology/unmatched-studies")),
        &nurse.csrf,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "the queue shows names: radiology desk only"
    );

    let tech = common::provision_staff(&app, &csrf, "radiology_tech", &[]).await;
    let (status, queue) = send(
        tech.client.get(app.url("/api/radiology/unmatched-studies")),
        &tech.csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{queue}");
    assert!(
        queue
            .as_array()
            .is_some_and(|q| q.iter().any(|s| s["id"] == study.as_str()))
    );
    let (status, _) = send(
        tech.client.post(&link).json(&json!({ "order_id": order })),
        &tech.csrf,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "the permission alone does not reach this patient"
    );

    // Another patient's order: the patient ID differs, so it needs a note.
    let (status, body) = send(
        app.client
            .post(&link)
            .json(&json!({ "order_id": other_order })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    // The right patient's order: same UHID, birth date, sex and modality.
    let (status, linked) = send(
        app.client.post(&link).json(&json!({ "order_id": order })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{linked}");
    assert_eq!(linked["study"]["status"], "linked");
    assert_eq!(linked["mismatches"], json!([]));
    let (filed, state): (Option<String>, String) = sqlx::query_as(
        "SELECT pacs_study_uid, status::text FROM radiology_orders WHERE id = $1::uuid",
    )
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("order");
    assert_eq!((filed.is_some(), state.as_str()), (true, "completed"));

    let (status, _) = send(
        app.client.post(&link).json(&json!({ "order_id": order })),
        &csrf,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a resolved study is not filed twice"
    );
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE entity_id = $1::uuid AND action = 'radiology.unmatched_study.link'",
    )
    .bind(&study)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1);
}

#[tokio::test]
async fn a_mismatch_is_filed_only_with_a_note_and_a_stray_is_dismissed_with_a_reason() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, _, order) = patient_with_order(&app, &csrf).await;
    let study = queued_study(&app, "WALKIN-01").await;
    let link = app.url(&format!("/api/radiology/unmatched-studies/{study}/link"));
    let (status, body) = send(
        app.client.post(&link).json(&json!({ "order_id": order })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let (status, linked) = send(
        app.client.post(&link).json(&json!({
            "order_id": order, "note": "Walk-in; ID typed at the console. Confirmed name and DOB with the patient."
        })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{linked}");
    assert_eq!(linked["mismatches"].as_array().map(Vec::len), Some(1));

    let stray = queued_study(&app, "PHANTOM").await;
    let dismiss = app.url(&format!("/api/radiology/unmatched-studies/{stray}/dismiss"));
    let (status, _) = send(
        app.client.post(&dismiss).json(&json!({ "reason": "" })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, body) = send(
        app.client
            .post(&dismiss)
            .json(&json!({ "reason": "QA phantom" })),
        &csrf,
    )
    .await;
    assert_eq!(
        (status, body["status"].as_str()),
        (StatusCode::OK, Some("dismissed"))
    );
}

#[tokio::test]
async fn a_study_with_no_order_reaches_the_queue_instead_of_the_log() {
    let http = reqwest::Client::new();
    if http.get(format!("{ORTHANC}/system")).send().await.is_err() {
        return;
    }
    let app = common::spawn_app().await;
    app.login_admin().await;
    let tenant = admin_tenant(&app).await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'radiology', 'pacs_config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = $2, deleted_at = NULL",
    )
    .bind(tenant)
    .bind(json!({ "orthanc_url": ORTHANC, "orthanc_username": "", "viewer_type": "ohif" }))
    .execute(&app.db)
    .await
    .expect("config");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let made: Value = http
        .post(format!("{ORTHANC}/tools/create-dicom"))
        .json(&json!({ "Tags": {
            "PatientID": format!("WALK-{tag}"), "PatientName": "Rao^Meena", "PatientSex": "F",
            "AccessionNumber": format!("NOORDER{tag}"), "Modality": "DX",
            "StudyDescription": "Chest PA", "SOPClassUID": "1.2.840.10008.5.1.4.1.1.1.1",
        }}))
        .send()
        .await
        .expect("create dicom")
        .json()
        .await
        .expect("dicom json");
    let study_id = made["ParentStudy"].as_str().expect("study").to_owned();
    let mut queued = None;
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        medbrains_server::services::pacs_sync::scan_once(
            &app.db,
            &medbrains_core::secrets::EnvSecretResolver::new(),
        )
        .await
        .expect("sync");
        queued = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
            "SELECT status, dicom_patient_name, modality FROM radiology_unmatched_studies \
              WHERE tenant_id = $1 AND orthanc_id = $2",
        )
        .bind(tenant)
        .bind(&study_id)
        .fetch_optional(&app.db)
        .await
        .expect("queue");
        if queued.is_some() {
            break;
        }
    }
    let _ = http
        .delete(format!("{ORTHANC}/studies/{study_id}"))
        .send()
        .await;
    let (status, name, modality) = queued.expect("queued for the desk");
    assert_eq!(status, "open");
    assert_eq!(name.as_deref(), Some("Rao Meena"));
    assert_eq!(modality.as_deref(), Some("DX"));
}
