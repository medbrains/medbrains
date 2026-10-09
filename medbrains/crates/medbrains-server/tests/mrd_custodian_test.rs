//! Medical records staff open every patient's chart, and each opening is
//! logged; a clinician outside the patient's care does not. Before this,
//! the MRD officer's packet list held only patients they had treated —
//! none — while a single packet opened by id was checked for no one.

mod common;

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

async fn department(app: &common::TestApp, code: &str) -> Uuid {
    sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = $1",
    )
    .bind(code)
    .fetch_one(&app.db)
    .await
    .expect("department")
}

/// A signed-in member of staff: their id, client and CSRF token.
async fn staff(
    app: &common::TestApp,
    admin_csrf: &str,
    role: &str,
    dept: Uuid,
) -> (Uuid, Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("mrd_{tag}"), format!("Mrd#{tag}Aa9"));
    let (status, user) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Staff {tag}"),
            "role": role, "department_ids": [dept],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{user}");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let id = user["id"].as_str().expect("id").parse().expect("uuid");
    (
        id,
        client,
        login["csrf_token"].as_str().unwrap_or("").to_owned(),
    )
}

#[tokio::test]
async fn medical_records_open_every_chart_and_each_opening_is_logged() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let medicine = department(&app, "GEN-MEDICINE").await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Chart', 'Filed', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-MRD-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let (status, visit) = send(
        &csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": medicine })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let encounter = visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned();
    let (status, packet) = send(
        &csrf,
        app.client
            .post(app.url(&format!("/api/mrd/case-sheets/from-opd/{encounter}")))
            .json(&json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{packet}");
    let packet_id = packet["id"].as_str().expect("packet").to_owned();

    // An officer in no clinical department: no care relation to anyone.
    let records_dept: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, 'Medical Records ' || $1, 'administrative'::department_type \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("MRD{}", suffix.to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("records department");
    let (officer, records, _) = staff(&app, &csrf, "mrd_officer", records_dept).await;
    let listed: Value = records
        .get(app.url(&format!("/api/mrd/case-sheets?encounter_id={encounter}")))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    assert_eq!(
        listed[0]["id"],
        json!(packet_id),
        "the officer finds the packet: {listed}"
    );
    let opened = records
        .get(app.url(&format!("/api/mrd/case-sheets/{packet_id}/pages")))
        .send()
        .await
        .expect("pages");
    assert_eq!(opened.status(), StatusCode::OK);
    let logged: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM patient_record_access_log \
          WHERE patient_id = $1 AND accessed_by = $2 AND access_type = 'mrd_custodian'",
    )
    .bind(patient)
    .bind(officer)
    .fetch_one(&app.db)
    .await
    .expect("access log");
    assert!(
        logged >= 1,
        "opening the chart is on the patient's access log"
    );

    // A doctor in another department, outside this patient's care.
    let elsewhere: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, 'Elsewhere ' || $1, 'clinical'::department_type \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("ELS{}", suffix.to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("other department");
    let (_, outsider, _) = staff(&app, &csrf, "doctor", elsewhere).await;
    let refused = outsider
        .get(app.url(&format!("/api/mrd/case-sheets/{packet_id}/pages")))
        .send()
        .await
        .expect("pages");
    assert_eq!(
        refused.status(),
        StatusCode::NOT_FOUND,
        "no chart outside one's care"
    );
    let theirs: Value = outsider
        .get(app.url(&format!("/api/mrd/case-sheets?encounter_id={encounter}")))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    assert_eq!(theirs, json!([]), "and it is not on their list");
}
