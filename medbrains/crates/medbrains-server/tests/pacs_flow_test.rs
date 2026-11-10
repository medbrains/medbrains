//! Imaging actually flows (#226): an order goes onto the modality worklist
//! under its accession number, the modality's study comes back carrying it,
//! and the sync files the study against the order and marks the exam done.
//!
//! Runs against the development Orthanc (`docker compose up -d orthanc`,
//! http://127.0.0.1:8042). Without it the test has nothing to talk to and
//! returns early rather than fail on infrastructure.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

const ORTHANC: &str = "http://127.0.0.1:8042";

#[tokio::test]
async fn an_order_reaches_the_worklist_and_its_study_comes_back_to_it() {
    let http = reqwest::Client::new();
    if http.get(format!("{ORTHANC}/system")).send().await.is_err() {
        return;
    }
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let before: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'radiology' AND key = 'pacs_config'",
    )
    .bind(tenant)
    .fetch_optional(&app.db)
    .await
    .expect("config");
    let set_config = |value: Value| {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'radiology', 'pacs_config', $2) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = $2, deleted_at = NULL",
        )
        .bind(tenant)
        .bind(value)
        .execute(&app.db)
    };
    set_config(json!({ "orthanc_url": ORTHANC, "orthanc_username": "", "viewer_type": "ohif", "auto_sync": true }))
        .await
        .expect("pacs config");

    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, 'Lakshmi', 'Devi', 'female', '9000000226', '1980-03-09') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-PX-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'Computed tomography') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CT{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("modality");
    let order: Value = app
        .client
        .post(app.url("/api/radiology/orders"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": patient, "modality_id": modality, "body_part": "Head" }))
        .send()
        .await
        .expect("order")
        .json()
        .await
        .expect("order json");
    let order_id = order["id"].as_str().expect("order id").to_owned();
    let accession = order["accession_number"]
        .as_str()
        .expect("accession")
        .to_owned();
    assert!(accession.starts_with("RA"), "{order}");

    let queued: Value = sqlx::query_scalar(
        "SELECT payload FROM outbox_events WHERE event_type = 'pacs.worklist.create' AND aggregate_id = $1::uuid",
    )
    .bind(&order_id)
    .fetch_one(&app.db)
    .await
    .expect("worklist queued");
    assert_eq!(queued["tags"]["AccessionNumber"], json!(accession));
    assert_eq!(queued["tags"]["PatientName"], "Devi^Lakshmi");
    assert_eq!(queued["tags"]["PatientBirthDate"], "19800309");

    // The modality's side: a study under that accession arrives in the PACS.
    let made: Value = http
        .post(format!("{ORTHANC}/tools/create-dicom"))
        .json(&json!({ "Tags": {
            "PatientID": format!("UH-PX-{tag}"), "PatientName": "Devi^Lakshmi",
            "AccessionNumber": accession, "Modality": "CT", "StudyDescription": "CT head plain",
            "SOPClassUID": "1.2.840.10008.5.1.4.1.1.2", "CTDIvol": "14.9",
        }}))
        .send()
        .await
        .expect("create dicom")
        .json()
        .await
        .expect("dicom json");
    let study_id = made["ParentStudy"].as_str().expect("study").to_owned();

    // Orthanc calls a study stable after StableAge seconds with no new images.
    let mut linked = false;
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        medbrains_server::services::pacs_sync::scan_once(
            &app.db,
            &medbrains_core::secrets::EnvSecretResolver::new(),
        )
        .await
        .expect("sync");
        let uid: Option<String> =
            sqlx::query_scalar("SELECT pacs_study_uid FROM radiology_orders WHERE id = $1::uuid")
                .bind(&order_id)
                .fetch_one(&app.db)
                .await
                .expect("order");
        if uid.is_some() {
            linked = true;
            break;
        }
    }
    assert!(linked, "the study came back to its order");
    let (status, viewer, instances): (String, String, i32) = sqlx::query_as(
        "SELECT o.status::text, s.viewer_url, s.instance_count FROM radiology_orders o \
           JOIN radiology_dicom_studies s ON s.order_id = o.id WHERE o.id = $1::uuid",
    )
    .bind(&order_id)
    .fetch_one(&app.db)
    .await
    .expect("study");
    assert_eq!(status, "completed", "the images are in: the exam is done");
    assert!(viewer.contains("/ohif/viewer?StudyInstanceUIDs="));
    assert_eq!(instances, 1);

    // The scanner's CTDIvol came with the image: recorded without anyone typing it.
    let (source, ctdi): (String, f64) = sqlx::query_as(
        "SELECT source, ctdi_vol::float8 FROM radiation_dose_records \
          WHERE order_id = $1::uuid AND deleted_at IS NULL",
    )
    .bind(&order_id)
    .fetch_one(&app.db)
    .await
    .expect("dose read from the image headers");
    assert_eq!((source.as_str(), ctdi), ("dicom_header", 14.9));

    let _ = http
        .delete(format!("{ORTHANC}/studies/{study_id}"))
        .send()
        .await;
    match before {
        Some(value) => {
            set_config(value).await.expect("restore");
        }
        None => {
            sqlx::query("DELETE FROM tenant_settings WHERE tenant_id = $1 AND category = 'radiology' AND key = 'pacs_config'")
                .bind(tenant)
                .execute(&app.db)
                .await
                .expect("restore");
        }
    }
}
