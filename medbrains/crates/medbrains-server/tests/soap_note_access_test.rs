//! A hospital that restricts a doctor's access to the consultation
//! (`opd.soap_note` in the user's field access) keeps it restricted on the
//! case sheet: the doctor is not offered and cannot start a consultation,
//! reads a colleague's as withheld rather than blank, and cannot export a
//! sheet with it missing. Other doctors are unaffected.

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

/// A signed-in doctor in General Medicine: their id, client and CSRF token.
async fn doctor(app: &common::TestApp, admin_csrf: &str) -> (Uuid, Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("soap_{tag}"), format!("Soap#{tag}Aa9"));
    let dept: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, user) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Dr {tag}"),
            "role": "doctor", "department_ids": [dept],
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
    (
        user["id"].as_str().expect("id").parse().expect("uuid"),
        client,
        login["csrf_token"].as_str().unwrap_or("").to_owned(),
    )
}

/// An OPD visit to General Medicine, opened by the admin.
async fn visit(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Soap', 'Access', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-SA-{suffix}"))
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
    let (status, body) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": department })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["encounter"]["id"].as_str().expect("id").to_owned()
}

#[tokio::test]
async fn a_restricted_doctor_neither_writes_nor_reads_the_consultation() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = visit(&app, &csrf).await;
    let (_, writer, writer_csrf) = doctor(&app, &csrf).await;
    let (restricted, reader, reader_csrf) = doctor(&app, &csrf).await;
    sqlx::query(
        "UPDATE users SET access_matrix = jsonb_set(COALESCE(access_matrix, '{}'), \
           '{field_access}', '{\"opd.soap_note\": \"view\"}') WHERE id = $1",
    )
    .bind(restricted)
    .execute(&app.db)
    .await
    .expect("restrict");

    let (status, note) = send(
        &writer_csrf,
        writer
            .post(app.url(&format!("/api/encounters/{encounter}/clinical-notes")))
            .json(&json!({ "note_type_code": "consultation", "sections": [
                { "code": "subjective", "text": "Cough for a week" } ] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{note}");
    let note_id = note["id"].as_str().expect("note id");
    let (status, signed) = send(
        &writer_csrf,
        writer
            .post(app.url(&format!("/api/clinical-notes/{note_id}/sign")))
            .json(&json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{signed}");

    let (_, types) = send(
        &reader_csrf,
        reader.get(app.url(&format!(
            "/api/clinical-notes/types?encounter_id={encounter}"
        ))),
    )
    .await;
    let codes: Vec<&str> = types
        .as_array()
        .expect("types")
        .iter()
        .filter_map(|t| t["code"].as_str())
        .collect();
    assert!(!codes.contains(&"consultation"), "not offered: {codes:?}");

    let (status, _) = send(
        &reader_csrf,
        reader
            .post(app.url(&format!("/api/encounters/{encounter}/clinical-notes")))
            .json(&json!({ "note_type_code": "consultation" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "and refused if asked");

    let (_, sheet) = send(
        &reader_csrf,
        reader.get(app.url(&format!("/api/encounters/{encounter}/clinical-notes"))),
    )
    .await;
    let seen = sheet
        .as_array()
        .expect("notes")
        .iter()
        .find(|n| n["id"] == json!(note_id))
        .expect("the note is on the sheet");
    assert_eq!(seen["withheld"], json!(true), "marked withheld: {seen}");
    assert_eq!(seen["sections"], json!([]), "with nothing of it sent");

    let (_, own_sheet) = send(
        &writer_csrf,
        writer.get(app.url(&format!("/api/encounters/{encounter}/clinical-notes"))),
    )
    .await;
    assert!(
        own_sheet.to_string().contains("Cough for a week"),
        "the writer still reads it"
    );

    let (status, _) = send(
        &reader_csrf,
        reader.get(app.url(&format!("/api/fhir/Composition?encounter={encounter}"))),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "no export with it missing");
}
