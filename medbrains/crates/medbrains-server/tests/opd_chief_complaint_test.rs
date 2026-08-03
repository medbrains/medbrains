mod common;

use uuid::Uuid;

async fn register(app: &common::TestApp, csrf: &str, phone: &str) -> Uuid {
    let p: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "first_name": "Complaint",
            "last_name": "Intake",
            "gender": "male",
            "phone": phone,
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    Uuid::parse_str(p["id"].as_str().expect("patient id")).expect("patient uuid")
}

async fn open_encounter(
    app: &common::TestApp,
    csrf: &str,
    patient_id: Uuid,
    department_id: &str,
    chief_complaint: Option<&str>,
) -> serde_json::Value {
    app.client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "patient_id": patient_id,
            "department_id": department_id,
            "chief_complaint": chief_complaint,
        }))
        .send()
        .await
        .expect("encounter request")
        .json()
        .await
        .expect("encounter json")
}

/// The complaint recorded at the front desk has to survive to the doctor's
/// waiting list, otherwise the patient is asked the same question twice — the
/// whole point of capturing it at registration.
///
/// A whitespace-only complaint must land as NULL, not as an empty string that
/// renders as a blank line and reads as "already answered".
#[tokio::test]
async fn chief_complaint_is_captured_at_registration_and_reaches_the_queue() {
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

    let patient_id = register(&app, &csrf, "9990002001").await;
    let created = open_encounter(
        &app,
        &csrf,
        patient_id,
        &department_id,
        Some("  Fever and body ache for three days  "),
    )
    .await;
    assert_eq!(
        created["encounter"]["chief_complaint"].as_str(),
        Some("Fever and body ache for three days"),
        "the complaint should be stored trimmed: {created}"
    );

    let queue: serde_json::Value = app
        .get(&app.client, "/api/opd/queue")
        .await
        .json()
        .await
        .expect("queue json");
    let entry = queue
        .as_array()
        .expect("queue array")
        .iter()
        .find(|row| row["patient_id"].as_str() == Some(&patient_id.to_string()))
        .expect("the patient we just queued");
    assert_eq!(
        entry["chief_complaint"].as_str(),
        Some("Fever and body ache for three days"),
        "the waiting list should say why the patient is here: {entry}"
    );

    // Whitespace only — stored as NULL so the screen says "not recorded".
    let blank_patient = register(&app, &csrf, "9990002002").await;
    let blank = open_encounter(&app, &csrf, blank_patient, &department_id, Some("   ")).await;
    assert!(
        blank["encounter"]["chief_complaint"].is_null(),
        "a whitespace-only complaint must be stored as NULL: {blank}"
    );
}
