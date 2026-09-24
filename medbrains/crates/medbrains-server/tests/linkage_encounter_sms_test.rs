//! OPD → patient's phone — the appointment confirmation is an outbox row.
//!
//! The SMS handler dead-letters any row without an E.164 `to` and a body.
//! The pipeline therefore looks the patient's phone up itself, dials a bare
//! Indian mobile as +91…, and queues nothing at all for a patient it cannot
//! reach — a warning in the log rather than a dead letter in the queue.

mod common;

use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn encounter_created_queues_one_confirmation_to_a_dialable_phone_or_none() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "first_name": "Linkage", "last_name": "Sms", "gender": "female", "phone": "9990000078" }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id: Uuid = patient["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("patient id");
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant");
    let encounter_id = Uuid::new_v4();
    let event = json!({ "encounter_id": encounter_id, "patient_id": patient_id });

    app.dispatch(tenant_id, "opd.encounter.created", &event)
        .await;
    app.dispatch(tenant_id, "opd.encounter.created", &event)
        .await;
    let rows = app
        .outbox_rows("sms.appointment_confirmation", &encounter_id.to_string())
        .await;
    assert_eq!(rows.len(), 1, "delivered twice, queued once");
    assert_eq!(rows[0]["to"], json!("+919990000078"));
    assert!(
        rows[0]["body"]
            .as_str()
            .is_some_and(|b| b.contains("confirmed"))
    );

    // A phone that cannot be dialled queues nothing rather than a dead letter.
    sqlx::query("UPDATE patients SET phone = '12345' WHERE id = $1")
        .bind(patient_id)
        .execute(&app.db)
        .await
        .expect("bad phone");
    let other = Uuid::new_v4();
    app.dispatch(
        tenant_id,
        "opd.encounter.created",
        &json!({ "encounter_id": other, "patient_id": patient_id }),
    )
    .await;
    assert!(
        app.outbox_rows("sms.appointment_confirmation", &other.to_string())
            .await
            .is_empty()
    );
}
