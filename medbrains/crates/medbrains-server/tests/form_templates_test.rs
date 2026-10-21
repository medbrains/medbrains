//! Hospital-built forms (#220): a draft is edited freely, a published
//! version never changes, staff fill in the live version, and a consent
//! keeps the version it was answered on.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn call(
    app: &common::TestApp,
    csrf: &str,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut req = app
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf);
    if let Some(body) = body {
        req = req.json(&body);
    }
    let resp = req.send().await.expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn question(key: &str, kind: &str, required: bool, options: &[&str]) -> Value {
    json!({ "key": key, "label": key.replace('_', " "), "kind": kind,
            "required": required, "options": options })
}

#[tokio::test]
async fn a_published_version_is_fixed_and_staff_fill_in_the_live_one() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let code = format!("t{}", &Uuid::new_v4().simple().to_string()[..12]);
    let (status, created) = call(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/forms/templates",
        Some(json!({ "code": code, "name": "Fall risk", "module": "nursing" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let id = created["id"].as_str().expect("id").to_owned();

    let (status, _) = call(
        &app,
        &csrf,
        reqwest::Method::POST,
        &format!("/api/forms/templates/{id}/publish"),
        None,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "an empty form is not published"
    );

    let dup = json!({ "name": "Fall risk", "draft": { "sections": [{ "title": "Risk",
        "fields": [question("score", "number", true, &[]), question("score", "text", false, &[])] }] } });
    let (status, body) = call(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &format!("/api/forms/templates/{id}"),
        Some(dup),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body.to_string().contains("share the key"), "{body}");

    let v1 = json!({ "name": "Fall risk", "draft": { "sections": [{ "title": "Risk",
        "fields": [question("score", "number", true, &[])] }] } });
    call(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &format!("/api/forms/templates/{id}"),
        Some(v1),
    )
    .await;
    let (status, first) = call(
        &app,
        &csrf,
        reqwest::Method::POST,
        &format!("/api/forms/templates/{id}/publish"),
        None,
    )
    .await;
    assert_eq!(
        (status, first["version"].as_i64()),
        (StatusCode::OK, Some(1))
    );

    let v2 = json!({ "name": "Fall risk", "draft": { "sections": [{ "title": "Risk",
        "fields": [question("score", "number", true, &[]), question("side", "radio", false, &["Left", "Right"])] }] } });
    call(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &format!("/api/forms/templates/{id}"),
        Some(v2),
    )
    .await;
    let (_, second) = call(
        &app,
        &csrf,
        reqwest::Method::POST,
        &format!("/api/forms/templates/{id}/publish"),
        None,
    )
    .await;
    assert_eq!(second["version"].as_i64(), Some(2));

    let (status, live) = call(
        &app,
        &csrf,
        reqwest::Method::GET,
        &format!("/api/forms/live/{code}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(live["version"].as_i64(), Some(2));
    assert_eq!(
        live["definition"]["sections"][0]["fields"]
            .as_array()
            .map(Vec::len),
        Some(2)
    );

    let rewrite = sqlx::query("UPDATE form_template_versions SET definition = '{}' WHERE id = $1")
        .bind(
            first["id"]
                .as_str()
                .expect("v1 id")
                .parse::<Uuid>()
                .expect("uuid"),
        )
        .execute(&app.db)
        .await;
    assert!(rewrite.is_err(), "a published version can't be rewritten");
}

async fn consent_patient(app: &common::TestApp) -> Uuid {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Consent', 'Form', 'male', '9000000220') RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-F-{}",
        &Uuid::new_v4().simple().to_string()[..10]
    ))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

#[tokio::test]
async fn a_consent_is_checked_against_its_form_and_keeps_the_questions() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let patient = consent_patient(&app).await;
    let consent = |answers: Value| {
        json!({
            "patient_id": patient, "procedure_name": "Excision biopsy", "consent_type": "procedure",
            "answers": answers,
        })
    };

    let (status, body) = call(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/opd/consents",
        Some(consent(json!({ "doctor_id": "x" }))),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    let (status, row) = call(&app, &csrf, reqwest::Method::POST, "/api/opd/consents",
        Some(consent(json!({ "risks_explained": "Bleeding, infection", "witness_name": "Staff Nurse Meena" })))).await;
    assert_eq!(status, StatusCode::OK, "{row}");
    assert_eq!(
        row["risks_explained"],
        json!("Bleeding, infection"),
        "answers fill the record's columns"
    );
    assert_eq!(row["witness_name"], json!("Staff Nurse Meena"));
    assert!(
        row["form_version_id"].is_null(),
        "taken on the built-in form"
    );
    assert!(
        row["body"]["definition"]["sections"].is_array(),
        "the built-in questions are kept with it"
    );
}
