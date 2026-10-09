//! A doctor's follow-up reminders list: what was set for a patient comes
//! back. The list bound the permitted-patient set to a single-uuid filter
//! and answered 500 to every call, so reminders were made and never seen.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_reminder_set_for_a_patient_is_listed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Remind', 'Me', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-RM-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");

    let created = app
        .client
        .post(app.url("/api/opd/reminders"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": patient, "reminder_type": "follow_up",
                       "reminder_date": "2026-12-01", "title": "Review HbA1c" }))
        .send()
        .await
        .expect("create");
    let status = created.status();
    assert_eq!(status, StatusCode::OK, "{}", created.text().await.unwrap_or_default());

    for query in [format!("?patient_id={patient}"), String::new()] {
        let resp = app
            .client
            .get(app.url(&format!("/api/opd/reminders{query}")))
            .send()
            .await
            .expect("list");
        assert_eq!(resp.status(), StatusCode::OK, "list{query}");
        let rows: Value = resp.json().await.expect("json");
        assert!(
            rows.as_array()
                .expect("rows")
                .iter()
                .any(|r| r["patient_id"] == json!(patient)),
            "the reminder is listed{query}"
        );
    }
}
