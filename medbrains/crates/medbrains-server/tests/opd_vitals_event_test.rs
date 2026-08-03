mod common;

use uuid::Uuid;

/// Recording vitals must put an `opd.vitals.recorded` row on the outbox, in the
/// same transaction as the vitals row.
///
/// The event name has been declared in `ClinicalEventName` — and read by the
/// NABH indicator reports — since the enum was written, while no code emitted
/// it. Nothing downstream could react to a nurse finishing at the vitals
/// counter. This test fails if the emit is dropped again.
#[tokio::test]
async fn recording_vitals_queues_a_clinical_event() {
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

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Vitals",
            "last_name": "Event",
            "gender": "female",
            "phone": "9990003001",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");

    let created: serde_json::Value = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "patient_id": patient_id,
            "department_id": department_id,
        }))
        .send()
        .await
        .expect("encounter request")
        .json()
        .await
        .expect("encounter json");
    let encounter_id = Uuid::parse_str(
        created["encounter"]["id"]
            .as_str()
            .expect("encounter id"),
    )
    .expect("uuid");

    let vital: serde_json::Value = app
        .client
        .post(app.url(&format!("/api/opd/encounters/{encounter_id}/vitals")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "temperature": "37.2",
            "pulse": 88,
            "systolic_bp": 128,
            "diastolic_bp": 82,
            "spo2": 97,
        }))
        .send()
        .await
        .expect("vitals request")
        .json()
        .await
        .expect("vitals json");
    let vital_id = Uuid::parse_str(vital["id"].as_str().expect("vital id")).expect("uuid");

    let row: Option<(String, serde_json::Value)> = sqlx::query_as(
        "SELECT event_type, payload FROM outbox_events \
         WHERE event_type = 'opd.vitals.recorded' AND aggregate_id = $1",
    )
    .bind(vital_id)
    .fetch_optional(&app.db)
    .await
    .expect("outbox query");

    let (event_type, payload) =
        row.expect("recording vitals should queue an opd.vitals.recorded event");
    assert_eq!(event_type, "opd.vitals.recorded");

    // The envelope is stored whole, so the event carries its own routing keys.
    let event = payload
        .get("payload")
        .expect("the outbox stores the full envelope");
    assert_eq!(
        event["encounter_id"].as_str(),
        Some(encounter_id.to_string().as_str()),
        "the event must name the encounter: {payload}"
    );
    assert_eq!(
        event["patient_id"].as_str(),
        Some(patient_id.to_string().as_str()),
        "the event must name the patient: {payload}"
    );
}
