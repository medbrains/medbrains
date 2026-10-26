//! The PACS settings and imaging reads keep patients' images where they
//! belong: a study is shown only to someone who may see its patient (404
//! otherwise, never another hospital's), the PACS password is write-only and
//! bound to its address, and an address off the hospital network is refused.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

struct Study {
    tenant: Uuid,
    patient: Uuid,
    id: Uuid,
}

async fn insert_study(app: &common::TestApp, tenant: Uuid) -> Study {
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Meena', 'Rao', 'female', '9000000227') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-PS-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_dicom_studies (tenant_id, patient_id, study_instance_uid, modality) \
         VALUES ($1, $2, $3, 'CT') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(format!("1.2.826.0.1.{}", Uuid::new_v4().as_u128()))
    .fetch_one(&app.db)
    .await
    .expect("study");
    Study {
        tenant,
        patient,
        id,
    }
}

async fn admin_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

async fn get(client: &reqwest::Client, url: String) -> (StatusCode, Value) {
    let resp = client.get(url).send().await.expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn listed(list: &Value, study: Uuid) -> bool {
    list.as_array()
        .is_some_and(|rows| rows.iter().any(|r| r["id"] == json!(study)))
}

#[tokio::test]
async fn a_study_is_shown_only_to_someone_who_may_see_its_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let study = insert_study(&app, admin_tenant(&app).await).await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;

    let by_patient = app.url(&format!(
        "/api/radiology/dicom-studies?patient_id={}",
        study.patient
    ));
    let download = app.url(&format!("/api/radiology/download-package/{}", study.id));

    // The nurse holds radiology.orders.list but has no link to this patient.
    assert_eq!(
        get(&nurse.client, by_patient.clone()).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get(&nurse.client, download.clone()).await.0,
        StatusCode::NOT_FOUND
    );
    let (status, all) = get(&nurse.client, app.url("/api/radiology/dicom-studies")).await;
    assert_eq!(status, StatusCode::OK, "{all}");
    assert!(!listed(&all, study.id), "not in the unfiltered list either");

    // Someone who may see the patient gets the study.
    let (status, list) = get(&app.client, by_patient).await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert!(listed(&list, study.id), "{list}");
    assert_eq!(get(&app.client, download).await.0, StatusCode::OK);
}

#[tokio::test]
async fn another_hospitals_study_does_not_exist_here() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let (other, _, _) = own_hospital(&app).await;
    let theirs = insert_study(&app, other).await;
    assert_ne!(theirs.tenant, admin_tenant(&app).await);

    let download = app.url(&format!("/api/radiology/download-package/{}", theirs.id));
    assert_eq!(get(&app.client, download).await.0, StatusCode::NOT_FOUND);
    let (_, list) = get(
        &app.client,
        app.url(&format!(
            "/api/radiology/dicom-studies?patient_id={}",
            theirs.patient
        )),
    )
    .await;
    assert!(!listed(&list, theirs.id), "{list}");
}

/// A hospital of the test's own, and its signed-in administrator — so no
/// other test's PACS settings are touched.
async fn own_hospital(app: &common::TestApp) -> (Uuid, reqwest::Client, String) {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let code = format!("PX{suffix}");
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'PACS Check Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("hospital");
    let username = format!("pxadmin_{}", suffix.to_lowercase());
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
         SELECT $1, $2, $2 || '@pacs-check.example.org', 'PACS Admin', 'hospital_admin', password_hash \
           FROM users WHERE username = 'admin'",
    )
    .bind(tenant)
    .bind(&username)
    .execute(&app.db)
    .await
    .expect("admin");
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": "admin123", "hospital_code": code }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    (tenant, client, csrf)
}

async fn put_config(
    app: &common::TestApp,
    (client, csrf): (&reqwest::Client, &str),
    body: Value,
) -> (StatusCode, Value) {
    let resp = client
        .put(app.url("/api/radiology/pacs-config"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("put");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn the_pacs_password_is_write_only_and_bound_to_its_address() {
    let app = common::spawn_app().await;
    let (tenant, client, csrf) = own_hospital(&app).await;
    let admin = (&client, csrf.as_str());

    // Off the hospital network: refused, nothing stored.
    let (status, body) = put_config(&app, admin, json!({
        "orthanc_url": "http://8.8.8.8:8042", "orthanc_username": "medbrains", "orthanc_password": "s3cret",
    }))
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    let lan = json!({
        "orthanc_url": "http://10.20.30.40:8042", "orthanc_username": "medbrains", "orthanc_password": "s3cret",
    });
    let (status, saved) = put_config(&app, admin, lan).await;
    assert_eq!(status, StatusCode::OK, "{saved}");
    let (_, read) = get(&client, app.url("/api/radiology/pacs-config")).await;
    for view in [&saved, &read] {
        assert_eq!(view["password_set"], true, "{view}");
        let text = view.to_string();
        assert!(
            !text.contains("s3cret") && !text.contains("sealed"),
            "{text}"
        );
    }
    let stored: Value = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'radiology' AND key = 'pacs_config'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("stored");
    assert!(!stored.to_string().contains("s3cret"), "sealed at rest");

    // Same address, no password: the saved one is kept.
    let (status, kept) = put_config(
        &app,
        admin,
        json!({
            "orthanc_url": "http://10.20.30.40:8042/", "orthanc_username": "medbrains",
        }),
    )
    .await;
    assert_eq!(
        (status, &kept["password_set"]),
        (StatusCode::OK, &json!(true)),
        "{kept}"
    );

    // A new address without the password is refused: the old one must not follow it.
    let (status, body) = put_config(
        &app,
        admin,
        json!({
            "orthanc_url": "http://10.20.30.99:8042", "orthanc_username": "medbrains",
        }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    // Moving the address behind the API's back leaves the password locked.
    sqlx::query(
        "UPDATE tenant_settings SET value = jsonb_set(value, '{orthanc_url}', '\"http://10.20.30.99:8042\"') \
          WHERE tenant_id = $1 AND category = 'radiology' AND key = 'pacs_config'",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("move");
    let moved = medbrains_outbox::handlers::pacs_target::load_target(
        &app.db,
        tenant,
        &medbrains_core::secrets::EnvSecretResolver::new(),
        &medbrains_outbox::handlers::pacs_target::Policy::default(),
    )
    .await;
    assert!(
        moved.is_err(),
        "the old password is unusable at the new address"
    );

    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 AND action = 'radiology.pacs_config.update' \
           AND new_values::text NOT LIKE '%s3cret%' AND created_at > now() - interval '5 minutes'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert!(audited >= 2, "every change is audited, without the secret");
}
