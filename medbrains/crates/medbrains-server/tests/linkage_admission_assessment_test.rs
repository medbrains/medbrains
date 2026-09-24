//! Admission → nursing — the table-only half of the linkage.
//!
//! The pipeline that raises the 24-hour initial assessment reads
//! nurse_shift_assignments and writes nursing_tasks. The Playwright spec
//! proves what the API shows on a rostered ward; this proves the two things
//! it cannot: delivering the event twice yields one task, and an event with
//! no ward yields none — rather than an unassigned task on nobody's list.
//!
//! The roster row is written by SQL here. The pipeline reads only that table;
//! the user's role is irrelevant to it, and this database has no active
//! nurse account to roster.

mod common;

use serde_json::{Value, json};
use uuid::Uuid;

async fn assessment_tasks(app: &common::TestApp, admission_id: Uuid) -> Vec<Option<Uuid>> {
    sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT assigned_to FROM nursing_tasks \
          WHERE admission_id = $1 AND task_type = 'initial_assessment' AND deleted_at IS NULL",
    )
    .bind(admission_id)
    .fetch_all(&app.db)
    .await
    .expect("nursing_tasks query")
}

#[tokio::test]
async fn admission_on_a_rostered_ward_raises_one_assessment_and_none_without_a_ward() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let beds: Vec<Value> = app
        .get(&app.client, "/api/ipd/beds/available")
        .await
        .json()
        .await
        .expect("beds json");
    let bed = beds
        .iter()
        .find(|b| b["ward_id"].is_string())
        .expect("an available bed with a ward — the seed has 28");
    let bed_id = bed["bed_id"].as_str().expect("bed id").to_owned();
    let ward_id: Uuid = bed["ward_id"].as_str().and_then(|s| s.parse().ok()).expect("ward id");

    let depts: Value = app.get(&app.client, "/api/setup/departments").await.json().await.expect("depts");
    let department_id = depts
        .as_array()
        .and_then(|a| a.first())
        .and_then(|d| d["id"].as_str())
        .expect("a department")
        .to_owned();

    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "first_name": "Linkage",
            "last_name": "Assessment",
            "gender": "male",
            "phone": "9990000072",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let tenant_id: Uuid = patient["tenant_id"].as_str().and_then(|s| s.parse().ok()).expect("tenant");

    // Roster somebody as charge nurse on the bed's ward for today.
    let nurse_user_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND is_active = true ORDER BY created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_one(&app.db)
    .await
    .expect("an active user to roster");
    sqlx::query(
        "INSERT INTO nurse_shift_assignments \
           (tenant_id, nurse_user_id, ward_id, shift_date, shift_type, patient_ids, \
            primary_assigned, charge_nurse_user_id) \
         VALUES ($1, $2, $3, CURRENT_DATE, 'day', ARRAY[]::uuid[], true, $2) \
         ON CONFLICT (tenant_id, nurse_user_id, ward_id, shift_date, shift_type) \
           WHERE deleted_at IS NULL DO NOTHING",
    )
    .bind(tenant_id)
    .bind(nurse_user_id)
    .bind(ward_id)
    .execute(&app.db)
    .await
    .expect("roster row");

    // Admit to that bed: the handler emits ipd.admission.created with the ward.
    let admitted: Value = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "patient_id": patient_id,
            "department_id": department_id,
            "bed_id": bed_id,
            "admission_source": "opd",
        }))
        .send()
        .await
        .expect("admit")
        .json()
        .await
        .expect("admission json");
    let admission_id: Uuid = admitted["admission"]["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("admission id");
    let id_str = admission_id.to_string();

    let emitted = app.outbox_rows("ipd.admission.created", &id_str).await;
    assert_eq!(emitted.len(), 1, "create_admission must queue exactly one event");
    // The outbox stores the whole envelope; the domain payload is nested. The
    // dispatcher unwraps it — this test hands over the envelope exactly as
    // the worker would, so that unwrapping is under test too.
    let envelope = &emitted[0];
    assert_eq!(
        envelope["payload"]["ward_id"].as_str().and_then(|s| s.parse::<Uuid>().ok()),
        Some(ward_id),
        "the event must carry the bed's ward, or the pipeline has nothing to roster against"
    );

    // Consume twice: one task, assigned to the rostered nurse.
    app.dispatch(tenant_id, "ipd.admission.created", envelope).await;
    app.dispatch(tenant_id, "ipd.admission.created", envelope).await;
    let tasks = assessment_tasks(&app, admission_id).await;
    assert_eq!(tasks, vec![Some(nurse_user_id)], "exactly one assessment, assigned, after two deliveries");

    // No ward in the payload: nothing is written. An unassigned task would sit
    // on nobody's list and make the register look attended to.
    let wardless = json!({ "admission_id": admission_id, "patient_id": patient_id });
    app.dispatch(tenant_id, "ipd.admission.created", &wardless).await;
    assert_eq!(assessment_tasks(&app, admission_id).await.len(), 1);

    // Leave the shift as we found it.
    sqlx::query(
        "UPDATE nurse_shift_assignments SET deleted_at = now() \
          WHERE tenant_id = $1 AND nurse_user_id = $2 AND ward_id = $3 \
            AND shift_date = CURRENT_DATE AND shift_type = 'day' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(nurse_user_id)
    .bind(ward_id)
    .execute(&app.db)
    .await
    .expect("unroster");
}
