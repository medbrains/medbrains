//! The viewer behind MedBrains sign-in: one study at a time, checked against
//! the caller's access to its patient, every open recorded. Share links are
//! in `pacs_share_test`.

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

/// A patient and a filed study row for `uid`.
async fn study_row(app: &common::TestApp, uid: &str) -> Uuid {
    let tenant = admin_tenant(app).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Ravi', 'Iyer', 'male', '9000000230') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-VW-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    sqlx::query_scalar(
        "INSERT INTO radiology_dicom_studies (tenant_id, patient_id, study_instance_uid, modality) \
         VALUES ($1, $2, $3, 'CT') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(uid)
    .fetch_one(&app.db)
    .await
    .expect("study")
}

#[tokio::test]
async fn opening_and_sharing_are_refused_without_the_right_permission_or_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let study = study_row(&app, &format!("1.2.826.0.1.{}", Uuid::new_v4().as_u128())).await;

    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let view = app.url(&format!("/api/radiology/dicom-studies/{study}/view"));
    let (status, _) = send(nurse.client.post(&view), &nurse.csrf).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "not this nurse's patient");
    let (status, _) = send(
        nurse
            .client
            .post(app.url("/api/radiology/share-links"))
            .json(&json!({ "study_id": study, "recipient_name": "Dr X" })),
        &nurse.csrf,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "a nurse cannot share images");

    let share = |body: Value| {
        send(
            app.client
                .post(app.url("/api/radiology/share-links"))
                .json(&body),
            &csrf,
        )
    };
    let (status, _) =
        share(json!({ "study_id": study, "recipient_name": "Dr X", "expires_hours": 500 })).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a link lasts at most a week"
    );
    let (status, _) = share(json!({ "study_id": study, "recipient_name": " " })).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a link names who it is for"
    );

    let (status, _) = send(
        app.client
            .get(app.url("/api/radiology/pacs/dicom-web/studies")),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "no search across the PACS");
}

#[tokio::test]
async fn the_viewer_opens_one_study_through_medbrains() {
    let http = reqwest::Client::new();
    if http.get(format!("{ORTHANC}/system")).send().await.is_err() {
        return;
    }
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'radiology', 'pacs_config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = $2, deleted_at = NULL",
    )
    .bind(admin_tenant(&app).await)
    .bind(json!({ "orthanc_url": ORTHANC, "orthanc_username": "", "viewer_type": "ohif" }))
    .execute(&app.db)
    .await
    .expect("config");
    let made: Value = http
        .post(format!("{ORTHANC}/tools/create-dicom"))
        .json(&json!({ "Tags": { "PatientID": "VIEW-1", "Modality": "CT", "SOPClassUID": "1.2.840.10008.5.1.4.1.1.2" } }))
        .send()
        .await
        .expect("create")
        .json()
        .await
        .expect("json");
    let orthanc_study = made["ParentStudy"].as_str().expect("study").to_owned();
    let tags: Value = http
        .get(format!("{ORTHANC}/studies/{orthanc_study}"))
        .send()
        .await
        .expect("study")
        .json()
        .await
        .expect("json");
    let uid = tags["MainDicomTags"]["StudyInstanceUID"]
        .as_str()
        .expect("uid")
        .to_owned();
    let study = study_row(&app, &uid).await;

    // Staff: open, then the viewer's own requests.
    let (status, opened) = send(
        app.client
            .post(app.url(&format!("/api/radiology/dicom-studies/{study}/view"))),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{opened}");
    assert!(
        opened["viewer_url"]
            .as_str()
            .is_some_and(|u| u.contains(&uid))
    );
    let qido = app.url(&format!(
        "/api/radiology/pacs/dicom-web/studies?StudyInstanceUID={uid}"
    ));
    let found: Value = app
        .client
        .get(&qido)
        .send()
        .await
        .expect("qido")
        .json()
        .await
        .expect("json");
    assert_eq!(found.as_array().map(Vec::len), Some(1), "{found}");
    let page = app
        .client
        .get(app.url("/api/radiology/pacs/ohif/viewer"))
        .send()
        .await
        .expect("page");
    assert_eq!(page.status(), StatusCode::OK);
    let html = page.text().await.expect("html");
    assert!(
        html.contains("medbrains-init.js") && !html.contains("<script>"),
        "no inline script"
    );
    let config = app
        .client
        .get(app.url("/api/radiology/pacs/ohif/app-config.js"))
        .send()
        .await
        .expect("cfg");
    let config = config.text().await.expect("js");
    assert!(
        config.contains("routerBasename = '/api/radiology/pacs/ohif/'")
            && config.contains("showStudyList = false")
    );
    // No walking out of the viewer's files into the PACS's own API.
    for escape in [
        "/api/radiology/pacs/ohif/..%2Fpatients",
        "/api/radiology/pacs/ohif/%2E%2E/patients",
    ] {
        let status = app
            .client
            .get(app.url(escape))
            .send()
            .await
            .expect("escape")
            .status();
        assert_eq!(status, StatusCode::NOT_FOUND, "{escape}");
    }
    let other = app.url("/api/radiology/pacs/dicom-web/studies?StudyInstanceUID=1.2.3.4.5.6");
    assert_eq!(
        app.client.get(&other).send().await.expect("other").status(),
        StatusCode::NOT_FOUND
    );
    let viewed: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE entity_id = $1 AND action = 'radiology.study.view'",
    )
    .bind(study)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(viewed, 1, "who opened it is recorded");

    let _ = http
        .delete(format!("{ORTHANC}/studies/{orthanc_study}"))
        .send()
        .await;
}
