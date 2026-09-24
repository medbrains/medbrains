//! Discharge → the patient's phone and the record room.
//!
//! `PUT /api/ipd/admissions/{id}/discharge` releases the bed in its own
//! transaction, queues `ipd.discharge.completed` on the clinical outbox and
//! hands `ipd.discharge.initiated` to the job queue, whose pipeline queues a
//! WhatsApp discharge summary and an MRD file-creation request. Nothing a
//! screen shows says any of that happened; this proves the emit half over
//! the tables and the consume half by dispatching the event twice: one
//! summary, one file request.

mod common;

use serde_json::{Value, json};
use uuid::Uuid;

async fn queued_pipeline_events(app: &common::TestApp, tenant_id: Uuid, admission_id: &str) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM job_queue \
          WHERE tenant_id = $1 AND job_type = 'pipeline_event' \
            AND payload->>'event_code' = 'ipd.discharge.initiated' \
            AND payload->'payload'->>'admission_id' = $2",
    )
    .bind(tenant_id)
    .bind(admission_id)
    .fetch_one(&app.db)
    .await
    .expect("job_queue query")
}

#[tokio::test]
async fn discharge_releases_the_bed_and_queues_one_summary_and_one_mrd_request() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let beds: Vec<Value> = app
        .get(&app.client, "/api/ipd/beds/available")
        .await
        .json()
        .await
        .expect("beds");
    let bed_id = beds
        .first()
        .and_then(|b| b["bed_id"].as_str())
        .expect("a free bed")
        .to_owned();
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("depts");
    let department_id = depts[0]["id"].as_str().expect("a department").to_owned();

    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "first_name": "Linkage", "last_name": "Discharge", "gender": "female", "phone": "9990000074" }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant");

    let created: Value = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "patient_id": patient_id, "department_id": department_id, "bed_id": bed_id }),
        )
        .send()
        .await
        .expect("admit")
        .json()
        .await
        .expect("admission json");
    let admission_id = created["admission"]["id"]
        .as_str()
        .expect("admission id")
        .to_owned();

    let resp = app
        .client
        .put(app.url(&format!("/api/ipd/admissions/{admission_id}/discharge")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "discharge_type": "normal", "discharge_summary": "Recovered; review in a week." }))
        .send()
        .await
        .expect("discharge");
    assert_eq!(
        resp.status(),
        200,
        "{}",
        resp.text().await.unwrap_or_default()
    );

    // The bed went to housekeeping in the same transaction.
    let (status, held_by): (String, Option<Uuid>) = sqlx::query_as(
        "SELECT status::text, admission_id FROM bed_states WHERE tenant_id = $1 AND location_id = $2",
    )
    .bind(tenant_id)
    .bind(bed_id.parse::<Uuid>().expect("bed uuid"))
    .fetch_one(&app.db)
    .await
    .expect("bed_states query");
    assert_eq!((status.as_str(), held_by), ("vacant_dirty", None));

    // Emit half: one clinical event, one queued pipeline event.
    assert_eq!(
        app.outbox_rows("ipd.discharge.completed", &admission_id)
            .await
            .len(),
        1
    );
    assert_eq!(
        queued_pipeline_events(&app, tenant_id, &admission_id).await,
        1
    );

    // Consume half, delivered twice: still one summary and one file request.
    let payload = json!({ "admission_id": admission_id, "patient_id": patient_id, "discharge_type": "normal" });
    app.dispatch(tenant_id, "ipd.discharge.initiated", &payload)
        .await;
    app.dispatch(tenant_id, "ipd.discharge.initiated", &payload)
        .await;
    assert_eq!(
        app.outbox_rows("whatsapp.discharge_summary", &admission_id)
            .await
            .len(),
        1
    );
    assert_eq!(
        app.outbox_rows("mrd.file_creation_requested", &admission_id)
            .await
            .len(),
        1
    );
}
