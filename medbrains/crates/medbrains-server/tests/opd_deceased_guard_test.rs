mod common;

use reqwest::StatusCode;
use uuid::Uuid;

/// Register a patient, returning (patient_id, tenant_id).
async fn register(app: &common::TestApp, csrf: &str, phone: &str) -> (Uuid, Uuid) {
    let p: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "first_name": "Deceased",
            "last_name": "Guard",
            "gender": "female",
            "phone": phone,
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let id = Uuid::parse_str(p["id"].as_str().expect("patient id")).expect("patient uuid");
    let tenant = Uuid::parse_str(p["tenant_id"].as_str().expect("tenant_id")).expect("tenant uuid");
    (id, tenant)
}

async fn open_encounter(
    app: &common::TestApp,
    csrf: &str,
    patient_id: Uuid,
    department_id: &str,
) -> reqwest::Response {
    app.client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "patient_id": patient_id,
            "department_id": department_id,
        }))
        .send()
        .await
        .expect("encounter request")
}

/// The deceased-patient front-door guard (#4464): a patient recorded as
/// deceased must not start a new OPD visit (data-integrity / medico-legal),
/// while a living patient's encounter opens normally.
#[tokio::test]
async fn deceased_patient_cannot_start_opd_encounter() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let depts: serde_json::Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("departments json");
    let department_id = depts
        .as_array()
        .and_then(|a| a.first())
        .and_then(|d| d.get("id"))
        .and_then(serde_json::Value::as_str)
        .expect("a seeded department")
        .to_owned();

    // Living patient: the encounter opens.
    let (alive_id, _) = register(&app, &csrf, "9990001001").await;
    let ok = open_encounter(&app, &csrf, alive_id, &department_id).await;
    assert!(
        ok.status().is_success(),
        "a living patient's OPD encounter should open, got {}",
        ok.status()
    );

    // Deceased patient: the encounter is refused 409.
    let (dead_id, tenant) = register(&app, &csrf, "9990001002").await;
    app.mark_patient_deceased(dead_id, tenant).await;
    let blocked = open_encounter(&app, &csrf, dead_id, &department_id).await;
    assert_eq!(
        blocked.status(),
        StatusCode::CONFLICT,
        "a deceased patient must not start a new OPD visit"
    );
    let body: serde_json::Value = blocked.json().await.expect("conflict json");
    let msg = serde_json::to_string(&body).unwrap_or_default().to_lowercase();
    assert!(msg.contains("deceased"), "the 409 body should mention deceased: {body}");
}
