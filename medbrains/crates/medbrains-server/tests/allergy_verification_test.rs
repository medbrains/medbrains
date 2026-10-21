//! A wrong allergy is corrected on the chart, never erased.
//!
//! A doctor marks it entered-in-error or refuted with a reason; it stops
//! alerting (`is_active = false`) and stays listed with who, when and why.

use crate::common;

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

/// A signed-in member of staff, and their CSRF token.
async fn staff(
    app: &common::TestApp,
    admin_csrf: &str,
    role: &str,
    dept: Uuid,
) -> (Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("allergy_{tag}"), format!("Allergy#{tag}Aa9"));
    let (status, body) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Allergy {role}"),
            "role": role,
            "department_ids": [dept],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let resp = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    let login: Value = resp.json().await.expect("login json");
    (
        client,
        login["csrf_token"].as_str().unwrap_or("").to_owned(),
    )
}

/// A patient seen in the department today, with a penicillin allergy on file.
async fn patient_with_allergy(app: &common::TestApp, csrf: &str, dept: Uuid) -> (String, String) {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Penicillin', 'Label', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-AV-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let (status, visit) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": dept })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let base = format!("/api/patients/{patient}/allergies");
    let (status, created) = send(
        csrf,
        app.client
            .post(app.url(&base))
            .json(&json!({ "allergy_type": "drug", "allergen_name": "Penicillin" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let id = created["allergy"]["id"].as_str().expect("id").to_owned();
    (base, id)
}

/// Given a penicillin allergy recorded on the wrong patient, When the doctor
/// marks it entered-in-error with a reason, Then it stops alerting, stays on
/// the chart with the reason, and cannot be re-marked.
#[tokio::test]
async fn a_doctor_retires_a_wrong_allergy_and_it_stays_on_the_chart() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let dept = department(&app, "GEN-MEDICINE").await;
    let (base, id) = patient_with_allergy(&app, &csrf, dept).await;
    let (doctor, doctor_csrf) = staff(&app, &csrf, "doctor", dept).await;
    let url = app.url(&format!("{base}/{id}/verification"));

    let (status, body) = send(
        &doctor_csrf,
        doctor
            .put(&url)
            .json(&json!({ "verdict": "entered_in_error", "reason": "  " })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "a reason is required: {body}"
    );

    let (status, allergy) = send(
        &doctor_csrf,
        doctor.put(&url).json(&json!({
            "verdict": "entered_in_error",
            "reason": "Recorded on the wrong patient",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{allergy}");
    assert_eq!(
        allergy["is_active"], false,
        "a retired allergy stops alerting"
    );
    assert_eq!(allergy["verification_status"], "entered_in_error");
    assert_eq!(
        allergy["verification_reason"],
        "Recorded on the wrong patient"
    );

    let (_, list) = send(&csrf, app.client.get(app.url(&base))).await;
    let kept = list
        .as_array()
        .into_iter()
        .flatten()
        .any(|a| a["id"] == id.as_str() && a["verification_status"] == "entered_in_error");
    assert!(kept, "the corrected allergy stays on the chart");

    let (status, _) = send(
        &doctor_csrf,
        doctor
            .put(&url)
            .json(&json!({ "verdict": "confirmed", "reason": "changed my mind" })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a retired allergy is not re-marked"
    );
}

/// Given a nurse, When they try to retire an allergy, Then it is refused —
/// taking a drug-allergy label off is a doctor's decision.
#[tokio::test]
async fn a_nurse_cannot_retire_an_allergy() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let dept = department(&app, "GEN-MEDICINE").await;
    let (base, id) = patient_with_allergy(&app, &csrf, dept).await;
    let (nurse, nurse_csrf) = staff(&app, &csrf, "nurse", dept).await;

    let (status, _) = send(
        &nurse_csrf,
        nurse
            .put(app.url(&format!("{base}/{id}/verification")))
            .json(&json!({ "verdict": "refuted", "reason": "patient says not allergic" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}
